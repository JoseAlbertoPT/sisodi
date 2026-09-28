"use client"

import type { HistoricoRow } from "./parse-excel-historico"
import { parseImporteTexto } from "./parse-importe"

export const HISTORICO_COLUMNS = {
  folioJustificacion: "FOLIO DE JUSTIFICACIÓN",
  folioDictamen: "FOLIO DE DICTAMEN/OPINIÓN",
  secretaria: "SECRETARÍA/SUBSECRETARÍA/DEPENDENCIA/ORGANISMO AUXILIAR",
  unidadAdscripcion: "UNIDAD ADMINISTRATIVA DE ADSCRIPCIÓN",
  unidadResponsableGasto: "UNIDAD RESPONSABLE DEL GASTO",
  programaProyecto: "PROGRAMA O PROYECTO",
  regimenContratacion: "RÉGIMEN DE CONTRATACIÓN",
  tipoActividad: "TIPO DE ACTIVIDAD",
  numPrestadores: "NÚMERO DE PRESTADORES DE SERVICIO",
  vigenciaInicio: "VIGENCIA (INICIO)",
  vigenciaTermino: "VIGENCIA (TÉRMINO)",
  importeBruto: "IMPORTE BRUTO (mensual/por día/por hora)",
  objetoContratacion: "OBJETO DE LA CONTRATACIÓN",
  actividadesRealizar: "ACTIVIDADES A REALIZAR POR EL PRESTADOR DE SERVICIOS",
  responsabilidades: "RESPONSABILIDADES A CUMPLIR POR EL PRESTADOR DE SERVICIOS",
  escolaridadMinima: "ESCOLARIDAD MÍNIMA",
  competenciasAdministrativas: "COMPETENCIAS ADMINISTRATIVAS",
  competenciasTecnicas: "COMPETENCIAS TÉCNICAS",
  competenciasSociales: "COMPETENCIAS SOCIALES",
  valores: "VALORES",
  areasExperiencia: "ÁREAS DE EXPERIENCIA",
} as const

export interface HistoricoPrestacionForm {
  secretaria: string
  unidadAdscripcion: string
  unidadResponsableGasto: string
  programaProyecto: string
  regimen: string
  tipoActividad: string
  numPrestadores: string
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  objetoContratacion: string
  actividades: string[]
  responsabilidades: string[]
  escolaridadMinima: string
  competenciasAdministrativas: string
  competenciasTecnicas: string
  competenciasSociales: string
  valores: string
  areasExperiencia: string
}

function get(row: HistoricoRow, key: keyof typeof HISTORICO_COLUMNS): string {
  const col = HISTORICO_COLUMNS[key]
  const val = row[col]
  return val != null ? String(val).trim() : ""
}

function vigenciaToISO(ddmmyyyy: string): string {
  const t = ddmmyyyy.trim()
  if (!t) return ""
  const parts = t.split(/[/\-.]/)
  if (parts.length !== 3) return ""
  const [d, m, y] = parts
  const day = d.padStart(2, "0")
  const month = m.padStart(2, "0")
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${month}-${day}`
}

function formatImporteBruto(raw: string): string {
  const n = parseImporteTexto(raw)
  if (n === null) return ""
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function splitListItems(text: string): string[] {
  const normalized = text
    .split(/\n|\r\n/)
    .map((s) => s.replace(/^\s*[IVX]+\.\s*/, "").replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean)
  return normalized.length > 0 ? normalized : [""]
}

function mapRegimen(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("ASIMILADO")) return "asimilados"
  if (u.includes("HONORARIO")) return "honorarios"
  return ""
}

function mapTipoActividad(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("PROFESIONAL") || u.includes("PROFESIONALES")) return "profesional"
  if (u.includes("TECNIC") || u.includes("TÉCNIC")) return "tecnico"
  if (u.includes("OPERATIV") || u.includes("OPERATIVA")) return "operativo"
  if (u.includes("ASESOR") || u.includes("ASESORÍA")) return "asesoria"
  return ""
}

function mapEscolaridad(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("BACHILLERATO")) return "bachillerato"
  if (u.includes("TÉCNICO SUPERIOR") || u.includes("TECNICO SUPERIOR")) return "tecnico"
  if (u.includes("LICENCIATURA") || u.includes("LICENCIADO")) return "licenciatura"
  if (u.includes("MAESTRÍA") || u.includes("MAESTRIA")) return "maestria"
  if (u.includes("DOCTORADO")) return "doctorado"
  return ""
}

function mapUnidadAdscripcion(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("PROFESIONALIZACION") || u.includes("INNOVACION") || u.includes("INNOVACIÓN")) return "dgpic"
  if (u.includes("ADMINISTRACION") && u.includes("FINANZAS")) return "dgaf"
  if (u.includes("RECURSOS HUMANOS")) return "dgrh"
  return ""
}

function mapUnidadResponsableGasto(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("OFICINA") || u.includes("SECRETARIO")) return "urg-01"
  if (u.includes("DIRECCION GENERAL") || u.includes("DIRECCIÓN GENERAL")) return "urg-02"
  if (u.includes("COORDINACION") || u.includes("COORDINACIÓN")) return "urg-03"
  return ""
}

export function mapHistoricoRowToPrestacion(row: HistoricoRow): HistoricoPrestacionForm {
  const secretaria = get(row, "secretaria")
  const rawUnidadAdsc = get(row, "unidadAdscripcion")
  const rawURG = get(row, "unidadResponsableGasto")
  const actividadesRaw = get(row, "actividadesRealizar")
  const responsabilidadesRaw = get(row, "responsabilidades")

  return {
    secretaria: secretaria || "Secretaria de Administracion",
    unidadAdscripcion: mapUnidadAdscripcion(rawUnidadAdsc) || "",
    unidadResponsableGasto: mapUnidadResponsableGasto(rawURG) || "",
    programaProyecto: get(row, "programaProyecto"),
    regimen: mapRegimen(get(row, "regimenContratacion")),
    tipoActividad: mapTipoActividad(get(row, "tipoActividad")),
    numPrestadores: get(row, "numPrestadores") || "",
    vigenciaInicio: vigenciaToISO(get(row, "vigenciaInicio")),
    vigenciaFin: vigenciaToISO(get(row, "vigenciaTermino")),
    importeBruto: formatImporteBruto(get(row, "importeBruto")),
    objetoContratacion: get(row, "objetoContratacion"),
    actividades: splitListItems(actividadesRaw),
    responsabilidades: splitListItems(responsabilidadesRaw),
    escolaridadMinima: mapEscolaridad(get(row, "escolaridadMinima")),
    competenciasAdministrativas: get(row, "competenciasAdministrativas"),
    competenciasTecnicas: get(row, "competenciasTecnicas"),
    competenciasSociales: get(row, "competenciasSociales"),
    valores: get(row, "valores"),
    areasExperiencia: get(row, "areasExperiencia"),
  }
}
