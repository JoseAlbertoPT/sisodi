import { NextRequest, NextResponse } from "next/server";
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaCartaDescriptivaServicios,
  type CartaDescriptivaData,
} from "@/components/plantillas/PlantillaCartaDescriptivaServicios";
import { claveParaPdf, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { puedeMostrarFolioDictamen } from "@/lib/firma-visibilidad";
import { buildRomanNumberedList } from "@/lib/roman-list";
import { applyTextRules } from "@/lib/utils";
import { generarQRPng } from "@/lib/pdf-firma-estampado";
import React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const PUA_RANGE_START = 0xe000;
const PUA_RANGE_END = 0xf8ff;

function stripPUA(str: string): string {
  return Array.from(str)
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < PUA_RANGE_START || cp > PUA_RANGE_END;
    })
    .join(String());
}

function cleanBulletText(item: string): string {
  return applyTextRules(
    stripPUA(item).replace(/^[\s•‣◦⁃∙\-–—]+/, ""),
  );
}

function splitToArray(str: string | null | undefined): string[] {
  if (!str || str.trim() === "") return [];
  return str
    .split(/\n+/)
    .map(cleanBulletText)
    .filter((item) => item.length > 0);
}


function toSingleLine(str: string | null | undefined): string[] {
  if (!str || str.trim() === "") return [];
  const joined = str
    .split(/\n+/)
    .map(cleanBulletText)
    .filter((item) => item.length > 0)
    .join(" ");
  return joined ? [joined] : [];
}

function formatFechaLarga(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function buildCartaDescriptivaBuffer(
  solicitudId: string | null,
  claveOverride: string | null,
  catalogoId?: string | null,
  fechaOverride?: Date | null,
  firma?: { nombre?: string; cargo?: string; urlValidacion?: string } | null,
) {
  const sol = solicitudId
    ? await prisma.solicitud.findUnique({
        where: { id: Number(solicitudId) },
        include: {
          estado: { select: { nombre: true } },
          historial_solicitud: {
            where: { comentario: { contains: MARCA_HISTORICO_IMPORTADO } },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null;

  let source: {
    fecha: string;
    objeto: string | null;
    actividades: string[];
    responsabilidades: string[];
    escolaridad: string | null;
    comp_adm: string | null;
    comp_tec: string | null;
    comp_soc: string | null;
    valores: string | null;
    areas_exp: string | null;
    folioBase: string;
    clave: string;
  } | null = null;

  if (sol) {
    const esHistoricoImportado = sol.historial_solicitud.length > 0;
    // Regla 12: el folio de dictamen no se expone en documentos descargables
    // hasta que la solicitud llegue a "Emitido" (última firma completada).
    const folioDictamenVisible = puedeMostrarFolioDictamen((sol as any).estado?.nombre) ? sol.folio_dictamen : null;
    const folio = folioDictamenVisible ?? sol.folio_recepcion ?? String(sol.id);
    source = {
      fecha: formatFechaLarga(fechaOverride ?? sol.fecha_creacion ?? sol.fecha_envio),
      objeto: sol.objeto,
      actividades: sol.actividades ?? [],
      responsabilidades: sol.responsabilidades ?? [],
      escolaridad: sol.escolaridad,
      comp_adm: sol.comp_adm,
      comp_tec: sol.comp_tec,
      comp_soc: sol.comp_soc,
      valores: sol.valores,
      areas_exp: sol.areas_exp,
      folioBase: sol.folio_recepcion ?? folioDictamenVisible ?? String(sol.id),
      clave: claveOverride ?? claveParaPdf(sol.secretaria, folio, esHistoricoImportado),
    };
  } else if (catalogoId) {
    const cj = await prisma.catalogo_justificacion.findUnique({ where: { id: Number(catalogoId) } });
    if (!cj) return null;
    const folio = cj.folio_dictamen ?? cj.folio_recepcion ?? String(cj.id);
    source = {
      fecha: formatFechaLarga(fechaOverride ?? cj.creado_en),
      objeto: cj.objeto,
      actividades: cj.actividades ?? [],
      responsabilidades: cj.responsabilidades ?? [],
      escolaridad: cj.escolaridad,
      comp_adm: cj.comp_adm,
      comp_tec: cj.comp_tec,
      comp_soc: cj.comp_soc,
      valores: cj.valores,
      areas_exp: cj.areas_exp,
      folioBase: cj.folio_recepcion ?? cj.folio_dictamen ?? String(cj.id),
      clave: claveOverride ?? claveParaPdf(cj.secretaria, folio, true),
    };
  }

  if (!source) return null;

  const data: CartaDescriptivaData = {
    clave: source.clave,
    fecha: source.fecha,
    objetoContratacion: applyTextRules(stripPUA(source.objeto ?? "")),
    actividades: buildRomanNumberedList(source.actividades, stripPUA, applyTextRules),
    responsabilidades: buildRomanNumberedList(source.responsabilidades, stripPUA, applyTextRules),
    escolaridad: toSingleLine(source.escolaridad),
    competenciasAdministrativas: splitToArray(source.comp_adm),
    competenciasTecnicas: splitToArray(source.comp_tec),
    competenciasSociales: splitToArray(source.comp_soc),
    valores: splitToArray(source.valores),
    areasExperiencia: splitToArray(source.areas_exp),
    firmaNombre: firma?.nombre,
    firmaCargo: firma?.cargo,
    firmaUrlValidacion: firma?.urlValidacion,
    firmaQrPng: firma?.urlValidacion
      ? await generarQRPng(firma.urlValidacion, 200).catch(() => undefined)
      : undefined,
  };

  const stream = await renderToStream(
    React.createElement(
      PlantillaCartaDescriptivaServicios as React.FC<any>,
      { data },
    ) as any,
  );
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

  const filename = `CartaDescriptiva_${source.folioBase.replace(/\//g, "-")}.pdf`;

  return { buffer, sol, filename };
}

async function buildPDFResponse(
  solicitudId: string | null,
  claveOverride: string | null,
  catalogoId: string | null = null,
) {
  if (!solicitudId && !catalogoId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId o catalogoId" },
      { status: 400 },
    );
  }

  const result = await buildCartaDescriptivaBuffer(solicitudId, claveOverride, catalogoId);
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
  const clave = searchParams.get("clave");
  const catalogoId = searchParams.get("catalogoId");
  return buildPDFResponse(solicitudId, clave, catalogoId);
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const clave = body?.clave ? String(body.clave) : null;
  const catalogoId = body?.catalogoId ? String(body.catalogoId) : null;
  return buildPDFResponse(solicitudId, clave, catalogoId);
}
