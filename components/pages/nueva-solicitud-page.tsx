"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  FilePlus, Upload, ArrowLeft, ArrowRight, Plus, Trash2,
  FileText, ClipboardList, Save, SendHorizonal, AlertCircle, Info,
  ShieldAlert, CheckCircle2, Clock, Calendar, Lock,
} from "lucide-react"
import { useSolicitudes, type TipoAdministracion } from "@/lib/solicitudes-store"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { useAuth } from "@/lib/auth-context"
import { CAP_3000, CAP_1000, NOMBRAMIENTO_TD, parseDateDMY, isPeriodoVigente } from "@/lib/calendario-recepcion-mock"
import { useHistoricoStore } from "@/lib/historico-store"
import type { HistoricoRow } from "@/lib/parse-excel-historico"

export type FormularioData = {
  secretaria:            string
  unidadAdministrativa:  string
  unidadResponsable:     string
  programaProyecto:      string
  regimen:               string
  tipoActividades:       string
  numeroPrestadores:     string
  denominacion:          string
  vigenciaInicio:        string
  vigenciaFin:           string
  importeBruto:          string
  objeto:                string
  actividades:           string[]
  responsabilidades:     string[]
  escolaridad:           string
  compAdm:               string
  compTec:               string
  compSoc:               string
  valores:               string
  areasExp:              string
}

// Tabulador
const RANGOS_TABULADOR = [
  { min: 32124.36, max: 49846.50, nivel: "105", puesto: "Director General" },
  { min: 24380.00, max: 32123.30, nivel: "106", puesto: "Coordinador de area" },
  { min: 19080.00, max: 24369.40, nivel: "107", puesto: "Director de area" },
  { min: 0.00,     max: 18830.90, nivel: "108", puesto: "Subdirector de area" },
  { min: 0.00,     max: 13292.40, nivel: "109", puesto: "Jefe de departamento" },
  { min: 11600.00, max: 15898.94, nivel: "301", puesto: "Especialista" },
  { min: 10554.00, max: 11658.94, nivel: "302", puesto: "Tecnico especializado" },
  { min: 0.00,     max: 10553.36, nivel: "303", puesto: "Tecnico operativo / Registrador" },
]

// Columnas de Excel
const COL = {
  secretaria:             "SECRETARÍA/SUBSECRETARÍA/DEPENDENCIA/ORGANISMO AUXILIAR",
  unidadAdscripcion:      "UNIDAD ADMINISTRATIVA DE ADSCRIPCIÓN",
  unidadResponsableGasto: "UNIDAD RESPONSABLE DEL GASTO",
  programaProyecto:       "PROGRAMA O PROYECTO",
  regimen:                "RÉGIMEN DE CONTRATACIÓN",
  tipoActividad:          "TIPO DE ACTIVIDAD",
  numPrestadores:         "NÚMERO DE PRESTADORES DE SERVICIO",
  vigenciaInicio:         "VIGENCIA (INICIO)",
  vigenciaTermino:        "VIGENCIA (TÉRMINO)",
  importeBruto:           "IMPORTE BRUTO (mensual/por día/por hora)",
  objeto:                 "OBJETO DE LA CONTRATACIÓN",
  actividades:            "ACTIVIDADES A REALIZAR POR EL PRESTADOR DE SERVICIOS",
  responsabilidades:      "RESPONSABILIDADES A CUMPLIR POR EL PRESTADOR DE SERVICIOS",
  escolaridad:            "ESCOLARIDAD MÍNIMA",
  compAdm:                "COMPETENCIAS ADMINISTRATIVAS",
  compTec:                "COMPETENCIAS TÉCNICAS",
  compSoc:                "COMPETENCIAS SOCIALES",
  valores:                "VALORES",
  areasExp:               "ÁREAS DE EXPERIENCIA",
  folioJustificacion:     "FOLIO DE JUSTIFICACIÓN",
  folioDictamen:          "FOLIO DE DICTAMEN/OPINIÓN",
} as const

// Catálogos
const SECRETARIAS_CATALOGO = [
  "Secretaria de Administracion",
  "Secretaria de Finanzas",
  "Secretaria de Educacion",
  "Secretaria de Salud",
  "Secretaria de Gobierno",
  "Secretaria de Obras Publicas",
  "Secretaria de Desarrollo Social",
  "Secretaria de Seguridad Publica",
]

type DatosSecretaria = {
  unidades:  { value: string; label: string }[]
  urgs:      { value: string; label: string }[]
  programas: string[]
  regimen:   string
}

const DATOS_FALLBACK: Record<string, DatosSecretaria> = {
  "Secretaria de Administracion": {
    unidades: [
      { value: "Dir. Gral. de Profesionalizacion e Innovacion", label: "Dir. Gral. de Profesionalizacion e Innovacion" },
      { value: "Dir. Gral. de Administracion y Finanzas",       label: "Dir. Gral. de Administracion y Finanzas" },
      { value: "Dir. Gral. de Recursos Humanos",                label: "Dir. Gral. de Recursos Humanos" },
    ],
    urgs: [
      { value: "URG-01 Oficina del Secretario",      label: "URG-01 Oficina del Secretario" },
      { value: "URG-02 Direccion General",           label: "URG-02 Direccion General" },
      { value: "URG-03 Coordinacion Administrativa", label: "URG-03 Coordinacion Administrativa" },
    ],
    programas: ["P-001 Modernizacion Administrativa", "P-002 Profesionalizacion"],
    regimen: "honorarios",
  },
  "Secretaria de Finanzas": {
    unidades: [
      { value: "Dir. Gral. de Presupuesto",                  label: "Dir. Gral. de Presupuesto" },
      { value: "Dir. Gral. de Tesoreria",                    label: "Dir. Gral. de Tesoreria" },
      { value: "Dir. Gral. de Contabilidad y Fiscalizacion", label: "Dir. Gral. de Contabilidad y Fiscalizacion" },
    ],
    urgs: [
      { value: "URG-F01 Despacho del Secretario",  label: "URG-F01 Despacho del Secretario" },
      { value: "URG-F02 Subsecretaria de Egresos", label: "URG-F02 Subsecretaria de Egresos" },
    ],
    programas: ["F-001 Control Presupuestal", "F-002 Fiscalizacion"],
    regimen: "asimilados",
  },
  "Secretaria de Educacion": {
    unidades: [
      { value: "Dir. de Educacion Basica",           label: "Dir. de Educacion Basica" },
      { value: "Dir. de Educacion Media Superior",   label: "Dir. de Educacion Media Superior" },
      { value: "Dir. de Educacion Normal y Superior",label: "Dir. de Educacion Normal y Superior" },
    ],
    urgs: [
      { value: "URG-E01 Oficina del Titular",     label: "URG-E01 Oficina del Titular" },
      { value: "URG-E02 Subsecretaria Academica", label: "URG-E02 Subsecretaria Academica" },
    ],
    programas: ["E-001 Cobertura Educativa", "E-002 Calidad Docente"],
    regimen: "honorarios",
  },
  "Secretaria de Salud": {
    unidades: [
      { value: "Dir. de Atencion Primaria a la Salud", label: "Dir. de Atencion Primaria a la Salud" },
      { value: "Dir. de Hospitales y Servicios",       label: "Dir. de Hospitales y Servicios" },
    ],
    urgs: [
      { value: "URG-S01 Despacho Secretarial",                label: "URG-S01 Despacho Secretarial" },
      { value: "URG-S02 Subsecretaria de Servicios de Salud", label: "URG-S02 Subsecretaria de Servicios de Salud" },
    ],
    programas: ["S-001 Atencion Medica Universal", "S-002 Prevencion y Promocion"],
    regimen: "honorarios",
  },
  "Secretaria de Gobierno": {
    unidades: [
      { value: "Dir. de Servicios Juridicos",       label: "Dir. de Servicios Juridicos" },
      { value: "Dir. de Seguridad Publica y Civil", label: "Dir. de Seguridad Publica y Civil" },
    ],
    urgs: [
      { value: "URG-G01 Despacho del Secretario",   label: "URG-G01 Despacho del Secretario" },
      { value: "URG-G02 Subsecretaria de Gobierno", label: "URG-G02 Subsecretaria de Gobierno" },
    ],
    programas: ["G-001 Seguridad Ciudadana", "G-002 Coordinacion Interinstitucional"],
    regimen: "honorarios",
  },
  "Secretaria de Obras Publicas": {
    unidades: [
      { value: "Dir. de Obras y Proyectos",        label: "Dir. de Obras y Proyectos" },
      { value: "Dir. de Control y Calidad",        label: "Dir. de Control y Calidad" },
      { value: "Dir. de Licitaciones y Contratos", label: "Dir. de Licitaciones y Contratos" },
    ],
    urgs: [
      { value: "URG-O01 Despacho del Secretario", label: "URG-O01 Despacho del Secretario" },
      { value: "URG-O02 Subsecretaria Tecnica",   label: "URG-O02 Subsecretaria Tecnica" },
    ],
    programas: ["O-001 Infraestructura Vial", "O-002 Obra Social"],
    regimen: "honorarios",
  },
  "Secretaria de Desarrollo Social": {
    unidades: [
      { value: "Dir. de Desarrollo Social",                  label: "Dir. de Desarrollo Social" },
      { value: "Dir. de Programas y Proyectos Comunitarios", label: "Dir. de Programas y Proyectos Comunitarios" },
    ],
    urgs: [
      { value: "URG-D01 Despacho Titular",          label: "URG-D01 Despacho Titular" },
      { value: "URG-D02 Subsecretaria de Bienestar", label: "URG-D02 Subsecretaria de Bienestar" },
    ],
    programas: ["D-001 Atencion a Grupos Vulnerables", "D-002 Combate a la Pobreza"],
    regimen: "asimilados",
  },
  "Secretaria de Seguridad Publica": {
    unidades: [
      { value: "Dir. de Policia Operativa",               label: "Dir. de Policia Operativa" },
      { value: "Dir. de Investigacion y Prevencion",      label: "Dir. de Investigacion y Prevencion" },
      { value: "Dir. de Tecnologias e Inteligencia Criminal", label: "Dir. de Tecnologias e Inteligencia Criminal" },
    ],
    urgs: [
      { value: "URG-SP01 Comisionado General",     label: "URG-SP01 Comisionado General" },
      { value: "URG-SP02 Subsecretaria Operativa", label: "URG-SP02 Subsecretaria Operativa" },
    ],
    programas: ["SP-001 Prevencion del Delito", "SP-002 Proximidad Social"],
    regimen: "honorarios",
  },
}

//HELPERS
function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getCell(row: HistoricoRow, colTarget: string): string {
  const exact = row[colTarget]
  if (exact != null) return String(exact).trim()
  const targetNorm = norm(colTarget)
  for (const key of Object.keys(row)) {
    if (norm(key) === targetNorm) {
      const v = row[key]
      return v != null ? String(v).trim() : ""
    }
  }
  return ""
}

