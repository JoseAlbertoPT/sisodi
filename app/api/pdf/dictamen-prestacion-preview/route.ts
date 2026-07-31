import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaDictamenPrestacionServicios,
  type DictamenPrestacionData,
} from "@/components/plantillas/PlantillaDictamenPrestacionServicios";
import React from "react";

export const runtime = "nodejs";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET() {
  const mock: DictamenPrestacionData = {
    folio: "10/07/2026",
    fecha: "08 de julio de 2026",
    secretariaDependencia: "Secretaría de Gobierno",
    unidadResponsableGasto:
      "Comisión de Búsqueda de Personas del Estado de Morelos",
    unidadAdministrativa:
      "Comisión de Búsqueda de Personas del Estado de Morelos",
    regimenContratacion: "Honorarios",
    tipoServicios: "Actividades Jurídico-Administrativo (Asistente A)",
    claveNombrePrograma:
      "U008 Subsidio para Acciones de Búsqueda de Personas Desaparecidas y No Localizadas 2026 Proyecto para el Fortalecimiento de Capacidades",
    objetoContratacion:
      "Brindar asesoría jurídico-administrativa especializada a la Comisión de Búsqueda de Personas del Estado de Morelos, así como el seguimiento a los asuntos en materia de transparencia, subsidios federales y búsqueda de personas, mediante el análisis e interpretación del marco normativo y la revisión de instrumentos jurídicos y administrativos, con la finalidad de fortalecer el cumplimiento del marco normativo aplicable y garantizar la adecuada atención de los asuntos competencia de la Comisión.",
    importeBruto: "$20,000.00",
    tipoPagoLabel: "mensual",
    justificacion: "SG/10/07/2026",
    numeroPrestadores: 1,
    vigenciaInicio: "2026-08-03",
    vigenciaFin: "2026-12-31",
  };

  const stream = await renderToStream(
    React.createElement(
      PlantillaDictamenPrestacionServicios as React.FC<any>,
      { data: mock },
    ) as any,
  );
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="dictamen-prestacion-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
