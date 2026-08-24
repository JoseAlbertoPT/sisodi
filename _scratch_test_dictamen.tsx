import { renderToStream } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import React from "react";
import { PlantillaDictamenPrestacionServicios, type DictamenPrestacionData } from "./components/plantillas/PlantillaDictamenPrestacionServicios";
import fs from "fs";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const data: DictamenPrestacionData = {
  folio: "18/08/2026",
  fecha: "21 de agosto de 2026",
  secretariaDependencia: "Jefatura de la Oficina de la Gubernatura del Estado",
  unidadResponsableGasto: "Jefatura de la Oficina de la Gubernatura del Estado",
  unidadAdministrativa: "1.01.1.0.0.0.0",
  regimenContratacion: "Honorarios",
  tipoServicios: "Prestación de servicios profesionales",
  claveNombrePrograma: "P-005 Fortalecimiento Institucional",
  objetoContratacion: "Prestación de servicios profesionales para apoyar en las actividades administrativas de la Jefatura de la Oficina de la Gubernatura del Estado, incluyendo la elaboración de reportes, el seguimiento a indicadores, la atención a solicitudes ciudadanas, la coordinación con otras unidades administrativas, el apoyo en la logística de eventos institucionales, la sistematización de la información generada por la unidad, la elaboración de minutas y actas de reuniones de trabajo, así como cualquier otra actividad afín encomendada por su jefe inmediato en el ámbito de sus competencias y atribuciones, garantizando en todo momento la confidencialidad de la información manejada y el cumplimiento de los lineamientos internos de la dependencia.",
  importeBruto: "$15,000.00",
  tipoPagoLabel: "mensual",
  justificacion: "SAF-DGDO-000123",
  numeroPrestadores: 1,
  vigenciaInicio: "2026-08-21",
  vigenciaFin: "2027-02-21",
  notaDictamen: "Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable. Asimismo, se hace del conocimiento que cualquier modificación posterior a la vigencia, importe o condiciones pactadas en el presente dictamen deberá ser notificada oportunamente a esta Dirección General para su valoración correspondiente, en apego a la normatividad vigente en la materia, y que el incumplimiento de dicha notificación podrá derivar en la cancelación del presente documento sin responsabilidad para esta autoridad. Se reitera que el presente dictamen no exime a la unidad administrativa solicitante de cumplir con las demás disposiciones jurídicas y administrativas aplicables en materia de contratación de prestadores de servicios.",
};

async function main() {
  const stream = await renderToStream(React.createElement(PlantillaDictamenPrestacionServicios, { data }) as any);
  const buffer = await streamToBuffer(stream as unknown as NodeJS.ReadableStream);
  fs.writeFileSync("_scratch_dictamen.pdf", buffer);
  const doc = await PDFDocument.load(buffer);
  console.log("PAGE COUNT:", doc.getPageCount());
}

main().catch((e) => { console.error(e); process.exit(1); });