function detectarClaves(
  rows: HistoricoRow[],
  targets: Record<string, string>
): Record<string, string> {
  if (rows.length === 0) return targets
  const sampleKeys = Object.keys(rows[0])
  const resultado: Record<string, string> = {}
  for (const [alias, colTarget] of Object.entries(targets)) {
    if (sampleKeys.includes(colTarget)) {
      resultado[alias] = colTarget
      continue
    }
    const targetNorm = norm(colTarget)
    const found = sampleKeys.find((k) => norm(k) === targetNorm)
    resultado[alias] = found ?? colTarget
  }
  return resultado
}

function getFallback(secretaria: string): DatosSecretaria | null {
  if (DATOS_FALLBACK[secretaria]) return DATOS_FALLBACK[secretaria]
  const key = Object.keys(DATOS_FALLBACK).find(
    (k) =>
      k.toLowerCase().includes(secretaria.toLowerCase()) ||
      secretaria.toLowerCase().includes(k.toLowerCase().split(" ")[1] ?? "___")
  )
  return key ? DATOS_FALLBACK[key] : null
}

function getDatosSecretaria(secretaria: string, rows: HistoricoRow[]): DatosSecretaria | null {
  if (!secretaria) return null

  if (rows.length > 0) {
    const claves = detectarClaves(rows, {
      secretaria:             COL.secretaria,
      unidadAdscripcion:      COL.unidadAdscripcion,
      unidadResponsableGasto: COL.unidadResponsableGasto,
      programaProyecto:       COL.programaProyecto,
      regimen:                COL.regimen,
    })

    const secNorm = norm(secretaria)
    let filas = rows.filter((row) => {
      const val = norm(getCell(row, claves.secretaria))
      return val.includes(secNorm) || secNorm.includes(val.split(" ")[1] ?? "___")
    })

    if (filas.length === 0) filas = rows

    const unidadesMap = new Map<string, string>()
    filas.forEach((row) => {
      const u = getCell(row, claves.unidadAdscripcion)
      if (u) unidadesMap.set(u, u)
    })
    const unidades = Array.from(unidadesMap.keys())
      .sort()
      .map((u) => ({ value: u, label: u }))

    const urgsMap = new Map<string, string>()
    filas.forEach((row) => {
      const urg = getCell(row, claves.unidadResponsableGasto)
      if (urg) urgsMap.set(urg, urg)
    })
    const urgs = Array.from(urgsMap.keys())
      .sort()
      .map((u) => ({ value: u, label: u }))

    const programasSet = new Set<string>()
    filas.forEach((row) => {
      const p = getCell(row, claves.programaProyecto)
      if (p) programasSet.add(p)
    })

    const regimenCount: Record<string, number> = {}
    filas.forEach((row) => {
      const r = normalizaRegimen(getCell(row, claves.regimen))
      regimenCount[r] = (regimenCount[r] ?? 0) + 1
    })
    const regimenFrecuente =
      Object.entries(regimenCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "honorarios"

    if (unidades.length > 0 || urgs.length > 0) {
      const fb = getFallback(secretaria)
      return {
        unidades:  unidades.length > 0  ? unidades  : (fb?.unidades  ?? []),
        urgs:      urgs.length > 0      ? urgs      : (fb?.urgs      ?? []),
        programas: programasSet.size > 0 ? Array.from(programasSet).sort() : (fb?.programas ?? []),
        regimen:   regimenFrecuente,
      }
    }
  }

  return getFallback(secretaria)
}

function parseImporteBruto(raw: string): string {
  if (!raw) return ""
  let clean = raw.replace(/[$\s]/g, "")
  const commas = (clean.match(/,/g) ?? []).length
  const dots   = (clean.match(/\./g) ?? []).length
  if (commas === 2) {
    const last = clean.lastIndexOf(",")
    clean = clean.slice(0, last).replace(/,/g, "") + "." + clean.slice(last + 1)
  } else if (commas === 1 && dots === 0) {
    const parts = clean.split(",")
    if (parts[1].length <= 2) clean = parts[0] + "." + parts[1]
    else clean = parts.join("")
  } else {
    clean = clean.replace(/,/g, "")
  }
  const n = parseFloat(clean)
  if (Number.isNaN(n)) return ""
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseMoney(str: string): number {
  if (!str) return -1
  const clean = str.replace(/[$,\s]/g, "")
  const n = parseFloat(clean)
  return isNaN(n) ? -1 : n
}

function splitList(text: string): string[] {
  const lines = text
    .split(/\n|\r\n/)
    .map((s) => s.replace(/^\s*[IVX]+\.\s*/, "").replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean)
  return lines.length > 0 ? lines : [""]
}

function mapEscolaridad(excel: string): string {
  const u = excel.toUpperCase()
  if (u.includes("BACHILLERATO")) return "bachillerato"
  if (u.includes("TÉCNICO SUPERIOR") || u.includes("TECNICO SUPERIOR")) return "tecnico"
  if (u.includes("LICENCIATURA") || u.includes("LICENCIADO")) return "licenciatura"
  if (u.includes("MAESTRÍA") || u.includes("MAESTRIA")) return "maestria"
  if (u.includes("DOCTORADO")) return "doctorado"
  return "licenciatura"
}

function normalizaRegimen(excel: string): string {
  const u = excel.toUpperCase().trim()
  if (u.includes("ASIMILADO")) return "asimilados"
  if (u.includes("HONORARIO")) return "honorarios"
  if (u.includes("NOMBRAMIENTO") || u.includes("TIEMPO DETERMINADO")) return "nombramiento"
  return u.toLowerCase()
}

function extraerAnioMes(fechaStr: string): { anio: number; mes: number } | null {
  if (!fechaStr) return null
  const matchDMY = fechaStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (matchDMY) return { anio: parseInt(matchDMY[3]), mes: parseInt(matchDMY[2]) }
  const matchYMD = fechaStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (matchYMD) return { anio: parseInt(matchYMD[1]), mes: parseInt(matchYMD[2]) }
  const serial = parseFloat(fechaStr)
  if (!isNaN(serial) && serial > 40000) {
    const d = new Date((serial - 25569) * 86400 * 1000)
    return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
  }
  return null
}

const MESES_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function parsePeriodo(periodoLabel: string): { anio: number; mes: number } | null {
  if (!periodoLabel) return null
  const lower = periodoLabel.toLowerCase()
  const anioMatch = lower.match(/\b(20\d{2})\b/)
  const anio = anioMatch ? parseInt(anioMatch[1]) : null
  if (!anio) return null
  for (const [nombre, num] of Object.entries(MESES_ES)) {
    if (lower.includes(nombre)) return { anio, mes: num }
  }
  return { anio, mes: 0 }
}

function rowEnPeriodo(row: HistoricoRow, periodoLabel: string): boolean {
  if (!periodoLabel) return true
  const periodo = parsePeriodo(periodoLabel)
  if (!periodo) return true
  const inicioStr = getCell(row, COL.vigenciaInicio)
  const finStr    = getCell(row, COL.vigenciaTermino)
  const inicio = extraerAnioMes(inicioStr)
  const fin    = extraerAnioMes(finStr)
  if (!inicio) return false
  if (periodo.mes === 0) {
    return periodo.anio >= inicio.anio && periodo.anio <= (fin?.anio ?? inicio.anio)
  }
  const periodoNum = periodo.anio * 100 + periodo.mes
  const inicioNum  = inicio.anio * 100 + inicio.mes
  const finNum     = fin ? fin.anio * 100 + fin.mes : inicioNum
  return periodoNum >= inicioNum && periodoNum <= finNum
}

const OPCIONES_COMPETENCIAS_ADM = [
  "Toma de Decisiones","Análisis e Interpretación de Información",
  "Planificación de Actividades","Control y Seguimiento","Negociación","Liderazgo",
]
const OPCIONES_COMPETENCIAS_TEC = [
  "Conocimientos en Prevención Social","Consultoría en Gestión de la No Violencia",
  "Análisis de Información","Desarrollo de Software","Bases de Datos","Redes y Telecomunicaciones",
]
const OPCIONES_COMPETENCIAS_SOC = [
  "Trabajo en Equipo","Relaciones Interpersonales","Capacidad de Comunicación",
  "Orientación a Resultados","Adaptabilidad",
]
const OPCIONES_VALORES = [
  "Equidad de Género","Responsabilidad","Transparencia","Eficiencia","Rendición de Cuentas","Integridad",
]
const OPCIONES_AREAS_EXP = [
  "Estrategias de Seguridad","Geo Estadística de Seguridad","Seguridad Pública","Seguridad Ciudadana",
  "Redes en Seguridad Pública","Administración Pública","Tecnologías de la Información",
]

const SECRETARIAS_EXCEPCION = [
  "Sec. de Finanzas","Sec. de Educacion","Sec. de Salud",
  "Sec. de Gobierno","Sec. de Obras","Sec. de Desarrollo",
]
const UNIDADES_ADMINISTRATIVAS_EXC = [
  "Dir. Gral. de Administracion y Finanzas",
  "Dir. Gral. de Profesionalizacion e Innovacion",
  "Dir. Gral. de Recursos Humanos",
]

function useExcelRows(historicos: { sheets: Record<string, HistoricoRow[]> }[]): HistoricoRow[] {
  return useMemo(() => {
    if (historicos.length === 0) return []
    const last = historicos[historicos.length - 1]
    return Object.values(last.sheets).flat()
  }, [historicos])
}

const FALLBACK_TIPOS_ACTIVIDAD: Record<string, { value: string; label: string }[]> = {
  honorarios: [
    { value: "profesional", label: "Actividades Profesionales" },
    { value: "tecnico",     label: "Actividades Técnicas" },
    { value: "operativo",   label: "Actividades Operativas" },
    { value: "asesoria",    label: "Actividades de Asesoría" },
  ],
  asimilados: [
    { value: "profesional", label: "Actividades Profesionales" },
    { value: "tecnico",     label: "Actividades Técnicas" },
    { value: "asesoria",    label: "Actividades de Asesoría" },
  ],
  nombramiento: [
    { value: "directivo",   label: "Directivo" },
    { value: "mando_medio", label: "Mando Medio" },
    { value: "operativo",   label: "Operativo" },
    { value: "tecnico_esp", label: "Técnico Especializado" },
  ],
}

function extraerTiposActividad(
  rows: HistoricoRow[], regimen: string, programa?: string
): { value: string; label: string }[] {
  const regimenNorm = regimen.toLowerCase().trim()
  const filtered = rows
    .filter((row) => {
      const r = getCell(row, COL.regimen)
      if (!r) return true
      const rNorm = normalizaRegimen(r)
      return rNorm === regimenNorm || r.toLowerCase().includes(regimenNorm)
    })
    .filter((row) => {
      if (!programa) return true
      return getCell(row, COL.programaProyecto) === programa
    })
  const seen = new Set<string>()
  const result: { value: string; label: string }[] = []
  filtered.forEach((row) => {
    const label = getCell(row, COL.tipoActividad)
    if (!label) return
    const value = label.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
    if (!seen.has(value)) { seen.add(value); result.push({ value, label }) }
  })
  return result
}

function useTiposActividad(regimen: string, rows: HistoricoRow[]): { value: string; label: string }[] {
  return useMemo(() => {
    if (!regimen) return []
    if (rows.length === 0) return FALLBACK_TIPOS_ACTIVIDAD[regimen] ?? []
    const fromExcel = extraerTiposActividad(rows, regimen)
    return fromExcel.length > 0 ? fromExcel : (FALLBACK_TIPOS_ACTIVIDAD[regimen] ?? [])
  }, [regimen, rows])
}

function useProgramas(rows: HistoricoRow[]): string[] {
  return useMemo(() => {
    if (rows.length === 0) return []
    const seen = new Set<string>()
    rows.forEach((row) => { const p = getCell(row, COL.programaProyecto); if (p) seen.add(p) })
    return Array.from(seen).sort()
  }, [rows])
}

function useTiposActividadPorPrograma(
  programa: string, regimen: string, rows: HistoricoRow[]
): { value: string; label: string }[] {
  return useMemo(() => {
    if (!programa) return []
    if (rows.length === 0) return FALLBACK_TIPOS_ACTIVIDAD[regimen] ?? []
    const fromExcel = extraerTiposActividad(rows, regimen, programa)
    return fromExcel.length > 0 ? fromExcel : extraerTiposActividad(rows, regimen)
  }, [programa, regimen, rows])
}

function useRowPrecarga(
  programa: string, tipoActividad: string, regimen: string, rows: HistoricoRow[]
): HistoricoRow | null {
  return useMemo(() => {
    if (!programa || !tipoActividad) return null
    return (
      rows.find((row) => {
        const p = getCell(row, COL.programaProyecto) === programa
        const t = getCell(row, COL.tipoActividad)
          .toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "") === tipoActividad
        const r = !regimen || normalizaRegimen(getCell(row, COL.regimen)) === regimen
        return p && t && r
      }) ?? null
    )
  }, [programa, tipoActividad, regimen, rows])
}

type TipoSolicitud = "" | "prestacion" | "nombramiento"
type Step = "tipo" | "renovacion" | "formulario"

type FolioExcel = {
  id:               string
  folioJustificacion: string
  folioDictamen:    string
  secretaria:       string
  vigenciaInicio:   string
  vigenciaFin:      string
  unidadAdscripcion:      string
  unidadResponsableGasto: string
  programaProyecto:       string
  tipoActividad:          string
  regimen:                string
  numPrestadores:         string
  importeBruto:           string
  objeto:                 string
  actividades:            string
  responsabilidades:      string
  escolaridad:            string
  compAdm:                string
  compTec:                string
  compSoc:                string
  valores:                string
  areasExp:               string
}

function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        {label}
        <Lock className="h-3 w-3 text-muted-foreground" />
      </Label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
        <span className="text-sm text-muted-foreground truncate">{value || "—"}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3 shrink-0" />{hint}</p>}
    </div>
  )
}

