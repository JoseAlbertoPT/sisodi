import jsPDF from "jspdf"

// ── Types ──
export interface JustificacionData {
  folio: string
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Determinado" | "Nombramiento Tiempo Det."
  secretaria: string
  unidadAdministrativa: string
  denominacion: string
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior?: string
  fecha: string
  /** true only when solicitud is already in any DO stage or Emitido */
  firmadoDigitalmente: boolean
}

// ── Helpers ──
const PAGE_W = 215.9 // letter mm
const PAGE_H = 279.4
const M_LEFT = 25
const M_RIGHT = 25
const M_TOP = 30
const M_BOTTOM = 25
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT
const LINE_H = 5.5

function drawHeader(doc: jsPDF, pageNum: number, totalPages: number) {
  // Top rule
  doc.setDrawColor(0, 90, 50) // institutional green
  doc.setLineWidth(0.8)
  doc.line(M_LEFT, 18, PAGE_W - M_RIGHT, 18)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 90, 50)
  doc.text("GOBIERNO DEL ESTADO", M_LEFT, 14)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text(`Pagina ${pageNum} de ${totalPages}`, PAGE_W - M_RIGHT, 14, { align: "right" })
}

function drawFooter(doc: jsPDF) {
  const y = PAGE_H - 15
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(M_LEFT, y, PAGE_W - M_RIGHT, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text("Documento generado por el Sistema de Gestion de Honorarios — Solo para uso interno", M_LEFT, y + 4)
  doc.text("Direccion de Obligaciones (DO) — DGRH", PAGE_W - M_RIGHT, y + 4, { align: "right" })
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(0, 90, 50)
  doc.text(title, M_LEFT, y)
  doc.setDrawColor(0, 90, 50)
  doc.setLineWidth(0.4)
  doc.line(M_LEFT, y + 1.5, PAGE_W - M_RIGHT, y + 1.5)
  return y + 7
}

function fieldRow(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.text(`${label}:`, M_LEFT, y)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 30, 30)
  const labelWidth = doc.getTextWidth(`${label}: `)
  const valueX = M_LEFT + Math.max(labelWidth, 45)

  const lines = doc.splitTextToSize(value, CONTENT_W - (valueX - M_LEFT))
  doc.text(lines, valueX, y)
  return y + Math.max(lines.length, 1) * LINE_H + 1
}

function bulletList(doc: jsPDF, y: number, items: string[]): number {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(30, 30, 30)
  let currentY = y
  for (const item of items) {
    const lines = doc.splitTextToSize(`•  ${item}`, CONTENT_W - 8)
    doc.text(lines, M_LEFT + 4, currentY)
    currentY += lines.length * LINE_H + 1
  }
  return currentY
}

// ── Main generator ──
export function buildJustificacionPDFDoc(data: JustificacionData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
  const totalPages = 3
  return _fillDoc(doc, data, totalPages)
}

export function generateJustificacionPDFBase64(data: JustificacionData): string {
  const doc = buildJustificacionPDFDoc(data)
  const out = doc.output("datauristring")
  // "data:application/pdf;filename=generated.pdf;base64,XXXX" → extract XXXX
  const idx = out.indexOf("base64,")
  return idx >= 0 ? out.slice(idx + "base64,".length) : out
}

export function generateJustificacionPDF(data: JustificacionData) {
  const doc = buildJustificacionPDFDoc(data)
  doc.save(`Justificacion_${data.folio}.pdf`)
}

