import { NextRequest, NextResponse } from "next/server";
import { mensajePublico } from "@/lib/error-publico";
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaDictamenPrestacionServicios,
  type DictamenPrestacionData,
} from "@/components/plantillas/PlantillaDictamenPrestacionServicios";
import { claveParaPdf, folioSinSiglas, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { puedeMostrarFolioDictamen } from "@/lib/firma-visibilidad";
import { applyTextRules } from "@/lib/utils";
import { getNotaDictamen } from "@/lib/configuracion-texto";
import React from "react";

export const runtime = "nodejs";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function formatFechaLarga(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatImporte(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPrestadores?: number
  programaProyecto?: string
  importeBruto?: number
}

export async function buildDictamenPrestacionBuffer(
  solicitudId: string | null,
  overrides: PdfOverrides = {},
  catalogoId?: string | null,
) {
  const sol = solicitudId
    ? await prisma.solicitud.findUnique({
        where: { id: Number(solicitudId) },
        include: {
          dictamen: true,
          estado: { select: { nombre: true } },
          historial_solicitud: {
            where: { comentario: { contains: MARCA_HISTORICO_IMPORTADO } },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null;

  let data: DictamenPrestacionData;
  let folio: string;
  const notaDictamen = (await getNotaDictamen()).valor;

  // Cada vez que se reutiliza (o cancela) un registro del catálogo, este
  // endpoint se llama justo después de /api/catalogo-justificaciones/solicitar
  // (que ya insertó la fila de esa acción) con la vigencia como override —
  // así que contar cuántas filas tiene ya el registro del catálogo da
  // directamente el consecutivo de ÉSTA ("06/08/2026-1", "-2", … "-30"). Solo
  // se aplica cuando venimos de esa acción (hay override de vigencia): una
  // descarga normal no debe cargar el consecutivo de reutilizaciones pasadas.
  // El sufijo va SOLO en el campo "Folio" de arriba del documento — la
  // "Justificación" (siglas + folio de dictamen) siempre se arma con el folio
  // limpio, sin el consecutivo de reutilización.
  const esGeneracionDesdeCatalogo = !!(overrides.vigenciaInicio || overrides.vigenciaFin);
  const catalogoJustificacionId = esGeneracionDesdeCatalogo
    ? (catalogoId
        ? Number(catalogoId)
        : solicitudId
          ? (await prisma.catalogo_justificacion.findUnique({
              where: { solicitud_id: Number(solicitudId) },
              select: { id: true },
            }))?.id ?? null
          : null)
    : null;
  const reutilizacionNumero = catalogoJustificacionId
    ? await prisma.catalogo_solicitud.count({ where: { catalogo_justificacion_id: catalogoJustificacionId } })
    : 0;
  // Regla 12: el dictamen definitivo no se puede descargar hasta que la
  // solicitud tenga la última firma requerida (estado "Emitido"). La
  // reutilización desde Catálogo queda fuera: que exista el registro del
  // catálogo ya prueba que el dictamen original se emitió, y este documento
  // nuevo lo firma en ese momento quien reutiliza — el estado actual de la
  // solicitud original (que pudo cambiar después de emitirse) no aplica.
  const esReutilizacionCatalogo = esGeneracionDesdeCatalogo && catalogoJustificacionId !== null;
  if (sol && !esReutilizacionCatalogo && !puedeMostrarFolioDictamen((sol as any).estado?.nombre)) {
    throw new Error("El dictamen aún no puede descargarse: falta completar el proceso de firma.");
  }
  const conSufijo = (f: string): string => (reutilizacionNumero > 0 ? `${f}-${reutilizacionNumero}` : f);

  if (sol) {
    const esHistoricoImportado = sol.historial_solicitud.length > 0;
    folio =
      sol.dictamen?.folio ??
      sol.folio_dictamen ??
      sol.folio_recepcion ??
      String(sol.id);
    data = {
      folio: folioSinSiglas(folio),
      folioActual: reutilizacionNumero > 0 ? folioSinSiglas(conSufijo(folio)) : undefined,
      fecha: formatFechaLarga(new Date()),
      secretariaDependencia: sol.secretaria ?? "",
      unidadResponsableGasto: sol.unidad_responsable ?? "",
      unidadAdministrativa: sol.unidad_administrativa ?? "",
      regimenContratacion: sol.regimen ?? "",
      tipoServicios: applyTextRules(sol.tipo_actividades ?? ""),
      claveNombrePrograma: applyTextRules(overrides.programaProyecto ?? sol.programa_proyecto ?? ""),
      objetoContratacion: applyTextRules(sol.objeto ?? ""),
      importeBruto: formatImporte(overrides.importeBruto ?? sol.importe_bruto),
      tipoPagoLabel: (sol.tipo_importe ?? "").replace(/_/g, " ") || undefined,
      justificacion: claveParaPdf(sol.secretaria, folio, esHistoricoImportado) || sol.folio_justificacion || "",
      numeroPrestadores: overrides.numeroPrestadores ?? sol.numero_prestadores ?? 1,
      vigenciaInicio: overrides.vigenciaInicio ?? (sol.vigencia_inicio
        ? sol.vigencia_inicio.toISOString().split("T")[0]
        : ""),
      vigenciaFin: overrides.vigenciaFin ?? (sol.vigencia_fin
        ? sol.vigencia_fin.toISOString().split("T")[0]
        : ""),
      notaDictamen,
    };
  } else if (catalogoId) {
    // Registro histórico sin solicitud viva — datos archivados directo en catalogo_justificacion.
    const cj = await prisma.catalogo_justificacion.findUnique({ where: { id: Number(catalogoId) } });
    if (!cj) return null;
    folio = cj.folio_dictamen ?? cj.folio_recepcion ?? String(cj.id);
    data = {
      folio: folioSinSiglas(folio),
      folioActual: reutilizacionNumero > 0 ? folioSinSiglas(conSufijo(folio)) : undefined,
      fecha: formatFechaLarga(new Date()),
      secretariaDependencia: cj.secretaria ?? "",
      unidadResponsableGasto: cj.unidad_responsable ?? "",
      unidadAdministrativa: cj.unidad_administrativa ?? "",
      regimenContratacion: cj.regimen_contratacion ?? "",
      tipoServicios: applyTextRules(cj.tipo_actividad ?? ""),
      claveNombrePrograma: applyTextRules(overrides.programaProyecto ?? cj.programa_proyecto ?? ""),
      objetoContratacion: applyTextRules(cj.objeto ?? ""),
      importeBruto: formatImporte(overrides.importeBruto ?? cj.importe_bruto),
      tipoPagoLabel: (cj.tipo_pago ?? "").replace(/_/g, " ") || undefined,
      // Histórico: sin siglas calculadas, el folio real tal cual (claveParaPdf con esHistorico=true).
      justificacion: claveParaPdf(cj.secretaria, folio, true) || cj.folio_justificacion || "",
      numeroPrestadores: overrides.numeroPrestadores ?? cj.numero_personas ?? 1,
      vigenciaInicio: overrides.vigenciaInicio ?? (cj.vigencia_inicio
        ? cj.vigencia_inicio.toISOString().split("T")[0]
        : ""),
      vigenciaFin: overrides.vigenciaFin ?? (cj.vigencia_fin
        ? cj.vigencia_fin.toISOString().split("T")[0]
        : ""),
      notaDictamen,
    };
  } else {
    return null;
  }

  const stream = await renderToStream(
    React.createElement(
      PlantillaDictamenPrestacionServicios as React.FC<any>,
      { data },
    ) as any,
  );
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

  const filename = `Dictamen_${conSufijo(folio).replace(/\//g, "-")}.pdf`;

  return { buffer, sol, folio, filename };
}

async function buildPDFResponse(solicitudId: string | null, overrides: PdfOverrides = {}, catalogoId: string | null = null) {
  if (!solicitudId && !catalogoId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId o catalogoId" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await buildDictamenPrestacionBuffer(solicitudId, overrides, catalogoId);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: mensajePublico(e, "No se pudo generar el dictamen") },
      { status: 403 },
    );
  }
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const catalogoId = searchParams.get("catalogoId");
  const overrides: PdfOverrides = {};
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi;
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf;
  const np = searchParams.get("numeroPrestadores") ?? searchParams.get("numeroPersonas");
  if (np) overrides.numeroPrestadores = Number(np);
  const pp = searchParams.get("programaProyecto"); if (pp) overrides.programaProyecto = pp;
  return buildPDFResponse(solicitudId, overrides, catalogoId);
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const catalogoId = body?.catalogoId ? String(body.catalogoId) : null;
  const overrides: PdfOverrides = {};
  if (body?.vigenciaInicio) overrides.vigenciaInicio = String(body.vigenciaInicio);
  if (body?.vigenciaFin)    overrides.vigenciaFin    = String(body.vigenciaFin);
  const np = body?.numeroPrestadores ?? body?.numeroPersonas;
  if (np) overrides.numeroPrestadores = Number(np);
  if (body?.programaProyecto) overrides.programaProyecto = String(body.programaProyecto);
  return buildPDFResponse(solicitudId, overrides, catalogoId);
}
