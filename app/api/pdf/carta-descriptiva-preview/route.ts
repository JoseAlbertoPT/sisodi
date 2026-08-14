import { NextResponse } from "next/server";
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

export async function GET() {
  const mock: CartaDescriptivaData = {
    clave: "SDEyT/34/01/2026",
    fecha: "01 de enero de 2026",
    objetoContratacion:
      "Ejecutar acciones estratégicas de difusión y comunicación institucional sobre los proyectos de inversión y el crecimiento económico del Estado de Morelos, a través de medios digitales, redes sociales y materiales informativos, con el objetivo de dar visibilidad a los proyectos, fortalecer la confianza del sector empresarial, atraer nuevas inversiones y consolidar al Estado como un destino competitivo para la instalación y expansión de proyectos productivos.",
    actividades: [
      "Gestionar las redes sociales institucionales, mediante la creación y difusión de contenido y mensajes oficiales, con la finalidad de informar sobre los proyectos de inversión del Estado de Morelos.",
      "Elaborar contenido informativo y promocional, mediante materiales gráficos, comunicados institucionales y publicaciones en redes sociales, con el objetivo de difundir los avances, resultados y logros alcanzados en los proyectos de inversión.",
      "Investigar y recabar información estadística económica de las inversiones del Estado a través de la consulta en sitios oficiales con la finalidad de desarrollar contenido que permita informar las inversiones y datos económicos del Estado.",
      "Monitorear el impacto de las acciones estratégicas de difusión mediante las métricas de alcance e interacción en plataformas digitales, con el fin de optimizar la efectividad de la comunicación institucional.",
      "Registrar y dar seguimiento a los mensajes, comentarios y solicitudes de información recibidos en redes sociales, mediante su revisión y atención oportuna, con el objetivo de garantizar una adecuada respuesta y fortalecer la consolidación de nuevos proyectos de inversión.",
    ],
    responsabilidades: [
      "Generar contenido estratégico para redes y medios digitales, mediante el uso de herramientas de diseño y narrativa institucional, con la finalidad de posicionar al Estado de Morelos como un destino competitivo para la inversión.",
      "Elaborar los contenidos digitales y materiales informativos, mediante la recopilación de datos técnicos y casos de éxito, con la finalidad de promover proyectos de consolidación y expansión de inversiones en la entidad.",
      "Validar la información económica utilizada en las plataformas digitales, a través de la verificación de fuentes oficiales y datos estadísticos, con la finalidad de asegurar la veracidad, confiabilidad y congruencia de la imagen institucional.",
      "Analizar las métricas de alcance e interacción en redes sociales, mediante el monitoreo de indicadores clave de desempeño (KPIs), con la finalidad de identificar áreas de mejora y optimizar la estrategia de difusión institucional.",
      "Atender y canalizar los mensajes y solicitudes de información, a través de una gestión proactiva en redes sociales, con la finalidad de garantizar respuestas oportunas que fortalezcan la vinculación con potenciales inversionistas.",
    ],
    escolaridad: [
      "Licenciatura en Comunicación, Administración, Mercadotecnia, carrera a fin y/o experiencia curricular comprobable.",
    ],
    competenciasAdministrativas: [
      "Planeación y organización",
      "Gestión de información",
      "Seguimiento y control",
    ],
    competenciasTecnicas: [
      "Comunicación institucional y digital",
      "Manejo de redes sociales institucionales",
      "Análisis de métricas digitales",
      "Búsqueda y análisis de información económica",
      "Uso de herramientas digitales",
    ],
    competenciasSociales: [
      "Comunicación efectiva oral y escrita",
      "Resolución de conflictos y manejo de situaciones bajo presión",
      "Trabajo colaborativo",
      "Orientación al servicio",
    ],
    valores: [
      "Responsabilidad",
      "Honestidad",
      "Transparencia",
      "Trabajo en equipo",
      "Respeto",
    ],
    areasExperiencia: [
      "Plataformas digitales",
      "Comunicación Institucional",
      "Redes Sociales",
    ],
  };

  const stream = await renderToStream(
    React.createElement(
      PlantillaCartaDescriptivaServicios as React.FC<any>,
      { data: mock },
    ) as any,
  );
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="carta-descriptiva-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
