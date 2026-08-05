import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaDictamenPrestacionServicios,
  type DictamenPrestacionData,
} from "@/components/plantillas/PlantillaDictamenPrestacionServicios";
import { claveParaPdf, MARCA_HISTORICO_IMPORTADO } from "@/lib/clave-dictamen";
import { applyTextRules } from "@/lib/utils";
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

  if (sol) {
    const esHistoricoImportado = sol.historial_solicitud.length > 0;
    folio =
      sol.dictamen?.folio ??
      sol.folio_dictamen ??
      sol.folio_recepcion ??
      String(sol.id);
    data = {
      folio,
      fecha: formatFechaLarga(sol.dictamen?.fecha_emision ?? sol.fecha_emision),
      secretariaDependencia: sol.secretaria ?? "",
      unidadResponsableGasto: sol.unidad_responsable ?? "",
      unidadAdministrativa: sol.unidad_administrativa ?? "",
      regimenContratacion: sol.regimen ?? "",
      tipoServicios: applyTextRules(sol.tipo_actividades ?? ""),
      claveNombrePrograma: applyTextRules(sol.programa_proyecto ?? ""),
      objetoContratacion: applyTextRules(sol.objeto ?? ""),
      importeBruto: formatImporte(sol.importe_bruto),
      tipoPagoLabel: (sol.tipo_importe ?? "").replace(/_/g, " ") || undefined,
      justificacion: claveParaPdf(sol.secretaria, folio, esHistoricoImportado) || sol.folio_justificacion || "",
      numeroPrestadores: overrides.numeroPrestadores ?? sol.numero_prestadores ?? 1,
      vigenciaInicio: overrides.vigenciaInicio ?? (sol.vigencia_inicio
        ? sol.vigencia_inicio.toISOString().split("T")[0]
        : ""),
      vigenciaFin: overrides.vigenciaFin ?? (sol.vigencia_fin
        ? sol.vigencia_fin.toISOString().split("T")[0]
        : ""),
    };
  } else if (catalogoId) {
    // Registro histórico sin solicitud viva — datos archivados directo en catalogo_justificacion.
    const cj = await prisma.catalogo_justificacion.findUnique({ where: { id: Number(catalogoId) } });
    if (!cj) return null;
    folio = cj.folio_dictamen ?? cj.folio_recepcion ?? String(cj.id);
    data = {
      folio,
      fecha: formatFechaLarga(cj.fecha_emision ?? cj.creado_en),
      secretariaDependencia: cj.secretaria ?? "",
      unidadResponsableGasto: cj.unidad_responsable ?? "",
      unidadAdministrativa: cj.unidad_administrativa ?? "",
      regimenContratacion: cj.regimen_contratacion ?? "",
      tipoServicios: applyTextRules(cj.tipo_actividad ?? ""),
      claveNombrePrograma: applyTextRules(cj.programa_proyecto ?? ""),
      objetoContratacion: applyTextRules(cj.objeto ?? ""),
      importeBruto: formatImporte(cj.importe_bruto),
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

  const filename = `Dictamen_${folio.replace(/\//g, "-")}.pdf`;

  return { buffer, sol, folio, filename };
}

async function buildPDFResponse(solicitudId: string | null, overrides: PdfOverrides = {}, catalogoId: string | null = null) {
  if (!solicitudId && !catalogoId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId o catalogoId" },
      { status: 400 },
    );
  }

  const result = await buildDictamenPrestacionBuffer(solicitudId, overrides, catalogoId);
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
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  const catalogoId = searchParams.get("catalogoId");
  const overrides: PdfOverrides = {};
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi;
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf;
  const np = searchParams.get("numeroPrestadores") ?? searchParams.get("numeroPersonas");
  if (np) overrides.numeroPrestadores = Number(np);
  return buildPDFResponse(solicitudId, overrides, catalogoId);
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
  return buildPDFResponse(solicitudId, overrides, catalogoId);
}