function _fillDoc(doc: jsPDF, data: JustificacionData, totalPages: number) {

  // ═══════════════════ PAGE 1 ═══════════════════
  drawHeader(doc, 1, totalPages)
  drawFooter(doc)

  // Document title
  let y = M_TOP + 2
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(0, 60, 35)
  doc.text("JUSTIFICACION DE CONTRATACION", PAGE_W / 2, y, { align: "center" })
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  const isPrestacion = data.tipo === "Prestacion de Servicios"
  doc.text(`Capitulo ${isPrestacion ? "3000 — Honorarios por Servicios Profesionales" : "1000 — Honorarios Asimilados a Salarios"}`, PAGE_W / 2, y, { align: "center" })
  y += 10

  // Section: Datos Generales
  y = sectionTitle(doc, y, "1. Datos Generales")
  y = fieldRow(doc, y, "Folio", data.folio)
  y = fieldRow(doc, y, "Tipo de solicitud", data.tipo)
  y = fieldRow(doc, y, "Secretaria / Dependencia", data.secretaria)
  y = fieldRow(doc, y, "Unidad Administrativa", data.unidadAdministrativa)
  y = fieldRow(doc, y, "Denominacion del puesto", data.denominacion)
  y = fieldRow(doc, y, "Vigencia", `${data.vigenciaInicio}  al  ${data.vigenciaFin}`)
  y = fieldRow(doc, y, "Importe Bruto Mensual", data.importeBruto)
  y = fieldRow(doc, y, "Tipo de contratacion", data.esRenovacion ? "Renovacion" : "Nueva contratacion")
  if (data.esRenovacion && data.folioAnterior) {
    y = fieldRow(doc, y, "Folio dictamen anterior", data.folioAnterior)
  }
  y = fieldRow(doc, y, "Fecha de solicitud", data.fecha)

  y += 6

  // Section: Renovacion
  y = sectionTitle(doc, y, "2. Renovacion / Antecedentes")
  if (data.esRenovacion) {
    y = fieldRow(doc, y, "Contratacion previa", "Si — Se trata de una renovacion de contrato")
    y = fieldRow(doc, y, "Dictamen previo", data.folioAnterior || "N/A")
    y = fieldRow(doc, y, "Justificacion de renovacion", "El prestador de servicios ha cumplido satisfactoriamente con las funciones encomendadas en el periodo anterior, y las actividades sustantivas que desempena continuan siendo necesarias para el adecuado funcionamiento de la unidad administrativa.")
  } else {
    y = fieldRow(doc, y, "Contratacion previa", "No — Nueva contratacion")
    y = fieldRow(doc, y, "Justificacion", "Se requiere la incorporacion de personal especializado para cubrir las necesidades operativas del area, mismas que no pueden ser atendidas con la plantilla de personal de estructura actual.")
  }

  // ═══════════════════ PAGE 2 ═══════════════════
  doc.addPage("letter", "portrait")
  drawHeader(doc, 2, totalPages)
  drawFooter(doc)
  y = M_TOP + 2

  // Section: Objeto de la contratacion
  y = sectionTitle(doc, y, "3. Objeto de la Contratacion")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(30, 30, 30)
  const objetoText = isPrestacion
    ? "Contratacion de servicios profesionales especializados para el desarrollo, seguimiento y evaluacion de programas institucionales, asi como para la atencion de las funciones sustantivas de la unidad administrativa requirente, asegurando el cumplimiento de las metas y objetivos del area."
    : "Contratacion bajo el regimen de honorarios asimilados a salarios para desempenar funciones de coordinacion, supervision y ejecucion de actividades administrativas y operativas, garantizando la continuidad de las funciones sustantivas de la dependencia."
  const objetoLines = doc.splitTextToSize(objetoText, CONTENT_W)
  doc.text(objetoLines, M_LEFT, y)
  y += objetoLines.length * LINE_H + 6

  // Section: Actividades principales
  y = sectionTitle(doc, y, "4. Actividades Principales")
  const actividades = isPrestacion
    ? [
        "Elaborar informes tecnicos y reportes de avance sobre los programas a su cargo.",
        "Coordinar con las areas involucradas la ejecucion oportuna de las actividades programadas.",
        "Analizar y proponer mejoras a los procesos administrativos y operativos del area.",
        "Dar seguimiento al cumplimiento de indicadores de gestion y compromisos institucionales.",
        "Participar en reuniones de trabajo y comites tecnicos relacionados con el objeto del contrato.",
        "Las demas que le encomiende el titular de la unidad administrativa en el ambito de su competencia.",
      ]
    : [
        "Supervisar al personal operativo asignado al area de responsabilidad.",
        "Elaborar y presentar reportes trimestrales de avance y cumplimiento de metas.",
        "Coordinar procesos administrativos internos de la unidad administrativa.",
        "Asegurar el cumplimiento normativo en todas las operaciones del area.",
        "Gestionar y dar seguimiento a tramites interinstitucionales.",
        "Las demas funciones que le sean encomendadas por el superior jerarquico inmediato.",
      ]
  y = bulletList(doc, y, actividades)
  y += 4

  // Section: Responsabilidades
  y = sectionTitle(doc, y, "5. Responsabilidades")
  const responsabilidades = [
    "Cumplir con la normatividad aplicable al ejercicio de los recursos publicos.",
    "Mantener la confidencialidad de la informacion institucional a la que tenga acceso.",
    "Entregar en tiempo y forma los productos y/o entregables comprometidos.",
    "Reportar oportunamente cualquier irregularidad detectada en el ejercicio de sus funciones.",
  ]
  y = bulletList(doc, y, responsabilidades)
  y += 4

  // Section: Perfil requerido
  y = sectionTitle(doc, y, "6. Perfil Profesional Requerido")
  y = fieldRow(doc, y, "Escolaridad minima", "Licenciatura (titulado o pasante)")
  y = fieldRow(doc, y, "Experiencia", "Minimo 2 anos en funciones similares")
  y = fieldRow(doc, y, "Conocimientos", "Administracion publica, normatividad gubernamental, paqueteria Office")

  // ═══════════════════ PAGE 3 ═══════════════════
  doc.addPage("letter", "portrait")
  drawHeader(doc, 3, totalPages)
  drawFooter(doc)
  y = M_TOP + 2

  // Section: Marco normativo
  y = sectionTitle(doc, y, "7. Marco Normativo Aplicable")
  const normativo = [
    "Ley Organica de la Administracion Publica del Estado.",
    "Ley de Presupuesto, Gasto Publico y su Contabilidad del Estado.",
    "Reglamento Interior de la Secretaria requirente.",
    "Lineamientos Generales para la Contratacion de Servicios Profesionales por Honorarios.",
    "Clasificador por Objeto del Gasto — Capitulo 1000 / 3000, segun corresponda.",
  ]
  y = bulletList(doc, y, normativo)
  y += 4

  // Section: Documentos adjuntos
  y = sectionTitle(doc, y, "8. Documentos Adjuntos")
  const documentos = [
    "Curriculum vitae del prestador de servicios.",
    "Copia de identificacion oficial vigente.",
    "Constancia de situacion fiscal.",
    "Oficio de suficiencia presupuestal.",
    data.esRenovacion ? "Dictamen anterior y evaluacion de desempeno." : "Justificacion de la unidad administrativa.",
  ]
  y = bulletList(doc, y, documentos)

  // ── Signature block ──
  y += 20
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)

  // Center signature
  const sigCenterX = PAGE_W / 2
  const sigLineW = 80
  doc.line(sigCenterX - sigLineW / 2, y, sigCenterX + sigLineW / 2, y)

  y += 5
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text("Elaboro y valido", sigCenterX, y, { align: "center" })
  y += 5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.text("Lic. Laura Vega Martinez", sigCenterX, y, { align: "center" })
  y += 4.5
  doc.text("Analista de Validacion — UEFA / DGRH", sigCenterX, y, { align: "center" })

  if (data.firmadoDigitalmente) {
    y += 7
    // Digital signature box
    doc.setDrawColor(0, 90, 50)
    doc.setLineWidth(0.5)
    const boxW = 70
    const boxH = 14
    doc.roundedRect(sigCenterX - boxW / 2, y, boxW, boxH, 2, 2)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(0, 90, 50)
    doc.text("FIRMADO DIGITALMENTE", sigCenterX, y + 5.5, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(80, 80, 80)
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, sigCenterX, y + 10, { align: "center" })
  }

  return doc
}