function DynamicList({ label, items, onChange, max = 10, readonly = false }: {
  label: string; items: string[]; onChange: (items: string[]) => void; max?: number; readonly?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {label && (
        <Label className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
          {label}
          {readonly && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
            {idx + 1}
          </span>
          <Input
            value={item}
            onChange={(e) => {
              if (readonly) return
              const copy = [...items]; copy[idx] = e.target.value; onChange(copy)
            }}
            placeholder={`${label || "Item"} ${idx + 1}`}
            className={`${readonly ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
            readOnly={readonly}
          />
          {!readonly && items.length > 1 && (
            <Button type="button" variant="ghost" size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!readonly && items.length < max && (
        <Button type="button" variant="outline" size="sm" className="w-fit"
          onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1 h-4 w-4" />Agregar
        </Button>
      )}
    </div>
  )
}

function StepIndicator({ step, tipo }: { step: Step; tipo: TipoSolicitud }) {
  const steps = [
    { key: "tipo",       label: "Tipo de Solicitud" },
    { key: "renovacion", label: "Renovacion" },
    { key: "formulario", label: tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento" },
  ]
  const currentIndex = steps.findIndex((s) => s.key === step)
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
              ${i === currentIndex ? "bg-primary text-primary-foreground"
                : i < currentIndex ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < currentIndex ? "bg-secondary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function TabuladorCard({ importe }: { importe: string }) {
  const coincidencias = useMemo(() => {
    const val = parseMoney(importe)
    if (val < 0) return []
    return RANGOS_TABULADOR.filter((r) => val >= r.min && val <= r.max)
  }, [importe])
  return (
    <Card className="shadow-sm border-secondary/30 border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
          <ClipboardList className="h-5 w-5 text-secondary" />Tabulador — Nivel y Nombramiento (informativo)
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <Info className="h-3.5 w-3.5" />Los niveles se calculan automaticamente a partir del importe capturado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {parseMoney(importe) < 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Capture un importe para ver coincidencias.</span>
          </div>
        ) : coincidencias.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Sin coincidencias para el importe capturado.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {coincidencias.map((c) => (
              <div key={c.nivel + c.puesto}
                className="flex items-center gap-3 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-2.5">
                <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-xs shrink-0">
                  Nivel {c.nivel}
                </Badge>
                <span className="text-sm font-medium text-card-foreground">{c.puesto}</span>
              </div>
            ))}
            {coincidencias.length > 1 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Existen traslapes entre rangos (solo informativo).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SelectTriggerTruncado({ placeholder, selectedLabel, className = "" }: {
  placeholder: string; selectedLabel?: string; className?: string
}) {
  return (
    <SelectTrigger className={`bg-background w-full ${className}`}>
      <span className="block truncate text-sm pr-1">
        {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    </SelectTrigger>
  )
}

function SelectConBusqueda({
  opciones, value, onValueChange, placeholder, disabled = false, className = "",
}: {
  opciones: { value: string; label: string }[]
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  className?: string
}) {
  const [busqueda, setBusqueda] = useState("")
  const filtradas = useMemo(
    () => busqueda.trim()
      ? opciones.filter((o) => norm(o.label).includes(norm(busqueda)))
      : opciones,
    [opciones, busqueda]
  )
  const selectedLabel = opciones.find((o) => o.value === value)?.label

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={`bg-background w-full ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
        <span className="block truncate text-sm pr-1">
          {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent>
        {opciones.length > 6 && (
          <div className="px-2 py-1.5 border-b border-border">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="h-7 text-xs bg-background"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {filtradas.length === 0
          ? <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
          : filtradas.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))
        }
      </SelectContent>
    </Select>
  )
}

function FormularioPrestacion({
  prefilled, lockVigenciaOnly, regimenPeriodo = "", excelRows = [], esRenovacion = false,
  datosRenovacion, onFormChange,
}: {
  prefilled: boolean
  lockVigenciaOnly?: boolean
  regimenPeriodo?: string
  excelRows?: HistoricoRow[]
  esRenovacion?: boolean
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
}) {
  const bloqueadoPorRenovacion = esRenovacion && !!datosRenovacion

  const regimenInicial = datosRenovacion
    ? normalizaRegimen(datosRenovacion.regimen)
    : regimenPeriodo === "honorarios" ? "honorarios"
    : regimenPeriodo === "asimilados" ? "asimilados"
    : prefilled ? "honorarios" : ""
  const regimenBloqueado = bloqueadoPorRenovacion || regimenPeriodo === "honorarios" || regimenPeriodo === "asimilados"
  const [regimen, setRegimen] = useState(regimenInicial)
  const regimenEfectivo = regimenPeriodo || regimen

  const [secretariaInput,      setSecretariaInput]      = useState(
    datosRenovacion?.secretaria ?? (prefilled ? "Secretaria de Administracion" : "")
  )
  const [secretariaConfirmada, setSecretariaConfirmada] = useState(
    datosRenovacion?.secretaria ?? (prefilled ? "Secretaria de Administracion" : "")
  )
  const [showSugerencias,      setShowSugerencias]      = useState(false)
  const [unidadSeleccionada,   setUnidadSeleccionada]   = useState(datosRenovacion?.unidadAdscripcion ?? "")
  const [urgSeleccionada,      setUrgSeleccionada]      = useState(datosRenovacion?.unidadResponsableGasto ?? "")
  const [programaSeleccionado, setProgramaSeleccionado] = useState(datosRenovacion?.programaProyecto ?? "")
  const [tipoActividadSeleccionado, setTipoActividadSeleccionado] = useState(
    datosRenovacion?.tipoActividad
      ? datosRenovacion.tipoActividad.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
      : ""
  )
  const [numeroPrestadores, setNumeroPrestadores] = useState(datosRenovacion?.numPrestadores ?? (prefilled ? "3" : ""))
  const [vigenciaInicio, setVigenciaInicio] = useState(prefilled ? "2026-01-01" : "")
  const [vigenciaFin,    setVigenciaFin]    = useState(prefilled ? "2026-06-30" : "")

  const sugerencias = useMemo(() => {
    if (!secretariaInput) return SECRETARIAS_CATALOGO
    return SECRETARIAS_CATALOGO.filter((s) => s.toLowerCase().includes(secretariaInput.toLowerCase()))
  }, [secretariaInput])

  const datosRelacionados = useMemo(
    () => getDatosSecretaria(secretariaConfirmada, excelRows),
    [secretariaConfirmada, excelRows]
  )

  const unidadesDisponibles = datosRelacionados?.unidades ?? []
  const urgsDisponibles     = datosRelacionados?.urgs     ?? []

  const programasDelExcel       = useProgramas(excelRows)
  const programasDeLaSecretaria = datosRelacionados?.programas ?? []
  const programas = programasDelExcel.length > 0 ? programasDelExcel : programasDeLaSecretaria

  const tiposActividadPorPrograma = useTiposActividadPorPrograma(programaSeleccionado, regimenEfectivo, excelRows)
  const tiposActividadPorRegimen  = useTiposActividad(regimenEfectivo, excelRows)
  const tiposActividad = programaSeleccionado && tiposActividadPorPrograma.length > 0
    ? tiposActividadPorPrograma : tiposActividadPorRegimen

  const rowPrecarga = useRowPrecarga(programaSeleccionado, tipoActividadSeleccionado, regimenEfectivo, excelRows)

  const [importeBruto, setImporteBruto] = useState(
    datosRenovacion?.importeBruto
      ? parseImporteBruto(datosRenovacion.importeBruto)
      : prefilled ? "45,000.00" : ""
  )
  const [actividades, setActividades] = useState<string[]>(
    datosRenovacion?.actividades
      ? splitList(datosRenovacion.actividades)
      : prefilled ? ["Desarrollo de modulos del sistema institucional"] : [""]
  )
  const [responsabilidades, setResponsabilidades] = useState<string[]>(
    datosRenovacion?.responsabilidades
      ? splitList(datosRenovacion.responsabilidades)
      : prefilled ? ["Cumplir con los plazos establecidos"] : [""]
  )
  const [objeto, setObjeto] = useState(
    datosRenovacion?.objeto
      ?? (prefilled ? "Prestacion de servicios profesionales para el desarrollo e implementacion de sistemas informaticos." : "")
  )
  const [escolaridad, setEscolaridad] = useState<string | undefined>(
    datosRenovacion?.escolaridad ? mapEscolaridad(datosRenovacion.escolaridad) : prefilled ? "licenciatura" : undefined
  )
  const [compAdm, setCompAdm] = useState<string | undefined>(datosRenovacion?.compAdm || undefined)
  const [compTec, setCompTec] = useState<string | undefined>(datosRenovacion?.compTec || undefined)
  const [compSoc, setCompSoc] = useState<string | undefined>(datosRenovacion?.compSoc || undefined)
  const [valores, setValores] = useState<string | undefined>(datosRenovacion?.valores || undefined)
  const [areasExp, setAreasExp] = useState<string | undefined>(datosRenovacion?.areasExp || undefined)

  const fuenteDatos = excelRows.length > 0 && secretariaConfirmada ? "excel" : "catalogo"

  const notifyParent = useCallback((overrides: Partial<FormularioData> = {}) => {
    const tipoActividadLabel = tiposActividad.find(t => t.value === tipoActividadSeleccionado)?.label ?? tipoActividadSeleccionado
    onFormChange({
      secretaria:           secretariaConfirmada || secretariaInput,
      unidadAdministrativa: unidadSeleccionada,
      unidadResponsable:    urgSeleccionada,
      programaProyecto:     programaSeleccionado,
      regimen:              regimenEfectivo,
      tipoActividades:      tipoActividadLabel,
      numeroPrestadores,
      vigenciaInicio,
      vigenciaFin,
      importeBruto,
      objeto,
      actividades,
      responsabilidades,
      escolaridad:          escolaridad ?? "",
      compAdm:              compAdm ?? "",
      compTec:              compTec ?? "",
      compSoc:              compSoc ?? "",
      valores:              valores ?? "",
      areasExp:             areasExp ?? "",
      ...overrides,
    })
  }, [
    secretariaConfirmada, secretariaInput, unidadSeleccionada, urgSeleccionada,
    programaSeleccionado, regimenEfectivo, tipoActividadSeleccionado, tiposActividad,
    numeroPrestadores, vigenciaInicio, vigenciaFin, importeBruto,
    objeto, actividades, responsabilidades,
    escolaridad, compAdm, compTec, compSoc, valores, areasExp, onFormChange,
  ])

  useEffect(() => {
    notifyParent()
  }, [notifyParent])

  const handleSecretariaConfirm = (valor: string) => {
    if (bloqueadoPorRenovacion) return
    setSecretariaInput(valor)
    setSecretariaConfirmada(valor)
    setShowSugerencias(false)
    setProgramaSeleccionado("")
    setTipoActividadSeleccionado("")
    const datos = getDatosSecretaria(valor, excelRows)
    setUnidadSeleccionada(datos?.unidades[0]?.value ?? "")
    setUrgSeleccionada(datos?.urgs[0]?.value ?? "")
    if (!regimenBloqueado && datos?.regimen && datos.regimen !== "nombramiento") {
      setRegimen(datos.regimen)
    }
  }

  const handleTipoActividadChange = (val: string) => {
    if (bloqueadoPorRenovacion) return
    setTipoActividadSeleccionado(val)
    const fila = excelRows.find((row) => {
      const p = !programaSeleccionado || getCell(row, COL.programaProyecto) === programaSeleccionado
      const t = getCell(row, COL.tipoActividad)
        .toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "") === val
      const r = !regimenEfectivo || normalizaRegimen(getCell(row, COL.regimen)) === regimenEfectivo
      return p && t && r
    })
    if (fila) {
      const objTxt  = getCell(fila, COL.objeto)
      const actTxt  = getCell(fila, COL.actividades)
      const respTxt = getCell(fila, COL.responsabilidades)
      const imp     = getCell(fila, COL.importeBruto)
      if (objTxt)  setObjeto(objTxt)
      if (actTxt)  setActividades(splitList(actTxt))
      if (respTxt) setResponsabilidades(splitList(respTxt))
      if (imp)     setImporteBruto(parseImporteBruto(imp))
      const esc  = getCell(fila, COL.escolaridad)
      const cAdm = getCell(fila, COL.compAdm);  const cTec = getCell(fila, COL.compTec)
      const cSoc = getCell(fila, COL.compSoc);  const val_ = getCell(fila, COL.valores)
      const aExp = getCell(fila, COL.areasExp)
      if (esc)  setEscolaridad(mapEscolaridad(esc))
      if (cAdm) setCompAdm(cAdm); if (cTec) setCompTec(cTec)
      if (cSoc) setCompSoc(cSoc); if (val_) setValores(val_); if (aExp) setAreasExp(aExp)
    }
  }

  const handleProgramaChange = (val: string) => {
    if (bloqueadoPorRenovacion) return
    setProgramaSeleccionado(val)
    setTipoActividadSeleccionado("")
    setObjeto(""); setActividades([""]); setResponsabilidades([""])
  }

  const handleRegimenChange = (val: string) => {
    if (bloqueadoPorRenovacion) return
    setRegimen(val); setTipoActividadSeleccionado("")
    setObjeto(""); setActividades([""]); setResponsabilidades([""])
    setImporteBruto(""); setEscolaridad(undefined); setCompAdm(undefined)
    setCompTec(undefined); setCompSoc(undefined); setValores(undefined); setAreasExp(undefined)
  }

  const tipoActividadLabel = tipoActividadSeleccionado
    ? tiposActividad.find((t) => t.value === tipoActividadSeleccionado)?.label
    : undefined
  const camposDependientesHabilitados = !bloqueadoPorRenovacion && (esRenovacion || !!secretariaConfirmada)

  return (
    <div className="flex flex-col gap-6">
      {bloqueadoPorRenovacion && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-secondary/40 bg-secondary/5 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Renovación — datos precargados y bloqueados</span>
            <span className="text-xs text-muted-foreground">
              Todos los campos se han cargado del folio anterior. Solo puede modificar la <strong>vigencia</strong>.
            </span>
          </div>
        </div>
      )}

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Secretaria */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Secretaria
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{secretariaInput || "—"}</span>
                </div>
              ) : esRenovacion ? (
                <>
                  <Input value={prefilled ? "Secretaria de Administracion" : ""} disabled className="bg-muted text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Precargada segun usuario</p>
                </>
              ) : (
                <div className="relative">
                  <Input
                    value={secretariaInput}
                    onChange={(e) => {
                      setSecretariaInput(e.target.value); setSecretariaConfirmada("")
                      setShowSugerencias(true); setUnidadSeleccionada(""); setUrgSeleccionada("")
                      setProgramaSeleccionado(""); setTipoActividadSeleccionado("")
                    }}
                    onFocus={() => setShowSugerencias(true)}
                    onBlur={() => setTimeout(() => setShowSugerencias(false), 200)}
                    placeholder="Escriba la secretaria..." className="bg-background" autoComplete="off"
                  />
                  {showSugerencias && sugerencias.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                      <div className="max-h-52 overflow-y-auto py-1">
                        {sugerencias.map((s) => (
                          <button key={s} type="button" onMouseDown={() => handleSecretariaConfirm(s)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors
                                ${secretariaConfirmada === s ? "bg-accent/60 font-medium" : ""}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {secretariaConfirmada && datosRelacionados && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      Datos cargados desde {fuenteDatos === "excel" ? "Excel histórico" : "catálogo base"}
                    </p>
                  )}
                  {secretariaConfirmada && !datosRelacionados && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3 shrink-0" />Secretaria capturada. Complete los campos manualmente.
                    </p>
                  )}
                  {!secretariaConfirmada && secretariaInput && (
                    <p className="text-xs text-muted-foreground mt-1">Seleccione una opcion de la lista</p>
                  )}
                  {!secretariaInput && (
                    <p className="text-xs text-muted-foreground mt-1">Escriba para ver sugerencias</p>
                  )}
                </div>
              )}
            </div>

            {/* Unidad adscripcion */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Administrativa de Adscripcion
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{unidadSeleccionada || "—"}</span>
                </div>
              ) : esRenovacion ? (
                <SelectConBusqueda
                  opciones={getDatosSecretaria("Secretaria de Administracion", excelRows)?.unidades ?? []}
                  value={unidadSeleccionada}
                  onValueChange={setUnidadSeleccionada}
                  placeholder="Seleccione unidad"
                />
              ) : (
                <>
                  <SelectConBusqueda
                    opciones={unidadesDisponibles}
                    value={unidadSeleccionada}
                    onValueChange={setUnidadSeleccionada}
                    placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaria" : "Seleccione unidad"}
                    disabled={!camposDependientesHabilitados}
                  />
                  {secretariaConfirmada && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      {fuenteDatos === "excel" ? "Desde Excel histórico" : "Catálogo base"} · {unidadesDisponibles.length} opciones
                    </p>
                  )}
                </>
              )}
            </div>

            {/* URG */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Responsable del Gasto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{urgSeleccionada || "—"}</span>
                </div>
              ) : esRenovacion ? (
                <SelectConBusqueda
                  opciones={getDatosSecretaria("Secretaria de Administracion", excelRows)?.urgs ?? []}
                  value={urgSeleccionada}
                  onValueChange={setUrgSeleccionada}
                  placeholder="Seleccione URG"
                />
              ) : (
                <>
                  <SelectConBusqueda
                    opciones={urgsDisponibles}
                    value={urgSeleccionada}
                    onValueChange={setUrgSeleccionada}
                    placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaria" : "Seleccione URG"}
                    disabled={!camposDependientesHabilitados}
                  />
                  {secretariaConfirmada && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      {fuenteDatos === "excel" ? "Desde Excel histórico" : "Catálogo base"} · {urgsDisponibles.length} opciones
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Programa */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Programa o Proyecto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{programaSeleccionado || "—"}</span>
                </div>
              ) : programas.length > 0 ? (
                <Select
                  value={programaSeleccionado} onValueChange={handleProgramaChange}
                  disabled={!esRenovacion && !camposDependientesHabilitados}
                >
                  <SelectTriggerTruncado
                    placeholder={!esRenovacion && !camposDependientesHabilitados ? "Ingrese primero la secretaria" : "Seleccione programa"}
                    selectedLabel={programaSeleccionado || undefined}
                    className={!esRenovacion && !camposDependientesHabilitados ? "opacity-50 cursor-not-allowed" : ""}
                  />
                  <SelectContent>
                    {programas.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={programaSeleccionado}
                  onChange={(e) => handleProgramaChange(e.target.value)}
                  placeholder="Nombre del programa" className="bg-background"
                  disabled={!esRenovacion && !camposDependientesHabilitados}
                />
              )}
              {!bloqueadoPorRenovacion && excelRows.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />Cargue un Excel histórico para ver programas disponibles
                </p>
              )}
            </div>

            {/* Régimen */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Regimen de Contratacion
                {regimenBloqueado && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground capitalize">
                    {regimenEfectivo === "asimilados" ? "Honorarios Asimilados a Salarios" : regimenEfectivo || "—"}
                  </span>
                </div>
              ) : (
                <Select
                  value={regimenEfectivo || undefined}
                  onValueChange={regimenBloqueado ? undefined : handleRegimenChange}
                  disabled={regimenBloqueado}
                >
                  <SelectTrigger className={`bg-background w-full ${regimenBloqueado ? "opacity-70 cursor-not-allowed" : ""}`}>
                    <SelectValue placeholder="Seleccione regimen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="honorarios">Honorarios</SelectItem>
                    <SelectItem value="asimilados">Honorarios Asimilados a Salarios</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {regimenBloqueado && !bloqueadoPorRenovacion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />Determinado por formulario anterior.
                </p>
              )}
            </div>

            {/* Tipo actividad */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Tipo de Actividades
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">
                    {datosRenovacion?.tipoActividad || tipoActividadLabel || "—"}
                  </span>
                </div>
              ) : (
                <>
                  <Select
                    value={tipoActividadSeleccionado}
                    onValueChange={handleTipoActividadChange}
                    disabled={!regimenEfectivo}
                  >
                    <SelectTriggerTruncado
                      placeholder={!regimenEfectivo ? "Seleccione primero un régimen" : "Segun unidad administrativa"}
                      selectedLabel={tipoActividadLabel}
                      className={!regimenEfectivo ? "opacity-60 cursor-not-allowed" : ""}
                    />
                    <SelectContent>
                      {tiposActividad.length === 0
                        ? <div className="px-3 py-2 text-xs text-muted-foreground">Sin opciones para este régimen</div>
                        : tiposActividad.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  {regimenEfectivo && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      {excelRows.length > 0 ? "Desde Excel histórico" : "Catálogo base"} · Régimen:{" "}
                      <span className="font-medium capitalize">
                        {regimenEfectivo === "asimilados" ? "Honorarios asimilados" : regimenEfectivo}
                      </span>
                      {tiposActividad.length > 0 && <span className="ml-1">({tiposActividad.length} opciones)</span>}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Numero prestadores */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Numero de Prestadores de Servicios
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input
                type="number" min={1}
                value={numeroPrestadores}
                onChange={(e) => { if (!bloqueadoPorRenovacion) setNumeroPrestadores(e.target.value) }}
                placeholder="Ej. 5"
                className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                readOnly={bloqueadoPorRenovacion}
              />
            </div>

            {/* Vigencia */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Vigencia
                {bloqueadoPorRenovacion && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary ml-1">
                    Editable
                  </Badge>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} className="bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Termino</span>
                  <Input type="date" value={vigenciaFin} onChange={(e) => setVigenciaFin(e.target.value)} className="bg-background" />
                </div>
              </div>
              {bloqueadoPorRenovacion && (
                <p className="text-xs text-secondary flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />Único campo modificable en esta renovación.
                </p>
              )}
            </div>

            {/* Importe */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Importe Bruto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text"
                  value={importeBruto}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteBruto(e.target.value) }}
                  placeholder="0.00"
                  className={`pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>
            </div>

            {/* Adjunto */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-secondary cursor-pointer">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">PDF, DOC (max. 10 MB)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TabuladorCard importe={importeBruto} />

      {/* Objeto */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.1 Objeto de la Contratacion
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={objeto}
            onChange={(e) => { if (!bloqueadoPorRenovacion) setObjeto(e.target.value) }}
            placeholder="Describa el objeto de la contratacion de manera detallada..."
            className={`min-h-28 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed resize-none" : "bg-background"}`}
            readOnly={bloqueadoPorRenovacion}
          />
          {rowPrecarga && !bloqueadoPorRenovacion && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />Precargado desde Excel histórico. Puede editarlo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actividades */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.2 Actividades a Realizar
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={actividades} onChange={setActividades} readonly={bloqueadoPorRenovacion} />
        </CardContent>
      </Card>

      {/* Responsabilidades */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.3 Responsabilidades
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={responsabilidades} onChange={setResponsabilidades} readonly={bloqueadoPorRenovacion} />
        </CardContent>
      </Card>

      {/* Perfil */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">II</span>
            Perfil
            {bloqueadoPorRenovacion && <Lock className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Escolaridad */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Escolaridad Minima
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground capitalize">{escolaridad || "—"}</span>
                </div>
              ) : (
                <Select value={escolaridad} onValueChange={setEscolaridad}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione escolaridad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bachillerato">Bachillerato</SelectItem>
                    <SelectItem value="tecnico">Tecnico Superior</SelectItem>
                    <SelectItem value="licenciatura">Licenciatura</SelectItem>
                    <SelectItem value="maestria">Maestria</SelectItem>
                    <SelectItem value="doctorado">Doctorado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Competencias Administrativas
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{compAdm || "—"}</span>
                </div>
              ) : (
                <Select value={compAdm} onValueChange={setCompAdm}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione competencia" /></SelectTrigger>
                  <SelectContent>
                    {OPCIONES_COMPETENCIAS_ADM.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Competencias Tecnicas
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{compTec || "—"}</span>
                </div>
              ) : (
                <Select value={compTec} onValueChange={setCompTec}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione competencia" /></SelectTrigger>
                  <SelectContent>
                    {OPCIONES_COMPETENCIAS_TEC.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Competencias Sociales
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{compSoc || "—"}</span>
                </div>
              ) : (
                <Select value={compSoc} onValueChange={setCompSoc}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione competencia" /></SelectTrigger>
                  <SelectContent>
                    {OPCIONES_COMPETENCIAS_SOC.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Valores
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{valores || "—"}</span>
                </div>
              ) : (
                <Select value={valores} onValueChange={setValores}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione valor" /></SelectTrigger>
                  <SelectContent>
                    {OPCIONES_VALORES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Areas de Experiencia
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{areasExp || "—"}</span>
                </div>
              ) : (
                <Select value={areasExp} onValueChange={setAreasExp}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione área" /></SelectTrigger>
                  <SelectContent>
                    {OPCIONES_AREAS_EXP.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FormularioNombramiento({
  prefilled, esRenovacion = false, excelRows = [], datosRenovacion, onFormChange,
}: {
  prefilled: boolean; esRenovacion?: boolean; excelRows?: HistoricoRow[]
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
}) {
  const bloqueadoPorRenovacion = esRenovacion && !!datosRenovacion

  const [importeNeto, setImporteNeto] = useState(
    datosRenovacion?.importeBruto ? parseImporteBruto(datosRenovacion.importeBruto) : prefilled ? "28,500.00" : ""
  )
  const [funciones, setFunciones] = useState<string[]>(
    datosRenovacion?.actividades ? splitList(datosRenovacion.actividades)
      : prefilled ? ["Coordinar procesos administrativos"] : [""]
  )
  const [responsabilidades, setResponsabilidades] = useState<string[]>(
    datosRenovacion?.responsabilidades ? splitList(datosRenovacion.responsabilidades)
      : prefilled ? ["Cumplimiento normativo del area"] : [""]
  )
  const [marcoNormativo, setMarcoNormativo] = useState<string[]>(
    prefilled ? ["Ley Organica de la Administracion Publica"] : [""]
  )
  const [secretariaInput,      setSecretariaInput]      = useState(datosRenovacion?.secretaria ?? (prefilled ? "Secretaria de Administracion" : ""))
  const [secretariaConfirmada, setSecretariaConfirmada] = useState(datosRenovacion?.secretaria ?? (prefilled ? "Secretaria de Administracion" : ""))
  const [showSugerencias, setShowSugerencias] = useState(false)
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(datosRenovacion?.unidadAdscripcion ?? "")
  const [urgSeleccionada, setUrgSeleccionada] = useState(datosRenovacion?.unidadResponsableGasto ?? "")
  const [programaInput, setProgramaInput] = useState(datosRenovacion?.programaProyecto ?? (prefilled ? "P-005 Fortalecimiento Institucional" : ""))
  const [vigenciaInicio, setVigenciaInicio] = useState(prefilled ? "2026-03-01" : "")
  const [vigenciaFin,    setVigenciaFin]    = useState(prefilled ? "2026-08-31" : "")
  const [numeroPrestadores, setNumeroPrestadores] = useState(datosRenovacion?.numPrestadores ?? (prefilled ? "2" : ""))

  const sugerencias = useMemo(() => {
    if (!secretariaInput) return SECRETARIAS_CATALOGO
    return SECRETARIAS_CATALOGO.filter((s) => s.toLowerCase().includes(secretariaInput.toLowerCase()))
  }, [secretariaInput])

  const datosRelacionados = useMemo(() => getDatosSecretaria(secretariaConfirmada, excelRows), [secretariaConfirmada, excelRows])
  const unidadesDisponibles = datosRelacionados?.unidades ?? []
  const urgsDisponibles     = datosRelacionados?.urgs     ?? []
  const fuenteDatos = excelRows.length > 0 && secretariaConfirmada ? "excel" : "catalogo"

  const handleSecretariaConfirm = (valor: string) => {
    if (bloqueadoPorRenovacion) return
    setSecretariaInput(valor); setSecretariaConfirmada(valor); setShowSugerencias(false)
    const datos = getDatosSecretaria(valor, excelRows)
    setUnidadSeleccionada(datos?.unidades[0]?.value ?? "")
    setUrgSeleccionada(datos?.urgs[0]?.value ?? "")
  }

  const camposDependientesHabilitados = !bloqueadoPorRenovacion && (esRenovacion || !!secretariaConfirmada)

  useEffect(() => {
    onFormChange({
      secretaria:           secretariaConfirmada || secretariaInput,
      unidadAdministrativa: unidadSeleccionada,
      unidadResponsable:    urgSeleccionada,
      programaProyecto:     programaInput,
      regimen:              "nombramiento",
      tipoActividades:      "",
      numeroPrestadores,
      vigenciaInicio,
      vigenciaFin,
      importeBruto:         importeNeto,
      objeto:               "",
      actividades:          funciones,
      responsabilidades,
      escolaridad: "", compAdm: "", compTec: "", compSoc: "", valores: "", areasExp: "",
    })
  }, [
    secretariaConfirmada, secretariaInput, unidadSeleccionada, urgSeleccionada,
    programaInput, numeroPrestadores, vigenciaInicio, vigenciaFin, importeNeto,
    funciones, responsabilidades, onFormChange,
  ])

  return (
    <div className="flex flex-col gap-6">
      {bloqueadoPorRenovacion && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-secondary/40 bg-secondary/5 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Renovación — datos precargados y bloqueados</span>
            <span className="text-xs text-muted-foreground">
              Todos los campos se han cargado del folio anterior. Solo puede modificar la <strong>vigencia</strong>.
            </span>
          </div>
        </div>
      )}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Secretaria {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{secretariaInput || "—"}</span>
                </div>
              ) : esRenovacion ? (
                <Input value={secretariaInput} disabled className="bg-muted text-muted-foreground" />
              ) : (
                <div className="relative">
                  <Input
                    value={secretariaInput}
                    onChange={(e) => { setSecretariaInput(e.target.value); setSecretariaConfirmada(""); setShowSugerencias(true); setUnidadSeleccionada(""); setUrgSeleccionada("") }}
                    onFocus={() => setShowSugerencias(true)}
                    onBlur={() => setTimeout(() => setShowSugerencias(false), 200)}
                    placeholder="Escriba la secretaria..." className="bg-background" autoComplete="off"
                  />
                  {showSugerencias && sugerencias.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                      <div className="max-h-52 overflow-y-auto py-1">
                        {sugerencias.map((s) => (
                          <button key={s} type="button" onMouseDown={() => handleSecretariaConfirm(s)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${secretariaConfirmada === s ? "bg-accent/60 font-medium" : ""}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {secretariaConfirmada && datosRelacionados && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />Datos cargados desde {fuenteDatos === "excel" ? "Excel histórico" : "catálogo base"}
                    </p>
                  )}
                  {!secretariaConfirmada && secretariaInput && (
                    <p className="text-xs text-muted-foreground mt-1">Seleccione una opcion de la lista</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Administrativa {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{unidadSeleccionada || "—"}</span>
                </div>
              ) : (
                <SelectConBusqueda opciones={unidadesDisponibles} value={unidadSeleccionada} onValueChange={setUnidadSeleccionada}
                  placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaria" : "Seleccione unidad"}
                  disabled={!camposDependientesHabilitados} />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Responsable del Gasto {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{urgSeleccionada || "—"}</span>
                </div>
              ) : (
                <SelectConBusqueda opciones={urgsDisponibles} value={urgSeleccionada} onValueChange={setUrgSeleccionada}
                  placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaria" : "Seleccione URG"}
                  disabled={!camposDependientesHabilitados} />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Programa o Proyecto {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input value={programaInput} onChange={(e) => { if (!bloqueadoPorRenovacion) setProgramaInput(e.target.value) }}
                placeholder="Nombre del programa"
                className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                readOnly={bloqueadoPorRenovacion} disabled={!bloqueadoPorRenovacion && !camposDependientesHabilitados} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Denominacion del Nombramiento {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input defaultValue={prefilled ? "Jefe de Departamento" : ""} placeholder="Ej. Subdirector de Area"
                className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                readOnly={bloqueadoPorRenovacion} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Importe Neto Mensual {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="text" value={importeNeto} onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteNeto(e.target.value) }}
                  placeholder="0.00"
                  className={`pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion} />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Vigencia
                {bloqueadoPorRenovacion && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary ml-1">Editable</Badge>}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} className="bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Termino</span>
                  <Input type="date" value={vigenciaFin} onChange={(e) => setVigenciaFin(e.target.value)} className="bg-background" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-secondary cursor-pointer">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">PDF, DOC (max. 10 MB)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TabuladorCard importe={importeNeto} />

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.2 Funciones Principales {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={funciones} onChange={setFunciones} readonly={bloqueadoPorRenovacion} />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.3 Responsabilidades {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={responsabilidades} onChange={setResponsabilidades} readonly={bloqueadoPorRenovacion} />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            I.4 Marco Normativo {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={marcoNormativo} onChange={setMarcoNormativo} readonly={bloqueadoPorRenovacion} />
        </CardContent>
      </Card>
    </div>
  )
}

function ExcepcionDOForm({ onBack }: { onBack: () => void }) {
  const { crearExcepcionDO, crearRegularizacionDO } = useSolicitudes()
  const [subTipo,        setSubTipo]        = useState<"captura" | "regularizacion">("captura")
  const [tipoSolicitud,  setTipoSolicitud]  = useState<"prestacion" | "nombramiento" | "">("")
  const [tipoAdmin,      setTipoAdmin]      = useState<TipoAdministracion>("centralizada")
  const [secretaria,     setSecretaria]     = useState("")
  const [unidad,         setUnidad]         = useState("")
  const [denominacion,   setDenominacion]   = useState("")
  const [vigenciaInicio, setVigenciaInicio] = useState("")
  const [vigenciaFin,    setVigenciaFin]    = useState("")
  const [importeBruto,   setImporteBruto]   = useState("")
  const [folioManual,    setFolioManual]    = useState("")
  const [fechaRecepcion, setFechaRecepcion] = useState("")
  const [folioSolicitud, setFolioSolicitud] = useState("")
  const [submitted,      setSubmitted]      = useState(false)
  const [assignedFolio,  setAssignedFolio]  = useState("")

  const canSubmit = tipoSolicitud && secretaria && unidad && denominacion &&
    vigenciaInicio && vigenciaFin && importeBruto && fechaRecepcion && folioSolicitud &&
    (subTipo === "captura" ? folioManual : true)

  const handleSubmit = () => {
    if (!canSubmit) return
    if (subTipo === "regularizacion") {
      const tempFolio = crearRegularizacionDO({
        folioSolicitud,
        tipo: tipoSolicitud === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
        tipoAdministracion: tipoAdmin, secretaria, unidadAdministrativa: unidad,
        fechaCreacion: fechaRecepcion, fechaRecepcionDO: fechaRecepcion, slaDiasHabiles: 15,
        denominacion, vigenciaInicio, vigenciaFin, importeBruto: `$${importeBruto}`,
        esRenovacion: false, folioAnterior: null, esExcepcionDO: true, esRegularizacion: true,
      })
      setAssignedFolio(tempFolio)
    } else {
      crearExcepcionDO({
        folioSolicitud, folioRecepcion: folioManual,
        tipo: tipoSolicitud === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
        tipoAdministracion: tipoAdmin, secretaria, unidadAdministrativa: unidad,
        fechaCreacion: fechaRecepcion, fechaRecepcionDO: fechaRecepcion, slaDiasHabiles: 15,
        denominacion, vigenciaInicio, vigenciaFin, importeBruto: `$${importeBruto}`,
        esRenovacion: false, folioAnterior: null, esExcepcionDO: true,
        folioRecepcionManual: true, folioTemporal: false, folioTemporalOriginal: null,
        folioOficializadoPor: null, fechaOficializacion: null, esRegularizacion: false,
      })
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-secondary/30">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
            <p className="text-base font-semibold text-card-foreground text-center">
              {subTipo === "regularizacion" ? "Regularizacion registrada exitosamente" : "Excepcion DO registrada exitosamente"}
            </p>
            {subTipo === "regularizacion" && (
              <Badge className="bg-primary/10 text-primary border-0 text-sm px-3 py-1">
                Folio temporal: {assignedFolio}
              </Badge>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Volver</Button>
              <Button onClick={() => { setSubmitted(false); setTipoSolicitud(""); setSecretaria(""); setUnidad(""); setDenominacion(""); setVigenciaInicio(""); setVigenciaFin(""); setImporteBruto(""); setFolioManual(""); setFechaRecepcion(""); setFolioSolicitud(""); setAssignedFolio("") }}
                className="bg-primary text-primary-foreground hover:bg-primary/90">Registrar Otra</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" />Volver</Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Excepcion DO</h2>
          <p className="text-sm text-muted-foreground">Captura directa por la Direccion de Organizacion</p>
        </div>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ShieldAlert className="h-5 w-5 text-accent-foreground" />Tipo de Excepcion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={subTipo} onValueChange={(v) => setSubTipo(v as "captura" | "regularizacion")} className="flex flex-col gap-3">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "captura" ? "border-accent bg-accent/5" : "border-border hover:border-secondary/50"}`}>
              <RadioGroupItem value="captura" id="sub-captura" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Captura DO</span>
                <span className="text-xs text-muted-foreground">Ingreso directo con folio de recepcion y fecha asignados manualmente por la DO.</span>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "regularizacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"}`}>
              <RadioGroupItem value="regularizacion" id="sub-regularizacion" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Regularizacion</span>
                <span className="text-xs text-muted-foreground">Ingreso con folio temporal generado automaticamente.</span>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          {subTipo === "regularizacion" ? <Clock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {subTipo === "regularizacion" ? "Registrar Regularizacion" : "Registrar Excepcion DO"}
        </Button>
      </div>
    </div>
  )
}

// ── Función reutilizable para construir el payload ────────────────────────────
function buildSolicitudPayload({
  usuarioId,
  tipo,
  regimenPeriodo,
  esExtemporanea,
  esRenovacion,
  folioSeleccionado,
  formData,
}: {
  usuarioId: string
  tipo: TipoSolicitud
  regimenPeriodo: string
  esExtemporanea: boolean
  esRenovacion: string
  folioSeleccionado: string
  formData: Partial<FormularioData>
}) {
  return {
    usuarioId,
    tipo_solicitud: tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
    periodoId:             1,
    esExtemporanea,
    secretaria:            formData.secretaria            ?? null,
    unidad_administrativa: formData.unidadAdministrativa  ?? null,
    unidad_responsable:    formData.unidadResponsable      ?? null,
    programa_proyecto:     formData.programaProyecto       ?? null,
    regimen:               formData.regimen                ?? regimenPeriodo ?? null,
    tipo_actividades:      formData.tipoActividades         ?? null,
    numero_prestadores:    formData.numeroPrestadores
      ? parseInt(formData.numeroPrestadores) || null
      : null,
    denominacion:          formData.denominacion            ?? null,
    vigencia_inicio:       formData.vigenciaInicio || null,
    vigencia_fin:          formData.vigenciaFin    || null,
    importe_bruto:         formData.importeBruto
      ? parseFloat(formData.importeBruto.replace(/[$,\s]/g, "")) || null
      : null,
    es_renovacion:         esRenovacion === "si",
    folio_anterior:        folioSeleccionado || null,
    objeto:                formData.objeto              ?? null,
    actividades:           formData.actividades          ?? [],
    responsabilidades:     formData.responsabilidades    ?? [],
    escolaridad:           formData.escolaridad          ?? null,
    comp_adm:              formData.compAdm              ?? null,
    comp_tec:              formData.compTec              ?? null,
    comp_soc:              formData.compSoc              ?? null,
    valores:               formData.valores              ?? null,
    areas_exp:             formData.areasExp             ?? null,
  }
}

export function NuevaSolicitudPage() {
  const [step,                setStep]                = useState<Step>("tipo")
  const [tipo,                setTipo]                = useState<TipoSolicitud>("")
  const [esRenovacion,        setEsRenovacion]        = useState<string>("")
  const [folioSeleccionado,   setFolioSeleccionado]   = useState<string>("")
  const [condicionRenovacion, setCondicionRenovacion] = useState<string>("")
  const [prefilled,           setPrefilled]           = useState(false)
  const [lockVigenciaOnly,    setLockVigenciaOnly]    = useState(false)
  const [datosRenovacion,     setDatosRenovacion]     = useState<FolioExcel | null>(null)
  const [showModalMismasCondiciones, setShowModalMismasCondiciones] = useState(false)

  const [enviado,       setEnviado]       = useState(false)
  const [folioGenerado, setFolioGenerado] = useState("")
  const [enviando,      setEnviando]      = useState(false)
  const [errorEnvio,    setErrorEnvio]    = useState<string | null>(null)

  const [guardandoBorrador,     setGuardandoBorrador]     = useState(false)
  const [borradorGuardado,      setBorradorGuardado]      = useState(false)
  const [errorBorrador,         setErrorBorrador]         = useState<string | null>(null)
  const [folioBorradorGuardado, setFolioBorradorGuardado] = useState<string>("")

  const [formData, setFormData] = useState<Partial<FormularioData>>({})
  const handleFormChange = useCallback((data: Partial<FormularioData>) => {
    setFormData(prev => ({ ...prev, ...data }))
  }, [])

  const { } = useSolicitudes()
  const { getPermisoActivo, consumirPermiso } = useAutorizaciones()
  const { user } = useAuth()

  const [regimenPeriodo,      setRegimenPeriodo]      = useState<"" | "honorarios" | "asimilados" | "nombramiento">("")
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("")
  const { historicos } = useHistoricoStore()
  const excelRows = useExcelRows(historicos)

  const periodoInfo = useMemo(() => {
    if (!regimenPeriodo || !periodoSeleccionado) return null
    const row = regimenPeriodo === "honorarios"
      ? CAP_3000.find((r) => r.mes === periodoSeleccionado)
      : regimenPeriodo === "asimilados"
      ? CAP_1000.find((r) => r.quincena === periodoSeleccionado)
      : NOMBRAMIENTO_TD.find((r) => r.quincena === periodoSeleccionado)
    if (!row) return null
    const limiteDODate = parseDateDMY(row.limiteDO)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const enTiempo = today <= limiteDODate
    return { row, limiteDODate, enTiempo }
  }, [regimenPeriodo, periodoSeleccionado])

  const periodoVencido = periodoSeleccionado ? (periodoInfo ? !periodoInfo.enTiempo : false) : false
  const puedeAvanzarDeTipo = !!(tipo && regimenPeriodo && periodoSeleccionado && !periodoVencido)

  const foliosReales = useMemo((): FolioExcel[] => {
    if (excelRows.length === 0) return []
    return excelRows
      .filter((row) => {
        const folio = getCell(row, COL.folioDictamen)
        if (!folio) return false
        const reg = normalizaRegimen(getCell(row, COL.regimen))
        if (tipo === "nombramiento" && reg !== "nombramiento") return false
        if (tipo === "prestacion"   && reg === "nombramiento") return false
        if (periodoSeleccionado) return rowEnPeriodo(row, periodoSeleccionado)
        return true
      })
      .reduce<FolioExcel[]>((acc, row) => {
        const folioDictamen      = getCell(row, COL.folioDictamen)
        const folioJustificacion = getCell(row, COL.folioJustificacion) || folioDictamen
        const secretaria         = getCell(row, COL.secretaria)
        const vigenciaInicio     = getCell(row, COL.vigenciaInicio)
        const vigenciaFin        = getCell(row, COL.vigenciaTermino)
        if (acc.find((f) => f.id === folioDictamen)) return acc
        acc.push({
          id: folioDictamen, folioJustificacion, folioDictamen, secretaria, vigenciaInicio, vigenciaFin,
          unidadAdscripcion:      getCell(row, COL.unidadAdscripcion),
          unidadResponsableGasto: getCell(row, COL.unidadResponsableGasto),
          programaProyecto:       getCell(row, COL.programaProyecto),
          tipoActividad:          getCell(row, COL.tipoActividad),
          regimen:                getCell(row, COL.regimen),
          numPrestadores:         getCell(row, COL.numPrestadores),
          importeBruto:           getCell(row, COL.importeBruto),
          objeto:                 getCell(row, COL.objeto),
          actividades:            getCell(row, COL.actividades),
          responsabilidades:      getCell(row, COL.responsabilidades),
          escolaridad:            getCell(row, COL.escolaridad),
          compAdm:                getCell(row, COL.compAdm),
          compTec:                getCell(row, COL.compTec),
          compSoc:                getCell(row, COL.compSoc),
          valores:                getCell(row, COL.valores),
          areasExp:               getCell(row, COL.areasExp),
        })
        return acc
      }, [])
      .sort((a, b) => a.folioDictamen.localeCompare(b.folioDictamen))
  }, [excelRows, tipo, periodoSeleccionado])

  const hayFoliosReales = foliosReales.length > 0

  const handleContinueToRenovacion = () => {
    if (puedeAvanzarDeTipo) setStep("renovacion")
  }

  const handleContinueToFormulario = () => {
    if (esRenovacion === "si" && folioSeleccionado) {
      const datos = foliosReales.find((f) => f.id === folioSeleccionado) ?? null
      setDatosRenovacion(datos)
      setPrefilled(true)
      setLockVigenciaOnly(condicionRenovacion === "mismas")
    } else {
      setDatosRenovacion(null)
      setPrefilled(false)
      setLockVigenciaOnly(false)
    }
    setStep("formulario")
  }

  const handleBack = useCallback(() => {
    if (step === "formulario") setStep("renovacion")
    else if (step === "renovacion") setStep("tipo")
  }, [step])

  const permisoActivo = regimenPeriodo && periodoSeleccionado && user?.name
    ? getPermisoActivo(user.name, regimenPeriodo, periodoSeleccionado) : null

  const folioSeleccionadoData = folioSeleccionado
    ? foliosReales.find((f) => f.id === folioSeleccionado) : null

  const handleGuardarBorrador = useCallback(async () => {
    setGuardandoBorrador(true)
    setErrorBorrador(null)

    try {
      const usuarioId = (user as any)?.id ?? (user as any)?.uuid ?? null
      if (!usuarioId) {
        setErrorBorrador("No se pudo identificar al usuario. Vuelva a iniciar sesión.")
        setGuardandoBorrador(false)
        return
      }

      const payload = {
        ...buildSolicitudPayload({
          usuarioId,
          tipo,
          regimenPeriodo,
          esExtemporanea: false,
          esRenovacion,
          folioSeleccionado,
          formData,
        }),
        estado_nombre: "Borrador",
      }

      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        setErrorBorrador(json.error ?? "Error al guardar el borrador. Intente de nuevo.")
        setGuardandoBorrador(false)
        return
      }

      setFolioBorradorGuardado(json.folio ?? json.data?.folio_recepcion ?? "")
      setBorradorGuardado(true)
    } catch (err) {
      console.error("Error de red al guardar borrador:", err)
      setErrorBorrador("Error de conexión. Verifique su red e intente de nuevo.")
    } finally {
      setGuardandoBorrador(false)
    }
  }, [user, tipo, regimenPeriodo, esRenovacion, folioSeleccionado, formData])

  const handleEnviarAValidacion = useCallback(
    async (periodoStillValid: boolean, hasPermiso: boolean) => {
      if (!periodoStillValid && !hasPermiso) return

      setEnviando(true)
      setErrorEnvio(null)

      try {
        if (!periodoStillValid && hasPermiso && user?.name && regimenPeriodo && periodoSeleccionado) {
          consumirPermiso(user.name, regimenPeriodo, periodoSeleccionado)
        }

        const usuarioId = (user as any)?.id ?? (user as any)?.uuid ?? null

        if (!usuarioId) {
          setErrorEnvio("No se pudo identificar al usuario. Vuelva a iniciar sesión.")
          setEnviando(false)
          return
        }

        const payload = buildSolicitudPayload({
          usuarioId,
          tipo,
          regimenPeriodo,
          esExtemporanea: !periodoStillValid && hasPermiso,
          esRenovacion,
          folioSeleccionado,
          formData,
        })

        const res = await fetch("/api/solicitudes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const json = await res.json()

        if (!res.ok || !json.ok) {
          setErrorEnvio(json.error ?? "Error al registrar la solicitud. Intente de nuevo.")
          setEnviando(false)
          return
        }

        const solicitudId = json.data?.id
        if (!solicitudId) {
          setErrorEnvio("No se pudo obtener el ID de la solicitud creada.")
          setEnviando(false)
          return
        }

        const patchRes = await fetch("/api/validacion", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solicitudId,
            nuevoEstado: "Enviada a Validacion (UEFA)",
            usuarioId,
            comentario: "Solicitud enviada a validacion por la URG",
          }),
        })

        const patchJson = await patchRes.json()

        if (!patchRes.ok || !patchJson.ok) {
          console.warn("Solicitud creada pero no se pudo cambiar el estado:", patchJson.error)
        }

        setFolioGenerado(json.folio ?? json.data?.folio_recepcion ?? "")
        setEnviado(true)
      } catch (err) {
        console.error("Error de red al enviar solicitud:", err)
        setErrorEnvio("Error de conexión. Verifique su red e intente de nuevo.")
      } finally {
        setEnviando(false)
      }
    },
    [user, regimenPeriodo, periodoSeleccionado, consumirPermiso, tipo,
     formData, esRenovacion, folioSeleccionado]
  )

  const handleReset = useCallback(() => {
    setEnviado(false); setBorradorGuardado(false)
    setFolioGenerado(""); setFolioBorradorGuardado("")
    setStep("tipo"); setTipo("")
    setEsRenovacion(""); setFolioSeleccionado(""); setCondicionRenovacion("")
    setPrefilled(false); setLockVigenciaOnly(false); setDatosRenovacion(null)
    setRegimenPeriodo(""); setPeriodoSeleccionado("")
    setErrorEnvio(null); setErrorBorrador(null)
    setFormData({})
  }, [])

  if (enviado) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-secondary/30">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
              <CheckCircle2 className="h-9 w-9 text-secondary" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-lg font-semibold text-card-foreground">
                Solicitud enviada a validación UEFA
              </p>
              <p className="text-sm text-muted-foreground">
                La solicitud fue ingresada correctamente. Puede seguir su avance en "Mis Solicitudes" → pestaña "Enviadas a UEFA".
              </p>
            </div>
            {folioGenerado && (
              <Badge className="bg-primary/10 text-primary border-0 text-sm px-4 py-1.5">
                Folio: {folioGenerado}
              </Badge>
            )}
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/30 px-6 py-3 text-center">
              <span className="text-xs text-muted-foreground">Tipo de solicitud</span>
              <span className="text-sm font-medium text-card-foreground">
                {tipo === "prestacion" ? "Prestación de Servicios" : "Nombramiento por Tiempo Determinado"}
              </span>
              {periodoSeleccionado && (
                <>
                  <span className="text-xs text-muted-foreground mt-1">Periodo</span>
                  <span className="text-sm font-medium text-card-foreground">{periodoSeleccionado}</span>
                </>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset}>
                <FilePlus className="mr-1.5 h-4 w-4" />Nueva Solicitud
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (borradorGuardado) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-muted">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Save className="h-9 w-9 text-muted-foreground" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-lg font-semibold text-card-foreground">
                Borrador guardado correctamente
              </p>
              <p className="text-sm text-muted-foreground">
                Puede continuar la captura desde "Mis Solicitudes" → pestaña "Borradores".
              </p>
            </div>
            {folioBorradorGuardado && (
              <Badge className="bg-muted text-muted-foreground border-0 text-sm px-4 py-1.5">
                Folio: {folioBorradorGuardado}
              </Badge>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset}>
                <FilePlus className="mr-1.5 h-4 w-4" />Nueva Solicitud
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Nueva Solicitud</h2>
            <p className="text-sm text-muted-foreground">
              Registre una nueva solicitud de dictaminacion tecnica funcional
            </p>
          </div>
        </div>
        <StepIndicator step={step} tipo={tipo} />
      </div>

      {/* PASO 1 — TIPO */}
      {step === "tipo" && (
        <>
          <Card className="shadow-sm border-secondary/30 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <Calendar className="h-5 w-5 text-secondary" />Periodo de aplicacion
              </CardTitle>
              <CardDescription>
                Seleccione el regimen y periodo para consultar las fechas limite de recepcion
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    Régimen de Contratación<span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Select value={regimenPeriodo} onValueChange={(v) => {
                    const nuevo = v as "honorarios" | "asimilados" | "nombramiento"
                    setRegimenPeriodo(nuevo); setPeriodoSeleccionado(""); setFolioSeleccionado("")
                    if (nuevo === "nombramiento") setTipo("nombramiento")
                    else setTipo("prestacion")
                  }}>
                    <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione regimen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorarios">Honorarios</SelectItem>
                      <SelectItem value="asimilados">Honorarios asimilados a salarios</SelectItem>
                      <SelectItem value="nombramiento">Nombramiento por tiempo determinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {regimenPeriodo === "honorarios" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">
                      Mes de aplicacion<span className="text-destructive ml-0.5">*</span>
                    </Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione mes" /></SelectTrigger>
                      <SelectContent>{CAP_3000.map((r) => <SelectItem key={r.mes} value={r.mes}>{r.mes}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {regimenPeriodo === "asimilados" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">
                      Quincena de aplicacion<span className="text-destructive ml-0.5">*</span>
                    </Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione quincena" /></SelectTrigger>
                      <SelectContent>{CAP_1000.map((r) => <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {regimenPeriodo === "nombramiento" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">
                      Quincena de aplicacion<span className="text-destructive ml-0.5">*</span>
                    </Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione quincena" /></SelectTrigger>
                      <SelectContent>{NOMBRAMIENTO_TD.map((r) => <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {periodoSeleccionado && periodoInfo && (
                <div className={`rounded-lg border-2 p-4 flex flex-col gap-3 ${periodoInfo.enTiempo ? "border-secondary/30 bg-secondary/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Limite DO (Dictamen)</span>
                      <span className="text-sm font-semibold text-card-foreground">{periodoInfo.row.limiteDO}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Limite DGRH (Alta)</span>
                      <span className="text-sm font-semibold text-card-foreground">{periodoInfo.row.limiteDGRH}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {periodoInfo.enTiempo ? (
                      <Badge className="bg-secondary/15 text-secondary border-0 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />En tiempo
                      </Badge>
                    ) : (
                      <div className="flex items-start gap-2 w-full">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-destructive">
                            Periodo vencido — no se puede registrar
                          </span>
                          <span className="text-xs text-muted-foreground">
                            La fecha límite DO ({periodoInfo.row.limiteDO}) ya pasó.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`shadow-sm border-border ${periodoVencido ? "opacity-50 pointer-events-none" : ""}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <FilePlus className="h-5 w-5 text-secondary" />Seleccione Tipo de Solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RadioGroup value={tipo} onValueChange={(v) => {
                const next = v as TipoSolicitud
                if (next === "prestacion"   && regimenPeriodo === "nombramiento") return
                if (next === "nombramiento" && regimenPeriodo !== "nombramiento") return
                setTipo(next)
              }} className="flex flex-col gap-3">
                <label htmlFor="tipo-prestacion" className={`flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors ${tipo === "prestacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"}`}>
                  <RadioGroupItem value="prestacion" id="tipo-prestacion" className="mt-0.5" disabled={regimenPeriodo === "nombramiento"} />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-card-foreground">Justificacion de Prestacion de Servicios</span>
                    <span className="text-xs text-muted-foreground">Honorarios / Honorarios Asimilados a Salarios</span>
                  </div>
                </label>
                <label htmlFor="tipo-nombramiento" className={`flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors ${tipo === "nombramiento" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"}`}>
                  <RadioGroupItem value="nombramiento" id="tipo-nombramiento" className="mt-0.5" disabled={regimenPeriodo !== "nombramiento"} />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-card-foreground">Justificacion para Nombramiento por Tiempo Determinado</span>
                    <span className="text-xs text-muted-foreground">Nombramiento por Tiempo Determinado</span>
                  </div>
                </label>
              </RadioGroup>

              <div className="flex justify-end pt-2">
                <Button onClick={handleContinueToRenovacion} disabled={!puedeAvanzarDeTipo}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  Continuar<ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PASO 2 — RENOVACION */}
      {step === "renovacion" && (
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              <FileText className="h-5 w-5 text-secondary" />Renovacion
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Renovación de la Dictamen *</Label>
              <RadioGroup value={esRenovacion} onValueChange={setEsRenovacion} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="si" id="ren-si" />
                  <Label htmlFor="ren-si" className="text-sm font-normal cursor-pointer">Si</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="ren-no" />
                  <Label htmlFor="ren-no" className="text-sm font-normal cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {esRenovacion === "si" && (
              <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    Folio del Dictamen/Opinion Anterior
                    {hayFoliosReales && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({foliosReales.length} encontrados{periodoSeleccionado ? ` · ${periodoSeleccionado}` : ""})
                      </span>
                    )}
                  </Label>
                  {excelRows.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
                      <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargue un Excel histórico para ver los dictámenes disponibles.</span>
                    </div>
                  ) : !hayFoliosReales ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
                      <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">No se encontraron folios de dictamen en el Excel.</span>
                    </div>
                  ) : (
                    <Select value={folioSeleccionado} onValueChange={setFolioSeleccionado}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione folio anterior" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {foliosReales.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="font-medium">{f.folioJustificacion}</span>{" / "}
                            <span className="font-medium">{f.folioDictamen}</span>
                            {f.secretaria && <span className="text-muted-foreground"> - {f.secretaria}</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {folioSeleccionadoData && (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Folio de Justificacion</span>
                        <span className="text-sm font-medium text-card-foreground">{folioSeleccionadoData.folioJustificacion}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Folio de Dictamen/Opinion</span>
                        <span className="text-sm font-medium text-card-foreground">{folioSeleccionadoData.folioDictamen}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Secretaria</span>
                        <span className="text-sm font-medium text-card-foreground">{folioSeleccionadoData.secretaria || "—"}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <Label className="text-sm font-medium">Condicion de Renovacion</Label>
                      <label
                        className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors
                          ${condicionRenovacion === "mismas" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/40"}`}
                        onClick={(e) => {
                          e.preventDefault()
                          if (condicionRenovacion === "mismas") setCondicionRenovacion("")
                          else setShowModalMismasCondiciones(true)
                        }}
                      >
                        <Checkbox checked={condicionRenovacion === "mismas"} className="mt-0.5 shrink-0 pointer-events-none" readOnly />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-card-foreground">Se solicita bajo mismas condiciones técnicas y funcionales</span>
                          <span className="text-xs text-muted-foreground">Marque esta casilla si confirma que no hay cambios respecto al dictamen anterior</span>
                        </div>
                        {condicionRenovacion === "mismas" && <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary ml-auto mt-0.5" />}
                      </label>
                    </div>

                    {showModalMismasCondiciones && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModalMismasCondiciones(false)} />
                        <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
                          <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-muted/30">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15">
                              <Lock className="h-5 w-5 text-secondary" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-base font-semibold text-card-foreground">¿Confirmar mismas condiciones?</span>
                              <span className="text-xs text-muted-foreground">Esta acción bloqueará los campos del formulario</span>
                            </div>
                          </div>
                          <div className="px-6 py-5 flex flex-col gap-4">
                            <p className="text-sm text-card-foreground">
                              a) La persona Titular de la Unidad de Enlace Financiero Administrativo se compromete a que la justificación cuente con las mismas condiciones técnico funcionales.
                            </p>
                            <p className="text-sm text-card-foreground">
                              b) La Dirección General de Desarrollo Organizacional emitirá la dictaminación correspondiente a la presente Justificación.
                            </p>
                            <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Único campo editable</span>
                              <span className="text-sm text-card-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-secondary shrink-0" />Vigencia de la nueva solicitud
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
                            <Button variant="outline" onClick={() => setShowModalMismasCondiciones(false)}>Cancelar</Button>
                            <Button className="bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => { setCondicionRenovacion("mismas"); setShowModalMismasCondiciones(false) }}>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />Sí, confirmar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Anterior</Button>
              <Button
                onClick={handleContinueToFormulario}
                disabled={
                  !esRenovacion ||
                  (esRenovacion === "si" && hayFoliosReales && !folioSeleccionado) ||
                  (esRenovacion === "si" && folioSeleccionado && condicionRenovacion !== "mismas")
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continuar<ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 3 — FORMULARIO */}
      {step === "formulario" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-primary text-primary-foreground">
              {tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento por Tiempo Determinado"}
            </Badge>
            {prefilled && datosRenovacion && (
              <Badge variant="outline" className="border-secondary text-secondary gap-1">
                <Lock className="h-3 w-3" />Renovacion — solo vigencia editable
              </Badge>
            )}
            {excelRows.length > 0 && (
              <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                Excel histórico activo ({excelRows.length} registros)
              </Badge>
            )}
          </div>

          {tipo === "prestacion" ? (
            <FormularioPrestacion
              prefilled={prefilled}
              lockVigenciaOnly={lockVigenciaOnly}
              regimenPeriodo={regimenPeriodo}
              excelRows={excelRows}
              esRenovacion={esRenovacion === "si"}
              datosRenovacion={datosRenovacion}
              onFormChange={handleFormChange}
            />
          ) : (
            <FormularioNombramiento
              prefilled={prefilled}
              esRenovacion={esRenovacion === "si"}
              excelRows={excelRows}
              datosRenovacion={datosRenovacion}
              onFormChange={handleFormChange}
            />
          )}

          {(() => {
            const periodoStillValid = regimenPeriodo && periodoSeleccionado
              ? isPeriodoVigente(regimenPeriodo, periodoSeleccionado).vigente
              : false
            const hasPermiso = !!permisoActivo
            const canSend = (periodoStillValid || hasPermiso) && !enviando && !guardandoBorrador

            return (
              <div className="flex flex-col gap-3">
                {errorBorrador && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <span className="text-xs text-destructive">{errorBorrador}</span>
                  </div>
                )}
                {errorEnvio && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <span className="text-xs text-destructive">{errorEnvio}</span>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <Button variant="outline" onClick={handleBack} disabled={enviando || guardandoBorrador}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />Anterior
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={guardandoBorrador || enviando}
                      onClick={handleGuardarBorrador}
                      className="gap-1.5"
                    >
                      {guardandoBorrador
                        ? <><Clock className="h-4 w-4 animate-spin" />Guardando...</>
                        : <><Save className="mr-1.5 h-4 w-4" />Guardar Borrador</>
                      }
                    </Button>

                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[160px]"
                      disabled={!canSend}
                      onClick={() => handleEnviarAValidacion(periodoStillValid, hasPermiso)}
                    >
                      {enviando ? (
                        <><Clock className="mr-1.5 h-4 w-4 animate-spin" />Enviando...</>
                      ) : (
                        <><SendHorizonal className="mr-1.5 h-4 w-4" />Enviar a Validacion</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}