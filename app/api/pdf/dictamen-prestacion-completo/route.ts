import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { buildCartaDescriptivaBuffer } from "../carta-descriptiva/route";
import { buildDictamenPrestacionBuffer } from "../dictamen-prestacion/route";
import { claveParaPdf, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { efirmaClient } from "@/lib/efirma-client";
import { agregarConstanciaFirma, type FirmaPortal } from "@/lib/pdf-firma-estampado";
import { puedeFirmarCatalogo } from "@/lib/api-guard";

export const runtime = "nodejs";

const BYPASS = process.env.EFIRMA_BYPASS === "true";

interface PdfOverrides {
  vigenciaInicio?: string
  vigenciaFin?: string
  numeroPrestadores?: number
  programaProyecto?: string
}

interface FirmaInput {
  usuarioId: string
  cargo: string
  certificado?: string
  clavePrivada?: string
  fraseClavePrivada?: string
}

function selloFalso(prefix: string, length = 344): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = prefix;
  while (out.length < length) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out.slice(0, length - 2) + "==";
}

/**
 * Resuelve la firma electrónica de quien reutiliza desde Catálogo — un solo
 * firmante, autofirma inmediata (no pasa por firma_proceso/firma_firmante:
 * a diferencia de una solicitud normal, aquí no hay un solicitud_id propio
 * al que atar un proceso multi-firmante, y no lo necesita — es un sello
 * inmediato de una sola persona, no un flujo de varios pasos). Devuelve la
 * misma forma (FirmaPortal) que usa la Constancia de Firma Electrónica de
 * Dictámenes, para reutilizar exactamente esa página (ver agregarConstanciaFirma).
 */
async function resolverFirma(input: FirmaInput): Promise<FirmaPortal> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: input.usuarioId },
    select: { nombre: true, rfc: true },
  });
  if (!usuario?.rfc) {
    throw new Error("Tu usuario no tiene RFC registrado. Contacta al administrador.");
  }
  if (!input.cargo?.trim()) {
    throw new Error("Falta el cargo/puesto de quien firma.");
  }
  const cargo = input.cargo.trim().toUpperCase();
  const rfc = usuario.rfc.toUpperCase();
  const ahora = new Date();

  if (!BYPASS) {
    if (!input.certificado || !input.clavePrivada || !input.fraseClavePrivada) {
      throw new Error("Faltan credenciales de e.firma (.cer, .key y contraseña).");
    }
    // Firma real contra el portal: se usa el modo "firmar de una vez" del
    // mismo cliente que usa el resto del sistema (ver efirmaClient.iniciar),
    // sin crear un firma_proceso persistente — es de un solo uso.
    const portalRes: any = await efirmaClient.iniciar({
      firmarAhora: true,
      usuario: rfc,
      certificado: input.certificado,
      clavePrivada: input.clavePrivada,
      fraseClavePrivada: input.fraseClavePrivada,
      nombre: `ReutilizacionCatalogo-${Date.now()}`,
      totalFirmantes: 1,
    });
    return {
      usuario: rfc,
      rolFirmante: `Realizó — ${cargo}`,
      responsable: usuario.nombre,
      selloDigital: portalRes?.selloDigital ?? portalRes?.firma?.selloDigital ?? null,
      estampadoTiempo: portalRes?.estampadoTiempo ?? ahora.toISOString().replace("T", " ").slice(0, 19),
      selloEstampadoTiempo: portalRes?.selloEstampadoTiempo ?? null,
      noCertificado: portalRes?.noCertificado ?? null,
      noCertificadoGEM: portalRes?.noCertificadoGEM ?? null,
      rfcGEM: portalRes?.rfcGEM ?? null,
      urlValidacion: portalRes?.urlValidacion ?? null,
      firmadoEn: ahora,
      cargo,
    };
  }

  // Modo bypass (desarrollo): mismos datos ficticios que usa el resto del
  // sistema para simular una firma completa sin llamar al portal real.
  return {
    usuario: rfc,
    rolFirmante: `Realizó — ${cargo}`,
    responsable: usuario.nombre,
    selloDigital: selloFalso("DEMO"),
    estampadoTiempo: ahora.toISOString().replace("T", " ").slice(0, 19),
    selloEstampadoTiempo: selloFalso("GEM"),
    noCertificado: "00001000000700000001",
    noCertificadoGEM: "00001000000709040175",
    rfcGEM: "GEM720601TW9",
    urlValidacion: `${(process.env.EFIRMA_PORTAL_URL ?? "https://firma-dev.morelos.gob.mx").replace(/\/$/, "")}/ValidacionFirma?uuid=${crypto.randomUUID()}`,
    firmadoEn: ahora,
    cargo,
  };
}

async function buildResponse(solicitudId: string | null, overrides: PdfOverrides = {}, catalogoId: string | null = null, firma: FirmaPortal | null = null) {
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

  // Cuando se firma (reutilización desde Catálogo), el nombre y cargo de quien
  // firma también se imprimen en el propio Dictamen (debajo de la NOTA), además
  // de la Constancia de Firma Electrónica que se agrega al final del documento.
  const dictamenOverrides = firma
    ? {
        ...overrides,
        firmaNombre: firma.responsable ?? undefined,
        firmaCargo: firma.cargo ?? undefined,
        firmaUrlValidacion: firma.urlValidacion ?? undefined,
      }
    : overrides;

  let dictamenResult, cartaResult;
  try {
    dictamenResult = await buildDictamenPrestacionBuffer(solicitudId, dictamenOverrides, catalogoId);
    cartaResult = await buildCartaDescriptivaBuffer(solicitudId, clave || null, catalogoId, new Date());
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
    let mergedBytes = await merged.save();

    const filename = `Dictamen_${dictamenResult.folio.replace(/\//g, "-")}.pdf`;

    // Reutilización desde Catálogo con firma: se agrega la misma página de
    // "Constancia de Firma Electrónica" que llevan los Dictámenes normales
    // (ver lib/pdf-firma-estampado.ts), no un texto aparte dentro del Dictamen.
    if (firma) {
      mergedBytes = await agregarConstanciaFirma({
        pdfBase: Buffer.from(mergedBytes),
        firmas: [firma],
        nombreArchivo: filename,
        folio: dictamenResult.folio,
      });
    }

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

  // Reutilización desde Catálogo: firma electrónica inmediata de una sola
  // persona (quien reutiliza) — se agrega como página de Constancia de Firma
  // Electrónica, igual que en Dictámenes. Solo se activa si el cliente manda
  // estos campos — una descarga normal (sin firma) sigue funcionando igual.
  let firma: FirmaPortal | null = null;
  if (body?.firmaCargo && body?.firmaUsuarioId) {
    if (!(await puedeFirmarCatalogo(String(body.firmaUsuarioId)))) {
      return NextResponse.json(
        { ok: false, error: "Solo un usuario con rol UEFA o Administrador puede firmar la reutilización del Catálogo." },
        { status: 403 },
      );
    }
    try {
      firma = await resolverFirma({
        usuarioId: String(body.firmaUsuarioId),
        cargo: String(body.firmaCargo),
        certificado: body.firmaCertificado ? String(body.firmaCertificado) : undefined,
        clavePrivada: body.firmaClavePrivada ? String(body.firmaClavePrivada) : undefined,
        fraseClavePrivada: body.firmaFraseClavePrivada ? String(body.firmaFraseClavePrivada) : undefined,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "No se pudo firmar el dictamen" },
        { status: 400 },
      );
    }
  }

  return buildResponse(solicitudId, overrides, catalogoId, firma);
}
