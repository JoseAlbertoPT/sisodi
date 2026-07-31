import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaDictamenPrestacionServicios,
  type DictamenPrestacionData,
} from "@/components/plantillas/PlantillaDictamenPrestacionServicios";
import { construirClave } from "@/lib/clave-dictamen";
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
  solicitudId: string,
  overrides: PdfOverrides = {},
) {
  const sol = await prisma.solicitud.findUnique({
    where: { id: Number(solicitudId) },
    include: { dictamen: true },
  });

  if (!sol) return null;

  const folio =
    sol.dictamen?.folio ??
    sol.folio_dictamen ??
    sol.folio_recepcion ??
    String(sol.id);

  const data: DictamenPrestacionData = {
    folio,
    fecha: formatFechaLarga(sol.dictamen?.fecha_emision ?? sol.fecha_emision),
    secretariaDependencia: sol.secretaria ?? "",
    unidadResponsableGasto: sol.unidad_responsable ?? "",
    unidadAdministrativa: sol.unidad_administrativa ?? "",
    regimenContratacion: sol.regimen ?? "",
    tipoServicios: sol.tipo_actividades ?? "",
    claveNombrePrograma: sol.programa_proyecto ?? "",
    objetoContratacion: sol.objeto ?? "",
    importeBruto: formatImporte(sol.importe_bruto),
    tipoPagoLabel: (sol.tipo_importe ?? "").replace(/_/g, " ") || undefined,
    justificacion: construirClave(sol.secretaria, folio) || sol.folio_justificacion || "",
    numeroPrestadores: overrides.numeroPrestadores ?? sol.numero_prestadores ?? 1,
    vigenciaInicio: overrides.vigenciaInicio ?? (sol.vigencia_inicio
      ? sol.vigencia_inicio.toISOString().split("T")[0]
      : ""),
    vigenciaFin: overrides.vigenciaFin ?? (sol.vigencia_fin
      ? sol.vigencia_fin.toISOString().split("T")[0]
      : ""),
  };

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

async function buildPDFResponse(solicitudId: string | null, overrides: PdfOverrides = {}) {
  if (!solicitudId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId" },
      { status: 400 },
    );
  }

  const result = await buildDictamenPrestacionBuffer(solicitudId, overrides);
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
  const overrides: PdfOverrides = {};
  const vi = searchParams.get("vigenciaInicio"); if (vi) overrides.vigenciaInicio = vi;
  const vf = searchParams.get("vigenciaFin");    if (vf) overrides.vigenciaFin    = vf;
  const np = searchParams.get("numeroPrestadores") ?? searchParams.get("numeroPersonas");
  if (np) overrides.numeroPrestadores = Number(np);
  return buildPDFResponse(solicitudId, overrides);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const overrides: PdfOverrides = {};
  if (body?.vigenciaInicio) overrides.vigenciaInicio = String(body.vigenciaInicio);
  if (body?.vigenciaFin)    overrides.vigenciaFin    = String(body.vigenciaFin);
  const np = body?.numeroPrestadores ?? body?.numeroPersonas;
  if (np) overrides.numeroPrestadores = Number(np);
  return buildPDFResponse(solicitudId, overrides);
}
