import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import {
  PlantillaCartaDescriptiva,
  type CartaDescriptivaData,
} from "@/components/plantillas/PlantillaCartaDescriptiva";
import React from "react";

export const runtime = "nodejs";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const dataEjemplo: CartaDescriptivaData = {
  objetoContratacion:
    "Contratación de un prestador de servicios profesionales para apoyar en las actividades de análisis, seguimiento y control de los procesos administrativos de la Unidad, conforme al programa de trabajo autorizado.",
  propositoServicios:
    "Fortalecer la capacidad operativa de la Unidad Administrativa mediante la incorporación de personal especializado que coadyuve al cumplimiento oportuno de los objetivos y metas institucionales.",
  actividades: [
    "Elaborar reportes periódicos sobre el avance de los procesos a su cargo.",
    "Dar seguimiento a los oficios y solicitudes turnadas a la Unidad.",
    "Apoyar en la integración y actualización de expedientes.",
  ],
  responsabilidades: [
    "Cumplir con las actividades encomendadas dentro de los plazos establecidos.",
    "Resguardar la información y documentación a la que tenga acceso.",
    "Observar la normatividad aplicable en el desempeño de sus funciones.",
  ],
  perfil: {
    escolaridadMinima: ["Licenciatura concluida en área administrativa, financiera o afín."],
    competenciasAdministrativas: ["Manejo de office", "Redacción de documentos oficiales"],
    competenciasTecnicas: ["Análisis de datos", "Manejo de sistemas administrativos"],
    competenciasSociales: ["Trabajo en equipo", "Comunicación efectiva"],
    valores: ["Honestidad", "Responsabilidad", "Compromiso institucional"],
    areasExperiencia: ["Administración pública", "Gestión de procesos"],
  },
  clave: "SDEyT/034/07/2026",
};

export async function GET() {
  const pdfElement = React.createElement(PlantillaCartaDescriptiva as React.FC<any>, {
    data: dataEjemplo,
  });
  const pdfStream = await renderToStream(pdfElement as any);
  const pdfBuffer = await streamToBuffer(pdfStream);

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Carta_Descriptiva_preview.pdf"',
    },
  });
}
