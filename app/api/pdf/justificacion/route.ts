import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import { Readable } from "node:stream";
import {
  PlantillaJustificacionServicios,
  type JustificacionData,
} from "@/components/plantillas/PlantillaJustificacionServicios";
import {
  PlantillaNombramientoDeterminado,
  type JustificacionNombramientoData,
} from "@/components/plantillas/PlantillaNombramientoDeterminado";
import { efirmaClient } from "@/lib/efirma-client";
import { agregarConstanciaFirma, type FirmaPortal } from "@/lib/pdf-firma-estampado";
import React from "react";

/* ── Helper: drena un Node Readable a Buffer (necesario para post-procesar
 *  el PDF con pdf-lib cuando se estampa la constancia eFirma). ── */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/* ── Helper: Convierte un string separado por comas O saltos de línea en array ── */
function splitToArray(str: string | null | undefined): string[] {
  if (!str || str.trim() === "") return [];
  // Los datos reales vienen separados por comas: "VALOR1, VALOR2, VALOR3"
  // También soporta saltos de línea por si cambia el formato en el futuro
  return str
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/* ── Helper: Limpia y formatea cadenas con guiones bajos ── */
function formatString(str: string | null | undefined): string {
  if (!str) return "";
  const spaced = str.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ── Helper: arma un sello digital ficticio para modo bypass ── */
function selloFalso(prefix: string, length = 344): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = prefix;
  while (out.length < length) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out.slice(0, length - 2) + "==";
}

/* ── Helper: construye una firma ficticia a partir de un firmante local (modo bypass) ── */
function buildFirmaFicticia(firmante: any, uuid?: string | null): FirmaPortal {
  const nombre = firmante?.nombre || "JUAN PÉREZ GARCÍA";
  const rfc = firmante?.rfc || "PEGJ800101AB1";
  const cargo = firmante?.cargo_firmante || firmante?.cargo || "Servidor Público";
  const rol = firmante?.rol || "Firmante";
  const fechaFirma = firmante?.fecha_firma || new Date().toISOString();
  const portalUrl = process.env.EFIRMA_PORTAL_URL || "https://firma-dev.morelos.gob.mx";
  const fakeUuid = uuid || "00000000-0000-0000-0000-000000000000";
  return {
    usuario: rfc,
    rolFirmante: `${rol} — ${cargo}`,
    responsable: nombre,
    selloDigital: selloFalso("DEMO"),
    estampadoTiempo: typeof fechaFirma === "string" ? fechaFirma.replace("T", " ").slice(0, 19) : new Date(fechaFirma).toISOString().replace("T", " ").slice(0, 19),
    selloEstampadoTiempo: selloFalso("GEM"),
    noCertificado: "00001000000700000001",
    noCertificadoGEM: "00001000000709040175",
    rfcGEM: "GEM720601TW9",
    urlValidacion: `${portalUrl.replace(/\/$/, "")}/ValidacionFirma?uuid=${fakeUuid}`,
    firmadoEn: fechaFirma,
  };
}

/* ── POST /api/pdf/justificacion ── */

// Firma names interface
interface FirmaNames {
  firmaElaboroNombre?: string;
  firmaRevisoNombre?: string;
  firmaVoBoJuridicoNombre?: string;
  firmaDictRevisoNombre?: string;
  firmaDictVerificoNombre?: string;
  firmaDictEmitioNombre?: string;
  firmaElaboroCargo?: string;
  firmaRevisoCargo?: string;
  firmaVoBoJuridicoCargo?: string;
  firmaDictRevisoCargo?: string;
  firmaDictVerificoCargo?: string;
  firmaDictEmitioCargo?: string;
  formato?: 'fisico' | 'en_linea';
}

/**
 * Resuelve el nombre y cargo capturado de cada firmante registrado en
 * `firma_firmante` y mapea por (rol + bandeja) a los slots del template.
 *
 * Mapeo plantilla PRESTACION_SERVICIOS / NOMBRAMIENTO:
 *   - Vo. Bo. (externo, nombramiento)         → firmaVoBoJuridicoNombre
 *   - Elaboró (externo)                       → firmaElaboroNombre
 *   - Revisó / bandeja=uefa (interno)         → firmaRevisoNombre
 *   - Revisó / bandeja=revision (interno)     → firmaDictRevisoNombre
 *   - Verificó / bandeja=validacion (interno) → firmaDictVerificoNombre
 *   - Emitió / bandeja=emision (interno)      → firmaDictEmitioNombre
 */
async function resolverNombresFirmantes(
  solicitudId: number,
  base: FirmaNames,
): Promise<FirmaNames> {
  const proceso = await prisma.firma_proceso.findUnique({
    where: { solicitud_id: solicitudId },
    include: {
      firmantes: {
        include: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!proceso) return base;

  const out: FirmaNames = { ...base };

  const resolverNombre = (f: any): string => {
    return (
      (f.tipo === "interno" ? f.usuario?.nombre : null) ||
      f.nombre ||
      ""
    );
  };
  const resolverCargo = (f: any): string => {
    return (f.cargo_firmante || "").trim();
  };

  for (const f of proceso.firmantes as any[]) {
    const nombre = resolverNombre(f);
    const cargo = resolverCargo(f);
    if (!nombre && !cargo) continue;
    const rol = (f.rol || "").toLowerCase();
    const bandeja = (f.bandeja || "").toLowerCase();

    if (rol.includes("vo. bo") || rol.includes("vo.bo") || rol.includes("vobo")) {
      if (!out.firmaVoBoJuridicoNombre) out.firmaVoBoJuridicoNombre = nombre;
      if (!out.firmaVoBoJuridicoCargo && cargo) out.firmaVoBoJuridicoCargo = cargo;
      continue;
    }
    if (rol.includes("elaboró") || rol.includes("elaboro")) {
      if (!out.firmaElaboroNombre) out.firmaElaboroNombre = nombre;
      if (!out.firmaElaboroCargo && cargo) out.firmaElaboroCargo = cargo;
      continue;
    }
    if (rol.includes("revisó") || rol.includes("reviso")) {
      if (bandeja === "uefa") {
        if (!out.firmaRevisoNombre) out.firmaRevisoNombre = nombre;
        if (!out.firmaRevisoCargo && cargo) out.firmaRevisoCargo = cargo;
      } else if (bandeja === "revision") {
        if (!out.firmaDictRevisoNombre) out.firmaDictRevisoNombre = nombre;
        if (!out.firmaDictRevisoCargo && cargo) out.firmaDictRevisoCargo = cargo;
      }
      continue;
    }
    if (rol.includes("verificó") || rol.includes("verifico")) {
      if (!out.firmaDictVerificoNombre) out.firmaDictVerificoNombre = nombre;
      if (!out.firmaDictVerificoCargo && cargo) out.firmaDictVerificoCargo = cargo;
      continue;
    }
    if (rol.includes("emitió") || rol.includes("emitio")) {
      if (!out.firmaDictEmitioNombre) out.firmaDictEmitioNombre = nombre;
      if (!out.firmaDictEmitioCargo && cargo) out.firmaDictEmitioCargo = cargo;
      continue;
    }
  }
  return out;
}

// Reutilizable wrapper para ambos métodos (GET y POST)
async function generatePDFResponse(solicitudId: string | null, firmasInput: FirmaNames = {}) {
  let firmas: FirmaNames = { ...firmasInput };
  try {
    if (!solicitudId) {
      return NextResponse.json(
        { ok: false, error: "Falta solicitudId" },
        { status: 400 }
      );
    }

    // Fetch TODOS los campos de la solicitud directamente de Prisma
    const sol = await prisma.solicitud.findUnique({
      where: { id: Number(solicitudId) },
      include: { dictamen: true },
    });

    const fechaDict =
      sol?.dictamen?.fecha_emision ?? (sol as any)?.fecha_emision ?? null;
    const fechaDictaminacion = fechaDict
      ? new Date(fechaDict).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "";

    if (!sol) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    // Auto-completa nombres de firmantes desde firma_firmante (no sobrescribe
    // los que vinieron explícitamente en el body).
    firmas = await resolverNombresFirmantes(Number(solicitudId), firmas);

    let pdfElement: React.ReactElement;

    if (sol.tipo_solicitud === "nombramiento" || (sol.regimen && sol.regimen.toLowerCase().includes("nombramiento"))) {
      const dataNombramiento: JustificacionNombramientoData = {
        tipoAdministracion: (sol as any).tipo_administracion || 'centralizada',
        formato: firmas.formato || 'fisico',
        oficioSolicitud: "",
        secretaria: sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable: sol.unidad_responsable ?? "",
        programaProyecto: sol.programa_proyecto ?? "",
        denominacionNombramiento: formatString(sol.denominacion),
        tipoActividad: formatString(sol.tipo_actividades),
        puestoJefeInmediato: formatString(sol.puesto_jefe_inmediato),
        numeroPersonas: sol.numero_prestadores ?? 1,
        importeNetoMensual: sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
          : "",
        tipoPago: (sol.tipo_importe ?? "").replace(/_/g, " "),
        equivalenciaNivel: `${sol.nivel_tabulador ?? ""} - ${sol.categoria_tabulador ?? ""}`.trim() === "-" ? "" : `${sol.nivel_tabulador ?? ""} ${sol.categoria_tabulador ?? ""}`,
        vigenciaInicio: sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : "",
        vigenciaTermino: sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : "",
        clavePresupuestal: "",
        renovacion: sol.es_renovacion ?? false,
        folioAnterior: sol.folio_anterior ?? "",

        objetoNombramiento: sol.objeto ?? "",
        funcionesPrincipales: sol.actividades ?? [],
        responsabilidades: sol.responsabilidades ?? [],
        marcoNormativo: sol.marco_normativo ?? [],

        condiciones: {
          cambioDomicilio: sol.condicion_cambio_domicilio ?? false,
          horario: sol.condicion_horario ?? false,
          viajar: sol.condicion_viajar ?? false,
        },
        riesgos: {
          caidas: (sol.riesgo_caidas as "Bajo" | "Medio" | "Alto" | "") || "",
          mutilaciones: (sol.riesgo_mutilaciones as "Bajo" | "Medio" | "Alto" | "") || "",
          golpes: (sol.riesgo_golpes as "Bajo" | "Medio" | "Alto" | "") || "",
          otros: (sol.riesgo_otros as "Bajo" | "Medio" | "Alto" | "") || "",
        },
        resguardoActivos: sol.resguardo_activos === "si",

        perfil: {
          escolaridadMinima: splitToArray(sol.escolaridad),
          competenciasAdministrativas: splitToArray(sol.comp_adm),
          competenciasTecnicas: splitToArray(sol.comp_tec),
          competenciasSociales: splitToArray(sol.comp_soc),
          valores: splitToArray(sol.valores),
          areasExperiencia: splitToArray(sol.areas_exp),
          aniosExperiencia: "",
        },
        // Firmas editables
        firmaElaboroNombre: firmas.firmaElaboroNombre,
        firmaRevisoNombre: firmas.firmaRevisoNombre,
        firmaVoBoJuridicoNombre: firmas.firmaVoBoJuridicoNombre,
        firmaDictRevisoNombre: firmas.firmaDictRevisoNombre,
        firmaDictVerificoNombre: firmas.firmaDictVerificoNombre,
        firmaDictEmitioNombre: firmas.firmaDictEmitioNombre,
        fechaDictaminacion,
      };

      pdfElement = React.createElement(
        PlantillaNombramientoDeterminado as React.FC<any>,
        { data: dataNombramiento },
      );
    } else {
      // ── Mapeo DIRECTO: campo de Prisma → campo de JustificacionData ──
      const dataHonorarios: JustificacionData = {
        tipoAdministracion: (sol as any).tipo_administracion || 'centralizada', // TODO: Ajustar este mapeo de base de datos según el esquema actual
        formato:            firmas.formato || 'fisico',
        secretaria:         sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable:  sol.unidad_responsable ?? "",
        regimenContratacion: sol.regimen ?? "",
        numeroPrestadores:  sol.numero_prestadores ?? 1,
        programaProyecto:   formatString(sol.programa_proyecto),
        tipoActividades:    formatString(sol.tipo_actividades),
        vigenciaInicio:     sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : "",
        vigenciaTermino:    sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : "",
        importeBruto:       sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
            })}`
          : "",
        tipoPago:           (sol.tipo_importe ?? "").replace(/_/g, " "),
        esRenovacion:       sol.es_renovacion ?? false,
        folioAnterior:      sol.folio_anterior ?? "",

        // I.1 Objeto de la contratación — campo de texto libre
        objetoContratacion: sol.objeto ?? "",

        // I.2 Actividades — es String[] en Prisma, se pasa directo
        actividades:        sol.actividades ?? [],

        // I.3 Responsabilidades — es String[] en Prisma, se pasa directo
        responsabilidades:  sol.responsabilidades ?? [],

        // II. Perfil — estos son strings con saltos de línea, se convierten a arrays
        perfil: {
          escolaridadMinima:          splitToArray(sol.escolaridad),
          competenciasAdministrativas: splitToArray(sol.comp_adm),
          competenciasTecnicas:        splitToArray(sol.comp_tec),
          competenciasSociales:        splitToArray(sol.comp_soc),
          valores:                     splitToArray(sol.valores),
          areasExperiencia:            splitToArray(sol.areas_exp),
        },
        // Firmas editables
        firmaElaboroNombre: firmas.firmaElaboroNombre,
        firmaRevisoNombre: firmas.firmaRevisoNombre,
        firmaDictRevisoNombre: firmas.firmaDictRevisoNombre,
        firmaDictVerificoNombre: firmas.firmaDictVerificoNombre,
        firmaDictEmitioNombre: firmas.firmaDictEmitioNombre,
        firmaElaboroCargo: firmas.firmaElaboroCargo,
        firmaRevisoCargo: firmas.firmaRevisoCargo,
        firmaDictRevisoCargo: firmas.firmaDictRevisoCargo,
        firmaDictVerificoCargo: firmas.firmaDictVerificoCargo,
        firmaDictEmitioCargo: firmas.firmaDictEmitioCargo,
        fechaDictaminacion,
      };

      pdfElement = React.createElement(
        PlantillaJustificacionServicios as React.FC<any>,
        { data: dataHonorarios },
      );
    }

    // Devolver el PDF como archivo descargable
    const folio =
      sol.folio_justificacion ??
      sol.folio_recepcion ??
      String(sol.id);

    const filename = `Justificacion_${folio.replace(/\//g, "-")}.pdf`;

    // ─── Render del PDF base ───
    // Usamos renderToStream en lugar de renderToBuffer: cuando NO se requiere
    // post-procesado (formato físico) podemos enviar el stream directo a la
    // respuesta y el navegador empieza a pintar el iframe en cuanto llegan los
    // primeros bytes (mejor TTFB). Si hay que estampar la constancia, drenamos
    // el stream a un Buffer.
    const pdfStream = await renderToStream(pdfElement as any);

    // ─── Post-procesamiento: estampar constancia de firma electrónica ───
    if (firmas.formato === "en_linea") {
      let pdfFinal: Buffer | Uint8Array = await streamToBuffer(pdfStream);
      try {
        const bypass = process.env.EFIRMA_BYPASS === "true";

        const firmaProceso = await prisma.firma_proceso.findUnique({
          where: { solicitud_id: Number(solicitudId) },
          include: bypass
            ? { firmantes: { orderBy: { orden: "asc" } } }
            : undefined,
        });

        let firmasPortal: FirmaPortal[] = [];

        if (bypass) {
          // ── Modo prueba: usar firmantes locales + sellos ficticios ──
          const dummyFirmantes = (firmaProceso as any)?.firmantes ?? [];
          if (dummyFirmantes.length > 0) {
            firmasPortal = dummyFirmantes.map((f: any) => buildFirmaFicticia(f, firmaProceso?.uuid));
          } else {
            firmasPortal = [buildFirmaFicticia({}, firmaProceso?.uuid)];
          }
        } else if (firmaProceso?.proceso_id) {
          // ── Modo real: consultar al portal e.firma ──
          const estado: any = await efirmaClient.estado(firmaProceso.proceso_id);
          firmasPortal = Array.isArray(estado?.firmas)
            ? estado.firmas.map((f: any) => ({
                usuario: f.usuario ?? "",
                rolFirmante: f.rolFirmante ?? null,
                responsable: f.responsable ?? null,
                selloDigital: f.selloDigital ?? null,
                estampadoTiempo: f.estampadoTiempo ?? null,
                selloEstampadoTiempo: f.selloEstampadoTiempo ?? null,
                noCertificado: f.noCertificado ?? null,
                noCertificadoGEM: f.noCertificadoGEM ?? null,
                rfcGEM: f.rfcGEM ?? null,
                urlValidacion: f.urlValidacion ?? null,
                firmadoEn: f.firmadoEn ?? null,
              }))
            : [];
        }

        if (firmasPortal.length > 0) {
          pdfFinal = await agregarConstanciaFirma({
            pdfBase: pdfFinal as Buffer,
            firmas: firmasPortal,
            nombreArchivo: filename,
            folio,
          });
        }
      } catch (errFirma) {
        console.error("[pdf/justificacion] Error agregando constancia de firma:", errFirma);
      }

      return new NextResponse(pdfFinal as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    // ─── Camino rápido: streamear el PDF directamente (sin constancia) ───
    const webStream = Readable.toWeb(pdfStream as Readable) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("[GET/POST /api/pdf/justificacion]", error);
    const message =
      error instanceof Error ? error.message : "Error al generar el PDF";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firmas: FirmaNames = {
    firmaElaboroNombre: body.firmaElaboroNombre,
    firmaRevisoNombre: body.firmaRevisoNombre,
    firmaVoBoJuridicoNombre: body.firmaVoBoJuridicoNombre,
    firmaDictRevisoNombre: body.firmaDictRevisoNombre,
    firmaDictVerificoNombre: body.firmaDictVerificoNombre,
    firmaDictEmitioNombre: body.firmaDictEmitioNombre,
    formato: body.formato === 'en_linea' ? 'en_linea' : 'fisico',
  };
  return generatePDFResponse(body.solicitudId, firmas);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const firmas: FirmaNames = {
    firmaElaboroNombre: searchParams.get("firmaElaboroNombre") || undefined,
    firmaRevisoNombre: searchParams.get("firmaRevisoNombre") || undefined,
    firmaVoBoJuridicoNombre: searchParams.get("firmaVoBoJuridicoNombre") || undefined,
    firmaDictRevisoNombre: searchParams.get("firmaDictRevisoNombre") || undefined,
    firmaDictVerificoNombre: searchParams.get("firmaDictVerificoNombre") || undefined,
    firmaDictEmitioNombre: searchParams.get("firmaDictEmitioNombre") || undefined,
    formato: searchParams.get("formato") === 'en_linea' ? 'en_linea' : 'fisico',
  };
  return generatePDFResponse(solicitudId, firmas);
}
