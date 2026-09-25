import { NextRequest, NextResponse } from "next/server";
import { mensajePublico } from "@/lib/error-publico";
import { requireSesion, verificarActor } from "@/lib/session"
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { buildCartaDescriptivaBuffer } from "../carta-descriptiva/route";
import { buildDictamenPrestacionBuffer } from "../dictamen-prestacion/route";
import { claveParaPdf, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { agregarConstanciaFirma, type FirmaPortal } from "@/lib/pdf-firma-estampado";
import { resolverFirmaCatalogo } from "@/lib/firma-catalogo";
import { puedeFirmarCatalogo } from "@/lib/api-guard";

export const runtime = "nodejs";

export interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPrestadores?: number
  programaProyecto?: string
  importeBruto?: number
}

type DictamenCompletoResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: number; error: string }

/**
 * Carta Descriptiva + Dictamen en un solo PDF. `firmas`: Constancia de Firma
 * Electrónica al final (en orden). La ÚLTIMA firma es la que se imprime dentro
 * del Dictamen (nombre, cargo y QR) — en la reutilización con doble firma es
 * la del Emisor.
 */
export async function buildDictamenCompletoBuffer(
  solicitudId: string | null,
  overrides: PdfOverrides = {},
  catalogoId: string | null = null,
  firmas: FirmaPortal[] = [],
): Promise<DictamenCompletoResult> {
  if (!solicitudId && !catalogoId) {
    return { ok: false, status: 400, error: "Falta solicitudId o catalogoId" };
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
      return { ok: false, status: 404, error: "Solicitud no encontrada" };
    }
    const folioMeta = solMeta.dictamen?.folio ?? solMeta.folio_dictamen ?? solMeta.folio_recepcion ?? solicitudId;
    clave = claveParaPdf(solMeta.secretaria, folioMeta, solMeta.historial_solicitud.length > 0);
  } else {
    const cjMeta = await prisma.catalogo_justificacion.findUnique({
      where: { id: Number(catalogoId) },
      select: { secretaria: true, folio_dictamen: true, folio_recepcion: true },
    });
    if (!cjMeta) {
      return { ok: false, status: 404, error: "Registro de catálogo no encontrado" };
    }
    const folioMeta = cjMeta.folio_dictamen ?? cjMeta.folio_recepcion ?? catalogoId!;
    clave = claveParaPdf(cjMeta.secretaria, folioMeta, true);
  }

  // Cuando se firma (reutilización desde Catálogo), el nombre y cargo de quien
  // firma también se imprimen en el propio Dictamen (debajo de la NOTA), además
  // de la Constancia de Firma Electrónica que se agrega al final del documento.
  const firmaImpresa = firmas.length > 0 ? firmas[firmas.length - 1] : null;
  const dictamenOverrides = firmaImpresa
    ? {
        ...overrides,
        firmaNombre: firmaImpresa.responsable ?? undefined,
        firmaCargo: firmaImpresa.cargo ?? undefined,
        firmaUrlValidacion: firmaImpresa.urlValidacion ?? undefined,
      }
    : overrides;

  let dictamenResult, cartaResult;
  try {
    dictamenResult = await buildDictamenPrestacionBuffer(solicitudId, dictamenOverrides, catalogoId);
    cartaResult = await buildCartaDescriptivaBuffer(solicitudId, clave || null, catalogoId, new Date());
  } catch (e) {
    console.error("[pdf/dictamen-prestacion-completo] Error generando buffers:", e);
    return { ok: false, status: 500, error: mensajePublico(e, "Error al generar el PDF") };
  }

  if (!dictamenResult || !cartaResult) {
    return { ok: false, status: 404, error: "Solicitud no encontrada" };
  }

  try {
    const merged = await PDFDocument.create();
    for (const buf of [cartaResult.buffer, dictamenResult.buffer]) {
      const src = await PDFDocument.load(buf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    let mergedBytes: Uint8Array = await merged.save();

    const filename = `Dictamen_${dictamenResult.folio.replace(/\//g, "-")}.pdf`;

    // Reutilización desde Catálogo con firma: se agrega la misma página de
    // "Constancia de Firma Electrónica" que llevan los Dictámenes normales
    // (ver lib/pdf-firma-estampado.ts), no un texto aparte dentro del Dictamen.
    if (firmas.length > 0) {
      mergedBytes = await agregarConstanciaFirma({
        pdfBase: Buffer.from(mergedBytes),
        firmas,
        nombreArchivo: filename,
        folio: dictamenResult.folio,
      });
    }

    return { ok: true, bytes: mergedBytes, filename };
  } catch (e) {
    console.error("[pdf/dictamen-prestacion-completo] Error uniendo PDFs:", e);
    return { ok: false, status: 500, error: mensajePublico(e, "Error al unir los documentos") };
  }
}

async function buildResponse(solicitudId: string | null, overrides: PdfOverrides = {}, catalogoId: string | null = null, firma: FirmaPortal | null = null) {
  const r = await buildDictamenCompletoBuffer(solicitudId, overrides, catalogoId, firma ? [firma] : []);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return new NextResponse(new Uint8Array(r.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.filename}"`,
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
  const ib = searchParams.get("importeBruto"); if (ib) overrides.importeBruto = Number(ib);
  return buildResponse(solicitudId, overrides, catalogoId);
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
  if (body?.importeBruto != null && body.importeBruto !== "") overrides.importeBruto = Number(body.importeBruto);

  // Reutilización desde Catálogo: firma electrónica inmediata de una sola
  // persona (quien reutiliza) — se agrega como página de Constancia de Firma
  // Electrónica, igual que en Dictámenes. Solo se activa si el cliente manda
  // estos campos — una descarga normal (sin firma) sigue funcionando igual.
  let firma: FirmaPortal | null = null;
  if (body?.firmaCargo && body?.firmaUsuarioId) {
    // El id que manda el cliente debe ser el de la sesión (lib/session.ts).
    const actorErr = verificarActor(sesion, String(body.firmaUsuarioId))
    if (actorErr) return actorErr
    if (!(await puedeFirmarCatalogo(String(body.firmaUsuarioId)))) {
      return NextResponse.json(
        { ok: false, error: "Solo un usuario con rol UEFA o Administrador puede firmar la reutilización del Catálogo." },
        { status: 403 },
      );
    }
    try {
      firma = await resolverFirmaCatalogo({
        usuarioId: String(body.firmaUsuarioId),
        cargo: String(body.firmaCargo),
        folio: solicitudId ?? catalogoId ?? "N/A",
        certificado: body.firmaCertificado ? String(body.firmaCertificado) : undefined,
        clavePrivada: body.firmaClavePrivada ? String(body.firmaClavePrivada) : undefined,
        fraseClavePrivada: body.firmaFraseClavePrivada ? String(body.firmaFraseClavePrivada) : undefined,
        nombreCert: body.nombreCert ? String(body.nombreCert) : undefined,
        rfcCert: body.rfcCert ? String(body.rfcCert) : undefined,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: mensajePublico(e, "No se pudo firmar el dictamen") },
        { status: 400 },
      );
    }
  }

  return buildResponse(solicitudId, overrides, catalogoId, firma);
}
