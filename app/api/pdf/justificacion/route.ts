import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
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
import { applyTextRules, applyTextRulesArray } from "@/lib/utils";
import { claveParaPdf, siglasSecretaria, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { stripLeadingRomanNumeral } from "@/lib/roman-list";
import { CLAVE_NOTA_DICTAMEN, NOTA_DICTAMEN_DEFAULT, getTextoConfiguracion } from "@/lib/configuracion-texto";
import React from "react";

// Actividades/responsabilidades traen su numeral romano de origen pegado al
// texto (columnas Q/R del catálogo). Esta plantilla ya antepone su propio
// número arábigo por separado (ver PlantillaJustificacionServicios/
// PlantillaNombramientoDeterminado), así que ese numeral de origen se quita
// antes de aplicar applyTextRules: si se dejara, quedaría duplicado
// ("1.  I. Coadyuvar...") y además rompe la capitalización de numerales de
// más de una letra (II, III, IV...), que applyTextRules no reconoce como
// numeral y deja a medio capitalizar ("Ii.", "Iii.").
function applyTextRulesToList(items: string[]): string[] {
  return applyTextRulesArray(items.map(stripLeadingRomanNumeral));
}

export const runtime = "nodejs";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function splitToArray(str: string | null | undefined): string[] {
  if (!str || str.trim() === "") return [];
  return str
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}


function escolaridadToSingleLine(str: string | null | undefined): string[] {
  const joined = splitToArray(str).join(" ");
  return joined ? [joined] : [];
}

function formatString(str: string | null | undefined): string {
  if (!str) return "";
  const spaced = str.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function selloFalso(prefix: string, length = 344): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = prefix;
  while (out.length < length) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out.slice(0, length - 2) + "==";
}

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


async function resolverNombresFirmantes(
  solicitudId: number,
  base: FirmaNames,
  soloFirmanteId: number | null = null,
): Promise<FirmaNames> {
  const proceso = await prisma.firma_proceso.findUnique({
    where: { solicitud_id: solicitudId },
    include: {
      firmantes: {
        include: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { orden: "asc" },
        ...(soloFirmanteId ? { where: { id: soloFirmanteId } } : {}),
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

// Firma autógrafa (física) no pasa por firma_proceso/firma_firmante — esas
// tablas solo existen para el portal de firma electrónica. Ahí la única
// constancia de quién aprobó cada etapa (UEFA/Revisó/Verificó/Emitió) queda
// en historial_solicitud: la fila que saca a la solicitud de "En Validacion
// Justificaciones" (UEFA) / "En Revision Revisor" / "En Verificacion Final" /
// "En Revision Emisor" trae el usuario_id de quien aprobó esa etapa. Se usa
// la más reciente por si hubo ciclos de observación/reenvío.
type CampoFirmaNombre = "firmaRevisoNombre" | "firmaDictRevisoNombre" | "firmaDictVerificoNombre" | "firmaDictEmitioNombre"
type CampoFirmaCargo = "firmaRevisoCargo" | "firmaDictRevisoCargo" | "firmaDictVerificoCargo" | "firmaDictEmitioCargo"
const ETAPA_NOMBRE_A_CAMPO: Record<string, { nombre: CampoFirmaNombre; cargo: CampoFirmaCargo }> = {
  "en validacion justificaciones": { nombre: "firmaRevisoNombre",     cargo: "firmaRevisoCargo" },
  "en revision revisor":           { nombre: "firmaDictRevisoNombre",   cargo: "firmaDictRevisoCargo" },
  "en verificacion final":         { nombre: "firmaDictVerificoNombre", cargo: "firmaDictVerificoCargo" },
  "en revision emisor":            { nombre: "firmaDictEmitioNombre",   cargo: "firmaDictEmitioCargo" },
}

async function resolverNombresFirmantesAutografa(
  solicitudId: number,
  base: FirmaNames,
): Promise<FirmaNames> {
  const out: FirmaNames = { ...base };
  const pendientes = Object.values(ETAPA_NOMBRE_A_CAMPO).filter(
    ({ nombre }) => !out[nombre],
  );
  if (pendientes.length === 0) return out;

  const historial = await prisma.historial_solicitud.findMany({
    where: { solicitud_id: solicitudId },
    include: {
      estado_historial_solicitud_estado_anterior_idToestado: { select: { nombre: true } },
      usuario: { select: { nombre: true, cargo: true } },
    },
    orderBy: { fecha: "desc" },
  });

  for (const h of historial) {
    const estadoAnterior = (
      h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? ""
    ).toLowerCase();
    const campos = ETAPA_NOMBRE_A_CAMPO[estadoAnterior];
    if (!campos || out[campos.nombre]) continue;
    out[campos.nombre] = h.usuario?.nombre || "";
    if (h.usuario?.cargo) out[campos.cargo] = h.usuario.cargo;
  }

  return out;
}

interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPersonas?: number
  // Número consecutivo de reutilización (1, 2, 3…) que se pega al folio de
  // dictamen en el Dictamen Técnico Funcional de Justificación de Prestación
  // de Servicios cuando el PDF se genera desde "Procesar" en el catálogo de
  // reutilizaciones — así cada reutilización queda identificada como
  // "06/08/2026-1", "06/08/2026-2", etc.
  reutilizacionNumero?: number
}

async function buildJustificacionBufferDesdeCatalogo(
  catalogoId: string,
  overrides: PdfOverrides,
): Promise<{ buffer: Buffer | Uint8Array; filename: string; sol: any } | null> {
  const cj = await prisma.catalogo_justificacion.findUnique({ where: { id: Number(catalogoId) } });
  if (!cj) return null;

  const folio = cj.folio_dictamen ?? cj.folio_recepcion ?? String(cj.id);
  const fechaDictaminacion = cj.fecha_emision
    ? new Date(cj.fecha_emision).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const notaDictamen = await getTextoConfiguracion(CLAVE_NOTA_DICTAMEN, NOTA_DICTAMEN_DEFAULT);

  const dataHonorarios: JustificacionData = {
    tipoAdministracion: cj.tipo_administracion === "paraestatal" ? "paraestatal" : "centralizada",
    formato: "fisico",
    secretaria: cj.secretaria ?? "",
    unidadAdministrativa: cj.unidad_administrativa ?? "",
    unidadResponsable: cj.unidad_responsable ?? "",
    oficioSolicitud: "",
    regimenContratacion: cj.regimen_contratacion ?? "",
    numeroPrestadores: overrides.numeroPersonas ?? cj.numero_personas ?? 1,
    programaProyecto: applyTextRules(formatString(cj.programa_proyecto)),
    tipoActividades: applyTextRules(formatString(cj.tipo_actividad)),
    vigenciaInicio: overrides.vigenciaInicio ?? (cj.vigencia_inicio ? cj.vigencia_inicio.toISOString().split("T")[0] : ""),
    vigenciaTermino: overrides.vigenciaFin ?? (cj.vigencia_fin ? cj.vigencia_fin.toISOString().split("T")[0] : ""),
    importeBruto: cj.importe_bruto
      ? `$${Number(cj.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
      : "",
    tipoPago: (cj.tipo_pago ?? "").replace(/_/g, " "),
    esRenovacion: cj.es_renovacion ?? false,
    folioAnterior: "",
    objetoContratacion: applyTextRules(cj.objeto ?? ""),
    actividades: applyTextRulesToList(cj.actividades ?? []),
    responsabilidades: applyTextRulesToList(cj.responsabilidades ?? []),
    perfil: {
      escolaridadMinima: applyTextRulesArray(escolaridadToSingleLine(cj.escolaridad)),
      competenciasAdministrativas: applyTextRulesArray(splitToArray(cj.comp_adm)),
      competenciasTecnicas: applyTextRulesArray(splitToArray(cj.comp_tec)),
      competenciasSociales: applyTextRulesArray(splitToArray(cj.comp_soc)),
      valores: applyTextRulesArray(splitToArray(cj.valores)),
      areasExperiencia: applyTextRulesArray(splitToArray(cj.areas_exp)),
    },
    fechaDictaminacion,
    ocultarFirmas: true,
    clave: claveParaPdf(cj.secretaria, folio, true),
    notaDictamen,
  };

  const pdfElement = React.createElement(PlantillaJustificacionServicios as React.FC<any>, { data: dataHonorarios });
  const folioFilename = cj.folio_recepcion ?? cj.folio_justificacion ?? folio;
  const filename = `Justificacion_${folioFilename.replace(/\//g, "-")}.pdf`;
  const pdfStream = await renderToStream(pdfElement as any);
  const pdfFinal = await streamToBuffer(pdfStream);

  return { buffer: pdfFinal, filename, sol: null };
}

// Datos ya resueltos (folio, firmas, contenido) de una justificación, separados
// de su renderizado a PDF (react-pdf) para que buildJustificacionBuffer no mezcle
// la consulta/armado de datos con el paso de renderizado.
export interface JustificacionResuelta {
  kind: "nombramiento" | "honorarios";
  data: JustificacionNombramientoData | JustificacionData;
  folio: string;
  filename: string;
  sol: any;
}

export async function resolveJustificacionData(
  solicitudId: string,
  firmasInput: FirmaNames = {},
  soloFirmanteId: number | null = null,
  overrides: PdfOverrides = {},
  sinFirmas = false,
  soloSiglas = false,
): Promise<JustificacionResuelta | null> {
  let firmas: FirmaNames = { ...firmasInput };
  {
    const sol = await prisma.solicitud.findUnique({
      where: { id: Number(solicitudId) },
      include: {
        dictamen: true,
        estado: true,
        usuario: { select: { organo_centralizado: { select: { id: true } } } },
        historial_solicitud: {
          where: { comentario: { contains: MARCA_HISTORICO_IMPORTADO } },
          take: 1,
          select: { id: true },
        },
      },
    });
    const esHistoricoImportado = (sol?.historial_solicitud.length ?? 0) > 0;
    // La página de Dictamen/Opinión Técnica Funcional solo debe incluirse una
    // vez que el dictamen ya está listo para su firma final: "Pendiente Firma
    // Dictamen" (autógrafa, se descarga para firmar fuera del sistema) o ya
    // "Emitido". Durante el resto de la cadena de firma electrónica (UEFA,
    // Revisión, Verificación, Emisor: "Pendiente Firma Justificacion" /
    // "Pendiente Firma Revision" / "Pendiente Firma Verificacion" / "Pendiente
    // Firma Emisor") esta página aún no debe aparecer.
    const ESTADOS_CON_DICTAMEN_APROBADO = new Set([
      "pendiente firma dictamen",
      "emitido",
    ]);
    const tieneDictamen = ESTADOS_CON_DICTAMEN_APROBADO.has(
      (sol?.estado?.nombre ?? "").toLowerCase(),
    );
    // Regla 12 (lib/firma-visibilidad.ts) sigue aplicando tal cual en "Mis
    // Solicitudes"/bandejas y en los demás PDFs (dictamen-prestacion,
    // carta-descriptiva): ahí el folio de dictamen permanece oculto hasta
    // "Emitido". En ESTE documento (el que se ve/firma en el portal de firma
    // electrónica) se pidió explícitamente lo contrario: mostrar el folio del
    // dictamen en la caja "Justificación" desde que existe (asignado al
    // aprobar en Emisión), sin esperar a que termine toda la cadena de firmas.
    const folioDictamenVisible = sol?.folio_dictamen ?? null;

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
      return null;
    }

    const folio =
      sol.folio_recepcion ??
      sol.folio_justificacion ??
      String(sol.id);
    const filename = `Justificacion_${folio.replace(/\//g, "-")}`;

    // Si esta solicitud nació de una reutilización del catálogo (creada por
    // /api/catalogo-justificaciones/procesar), calcula su posición cronológica
    // (1ª, 2ª, 3ª…) entre todas las reutilizaciones del mismo registro del
    // catálogo, para pegarla al folio de dictamen en el PDF más abajo. Se
    // calcula aquí, a partir de la solicitud, para que aplique sin importar
    // desde qué pantalla se genere el PDF (no solo cuando se pide con
    // catalogoSolicitudId explícito).
    if (overrides.reutilizacionNumero === undefined) {
      const catSolLink = await prisma.catalogo_solicitud.findFirst({
        where: { solicitud_nueva_id: Number(solicitudId) },
        select: { id: true, catalogo_justificacion_id: true },
      });
      if (catSolLink) {
        overrides.reutilizacionNumero = await prisma.catalogo_solicitud.count({
          where: { catalogo_justificacion_id: catSolLink.catalogo_justificacion_id, id: { lte: catSolLink.id } },
        });
      }
    }

    if (!sinFirmas) {
      firmas = await resolverNombresFirmantes(Number(solicitudId), firmas, soloFirmanteId);
      if ((sol as any).modalidad_firma === "autografa") {
        firmas = await resolverNombresFirmantesAutografa(Number(solicitudId), firmas);
      }
    }

    const notaDictamen = await getTextoConfiguracion(CLAVE_NOTA_DICTAMEN, NOTA_DICTAMEN_DEFAULT);

    const tipoAdministracion: 'centralizada' | 'paraestatal' =
      sol.tipo_administracion === 'paraestatal' ? 'paraestatal'
      : sol.tipo_administracion === 'centralizada' ? 'centralizada'
      : (sol as any).usuario?.organo_centralizado ? 'centralizada'
      : 'paraestatal'

    if (sol.tipo_solicitud === "nombramiento" || (sol.regimen && sol.regimen.toLowerCase().includes("nombramiento"))) {
      const dataNombramiento: JustificacionNombramientoData = {
        tipoAdministracion,
        formato: firmas.formato || 'fisico',
        oficioSolicitud: "",
        secretaria: sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable: sol.unidad_responsable ?? "",
        programaProyecto: applyTextRules(sol.programa_proyecto ?? ""),
        denominacionNombramiento: applyTextRules(formatString(sol.denominacion)),
        tipoActividad: applyTextRules(formatString(sol.tipo_actividades)),
        puestoJefeInmediato: applyTextRules(formatString(sol.puesto_jefe_inmediato)),
        numeroPersonas: overrides.numeroPersonas ?? sol.numero_prestadores ?? 1,
        importeNetoMensual: sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
          : "",
        tipoPago: (sol.tipo_importe ?? "").replace(/_/g, " "),
        equivalenciaNivel: `${sol.nivel_tabulador ?? ""} - ${sol.categoria_tabulador ?? ""}`.trim() === "-" ? "" : `${sol.nivel_tabulador ?? ""} ${sol.categoria_tabulador ?? ""}`,
        vigenciaInicio: overrides.vigenciaInicio ?? (sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : ""),
        vigenciaTermino: overrides.vigenciaFin ?? (sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : ""),
        clavePresupuestal: "",
        renovacion: sol.es_renovacion ?? false,
        folioAnterior: sol.folio_anterior ?? "",

        objetoNombramiento: applyTextRules(sol.objeto ?? ""),
        funcionesPrincipales: applyTextRulesToList(sol.actividades ?? []),
        responsabilidades: applyTextRulesToList(sol.responsabilidades ?? []),
        marcoNormativo: applyTextRulesToList(sol.marco_normativo ?? []),

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
          escolaridadMinima: applyTextRulesArray(escolaridadToSingleLine(sol.escolaridad)),
          competenciasAdministrativas: applyTextRulesArray(splitToArray(sol.comp_adm)),
          competenciasTecnicas: applyTextRulesArray(splitToArray(sol.comp_tec)),
          competenciasSociales: applyTextRulesArray(splitToArray(sol.comp_soc)),
          valores: applyTextRulesArray(splitToArray(sol.valores)),
          areasExperiencia: applyTextRulesArray(splitToArray(sol.areas_exp)),
          aniosExperiencia: "",
        },
        firmaElaboroNombre: firmas.firmaElaboroNombre,
        firmaRevisoNombre: firmas.firmaRevisoNombre,
        firmaVoBoJuridicoNombre: firmas.firmaVoBoJuridicoNombre,
        firmaDictRevisoNombre: firmas.firmaDictRevisoNombre,
        firmaDictVerificoNombre: firmas.firmaDictVerificoNombre,
        firmaDictEmitioNombre: firmas.firmaDictEmitioNombre,
        fechaDictaminacion,
        ocultarFirmas: sinFirmas,
        // El folio de dictamen (JOGE/1/02/2025) solo debe verse en Dictámenes
        // y Catálogo — en el PDF que se sube al portal de Firma de
        // Justificación (soloSiglas=true) se muestran solo las siglas.
        clave: soloSiglas ? siglasSecretaria(sol.secretaria) : claveParaPdf(sol.secretaria, folioDictamenVisible, esHistoricoImportado),
        notaDictamen,
        incluirPaginaDictamen: tieneDictamen,
      };

      return { kind: "nombramiento", data: dataNombramiento, folio, filename, sol };
    } else {
      const dataHonorarios: JustificacionData = {
        tipoAdministracion,
        formato:            firmas.formato || 'fisico',
        secretaria:         sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable:  sol.unidad_responsable ?? "",
        oficioSolicitud:    "",
        regimenContratacion: sol.regimen ?? "",
        numeroPrestadores:  overrides.numeroPersonas ?? sol.numero_prestadores ?? 1,
        programaProyecto:   applyTextRules(formatString(sol.programa_proyecto)),
        tipoActividades:    applyTextRules(formatString(sol.tipo_actividades)),
        vigenciaInicio:     overrides.vigenciaInicio ?? (sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : ""),
        vigenciaTermino:    overrides.vigenciaFin ?? (sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : ""),
        importeBruto:       sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
            })}`
          : "",
        tipoPago:           (sol.tipo_importe ?? "").replace(/_/g, " "),
        esRenovacion:       sol.es_renovacion ?? false,
        folioAnterior:      sol.folio_anterior ?? "",

        objetoContratacion: applyTextRules(sol.objeto ?? ""),

        actividades:        applyTextRulesToList(sol.actividades ?? []),

        responsabilidades:  applyTextRulesToList(sol.responsabilidades ?? []),

        perfil: {
          escolaridadMinima:          applyTextRulesArray(escolaridadToSingleLine(sol.escolaridad)),
          competenciasAdministrativas: applyTextRulesArray(splitToArray(sol.comp_adm)),
          competenciasTecnicas:        applyTextRulesArray(splitToArray(sol.comp_tec)),
          competenciasSociales:        applyTextRulesArray(splitToArray(sol.comp_soc)),
          valores:                     applyTextRulesArray(splitToArray(sol.valores)),
          areasExperiencia:            applyTextRulesArray(splitToArray(sol.areas_exp)),
        },
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
        ocultarFirmas: sinFirmas,
        // "Justificación"/"Clave" (siglas + folio) nunca lleva el consecutivo de
        // reutilización — solo el campo "Folio" de abajo, ver JustificacionData.folio.
        // El folio de dictamen (JOGE/1/02/2025) solo debe verse en Dictámenes
        // y Catálogo — en el PDF que se sube al portal de Firma de
        // Justificación (soloSiglas=true) se muestran solo las siglas.
        clave: soloSiglas ? siglasSecretaria(sol.secretaria) : claveParaPdf(sol.secretaria, folioDictamenVisible, esHistoricoImportado),
        folio: overrides.reutilizacionNumero && folioDictamenVisible
          ? `${folioDictamenVisible}-${overrides.reutilizacionNumero}`
          : (folioDictamenVisible ?? ""),
        notaDictamen,
        incluirPaginaDictamen: tieneDictamen,
      };

      return { kind: "honorarios", data: dataHonorarios, folio, filename, sol };
    }
  }
}

export async function buildJustificacionBuffer(
  solicitudId: string | null,
  firmasInput: FirmaNames = {},
  soloFirmanteId: number | null = null,
  overrides: PdfOverrides = {},
  sinFirmas = false,
  catalogoId: string | null = null,
  soloSiglas = false,
): Promise<{ buffer: Buffer | Uint8Array; filename: string; sol: any } | null> {
  if (!solicitudId) {
    return catalogoId ? buildJustificacionBufferDesdeCatalogo(catalogoId, overrides) : null;
  }

  const resuelto = await resolveJustificacionData(solicitudId, firmasInput, soloFirmanteId, overrides, sinFirmas, soloSiglas);
  if (!resuelto) return null;

  const { data, folio, sol } = resuelto;
  const filename = `${resuelto.filename}.pdf`;

  const pdfElement = resuelto.kind === "nombramiento"
    ? React.createElement(PlantillaNombramientoDeterminado as React.FC<any>, { data })
    : React.createElement(PlantillaJustificacionServicios as React.FC<any>, { data });

  const pdfStream = await renderToStream(pdfElement as any);

  let pdfFinal: Buffer | Uint8Array = await streamToBuffer(pdfStream);
  const esFirmaElectronica = ((sol as any).modalidad_firma ?? "electronica") !== "autografa";
  if (!sinFirmas && esFirmaElectronica) try {
    const bypass = process.env.EFIRMA_BYPASS === "true";

    const firmaProceso = await prisma.firma_proceso.findUnique({
      where: { solicitud_id: Number(solicitudId) },
      include: bypass
        ? {
            firmantes: {
              orderBy: { orden: "asc" },
              ...(soloFirmanteId ? { where: { id: soloFirmanteId } } : {}),
            },
          }
        : undefined,
    });

    let firmasPortal: FirmaPortal[] = [];

    if (bypass) {
      const dummyFirmantes = ((firmaProceso as any)?.firmantes ?? []).filter((f: any) => f.firmado);
      firmasPortal = dummyFirmantes.map((f: any) => buildFirmaFicticia(f, firmaProceso?.uuid));
    } else if (firmaProceso?.proceso_id) {
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

  return { buffer: pdfFinal, filename, sol };
}

async function generatePDFResponse(solicitudId: string | null, firmasInput: FirmaNames = {}, soloFirmanteId: number | null = null, overrides: PdfOverrides = {}, sinFirmas = false, catalogoId: string | null = null, soloSiglas = false) {
  try {
    if (!solicitudId && !catalogoId) {
      return NextResponse.json(
        { ok: false, error: "Falta solicitudId o catalogoId" },
        { status: 400 }
      );
    }

    const result = await buildJustificacionBuffer(solicitudId, firmasInput, soloFirmanteId, overrides, sinFirmas, catalogoId, soloSiglas);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Error al generar el PDF";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firmas: FirmaNames = {
    firmaElaboroNombre: body.firmaElaboroNombre,
    firmaElaboroCargo: body.firmaElaboroCargo,
    firmaRevisoNombre: body.firmaRevisoNombre,
    firmaVoBoJuridicoNombre: body.firmaVoBoJuridicoNombre,
    firmaDictRevisoNombre: body.firmaDictRevisoNombre,
    firmaDictVerificoNombre: body.firmaDictVerificoNombre,
    firmaDictEmitioNombre: body.firmaDictEmitioNombre,
    formato: body.formato === 'en_linea' ? 'en_linea' : 'fisico',
  };
  const catalogoId = body.catalogoId ? String(body.catalogoId) : null;
  return generatePDFResponse(body.solicitudId, firmas, null, {}, false, catalogoId, body.paraFirma === true);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const catalogoId = searchParams.get("catalogoId");
  const firmanteIdRaw = searchParams.get("firmanteId");
  let firmanteId: number | null = null;
  if (firmanteIdRaw !== null && firmanteIdRaw !== "") {
    const n = Number(firmanteIdRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { ok: false, error: "firmanteId inválido (entero positivo requerido)" },
        { status: 400 },
      );
    }
    firmanteId = n;
  }
  const firmas: FirmaNames = {
    firmaElaboroNombre: searchParams.get("firmaElaboroNombre") || undefined,
    firmaRevisoNombre: searchParams.get("firmaRevisoNombre") || undefined,
    firmaVoBoJuridicoNombre: searchParams.get("firmaVoBoJuridicoNombre") || undefined,
    firmaDictRevisoNombre: searchParams.get("firmaDictRevisoNombre") || undefined,
    firmaDictVerificoNombre: searchParams.get("firmaDictVerificoNombre") || undefined,
    firmaDictEmitioNombre: searchParams.get("firmaDictEmitioNombre") || undefined,
    formato: searchParams.get("formato") === 'en_linea' ? 'en_linea' : 'fisico',
  };
  const overrides: PdfOverrides = {}
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf
  const np = searchParams.get("numeroPersonas"); if (np) overrides.numeroPersonas = Number(np)
  const sinFirmas = searchParams.get("sinFirmas") === "true"

  return generatePDFResponse(solicitudId, firmas, firmanteId, overrides, sinFirmas, catalogoId);
}
