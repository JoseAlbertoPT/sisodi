import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { buildCartaDescriptivaBuffer } from "../carta-descriptiva/route";
import { buildDictamenPrestacionBuffer } from "../dictamen-prestacion/route";
import { claveParaPdf, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";

export const runtime = "nodejs";

interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPrestadores?: number
  programaProyecto?: string
}

async function buildResponse(solicitudId: string | null, overrides: PdfOverrides = {}, catalogoId: string | null = null) {
  if (!solicitudId && !catalogoId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId o catalogoId" },
      { status: 400 },
    );
  }

  // Consulta ligera solo para calcular la clave antes de lanzar ambos renders en paralelo.
  let clave: string
  if (solicitudId) {
    const solMeta = await prisma.solicitud.findUnique({
      where: { id: Number(solicitudId) },
      select: {
        secretaria: true, folio_dictamen: true, folio_recepcion: true, dictamen: { select: { folio: true } },
        historial_solicitud: { where: { comentario: { contains: MARCA_HISTORICO_IMPORTADO } }, take: 1, select: { id: true } },
      },
    });
    if (!solMeta) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 },
      );
    }
    const folioMeta = solMeta.dictamen?.folio ?? solMeta.folio_dictamen ?? solMeta.folio_recepcion ?? solicitudId;
    clave = claveParaPdf(solMeta.secretaria, folioMeta, solMeta.historial_solicitud.length > 0);
  } else {
    const cjMeta = await prisma.catalogo_justificacion.findUnique({
      where: { id: Number(catalogoId) },
      select: { secretaria: true, folio_dictamen: true, folio_recepcion: true },
    });
    if (!cjMeta) {
      return NextResponse.json(
        { ok: false, error: "Registro de catálogo no encontrado" },
        { status: 404 },
      );
    }
    const folioMeta = cjMeta.folio_dictamen ?? cjMeta.folio_recepcion ?? catalogoId!;
    clave = claveParaPdf(cjMeta.secretaria, folioMeta, true);
  }

  let dictamenResult, cartaResult;
  try {
    dictamenResult = await buildDictamenPrestacionBuffer(solicitudId, overrides, catalogoId);
    cartaResult = await buildCartaDescriptivaBuffer(solicitudId, clave || null, catalogoId);
  } catch (e) {
    console.error("[pdf/dictamen-prestacion-completo] Error generando buffers:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al generar el PDF" },
      { status: 500 },
    );
  }

  if (!dictamenResult || !cartaResult) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }

  try {
    const merged = await PDFDocument.create();
    for (const buf of [cartaResult.buffer, dictamenResult.buffer]) {
      const src = await PDFDocument.load(buf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const mergedBytes = await merged.save();

    const filename = `Dictamen_${dictamenResult.folio.replace(/\//g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf/dictamen-prestacion-completo] Error uniendo PDFs:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al unir los documentos" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const catalogoId = searchParams.get("catalogoId");
  const overrides: PdfOverrides = {};
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi;
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf;
  const np = searchParams.get("numeroPrestadores") ?? searchParams.get("numeroPersonas");
  if (np) overrides.numeroPrestadores = Number(np);
  const pp = searchParams.get("programaProyecto"); if (pp) overrides.programaProyecto = pp;
  return buildResponse(solicitudId, overrides, catalogoId);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const catalogoId = body?.catalogoId ? String(body.catalogoId) : null;
  const overrides: PdfOverrides = {};
  if (body?.vigenciaInicio) overrides.vigenciaInicio = String(body.vigenciaInicio);
  if (body?.vigenciaFin)    overrides.vigenciaFin    = String(body.vigenciaFin);
  const np = body?.numeroPrestadores ?? body?.numeroPersonas;
  if (np) overrides.numeroPrestadores = Number(np);
  if (body?.programaProyecto) overrides.programaProyecto = String(body.programaProyecto);
  return buildResponse(solicitudId, overrides, catalogoId);
}
