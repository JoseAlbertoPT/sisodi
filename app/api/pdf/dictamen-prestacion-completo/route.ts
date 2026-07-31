import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { buildCartaDescriptivaBuffer } from "../carta-descriptiva/route";
import { buildDictamenPrestacionBuffer } from "../dictamen-prestacion/route";
import { construirClave } from "@/lib/clave-dictamen";

export const runtime = "nodejs";

interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPrestadores?: number
}

async function buildResponse(solicitudId: string | null, overrides: PdfOverrides = {}) {
  if (!solicitudId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId" },
      { status: 400 },
    );
  }

  // Consulta ligera solo para calcular la clave antes de lanzar ambos renders en paralelo.
  const solMeta = await prisma.solicitud.findUnique({
    where: { id: Number(solicitudId) },
    select: { secretaria: true, folio_dictamen: true, folio_recepcion: true, dictamen: { select: { folio: true } } },
  });
  if (!solMeta) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }
  const folioMeta = solMeta.dictamen?.folio ?? solMeta.folio_dictamen ?? solMeta.folio_recepcion ?? solicitudId;
  const clave = construirClave(solMeta.secretaria, folioMeta);

  const [dictamenResult, cartaResult] = await Promise.all([
    buildDictamenPrestacionBuffer(solicitudId, overrides),
    buildCartaDescriptivaBuffer(solicitudId, clave || null),
  ]);

  if (!dictamenResult || !cartaResult) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }

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
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const overrides: PdfOverrides = {};
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi;
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf;
  const np = searchParams.get("numeroPrestadores") ?? searchParams.get("numeroPersonas");
  if (np) overrides.numeroPrestadores = Number(np);
  return buildResponse(solicitudId, overrides);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const overrides: PdfOverrides = {};
  if (body?.vigenciaInicio) overrides.vigenciaInicio = String(body.vigenciaInicio);
  if (body?.vigenciaFin)    overrides.vigenciaFin    = String(body.vigenciaFin);
  const np = body?.numeroPrestadores ?? body?.numeroPersonas;
  if (np) overrides.numeroPrestadores = Number(np);
  return buildResponse(solicitudId, overrides);
}
