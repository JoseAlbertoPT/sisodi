import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaCartaDescriptivaServicios,
  type CartaDescriptivaData,
} from "@/components/plantillas/PlantillaCartaDescriptivaServicios";
import React from "react";

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

function formatFechaMesAnio(d: Date | null | undefined): string {
  if (!d) return "";
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const dt = new Date(d);
  return `${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

async function buildPDFResponse(
  solicitudId: string | null,
  claveOverride: string | null,
) {
  if (!solicitudId) {
    return NextResponse.json(
      { ok: false, error: "Falta solicitudId" },
      { status: 400 },
    );
  }

  const sol = await prisma.solicitud.findUnique({
    where: { id: Number(solicitudId) },
  });

  if (!sol) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }

  const data: CartaDescriptivaData = {
    // ponytail: clave llega por override; pendiente definir dónde nace en sistema
    clave: claveOverride ?? "",
    fecha: formatFechaMesAnio(sol.fecha_creacion ?? sol.fecha_envio),
    objetoContratacion: sol.objeto ?? "",
    actividades: sol.actividades ?? [],
    responsabilidades: sol.responsabilidades ?? [],
    escolaridad: splitToArray(sol.escolaridad),
    competenciasAdministrativas: splitToArray(sol.comp_adm),
    competenciasTecnicas: splitToArray(sol.comp_tec),
    competenciasSociales: splitToArray(sol.comp_soc),
    valores: splitToArray(sol.valores),
    areasExperiencia: splitToArray(sol.areas_exp),
  };

  const stream = await renderToStream(
    React.createElement(
      PlantillaCartaDescriptivaServicios as React.FC<any>,
      { data },
    ) as any,
  );
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

  const folioBase =
    sol.folio_recepcion ?? sol.folio_dictamen ?? String(sol.id);
  const filename = `CartaDescriptiva_${folioBase.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
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
  const clave = searchParams.get("clave");
  return buildPDFResponse(solicitudId, clave);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const solicitudId = body?.solicitudId ? String(body.solicitudId) : null;
  const clave = body?.clave ? String(body.clave) : null;
  return buildPDFResponse(solicitudId, clave);
}
