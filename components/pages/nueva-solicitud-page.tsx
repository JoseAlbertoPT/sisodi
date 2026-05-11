"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PageLayout } from "@/components/page-layout"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {

  FilePlus, Upload, ArrowLeft, ArrowRight, Plus, Trash2,
  FileText, ClipboardList, Save, SendHorizonal, AlertCircle, Info,
  ShieldAlert, CheckCircle2, Clock, Calendar, Lock, X, Search, Loader2,

} from "lucide-react"
import { useSolicitudes, type TipoAdministracion } from "@/lib/solicitudes-store"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { useAuth } from "@/lib/auth-context"
import { parseDateDMY, isPeriodoVigente, type PeriodoCap3000, type PeriodoCap1000 } from "@/lib/calendario-recepcion-mock"
import { DatePickerHabil, isoToDate, dateToIso } from "@/components/ui/date-picker-habil"
import { useHistoricoStore } from "@/lib/historico-store"
import type { HistoricoRow } from "@/lib/parse-excel-historico"
import { RANGOS_TABULADOR, esMostrarEnFormulario } from "@/lib/tabulador"
import { filtrarSecretarias, getUAsForSecretaria, getClaveForUA } from "@/lib/ua-claves-catalog"
import { fetchCentralizadaTree, type OrganoCentralizadoNode } from "@/lib/catalogo-api"

export type FormularioData = {
  secretaria:            string
  unidadAdministrativa:  string
  unidadResponsable:     string
  programaProyecto:      string
  regimen:               string
  tipoActividades:       string
  numeroPrestadores:     string
  denominacion:          string
  puestoJefeInmediato:   string
  tipoAdministracionNom?: "centralizada" | "paraestatal"
  vigenciaInicio:        string
  vigenciaFin:           string
  importeBruto:          string
  tipoImporte:           string
  nivelTabulador:        string
  categoriaTabulador:    string
  objeto:                string
  actividades:           string[]
  responsabilidades:     string[]
  marcoNormativo:        string[]
  condicionesRiesgos?:   string[]
  resguardoActivos?:     string
  escolaridad:           string
  compAdm:               string
  compTec:               string
  compSoc:               string
  valores:               string
  areasExp:              string
  riesgoCaidas?:         string
  riesgoMutilaciones?:   string
  riesgoGolpes?:         string
  riesgoOtros?:          string
  condicionCambioDomicilio?: boolean
  condicionHorario?:         boolean
  condicionViajar?:          boolean
}

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
  nivelCategoria:         "NIVEL y CATEGORIA",
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
      { value: "Dir. de Obras y Proyectos ",        label: "Dir. de Obras y Proyectos" },
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
      { value: "Dir. de Desarrollo Social ",                  label: "Dir. de Desarrollo Social" },
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

function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function fmtClave(c: string): string {
  return c.replace(/\./g, " ").trim()
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
  return n.toLocaleString("es-Mx", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseMoney(str: string): number {
  if (!str) return -1
  const clean = str.replace(/[$,\s]/g, "")
  const n = parseFloat(clean)
  return isNaN(n) ? -1 : n
}
function getVigenciaMin(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}-01`
}
function esFechaPasada(dateStr: string): boolean {
  if (!dateStr) return false
  return dateStr < getVigenciaMin()
}

function esFinDeSemana(dateStr: string): boolean {
  if (!dateStr) return false
  const [y, m, d] = dateStr.split("-").map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}
function esFolioValido(folio: string): boolean {
  if (!folio || folio.trim() === "") return false
  const s = folio.trim()
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) return false
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return false
  if (/^\d{5,}$/.test(s)) return false
  return true
}

function OficioUpload({ vigenciaInicio, onFileChange }: { vigenciaInicio: string; onFileChange?: (file: File | null) => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFile = (file: File) => {
    setError(null)
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "zip", "rar", "txt", "odt", "ods"].includes(ext ?? "")) {
      setError("Formato no soportado. Se aceptan PDF, DOC, DOCX, XLS, XLSX, imágenes, ZIP, entre otros."); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo supera el límite de 10 MB."); return
    }
    setArchivo(file)
    onFileChange?.(file)
  }

        return (
        <div className="flex flex-col gap-1.5">
        <input ref={inputRef} type="file" accept="*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
        className={`flex items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 cursor-pointer transition-colors
            ${archivo ? "border-secondary bg-secondary/5" : error ? "border-destructive/50 bg-destructive/5" : "border-border bg-background hover:border-secondary"}`}
        >
        {archivo ? (
            <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
            <span className="text-xs font-medium text-secondary truncate max-w-xs">{archivo.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setArchivo(null); setError(null); onFileChange?.(null) }}
              className="text-muted-foreground hover:text-destructive ml-1 text-xs leading-none">✕</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Cualquier formato (máx. 10 MB) — Clic para buscar o Arrastra</p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

function formatFolioJustificacion(folio: string): string {
  const m = folio.match(/^JUST-(\d{4})-(\d+)$/)
  if (!m) return folio
  return `${parseInt(m[2], 10)}/${m[1]}`
}

function formatFolioDictamen(folio: string): string {
  const m = folio.match(/^(\d+)\/\d{1,2}\/(\d{4})$/)
  if (!m) return folio
  return `${parseInt(m[1], 10)}/${m[2]}`
}

function splitList(text: any): string[] {
  if (typeof text !== 'string') return [""]
  const lines = text
    .split(/\n|\r\n/)
    .map((s) => s.replace(/^\s*[IVX]+\.\s*/, "").replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean)
  return lines.length > 0 ? lines : [""]
}

function splitTags(s?: string): string[] {
  if (!s) return []
  return s.split(/[\n\r•·,;]+/).map(t => t.trim()).filter(Boolean)
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

function useExcelRows(historicos: { sheets: Record<string, HistoricoRow[]> }[]): HistoricoRow[] {
  return useMemo(() => {
    if (historicos.length === 0) return []
    const last = historicos[historicos.length - 1]
    return Object.values(last.sheets).flat()
  }, [historicos])
}

const FALLBACK_TIPOS_ACTIVIDAD: Record<string, { value: string; label: string }[]> = {
  "centralizada:honorarios": [
    { value: "profesional", label: "Actividades Profesionales" },
    { value: "tecnico",     label: "Actividades Técnicas" },
    { value: "operativo",   label: "Actividades Operativas" },
    { value: "asesoria",    label: "Actividades de Asesoría" },
  ],
  "centralizada:asimilados": [
    { value: "profesional", label: "Actividades Profesionales" },
    { value: "tecnico",     label: "Actividades Técnicas" },
    { value: "asesoria",    label: "Actividades de Asesoría" },
  ],
  "paraestatal:honorarios": [
    { value: "direccion_proyecto",     label: "Dirección de Proyecto" },
    { value: "coordinacion_tecnica",   label: "Coordinación Técnica" },
    { value: "soporte_administrativo", label: "Soporte Administrativo" },
    { value: "asesoria_especializada", label: "Asesoría Especializada" },
  ],
  "paraestatal:asimilados": [
    { value: "direccion_proyecto",     label: "Dirección de Proyecto" },
    { value: "coordinacion_tecnica",   label: "Coordinación Técnica" },
    { value: "asesoria_especializada", label: "Asesoría Especializada" },
  ],
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
  rows: HistoricoRow[], regimen: string, programa?: string, secretaria?: string
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
    .filter((row) => {
      if (!secretaria) return true
      return getCell(row, COL.secretaria).toLowerCase().includes(secretaria.toLowerCase())
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

  function useTiposActividad(
  regimen: string, rows: HistoricoRow[],
  tipoAdmin?: "centralizada" | "paraestatal", secretaria?: string
): { value: string; label: string }[] {
    return useMemo(() => {

    if (!regimen) return []
    const key = tipoAdmin ? `${tipoAdmin}:${regimen}` : regimen
    const fallback = FALLBACK_TIPOS_ACTIVIDAD[key] ?? FALLBACK_TIPOS_ACTIVIDAD[regimen] ?? []
    if (rows.length === 0) return fallback
    const fromExcel = extraerTiposActividad(rows, regimen, undefined, secretaria)
    return fromExcel.length > 0 ? fromExcel : fallback
  }, [regimen, rows, tipoAdmin, secretaria])
}

  function useProgramas(rows: HistoricoRow[], unidad?: string): string[] {
  return useMemo(() => {
    if (rows.length === 0) return []
    const filtered = unidad
      ? rows.filter((row) => {
          const ua = getCell(row, COL.unidadAdscripcion)
          return ua.toLowerCase().includes(unidad.toLowerCase()) ||
            unidad.toLowerCase().includes(ua.toLowerCase())
        })
      : rows
    const source = filtered.length > 0 ? filtered : rows
    const seen = new Set<string>()
    source.forEach((row) => { const p = getCell(row, COL.programaProyecto); if (p) seen.add(p) })
    return Array.from(seen).sort()
  }, [rows, unidad])
}

function useTiposActividadPorPrograma(
  programa: string, regimen: string, rows: HistoricoRow[],
  tipoAdmin?: "centralizada" | "paraestatal", secretaria?: string
): { value: string; label: string }[] {
  return useMemo(() => {
    if (!programa) return []
    const key = tipoAdmin ? `${tipoAdmin}:${regimen}` : regimen
    const fallback = FALLBACK_TIPOS_ACTIVIDAD[key] ?? FALLBACK_TIPOS_ACTIVIDAD[regimen] ?? []
    if (rows.length === 0) return fallback
    const fromExcel = extraerTiposActividad(rows, regimen, programa, secretaria)
    return fromExcel.length > 0 ? fromExcel : extraerTiposActividad(rows, regimen, undefined, secretaria)
  }, [programa, regimen, rows, tipoAdmin, secretaria])
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
  nivelCategoria:         string
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

function DynamicList({
  label, items, onChange, max = 100, readonly = false,
  minRequired, nivelTabulador,
  }: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  max?: number
  readonly?: boolean
  minRequired?: number
  nivelTabulador?: string
  }) {
  const minEfectivo = useMemo(() => {
    if (minRequired !== undefined) return minRequired
    if (!nivelTabulador) return 5
    const niv = nivelTabulador.trim().toUpperCase()
    return (niv === "105" || niv === "504") ? 7 : 5
  }, [minRequired, nivelTabulador])
  const maxEfectivo = useMemo(() => {
    if (!nivelTabulador) return max
    const niv = nivelTabulador.trim().toUpperCase()
    return (niv === "105" || niv === "504") ? 7 : max
  }, [nivelTabulador, max])
  const filledCount = items.filter((i) => i.trim() !== "").length
  const belowMin = !readonly && filledCount < minEfectivo
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Label className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
          {label}
          {readonly && <Lock className="h-3 w-3 text-muted-foreground" />}
          {!readonly && (
            <span className={`text-xs font-normal ml-1 ${belowMin ? "text-destructive" : "text-muted-foreground"}`}>
              (mínimo {minEfectivo})
            </span>
          )}
        </Label>
      )}
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-lg border-2 border-transparent px-3 py-2"
          >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
            {idx + 1}
          </span>
          {readonly && !item ? (
              <span className="text-sm text-muted-foreground">—</span>
           ) : (
            <Input
              value={item}
              onChange={(e) => {
                if (readonly) return
                const copy = [...items]; copy[idx] = e.target.value; onChange(copy)
              }}
              placeholder={`${label || "Item"} ${idx + 1}`}
              className={`border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm
                ${readonly ? "bg-transparent text-muted-foreground cursor-not-allowed" : "bg-transparent"}`}
              readOnly={readonly}
              />
              )}
          {!readonly && items.length > 1 && (
            <button
              type="button"
              onClick={() => { const copy = items.filter((_, i) => i !== idx); onChange(copy) }}
              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {!readonly && items.length < maxEfectivo && (
        <Button type="button" variant="outline" size="sm" className="w-fit mt-1"
          onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1 h-4 w-4" />Agregar
        </Button>
      )}
      {!readonly && belowMin && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Se requieren al menos {minEfectivo} elementos . Llevas {filledCount}.
        </p>
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

function formatMXN(n: number) {
  return n === 0 ? "$0" : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TagInput({
  items, onAdd, onRemove, placeholder, readonly = false, min, max,
}: {
  items: string[]
  onAdd: (val: string) => void
  onRemove: (i: number) => void
  placeholder?: string
  readonly?: boolean
  min?: number
  max?: number
}) {
  const [draft, setDraft] = useState("")
  const atMax = max !== undefined && items.length >= max
  const belowMin = !readonly && min !== undefined && items.length < min

  const add = () => {
    const v = draft.trim()
    if (!v || atMax) return
    onAdd(v)
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2">
      {!readonly && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
            placeholder={atMax ? `Máximo ${max} elementos alcanzado` : placeholder}
            className="bg-background"
            disabled={atMax}
          />
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={add} disabled={!draft.trim() || atMax}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      {!readonly && (min || max) && (
        <span className={`text-xs ${belowMin ? "text-destructive" : "text-muted-foreground"}`}>
          {items.length} elemento{items.length !== 1 ? "s" : ""}
          {min && ` · mín. ${min}`}{max && ` · máx. ${max}`}
        </span>
      )}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs">
              {item}
              {!readonly && (
                <button type="button" onClick={() => onRemove(i)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        readonly && <span className="text-sm text-muted-foreground">—</span>
      )}
      {belowMin && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />Mínimo {min} elementos requeridos.
        </p>
      )}
    </div>
  )
}

type TabuladorEntry = { nivel: string; categoria: string }

const SSPC_KEYWORDS = ["SEGURIDAD Y PROTECCION CIUDADANA", "SEGURIDAD Y PROTECCIÓN CIUDADANA", "SSPC"]
function isSSPC(secretaria?: string) {
  if (!secretaria) return false
  const upper = secretaria.toUpperCase()
  return SSPC_KEYWORDS.some((k) => upper.includes(k))
}

function TabuladorNiveles({ nivelCategoria, importeBruto, readonly = false, onSeleccionadoChange, secretaria }: {
  nivelCategoria?: string; importeBruto?: string; readonly?: boolean
  onSeleccionadoChange?: (nivel: string, categoria: string) => void
  secretaria?: string
}) {
  const normalizedImporte = parseImporteBruto(importeBruto || "")
  const [busqueda, setBusqueda]         = useState("")
  const [seleccionado, setSeleccionado] = useState<TabuladorEntry | null>(null)
  const rangosActivos = useMemo(() =>
    RANGOS_TABULADOR.filter((r) => {
      if (!esMostrarEnFormulario(r.nivel)) return false
      const niv = parseInt(r.nivel, 10)
      return niv >= 500 && niv < 600 ? isSSPC(secretaria) : true
    }),
  [secretaria])
  useEffect(() => {
    const normalized = parseImporteBruto(importeBruto || "")
    const q = normalized || ""
    if (!q) { setBusqueda(""); setSeleccionado(null); return }
    setBusqueda(normalized)
    const val = parseMoney(q)
    if (val >= 0) {
      const match = rangosActivos.find((r) => val >= r.min && val <= r.max)
      if (match) { setSeleccionado({ nivel: match.nivel, categoria: match.categoria }); return }
    }
    setSeleccionado(null)
  }, [importeBruto, rangosActivos])
  useEffect(() => {
    if (!onSeleccionadoChange) return
    onSeleccionadoChange(seleccionado?.nivel ?? "", seleccionado?.categoria ?? "")
  }, [seleccionado, onSeleccionadoChange])
  const coincidencias = useMemo(() => {
    const q = busqueda.trim()
    if (!q) return []
    const val = parseMoney(q)
    if (val >= 0) return rangosActivos.filter((r) => val >= r.min && val <= r.max)
    return []
  }, [busqueda, rangosActivos])

  return (
    <Card className="shadow-sm border-secondary/30 border-2">
      <CardHeader className="px-4 pt-3 pb-1">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <ClipboardList className="h-4 w-4 text-secondary" />Equivalencia al Tabulador
          {readonly && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-3 pt-2">
        {readonly ? (
          <div className="flex items-center gap-3 rounded-lg border-2 border-secondary/20 bg-secondary/5 px-3 py-2">
            <span className="text-sm font-semibold text-card-foreground">
              {(() => {
                let nivel = coincidencias[0]?.nivel || nivelCategoria || ""
                if (!nivel && normalizedImporte) {
                  const val = parseMoney(normalizedImporte)
                  const match = RANGOS_TABULADOR.find((r) => val >= r.min && val <= r.max)
                  nivel = match?.nivel ?? ""
                }
                if (!nivel && !normalizedImporte) {
                  return <span className="text-muted-foreground font-normal">—</span>
                }
                return (
                  <>
                    {nivel && <span className="text-secondary">{nivel}</span>}
                    {nivel && normalizedImporte && <span className="mx-1 text-muted-foreground">—</span>}
                    {normalizedImporte && <span>{normalizedImporte}</span>}
                  </>
                )
              })()}
            </span>
          </div>
        ) : (
          <>
            {!seleccionado && coincidencias.length > 1 && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Hay varias coincidencias — seleccione el nivel que corresponda.
                </span>
              </div>
            )}
            {seleccionado && (
              <div className="flex items-center gap-2 rounded-md bg-secondary/10 border border-secondary/30 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                <span className="text-xs text-secondary font-medium">
                  Nivel seleccionado: <strong>{seleccionado.nivel}</strong>
                  {seleccionado.categoria ? ` — categoría ${seleccionado.categoria}` : ""}
                </span>
              </div>
            )}
            {busqueda.trim() === "" ? (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Ingrese el importe para ver coincidencias</span>
              </div>
            ) : coincidencias.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="text-xs text-destructive">Sin coincidencias en el tabulador.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {coincidencias.map((c) => {
                  const isSelected = seleccionado?.nivel === c.nivel && seleccionado?.categoria === c.categoria
                  return (
                    <div
                      key={`${c.nivel}-${c.categoria}`}
                      onClick={() => setSeleccionado(isSelected ? null : { nivel: c.nivel, categoria: c.categoria })}
                      className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 cursor-pointer transition-colors
                        ${isSelected ? "border-secondary bg-secondary/15" : "border-secondary/20 bg-secondary/5 hover:border-secondary/50"}`}
                         >
                        <span className="text-sm font-semibold text-card-foreground shrink-0">
                        {c.nivel} : {formatMXN(c.min)} - {formatMXN(c.max)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{c.puesto}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-secondary ml-auto shrink-0" />}
                        </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
  const [open, setOpen] = useState(false)
  const palabras = busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtradas = useMemo(() => {
    if (!palabras.length) return opciones
    return opciones.filter((o) => {
      const etiqueta = norm(o.label)
      return palabras.every((p) => etiqueta.includes(norm(p)))
    })
  }, [opciones, busqueda])
  const selectedLabel = opciones.find((o) => o.value === value)?.label
  return (
    <Select
      value={value}
      onValueChange={(v) => { onValueChange(v); setOpen(false) }}
      disabled={disabled}
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setBusqueda("") }}
    >
      <SelectTrigger className={`bg-background w-full ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
        <span className="block truncate text-sm pr-1">
          {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent>
        <div className="px-2 py-1.5 border-b border-border sticky top-0 bg-popover z-10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="h-7 text-xs bg-background pl-7 pr-6"
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {busqueda && (
            <p className="text-[10px] text-muted-foreground mt-1 pl-1">
              {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtradas.length === 0
            ? <div className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados para "{busqueda}"</div>
            : filtradas.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))
          }
        </div>
      </SelectContent>
    </Select>
  )
}

function MarcoNormativoModal({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-muted/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Marco Normativo — Aviso importante</span>
          </div>
          <button onClick={onDismiss} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <p className="text-sm text-card-foreground">
            Este apartado deberá contar con <strong>validación previa por la UEJ</strong> o su equivalente antes de su envío.
          </p>
          <p className="text-sm text-card-foreground">
            La información registrada será <strong>responsabilidad de la persona titular</strong> de la Unidad de Enlace Financiero Administrativo o equivalente.
          </p>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/20">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAccept}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />Entendido, continuar
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormulaLlenadoModal({ onClose }: { onClose: () => void }) {
  const filas: { elemento: string; ejemplo: string }[] = [
    { elemento: "Verbo Infonitivo",                    ejemplo: "Revisar" },
    { elemento: "Actividad – ¿Qué hace?",               ejemplo: "Que las descripciones y perfiles de puesto cumplan con las actividades, responsabilidades y requisitos solicitados" },
    { elemento: "¿Cómo lo hace? / ¿En qué se basa?",   ejemplo: "Realizar el análisis para su elaboración y/o actualización, en apego al procedimiento y metodología establecida por la Dirección General de Desarrollo Organizacional" },
    { elemento: "Con la Finalidad de  / ¿Para qué lo hace?",       ejemplo: "Con la finalidad de que el puesto documentado cumpla con la funcionalidad requerida" },
    { elemento: "Alcance /¿Dónde aplica sus funciones?",             ejemplo: "De las plazas que integran la Administración Pública del Gobierno del Estado" },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Fórmula de llenado</span>
            <span className="text-xs text-muted-foreground">Guía para redactar correctamente el campo</span>

          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse">
            <thead>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium text-muted-foreground border border-border align-top">{fila.elemento}</td>
                  <td className="px-4 py-3 text-card-foreground border border-border leading-relaxed">{fila.ejemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}
function getNumeroUA(secretaria: string, unidad: string): string {
  if (!unidad) return "—"
  const uas = getUAsForSecretaria(secretaria)
  const idx = uas.findIndex((ua) => ua === unidad)
  return idx >= 0 ? String(idx + 1) : unidad
}

function FormularioPrestacion({
  prefilled, lockVigenciaOnly, regimenPeriodo = "", excelRows = [], esRenovacion = false,
  datosRenovacion, onFormChange, onArchivoChange, secretariaFija, unidadFija, claveReportePlazas, catalogoUAs = [],
  initialData,
}: {
  prefilled: boolean
  lockVigenciaOnly?: boolean
  regimenPeriodo?: string
  excelRows?: HistoricoRow[]
  esRenovacion?: boolean
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
  onArchivoChange?: (file: File | null) => void
  secretariaFija?: string | null
  unidadFija?: string | null
  claveReportePlazas?: string | null
  catalogoUAs?: { clave: string; nombre: string }[]
  initialData?: Partial<FormularioData>
}) {
  const bloqueadoPorRenovacion = esRenovacion
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [formulaObjetoShown, setFormulaObjetoShown] = useState(false)
  const [formulaActividadesShown, setFormulaActividadesShown] = useState(false)

  const regimenInicial = datosRenovacion
    ? normalizaRegimen(datosRenovacion.regimen)
    : initialData?.regimen
    || (regimenPeriodo === "honorarios" ? "honorarios"
    : regimenPeriodo === "asimilados" ? "asimilados"
    : prefilled ? "honorarios" : "")
  const regimenBloqueado = bloqueadoPorRenovacion || regimenPeriodo === "honorarios" || regimenPeriodo === "asimilados"
  const [regimen, setRegimen] = useState(regimenInicial)
  const regimenEfectivo = regimenPeriodo || regimen

  const secInicial = datosRenovacion?.secretaria ?? initialData?.secretaria ?? secretariaFija ?? (prefilled ? "Secretaria de Administracion" : "")
  const [secretariaInput,      setSecretariaInput]      = useState(secInicial)
  const [secretariaConfirmada, setSecretariaConfirmada] = useState(secInicial)
  const [showSugerencias,      setShowSugerencias]      = useState(false)
  const [unidadSeleccionada,   setUnidadSeleccionada]   = useState(
    datosRenovacion?.unidadAdscripcion ?? initialData?.unidadAdministrativa ?? unidadFija ?? ""
  )
  const [claveUA, setClaveUA] = useState(initialData?.unidadAdministrativa ?? claveReportePlazas ?? "")
  const [urgSeleccionada,      setUrgSeleccionada]      = useState(
    datosRenovacion?.unidadResponsableGasto
    ?? initialData?.unidadResponsable
    ?? (secretariaFija && unidadFija ? getClaveForUA(secretariaFija, unidadFija) : "")
    ?? ""
  )
  const [tipoAdministracionForm, setTipoAdministracionForm] = useState<"centralizada" | "paraestatal">(initialData?.tipoAdministracionNom ?? "centralizada")
  const [programaSeleccionado, setProgramaSeleccionado] = useState(
    datosRenovacion?.programaProyecto ?? initialData?.programaProyecto ?? ""
  )
  const [tipoActividadSeleccionado, setTipoActividadSeleccionado] = useState(
    datosRenovacion?.tipoActividad
      ? datosRenovacion.tipoActividad.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
      : initialData?.tipoActividades
      ? initialData.tipoActividades.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
      : ""
  )
  const [numeroPrestadores, setNumeroPrestadores] = useState(
    datosRenovacion?.numPrestadores ?? initialData?.numeroPrestadores ?? (prefilled ? "3" : "")
  )
  const [vigenciaInicio, setVigenciaInicio] = useState(
    initialData?.vigenciaInicio ?? (prefilled ? "2026-01-01" : "")
  )
  const [vigenciaFin, setVigenciaFin] = useState(
    initialData?.vigenciaFin ?? (prefilled ? "2026-06-30" : "")
  )

  const sugerencias = useMemo(() => {
    if (esRenovacion) {
      if (!secretariaInput) return SECRETARIAS_CATALOGO
      return SECRETARIAS_CATALOGO.filter((s) => s.toLowerCase().includes(secretariaInput.toLowerCase()))
    }
    return filtrarSecretarias(secretariaInput)
  }, [secretariaInput, esRenovacion])

  const datosRelacionados = useMemo(
    () => getDatosSecretaria(secretariaConfirmada, excelRows),
    [secretariaConfirmada, excelRows]
  )
  const unidadesDisponibles = esRenovacion
    ? (datosRelacionados?.unidades ?? [])
    : getUAsForSecretaria(secretariaConfirmada).map((ua) => ({ value: ua, label: ua }))
  const urgsDisponibles = datosRelacionados?.urgs ?? []
  const programasDelExcel       = useProgramas(excelRows, unidadSeleccionada || undefined)
  const programasDeLaSecretaria = datosRelacionados?.programas ?? []
  const programas = programasDelExcel.length > 0 ? programasDelExcel : programasDeLaSecretaria

  const tiposActividadPorPrograma = useTiposActividadPorPrograma(
    programaSeleccionado, regimenEfectivo, excelRows, tipoAdministracionForm, secretariaConfirmada
  )
  const tiposActividadPorRegimen  = useTiposActividad(
    regimenEfectivo, excelRows, tipoAdministracionForm, secretariaConfirmada
  )
  const tiposActividad = programaSeleccionado && tiposActividadPorPrograma.length > 0
    ? tiposActividadPorPrograma : tiposActividadPorRegimen
  const rowPrecarga = useRowPrecarga(programaSeleccionado, tipoActividadSeleccionado, regimenEfectivo, excelRows)
  const [importeBruto, setImporteBruto] = useState(
    datosRenovacion?.importeBruto
      ? parseImporteBruto(datosRenovacion.importeBruto)
      : initialData?.importeBruto ?? (prefilled ? "45,000.00" : "")
  )
  const [tipoImporte, setTipoImporte] = useState(initialData?.tipoImporte || "Mensual")
  const [actividades, setActividades] = useState<string[]>(
    datosRenovacion?.actividades
      ? splitList(datosRenovacion.actividades)
      : initialData?.actividades && initialData.actividades.length > 0
        ? initialData.actividades
        : prefilled ? ["Desarrollo de modulos del sistema institucional"] : [""]
  )
  const [responsabilidades, setResponsabilidades] = useState<string[]>(
    datosRenovacion?.responsabilidades
      ? splitList(datosRenovacion.responsabilidades)
      : initialData?.responsabilidades && initialData.responsabilidades.length > 0
        ? initialData.responsabilidades
        : prefilled ? ["Cumplir con los plazos establecidos"] : [""]
  )
  const [objeto, setObjeto] = useState(
    datosRenovacion?.objeto ?? initialData?.objeto
    ?? (prefilled ? "Prestacion de servicios profesionales para el desarrollo e implementacion de sistemas informaticos." : "")
  )
  const [escolaridad, setEscolaridad] = useState<string[]>(
    datosRenovacion?.escolaridad
      ? [datosRenovacion.escolaridad]
      : initialData?.escolaridad
        ? splitTags(initialData.escolaridad)
        : prefilled ? ["Licenciatura"] : []
  )
  const [compAdm, setCompAdm] = useState<string[]>(splitTags(datosRenovacion?.compAdm ?? initialData?.compAdm))
  const [compTec, setCompTec] = useState<string[]>(splitTags(datosRenovacion?.compTec ?? initialData?.compTec))
  const [compSoc, setCompSoc] = useState<string[]>(splitTags(datosRenovacion?.compSoc ?? initialData?.compSoc))
  const [valores, setValores] = useState<string[]>(splitTags(datosRenovacion?.valores ?? initialData?.valores))
  const [areasExp, setAreasExp] = useState<string[]>(splitTags(datosRenovacion?.areasExp ?? initialData?.areasExp))
  const [nivelTabulador,    setNivelTabulador]    = useState(initialData?.nivelTabulador ?? "")
  const [categoriaTabulador, setCategoriaTabulador] = useState(initialData?.categoriaTabulador ?? "")
  const fuenteDatos = excelRows.length > 0 && secretariaConfirmada ? "excel" : "catalogo"
  const notifyParent = useCallback((overrides: Partial<FormularioData> = {}) => {
      const tipoActividadLabel = tiposActividad.find(t => t.value === tipoActividadSeleccionado)?.label ?? tipoActividadSeleccionado

    onFormChange({
      secretaria:           secretariaConfirmada || secretariaInput,
      unidadAdministrativa: claveUA || unidadSeleccionada,
      unidadResponsable:    urgSeleccionada,
      programaProyecto:     programaSeleccionado,
      regimen:              regimenEfectivo,
      tipoActividades:      tipoActividadLabel,
      numeroPrestadores,
      denominacion:         "",
      puestoJefeInmediato:  "",
      vigenciaInicio,
      vigenciaFin,
      importeBruto,
      tipoImporte,
      nivelTabulador,
      categoriaTabulador,
      objeto,
      actividades,
      responsabilidades,
      marcoNormativo:       [],
      escolaridad:          escolaridad.join(", "),
      compAdm:              compAdm.join(", "),
      compTec:              compTec.join(", "),
      compSoc:              compSoc.join(", "),
      valores:              valores.join(", "),
      areasExp:             areasExp.join(", "),
      ...overrides,
    })
  }, [
    secretariaConfirmada, secretariaInput, claveUA, unidadSeleccionada, urgSeleccionada,
    programaSeleccionado, regimenEfectivo, tipoActividadSeleccionado, tiposActividad,
    numeroPrestadores, nivelTabulador, categoriaTabulador,
    vigenciaInicio, vigenciaFin, importeBruto, tipoImporte,
    objeto, actividades, responsabilidades,
    escolaridad, compAdm, compTec, compSoc, valores, areasExp, onFormChange,
  ])

  useEffect(() => { notifyParent() }, [notifyParent])

  const handleSecretariaConfirm = (valor: string) => {
    if (bloqueadoPorRenovacion) return
    setSecretariaInput(valor)
    setSecretariaConfirmada(valor)
    setShowSugerencias(false)
    setProgramaSeleccionado("")
    setTipoActividadSeleccionado("")
    if (!esRenovacion) {
      const uas = getUAsForSecretaria(valor)
      const primeraUA = uas[0] ?? ""
      setUnidadSeleccionada(primeraUA)
      setUrgSeleccionada(getClaveForUA(valor, primeraUA))
    } else {
      const datos = getDatosSecretaria(valor, excelRows)
      setUnidadSeleccionada(datos?.unidades[0]?.value ?? "")
      setUrgSeleccionada(datos?.urgs[0]?.value ?? "")
      if (!regimenBloqueado && datos?.regimen && datos.regimen !== "nombramiento") {
        setRegimen(datos.regimen)
      }
    }
  }

  const handleUnidadChange = (ua: string) => {
    setUnidadSeleccionada(ua)
    setProgramaSeleccionado("")
    setTipoActividadSeleccionado("")
    if (!esRenovacion) {
      const clave = getClaveForUA(secretariaConfirmada, ua)
      setUrgSeleccionada(clave)
      setClaveUA(clave)
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
      if (esc)  setEscolaridad([esc])
      if (cAdm) setCompAdm(splitTags(cAdm)); if (cTec) setCompTec(splitTags(cTec))
      if (cSoc) setCompSoc(splitTags(cSoc)); if (val_) setValores(splitTags(val_)); if (aExp) setAreasExp(splitTags(aExp))
    }
  }

  const handleProgramaChange = (val: string) => {
    if (bloqueadoPorRenovacion) return
    setProgramaSeleccionado(val)
    setTipoActividadSeleccionado("")
  }

  const handleRegimenChange = (val: string) => {
    if (bloqueadoPorRenovacion) return
    setRegimen(val); setTipoActividadSeleccionado("")
    setObjeto(""); setActividades([""]); setResponsabilidades([""])
    setImporteBruto(""); setEscolaridad([]); setCompAdm([])
    setCompTec([]); setCompSoc([]); setValores([]); setAreasExp([])
  }

  const tipoActividadLabel = tipoActividadSeleccionado
    ? tiposActividad.find((t) => t.value === tipoActividadSeleccionado)?.label
    : undefined
  const camposDependientesHabilitados = !bloqueadoPorRenovacion && (esRenovacion || !!secretariaConfirmada)
  const numeroUA = getNumeroUA(secretariaConfirmada || secretariaInput, unidadSeleccionada)

  return (
    <div className="flex flex-col gap-3">
      {showFormulaModal && <FormulaLlenadoModal onClose={() => setShowFormulaModal(false)} />}
      {bloqueadoPorRenovacion && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-secondary/40 bg-secondary/5 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Renovación — Datos  Precargados  y Bloqueados </span>
            <span className="text-xs text-muted-foreground">
              Todos los campos se han cargado del folio anterior. Solo puede modificar la <strong>Vigencia</strong>, el <strong>Oficio de Suficiencia</strong> y el <strong>Número de Prestadores de Servicios</strong>.
            </span>
          </div>
        </div>
      )}

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
             I. Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4 pb-3 pt-0">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Secretaría / Dependencia / Organismo
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                <span className="text-sm text-muted-foreground">{secretariaInput || "—"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Administrativa de Adscripción
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground font-semibold font-mono">{fmtClave(numeroUA)}</span>
                </div>
              ) : catalogoUAs.some((u) => u.clave !== "") ? (
                <Select
                  value={claveUA}
                  onValueChange={(clave) => {
                    const ua = catalogoUAs.find((u) => u.clave === clave)
                    setClaveUA(clave)
                    setUnidadSeleccionada(ua?.nombre ?? "")
                    setProgramaSeleccionado("")
                    setTipoActividadSeleccionado("")
                  }}
                   >
                  <SelectTrigger className="bg-background w-full font-mono">
                    <SelectValue placeholder="Seleccione clave" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogoUAs.filter((u) => u.clave !== "").map((u) => (
                      <SelectItem key={u.nombre} value={u.clave} textValue={fmtClave(u.clave)} className="font-mono">{fmtClave(u.clave)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={claveUA}
                  onChange={(e) => { setClaveUA(e.target.value); setProgramaSeleccionado(""); setTipoActividadSeleccionado("") }}
                  placeholder="Ingrese clave de la unidad administrativa"
                  className="bg-background font-mono"
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Responsable del Gasto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{urgSeleccionada || "—"}</span>
                </div>
              ) : catalogoUAs.length > 0 ? (
                <SelectConBusqueda
                  opciones={catalogoUAs.map((u) => ({ value: u.nombre, label: u.nombre }))}
                  value={urgSeleccionada}
                  onValueChange={setUrgSeleccionada}
                  placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaría" : "Seleccione unidad responsable"}
                  disabled={!camposDependientesHabilitados}
                />
              ) : urgsDisponibles.length > 0 ? (
                <SelectConBusqueda
                  opciones={urgsDisponibles}
                  value={urgSeleccionada}
                  onValueChange={setUrgSeleccionada}
                  placeholder="Seleccione unidad responsable"
                  disabled={!camposDependientesHabilitados}
                />
              ) : (
                <Input
                  value={urgSeleccionada}
                  onChange={(e) => setUrgSeleccionada(e.target.value)}
                  placeholder="Ingrese unidad responsable del gasto"
                  className="bg-background"
                  disabled={!camposDependientesHabilitados}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Programas o Proyectos
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{programaSeleccionado || "—"}</span>
                </div>
              ) : programas.length > 0 ? (
                <SelectConBusqueda
                  opciones={programas.map((p) => ({ value: p, label: p }))}
                  value={programaSeleccionado}
                  onValueChange={handleProgramaChange}
                  placeholder={!esRenovacion && !camposDependientesHabilitados ? "Ingrese primero la secretaría" : "Seleccione programa"}
                  disabled={!esRenovacion && !camposDependientesHabilitados}
                />
              ) : (
                <Input
                  value={programaSeleccionado}
                  onChange={(e) => handleProgramaChange(e.target.value)}
                  placeholder="Nombre del programa" className="bg-background"
                  disabled={!esRenovacion && !camposDependientesHabilitados}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Régimen de Contratación
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
                    <SelectValue placeholder="Seleccione régimen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="honorarios">Honorarios</SelectItem>
                    <SelectItem value="asimilados">Honorarios Asimilados a Salarios</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Tipo de Actividad
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">
                    {datosRenovacion?.tipoActividad || tipoActividadLabel || "—"}
                  </span>
                </div>
              ) : (
                <Select
                  value={tipoActividadSeleccionado}
                  onValueChange={handleTipoActividadChange}
                  disabled={!regimenEfectivo}
                >
                  <SelectTrigger className={`bg-background w-full ${!regimenEfectivo ? "opacity-60 cursor-not-allowed" : ""}`}>
                    <span className="block truncate text-sm pr-1">
                      {tipoActividadLabel ?? <span className="text-muted-foreground">{!regimenEfectivo ? "Seleccione primero un régimen" : "Según unidad administrativa"}</span>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {tiposActividad.length === 0
                      ? <div className="px-3 py-2 text-xs text-muted-foreground">Sin opciones para este régimen</div>
                      : tiposActividad.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Número de Prestadores de Servicios
              </Label>
              <Input
                type="number" min={1}
                value={numeroPrestadores}
                onChange={(e) => setNumeroPrestadores(e.target.value)}
                placeholder="Ej. 5"
                className="bg-background"
              />
            </div>


            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Tipo de Pago
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground capitalize">{tipoImporte}</span>
                </div>
              ) : (
                <Select value={tipoImporte} onValueChange={setTipoImporte}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                    <SelectItem value="Unico">Único</SelectItem>
                    <SelectItem value="Por_hora">Por Hora</SelectItem>
                    <SelectItem value="Por_taller">Por Taller</SelectItem>
                    <SelectItem value="Por_dia">Por Día</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>


            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Importe Bruto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text" value={importeBruto}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteBruto(e.target.value) }}
                  onBlur={(e) => { if (!bloqueadoPorRenovacion) setImporteBruto(parseImporteBruto(e.target.value)) }}
                  placeholder="0.00"
                  className={`pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
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
                  <DatePickerHabil
                    value={isoToDate(vigenciaInicio)}
                    fromDate={isoToDate(getVigenciaMin())}
                    onChange={(d) => d && setVigenciaInicio(dateToIso(d))}
                    placeholder="Seleccionar inicio"
                    className={`w-full bg-background ${esFechaPasada(vigenciaInicio) ? "border-destructive" : ""}`}
                  />
                  {esFechaPasada(vigenciaInicio) && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />No se aceptan meses anteriores.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Término</span>
                  <DatePickerHabil
                    value={isoToDate(vigenciaFin)}
                    fromDate={isoToDate(vigenciaInicio || getVigenciaMin())}
                    onChange={(d) => d && setVigenciaFin(dateToIso(d))}
                    placeholder="Seleccionar término"
                    className={`w-full bg-background ${esFechaPasada(vigenciaFin) ? "border-destructive" : ""}`}
                  />
                  {esFechaPasada(vigenciaFin) && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />No se aceptan meses anteriores.
                    </p>
                  )}
                </div>
              </div>
            </div>


            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <OficioUpload vigenciaInicio={vigenciaInicio} onFileChange={onArchivoChange} />
            </div>
          </div>
        </CardContent>
      </Card>


      <TabuladorNiveles
        nivelCategoria={datosRenovacion?.nivelCategoria}
        importeBruto={bloqueadoPorRenovacion ? datosRenovacion?.importeBruto : importeBruto}
        readonly={bloqueadoPorRenovacion}
        onSeleccionadoChange={(nivel, categoria) => { setNivelTabulador(nivel); setCategoriaTabulador(categoria) }}
        secretaria={secretariaConfirmada || secretariaInput}
      />

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">II</span>
            Objeto de la Contratación
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 hover:opacity-70 transition-opacity" title="Ver fórmula de llenado">
              <Info className="h-4 w-4 text-[#7B2D3E]" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <Textarea
            value={objeto}
            onChange={(e) => {
              if (!bloqueadoPorRenovacion) {
                if (!formulaObjetoShown && objeto === "" && e.target.value.length > 0) {
                  setShowFormulaModal(true)
                  setFormulaObjetoShown(true)
                }
                setObjeto(e.target.value)
              }
            }}
            placeholder="Describa el objeto de la contratación de manera detallada..."
            className={`min-h-28 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed resize-none" : "bg-background"}`}
            readOnly={bloqueadoPorRenovacion}
          />
        </CardContent>
      </Card>
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">III</span>
            Actividades a Realizar
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 hover:opacity-70 transition-opacity" title="Ver fórmula de llenado">
              <Info className="h-4 w-4 text-[#7B2D3E]" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <DynamicList
            label="" items={actividades}
            onChange={(newItems) => {
              if (!formulaActividadesShown) {
                const itemAdded = newItems.length > actividades.length
                const firstContent = newItems.some((v, i) => v.trim() !== "" && (actividades[i] ?? "").trim() === "")
                if (itemAdded || firstContent) {
                  setShowFormulaModal(true)
                  setFormulaActividadesShown(true)
                }
              }
              setActividades(newItems)
            }}
            readonly={bloqueadoPorRenovacion}
            nivelTabulador={nivelTabulador}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">IV</span>
            Responsabilidades
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-2">
          <DynamicList
            label="" items={responsabilidades} onChange={setResponsabilidades}
            readonly={bloqueadoPorRenovacion}
            nivelTabulador={nivelTabulador}
          />
          <div className="flex items-start gap-3 rounded-lg border-2 border-secondary/40 bg-secondary/5 px-4 py-3">
            <Info className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-card-foreground">Las responsabilidades deberán ser congruentes con las actividades registradas.</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {}
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">V</span>
            Perfil
            {bloqueadoPorRenovacion && <Lock className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          <p className="text-xs text-muted-foreground italic">
            SE REFIERE A LA ESCOLARIDAD, COMPETENCIAS Y EXPERIENCIA.
          </p>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-5 px-4 pb-4 pt-0 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-2">
            <span className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
              Escolaridad Mínima
              {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
            </span>
            <DynamicList
              label="" items={escolaridad.length > 0 ? escolaridad : [""]}
              onChange={setEscolaridad}
              readonly={bloqueadoPorRenovacion}
              minRequired={1}
              max={1}
            />
          </div>

          {[
            { sub: "II.1", label: "Competencias Administrativas", items: compAdm,  onChange: setCompAdm },
            { sub: "II.2", label: "Competencias Técnicas",        items: compTec,  onChange: setCompTec },
            { sub: "II.3", label: "Competencias Sociales",        items: compSoc,  onChange: setCompSoc },
            { sub: null,   label: "Áreas de Experiencia",         items: areasExp, onChange: setAreasExp },
            { sub: null,   label: "Valores",                      items: valores,  onChange: setValores },
          ].map(({ sub, label, items, onChange }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {sub && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{sub}</span>
                )}
                <span className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
                  {label}
                  {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </div>
              <DynamicList
                label="" items={items.length > 0 ? items : [""]}
                onChange={onChange}
                readonly={bloqueadoPorRenovacion}
                minRequired={3}
                max={5}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
function FormularioNombramiento({
  prefilled, esRenovacion = false, excelRows = [], datosRenovacion, onFormChange, onArchivoChange, secretariaFija, unidadFija, claveReportePlazas, catalogoUAs = [],
  tipoAdministracionUsuario = "centralizada", initialData,
}: {
  prefilled: boolean; esRenovacion?: boolean; excelRows?: HistoricoRow[]
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
  onArchivoChange?: (file: File | null) => void
  secretariaFija?: string | null
  unidadFija?: string | null
  claveReportePlazas?: string | null
  catalogoUAs?: { clave: string; nombre: string }[]
  tipoAdministracionUsuario?: "centralizada" | "paraestatal"
  initialData?: Partial<FormularioData>
}) {
  const bloqueadoPorRenovacion = esRenovacion
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [formulaObjetoShown, setFormulaObjetoShown] = useState(false)
  const [formulaActividadesShown, setFormulaActividadesShown] = useState(false)
  const [importeNeto,    setImporteNeto]    = useState(
    datosRenovacion?.importeBruto ? parseImporteBruto(datosRenovacion.importeBruto)
      : initialData?.importeBruto ? parseImporteBruto(initialData.importeBruto)
      : prefilled ? "28,500.00" : ""
  )
  const [tipoImporte, setTipoImporte] = useState(initialData?.tipoImporte || "Mensual")
  const [funciones, setFunciones] = useState<string[]>(
    datosRenovacion?.actividades ? splitList(datosRenovacion.actividades)
      : initialData?.actividades && initialData.actividades.length > 0 ? initialData.actividades
      : prefilled ? ["Coordinar procesos administrativos"] : [""]
  )
  const [responsabilidades, setResponsabilidades] = useState<string[]>(
    datosRenovacion?.responsabilidades ? splitList(datosRenovacion.responsabilidades)
      : initialData?.responsabilidades && initialData.responsabilidades.length > 0 ? initialData.responsabilidades
      : prefilled ? ["Cumplimiento normativo del area"] : [""]
  )
  const [marcoNormativo, setMarcoNormativo] = useState<string[]>(
    initialData?.marcoNormativo && initialData.marcoNormativo.length > 0 ? initialData.marcoNormativo
      : prefilled ? ["Ley Orgánica de la Administración Pública"] : [""]
  )
  const [showMarcoModal, setShowMarcoModal] = useState(false)
  const marcoModalShownRef = useRef(false)
  const [pendingMarcoChange, setPendingMarcoChange] = useState<string[] | null>(null)

  const handleMarcoNormativoChange = useCallback((newItems: string[]) => {
    if (!marcoModalShownRef.current) {
      setPendingMarcoChange(newItems)
      setShowMarcoModal(true)
      return
    }
    setMarcoNormativo(newItems)
  }, [])
  const [secretariaInput,      setSecretariaInput]      = useState(datosRenovacion?.secretaria ?? secretariaFija ?? initialData?.secretaria ?? (prefilled ? "Secretaria de Administracion" : ""))
  const [secretariaConfirmada, setSecretariaConfirmada] = useState(datosRenovacion?.secretaria ?? secretariaFija ?? initialData?.secretaria ?? (prefilled ? "Secretaria de Administracion" : ""))
  const [showSugerencias, setShowSugerencias] = useState(false)
  const [unidadAdscripcion, setUnidadAdscripcion] = useState(
    datosRenovacion?.unidadAdscripcion ?? initialData?.unidadAdministrativa ?? unidadFija ?? ""
  )
  const [claveUA, setClaveUA] = useState(initialData?.unidadAdministrativa ?? claveReportePlazas ?? "")
  const [urgSeleccionada, setUrgSeleccionada] = useState(
    datosRenovacion?.unidadResponsableGasto ?? initialData?.unidadResponsable ?? ""
  )
  const [programaInput, setProgramaInput] = useState(datosRenovacion?.programaProyecto ?? initialData?.programaProyecto ?? (prefilled ? "P-005 Fortalecimiento Institucional" : ""))
  const [vigenciaInicio, setVigenciaInicio] = useState(initialData?.vigenciaInicio ?? (prefilled ? "2026-03-01" : ""))
  const [vigenciaFin,    setVigenciaFin]    = useState(initialData?.vigenciaFin ?? (prefilled ? "2026-08-31" : ""))
  const [numeroPrestadores, setNumeroPrestadores] = useState(datosRenovacion?.numPrestadores ?? initialData?.numeroPrestadores ?? (prefilled ? "2" : ""))
  const [denominacion, setDenominacion] = useState(initialData?.denominacion ?? (prefilled ? "Jefe de Departamento" : ""))
  const [puestoJefeInmediato, setPuestoJefeInmediato] = useState(initialData?.puestoJefeInmediato ?? (prefilled ? "Director de Área" : ""))
  const [objetoNombramiento, setObjetoNombramiento] = useState(
    datosRenovacion?.objeto ?? initialData?.objeto ?? (prefilled ? "Nombramiento para coordinar funciones de la unidad administrativa." : "")
  )
  const [nivelTabulador,     setNivelTabulador]     = useState(initialData?.nivelTabulador ?? "")
  const [categoriaTabulador, setCategoriaTabulador] = useState(initialData?.categoriaTabulador ?? "")
  const [condiciones, setCondiciones]               = useState<Record<string, string>>(() => {
    if (!initialData) return {}
    const c: Record<string, string> = {}
    if (initialData.condicionCambioDomicilio) c["cambio-de-domicilio"] = "si"
    if (initialData.condicionHorario)         c["horario-especial"]    = "si"
    if (initialData.condicionViajar)          c["viajar"]              = "si"
    return c
  })
  const [riesgos,     setRiesgos]                   = useState<Record<string, string>>(() => {
    if (!initialData) return {}
    const r: Record<string, string> = {}
    if (initialData.riesgoCaidas)      r["caídas"]      = initialData.riesgoCaidas
    if (initialData.riesgoMutilaciones) r["mutilaciones"] = initialData.riesgoMutilaciones
    if (initialData.riesgoGolpes)      r["golpes"]       = initialData.riesgoGolpes
    if (initialData.riesgoOtros)       r["otros"]        = initialData.riesgoOtros
    return r
  })
  const [resguardoActivos, setResguardoActivos]     = useState(initialData?.resguardoActivos ?? "")
  const [escolaridad, setEscolaridad] = useState<string[]>(splitTags(datosRenovacion?.escolaridad ?? initialData?.escolaridad))
  const [compAdm,     setCompAdm]     = useState<string[]>(splitTags(datosRenovacion?.compAdm ?? initialData?.compAdm))
  const [compTec,     setCompTec]     = useState<string[]>(splitTags(datosRenovacion?.compTec ?? initialData?.compTec))
  const [compSoc,     setCompSoc]     = useState<string[]>(splitTags(datosRenovacion?.compSoc ?? initialData?.compSoc))
  const [valores,     setValores]     = useState<string[]>(splitTags(datosRenovacion?.valores ?? initialData?.valores))
  const [areasExp,    setAreasExp]    = useState<string[]>(splitTags(datosRenovacion?.areasExp ?? initialData?.areasExp))
  const [tipoActividadSeleccionado, setTipoActividadSeleccionado] = useState(
    datosRenovacion?.tipoActividad
      ? datosRenovacion.tipoActividad.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
      : initialData?.tipoActividades
      ? initialData.tipoActividades.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
      : ""
  )
  const tipoAdministracion = tipoAdministracionUsuario
  const tiposActividadNomPorPrograma = useTiposActividadPorPrograma(
    programaInput, "nombramiento", excelRows, tipoAdministracion, secretariaConfirmada
  )
  const tiposActividadNomPorRegimen = useTiposActividad(
    "nombramiento", excelRows, tipoAdministracion, secretariaConfirmada
  )
  const tiposActividadNom = programaInput && tiposActividadNomPorPrograma.length > 0
    ? tiposActividadNomPorPrograma : tiposActividadNomPorRegimen
  const tipoActividadNomLabel = tipoActividadSeleccionado
    ? tiposActividadNom.find(t => t.value === tipoActividadSeleccionado)?.label
    : undefined

  const sugerencias = useMemo(() => {
    if (esRenovacion) {
      if (!secretariaInput) return SECRETARIAS_CATALOGO
      return SECRETARIAS_CATALOGO.filter((s) => s.toLowerCase().includes(secretariaInput.toLowerCase()))
    }
    return filtrarSecretarias(secretariaInput)
  }, [secretariaInput, esRenovacion])

  const datosRelacionados = useMemo(() => getDatosSecretaria(secretariaConfirmada, excelRows), [secretariaConfirmada, excelRows])
  const clavesAdscripcion = useMemo((): { clave: string; nombre: string }[] => {
    if (catalogoUAs.some((u) => u.clave !== "")) return catalogoUAs.filter((u) => u.clave !== "")
    return getUAsForSecretaria(secretariaConfirmada)
      .map((ua) => ({ clave: getClaveForUA(secretariaConfirmada, ua), nombre: ua }))
      .filter((u) => u.clave !== "")
  }, [catalogoUAs, secretariaConfirmada])
  const urgsDisponibles = datosRelacionados?.urgs ?? []

  const fuenteDatos = excelRows.length > 0 && secretariaConfirmada ? "excel" : "catalogo"
  const camposDependientesHabilitados = !bloqueadoPorRenovacion && !!secretariaConfirmada
  const numeroUA = getNumeroUA(secretariaConfirmada || secretariaInput, unidadAdscripcion)
  const handleSecretariaConfirm = (valor: string) => {
    if (bloqueadoPorRenovacion) return

    setSecretariaInput(valor); setSecretariaConfirmada(valor); setShowSugerencias(false)
    setUnidadAdscripcion(""); setClaveUA(""); setUrgSeleccionada("")
  }

  useEffect(() => {
    const formatKey = (k: string) => k.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    onFormChange({
      secretaria:           secretariaConfirmada || secretariaInput,
      unidadAdministrativa: claveUA || unidadAdscripcion,
      unidadResponsable:    urgSeleccionada,
      programaProyecto:     programaInput,
      regimen:              "nombramiento",
      tipoActividades:      tipoActividadNomLabel ?? tipoActividadSeleccionado,
      numeroPrestadores,
      denominacion,
      puestoJefeInmediato,
      tipoAdministracionNom: tipoAdministracion,
      vigenciaInicio,
      vigenciaFin,
      importeBruto:         importeNeto,
      tipoImporte,
      nivelTabulador,
      categoriaTabulador,
      objeto:               objetoNombramiento,
      actividades:          funciones,
      responsabilidades,
      marcoNormativo,
      condicionesRiesgos: [
        ...Object.entries(condiciones)
          .filter(([, v]) => v)
          .map(([k, v]) => `${formatKey(k)}: ${v === "si" ? "Sí" : "No"}`),
        ...Object.entries(riesgos)
          .filter(([, v]) => v)
          .map(([k, v]) => `${formatKey(k)}: ${v.charAt(0).toUpperCase() + v.slice(1)}`),
      ],
      resguardoActivos: resguardoActivos, 
      escolaridad: escolaridad.join(", "), 
      compAdm:     compAdm.join("\n"), 
      compTec:     compTec.join("\n"), 
      compSoc:     compSoc.join("\n"), 
      valores:     valores.join("\n"), 
      areasExp:    areasExp.join("\n"),
      riesgoCaidas: riesgos.caídas ?? riesgos.caidas ?? "",
      riesgoMutilaciones: riesgos.mutilaciones ?? "",
      riesgoGolpes: riesgos.golpes ?? "",
      riesgoOtros: riesgos.otros ?? "",
      condicionCambioDomicilio: condiciones["cambio-de-domicilio"] === "si",
      condicionHorario: condiciones["horario-especial"] === "si",
      condicionViajar: condiciones.viajar === "si",
    })
  }, [
    secretariaConfirmada, secretariaInput, claveUA, unidadAdscripcion, urgSeleccionada,
    programaInput, numeroPrestadores, denominacion, puestoJefeInmediato,
    tipoAdministracion,
    vigenciaInicio, vigenciaFin, importeNeto, tipoImporte,
    nivelTabulador, categoriaTabulador, objetoNombramiento,
    tipoActividadSeleccionado, tipoActividadNomLabel,
    funciones, responsabilidades, marcoNormativo, condiciones, riesgos, resguardoActivos,
    escolaridad, compAdm, compTec, compSoc, valores, areasExp, onFormChange,
  ])

  return (
    <div className="flex flex-col gap-3">
      {showFormulaModal && <FormulaLlenadoModal onClose={() => setShowFormulaModal(false)} />}
      {showMarcoModal && (
        <MarcoNormativoModal

          onAccept={() => {
            marcoModalShownRef.current = true
            if (pendingMarcoChange !== null) {
              setMarcoNormativo(pendingMarcoChange)
              setPendingMarcoChange(null)
            }
            setShowMarcoModal(false)
          }}
          onDismiss={() => {
            setPendingMarcoChange(null)
            setShowMarcoModal(false)
          }}
        />
      )}

      {bloqueadoPorRenovacion && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-secondary/40 bg-secondary/5 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">Renovación — Datos  Precargados y Bloqueados</span>
            <span className="text-xs text-muted-foreground">
              La mayoría de campos vienen precargados del folio anterior. Solo puede modificar <strong>vigencia, oficio de suficiencia, número de prestadores de servicios, marco normativo, condiciones y riesgos</strong>.
            </span>
          </div>
        </div>
      )}

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4 pb-3 pt-0">
          <div className="grid gap-3 md:grid-cols-2">

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Secretaría / Dependencia / Organismo
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                <span className="text-sm text-muted-foreground">{secretariaInput || "—"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Administrativa de Adscripción
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground font-semibold font-mono">{fmtClave(numeroUA)}</span>
                </div>
              ) : clavesAdscripcion.length > 0 ? (
                <Select
                  value={claveUA}
                  onValueChange={(clave) => {
                    const ua = clavesAdscripcion.find((u) => u.clave === clave)
                    setClaveUA(clave)
                    setUnidadAdscripcion(ua?.nombre ?? "")
                  }}
                >
                  <SelectTrigger className="bg-background w-full font-mono">
                    <SelectValue placeholder={!camposDependientesHabilitados ? "Seleccione primero la secretaría" : "Seleccione clave"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clavesAdscripcion.map((u) => (
                      <SelectItem key={u.nombre} value={u.clave} textValue={fmtClave(u.clave)} className="font-mono">{fmtClave(u.clave)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={claveUA}
                  onChange={(e) => setClaveUA(e.target.value)}
                  placeholder="Ingrese clave de la unidad administrativa"
                  className="bg-background font-mono"
                  disabled={!camposDependientesHabilitados}
                />
              )}
            </div>

            {}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Unidad Responsable del Gasto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground">{urgSeleccionada || "—"}</span>
                </div>
              ) : catalogoUAs.length > 0 ? (
                <SelectConBusqueda
                  opciones={catalogoUAs.map((u) => ({ value: u.nombre, label: u.nombre }))}
                  value={urgSeleccionada}
                  onValueChange={setUrgSeleccionada}
                  placeholder={!camposDependientesHabilitados ? "Ingrese primero la secretaría" : "Seleccione unidad responsable"}
                  disabled={!camposDependientesHabilitados}
                />
              ) : urgsDisponibles.length > 0 ? (
                <SelectConBusqueda
                  opciones={urgsDisponibles}
                  value={urgSeleccionada}
                  onValueChange={setUrgSeleccionada}
                  placeholder="Seleccione unidad responsable"
                  disabled={!camposDependientesHabilitados}
                />
              ) : (
                <Input
                  value={urgSeleccionada}
                  onChange={(e) => setUrgSeleccionada(e.target.value)}
                  placeholder="Ingrese unidad responsable del gasto"
                  className="bg-background"
                  disabled={!camposDependientesHabilitados}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Programa o Proyecto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input
                value={programaInput}
                onChange={(e) => { if (!bloqueadoPorRenovacion) setProgramaInput(e.target.value) }}
                placeholder="Nombre del programa"
                className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                readOnly={bloqueadoPorRenovacion}
                disabled={!bloqueadoPorRenovacion && !camposDependientesHabilitados}
              />
              {!bloqueadoPorRenovacion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />Puede Obtenerse desde el Oficio de Suficiencia Presupuestal.
                </p>
              )}
            </div>

            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Denominación del Nombramiento
                  {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  value={denominacion}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setDenominacion(e.target.value) }}
                  placeholder="Ej. Subdirector de Área"
                  className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Puesto del Jefe Inmediato
                  {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  value={puestoJefeInmediato}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setPuestoJefeInmediato(e.target.value) }}
                  placeholder="Ej. Director General"
                  className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>

              {}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Tipo de Actividad
                  {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                {bloqueadoPorRenovacion ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                    <span className="text-sm text-muted-foreground">
                      {datosRenovacion?.tipoActividad || tipoActividadNomLabel || "—"}
                    </span>
                  </div>
                  ) : (
                  <Select
                    value={tipoActividadSeleccionado}
                    onValueChange={setTipoActividadSeleccionado}
                  >
                    <SelectTrigger className="bg-background w-full">
                      <span className="block truncate text-sm pr-1">
                        {tipoActividadNomLabel ?? <span className="text-muted-foreground">Seleccione tipo de actividad</span>}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {tiposActividadNom.length === 0
                        ? <div className="px-3 py-2 text-xs text-muted-foreground">Sin opciones disponibles</div>
                        : tiposActividadNom.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Número de Personas a Contratar
                </Label>
                <Input
                  type="number" min={1}
                  value={numeroPrestadores}
                  onChange={(e) => setNumeroPrestadores(e.target.value)}
                  placeholder="Ej. 2"
                  className="bg-background"
                />
              </div>
            </>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Tipo de Pago
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {bloqueadoPorRenovacion ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 min-h-9">
                  <span className="text-sm text-muted-foreground capitalize">{tipoImporte}</span>
                </div>
              ) : (
                <Select value={tipoImporte} onValueChange={setTipoImporte}>
                  <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                    <SelectItem value="Unico">Único</SelectItem>
                    <SelectItem value="Por_hora">Por Hora</SelectItem>
                    <SelectItem value="Por_taller">Por Taller</SelectItem>
                    <SelectItem value="Por_dia">Por Día</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Importe Neto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text" value={importeNeto}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteNeto(e.target.value) }}
                  onBlur={(e) => { if (!bloqueadoPorRenovacion) setImporteNeto(parseImporteBruto(e.target.value)) }}
                  placeholder="0.00"
                  className={`pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>
            </div>

            {}
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Vigencia
                {bloqueadoPorRenovacion && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary ml-1">Editable</Badge>}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <DatePickerHabil
                    value={isoToDate(vigenciaInicio)}
                    fromDate={isoToDate(getVigenciaMin())}
                    onChange={(d) => d && setVigenciaInicio(dateToIso(d))}
                    placeholder="Seleccionar inicio"
                    className={`w-full bg-background ${esFechaPasada(vigenciaInicio) ? "border-destructive" : ""}`}
                  />
                  {esFechaPasada(vigenciaInicio) && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />No se aceptan meses anteriores.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Término</span>
                  <DatePickerHabil
                    value={isoToDate(vigenciaFin)}
                    fromDate={isoToDate(vigenciaInicio || getVigenciaMin())}
                    onChange={(d) => d && setVigenciaFin(dateToIso(d))}
                    placeholder="Seleccionar término"
                    className={`w-full bg-background ${esFechaPasada(vigenciaFin) ? "border-destructive" : ""}`}
                  />
                  {esFechaPasada(vigenciaFin) && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />No se aceptan meses anteriores.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <OficioUpload vigenciaInicio={vigenciaInicio} onFileChange={onArchivoChange} />
            </div>
          </div>
        </CardContent>
      </Card>

      <TabuladorNiveles
        nivelCategoria={datosRenovacion?.nivelCategoria}
        importeBruto={bloqueadoPorRenovacion ? datosRenovacion?.importeBruto : importeNeto}
        readonly={bloqueadoPorRenovacion}
        onSeleccionadoChange={(nivel, categoria) => { setNivelTabulador(nivel); setCategoriaTabulador(categoria) }}
        secretaria={secretariaConfirmada || secretariaInput}
      />

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            II. Objeto del Nombramiento
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 hover:opacity-70 transition-opacity" title="Ver fórmula de llenado">
              <Info className="h-4 w-4 text-[#7B2D3E]" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <Textarea
            value={objetoNombramiento}
            onChange={(e) => {
              if (!bloqueadoPorRenovacion) {
                if (!formulaObjetoShown && objetoNombramiento === "" && e.target.value.length > 0) {
                  setShowFormulaModal(true)
                  setFormulaObjetoShown(true)
                }
                setObjetoNombramiento(e.target.value)
              }
            }}
            placeholder="Describa el objeto del nombramiento de manera detallada..."
            className={`min-h-24 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed resize-none" : "bg-background"}`}
            readOnly={bloqueadoPorRenovacion}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            III. Actividades a Realizar
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 hover:opacity-70 transition-opacity" title="Ver fórmula de llenado">
              <Info className="h-4 w-4 text-[#7B2D3E]" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <DynamicList
            label="" items={funciones}
            onChange={(newItems) => {
              if (!formulaActividadesShown) {
                const itemAdded = newItems.length > funciones.length
                const firstContent = newItems.some((v, i) => v.trim() !== "" && (funciones[i] ?? "").trim() === "")
                if (itemAdded || firstContent) {
                  setShowFormulaModal(true)
                  setFormulaActividadesShown(true)
                }
              }
              setFunciones(newItems)
            }}
            readonly={bloqueadoPorRenovacion}
            nivelTabulador={nivelTabulador}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            IV. Responsabilidades
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-2">
          <DynamicList
            label="" items={responsabilidades} onChange={setResponsabilidades}
            readonly={bloqueadoPorRenovacion}
            nivelTabulador={nivelTabulador}
          />
          <p className="text-xs text-muted-foreground italic">
            Las responsabilidades deberán ser congruentes con las actividades registradas.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            V. Marco Normativo
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary ml-1">Siempre editable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-2">
          <DynamicList
            label="" items={marcoNormativo} onChange={handleMarcoNormativoChange}
            readonly={false} minRequired={0}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            VI. Condiciones y Riesgos
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary ml-1">Siempre editable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 pb-4 pt-0">
          <div>
            <Label className="text-sm font-medium mb-3 block">Condiciones de Trabajo</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-2.5 text-left font-medium text-card-foreground">Condición</th>
                    <th className="px-4 py-2.5 text-center font-medium">Sí</th>
                    <th className="px-4 py-2.5 text-center font-medium">No</th>
                  </tr>
                </thead>
                <tbody>
                  {["Cambio de domicilio", "Horario especial", "Viajar"].map((c) => {
                    const key = c.toLowerCase().replace(/\s+/g, "-")
                    return (
                      <tr key={c} className="border-t border-border">
                        <td className="px-4 py-2.5 text-card-foreground">{c}</td>
                        {["si", "no"].map((opt) => (
                          <td key={opt} className="px-4 py-2.5 text-center">
                            <input
                              type="radio"
                              name={`cond-${key}`}
                              value={opt}
                              checked={condiciones[key] === opt}
                              onChange={() => setCondiciones(prev => ({ ...prev, [key]: opt }))}
                              className="cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-3 block">Tabla de Riesgos</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Riesgo</th>
                    <th className="px-4 py-2.5 text-center font-medium">Bajo</th>
                    <th className="px-4 py-2.5 text-center font-medium">Medio</th>
                    <th className="px-4 py-2.5 text-center font-medium">Alto</th>
                  </tr>
                </thead>
                <tbody>
                  {["Caídas", "Mutilaciones", "Golpes", "Otros"].map((r) => {
                    const key = r.toLowerCase()
                    return (
                      <tr key={r} className="border-t border-border">
                        <td className="px-4 py-2.5 text-card-foreground">{r}</td>
                        {["Bajo", "Medio", "Alto"].map((nivel) => (
                          <td key={nivel} className="px-4 py-2.5 text-center">
                            <input
                              type="radio"
                              name={`riesgo-${key}`}
                              value={nivel}
                              checked={riesgos[key] === nivel}
                              onChange={() => setRiesgos(prev => ({ ...prev, [key]: nivel }))}
                              className="cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            VII. Resguardo Personalizado de Activos
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary ml-1">Siempre editable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                <span className="font-semibold not-italic text-card-foreground">Administración Pública Centralizada:</span>{" "}
                En este caso se estará a lo que establezca el formato de Resguardo Personalizado de Activos de bienes muebles e intangibles,
                emitido por la Dirección General de Patrimonio de la Secretaría de Administración y Finanzas,
                que señala las obligaciones como resguardante de los Activos.
              </p>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                <span className="font-semibold not-italic text-card-foreground">Organismos Auxiliares:</span>{" "}
                En este caso se estará a lo establecido por sus disposiciones administrativas correspondientes.
              </p>
            </div>
          </div>
          <RadioGroup
            value={resguardoActivos}
            onValueChange={setResguardoActivos}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="si" id="resg-si" />
              <Label htmlFor="resg-si" className="text-sm font-normal cursor-pointer">Sí</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="resg-no" />
              <Label htmlFor="resg-no" className="text-sm font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">VIII</span>
            Perfil
            {bloqueadoPorRenovacion && <Lock className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          <p className="text-xs text-muted-foreground italic">
            SE REFIERE A LA ESCOLARIDAD, COMPETENCIAS Y EXPERIENCIA.
          </p>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-5 px-4 pb-4 pt-0 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-2">
            <span className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
              Escolaridad Mínima
              {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
            </span>
            <DynamicList
              label="" items={escolaridad.length > 0 ? escolaridad : [""]}
              onChange={setEscolaridad}
              readonly={bloqueadoPorRenovacion}
              minRequired={1}
              max={1}
            />
          </div>
          {[
            { sub: "VIII.1", label: "Competencias Administrativas", items: compAdm,  onChange: setCompAdm },
            { sub: "VIII.2", label: "Competencias Técnicas",        items: compTec,  onChange: setCompTec },
            { sub: "VIII.3", label: "Competencias Sociales",        items: compSoc,  onChange: setCompSoc },
            { sub: null,     label: "Áreas de Experiencia",         items: areasExp, onChange: setAreasExp },
            { sub: null,     label: "Valores",                      items: valores,  onChange: setValores },
          ].map(({ sub, label, items, onChange }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {sub && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{sub}</span>
                )}
                <span className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
                  {label}
                  {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </div>
              <DynamicList
                label="" items={items.length > 0 ? items : [""]}
                onChange={onChange}
                readonly={bloqueadoPorRenovacion}
                minRequired={3}
                max={5}
              />
            </div>
          ))}
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
      <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-secondary/30">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
            <p className="text-sm font-semibold text-card-foreground text-center">
              {subTipo === "regularizacion" ? "Regularización registrada exitosamente" : "Excepción DO registrada exitosamente"}
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
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" />Volver</Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Excepción DO</h2>
          <p className="text-sm text-muted-foreground">Captura directa por la Dirección de Organización</p>
        </div>
      </div>
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <ShieldAlert className="h-5 w-5 text-accent-foreground" />Tipo de Excepción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={subTipo} onValueChange={() => setSubTipo(v as "captura" | "regularizacion")} className="flex flex-col gap-3">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "captura" ? "border-accent bg-accent/5" : "border-border hover:border-secondary/50"}`}>
              <RadioGroupItem value="captura" id="sub-captura" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Captura DO</span>
                <span className="text-xs text-muted-foreground">Ingreso directo con folio de recepción y fecha asignados manualmente por la DO.</span>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "regularizacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"}`}>
              <RadioGroupItem value="regularizacion" id="sub-regularizacion" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Regularización</span>
                <span className="text-xs text-muted-foreground">Ingreso con folio temporal generado automáticamente.</span>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          {subTipo === "regularizacion" ? <Clock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {subTipo === "regularizacion" ? "Registrar Regularización" : "Registrar Excepción DO"}
        </Button>
      </div>
    </div>
  )
}

function validarCamposCompletos(formData: Partial<FormularioData>, tipo: TipoSolicitud): string[] {
  const faltantes: string[] = []
  const check = (val: string | string[] | undefined, label: string) => {
    if (Array.isArray(val)) {
      if (val.length === 0 || val.every((v) => !v.trim())) faltantes.push(label)
    } else {
      if (!val || !val.toString().trim()) faltantes.push(label)
    }
  }
  check(formData.secretaria,           "Secretaría")
  check(formData.unidadAdministrativa, "Unidad Administrativa")
  check(formData.unidadResponsable,    "Unidad Responsable del Gasto")
  check(formData.programaProyecto,     "Programa o Proyecto")
  if (tipo === "prestacion") {
    check(formData.numeroPrestadores, "Número de Prestadores")
  }
  check(formData.vigenciaInicio,       "Vigencia Inicio")
  check(formData.vigenciaFin,          "Vigencia Fin")
  check(formData.importeBruto,         "Importe Bruto")
  check(formData.nivelTabulador,       "Nivel Tabulador")
  check(formData.categoriaTabulador,   "Categoría Tabulador")
  check(formData.objeto,               "Objeto de la Contratación")
  check(formData.actividades,          "Actividades")
  check(formData.responsabilidades,    "Responsabilidades")
  if (tipo === "prestacion") {
    check(formData.regimen,       "Régimen de Contratación")
    check(formData.tipoActividades, "Tipo de Actividad")
    check(formData.escolaridad,   "Escolaridad")
    check(formData.compAdm,       "Competencias Administrativas")
    check(formData.compTec,       "Competencias Técnicas")
    check(formData.compSoc,       "Competencias Sociales")
    check(formData.valores,       "Valores")
    check(formData.areasExp,      "Áreas de Experiencia")
  } else if (tipo === "nombramiento") {
    check(formData.denominacion,        "Denominación del Nombramiento")
    check(formData.puestoJefeInmediato, "Puesto del Jefe Inmediato")
    check(formData.numeroPrestadores,   "Número de Personas a Contratar")
  }
  return faltantes
}
const MESES_LOWER_BUILD = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

function periodoNombreAMes(nombre: string): number {
  const lower = (nombre ?? "").toLowerCase()
  for (let i = 0; i < MESES_LOWER_BUILD.length; i++) {
    if (lower.includes(MESES_LOWER_BUILD[i])) return i + 1
  }
  return new Date().getMonth() + 1
}

function buildSolicitudPayload({
  usuarioId, tipo, regimenPeriodo, periodoNombre, esExtemporanea, esRenovacion, folioSeleccionado, formData, tipoAdministracion,
}: {
  usuarioId: string; tipo: TipoSolicitud; regimenPeriodo: string; periodoNombre: string; esExtemporanea: boolean
  esRenovacion: string; folioSeleccionado: string; formData: Partial<FormularioData>; tipoAdministracion?: string
}) {
  return {
    usuarioId,
    tipo_administracion: tipoAdministracion ?? "centralizada",
    tipo_solicitud: tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
    periodoMes:  periodoNombreAMes(periodoNombre),
    periodoAnio: new Date().getFullYear(),
    esExtemporanea,
    secretaria:            formData.secretaria            ?? null,
    unidad_administrativa: formData.unidadAdministrativa  ?? null,
    unidad_responsable:    formData.unidadResponsable      ?? null,
    programa_proyecto:     formData.programaProyecto       ?? null,
    regimen:               formData.regimen                ?? regimenPeriodo ?? null,
    tipo_actividades:      formData.tipoActividades         ?? null,
    numero_prestadores:    formData.numeroPrestadores ? parseInt(formData.numeroPrestadores) || null : null,
    denominacion:          formData.denominacion            || null,
    puesto_jefe_inmediato: formData.puestoJefeInmediato     || null,
    vigencia_inicio:       formData.vigenciaInicio || null,
    vigencia_fin:          formData.vigenciaFin    || null,
    importe_bruto:         formData.importeBruto ? parseFloat(formData.importeBruto.replace(/[$,\s]/g, "")) || null : null,
    tipo_importe:          formData.tipoImporte || null,
    es_renovacion:         esRenovacion === "si",
    folio_anterior:        folioSeleccionado || null,
    nivel_tabulador:       formData.nivelTabulador      || null,
    categoria_tabulador:   formData.categoriaTabulador  || null,
    objeto:                formData.objeto              ?? null,
    actividades:           formData.actividades          ?? [],
    responsabilidades:     formData.responsabilidades    ?? [],
    marco_normativo:       formData.marcoNormativo         ?? [],
    condiciones_riesgos:   formData.condicionesRiesgos    ?? [],
    escolaridad:           formData.escolaridad            ?? null,
    comp_adm:              formData.compAdm              ?? null,
    comp_tec:              formData.compTec              ?? null,
    comp_soc:              formData.compSoc              ?? null,
    valores:               formData.valores              ?? null,
    areas_exp:             formData.areasExp             ?? null,
    riesgo_caidas:         formData.riesgoCaidas         ?? null,
    riesgo_mutilaciones:   formData.riesgoMutilaciones   ?? null,
    riesgo_golpes:         formData.riesgoGolpes         ?? null,
    riesgo_otros:          formData.riesgoOtros          ?? null,
    condicion_cambio_domicilio: formData.condicionCambioDomicilio ?? false,
    condicion_horario:     formData.condicionHorario     ?? false,
    condicion_viajar:      formData.condicionViajar      ?? false,
    resguardo_activos:     formData.resguardoActivos     ?? false,
  }
}

type FolioExcelInternal = FolioExcel
export type EditSolicitudPayload = {
  id: string
  tipo: TipoSolicitud
  regimen: "" | "honorarios" | "asimilados" | "nombramiento"
  periodo: string
  formData: Partial<FormularioData>
  estado?: string
}
export function NuevaSolicitudPage({ editSolicitud, onAfterSave, onCancel }: { editSolicitud?: EditSolicitudPayload; onAfterSave?: () => void; onCancel?: () => void }) {
  const [step,                setStep]                = useState<Step>(editSolicitud ? "formulario" : "tipo")
  const [tipo,                setTipo]                = useState<TipoSolicitud>(editSolicitud?.tipo ?? "")
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
  const [formData, setFormData] = useState<Partial<FormularioData>>(editSolicitud?.formData ?? {})
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null)

  useEffect(() => {
    if ((borradorGuardado || enviado) && editSolicitud?.id && onAfterSave) {
      const t = setTimeout(onAfterSave, 1500)
      return () => clearTimeout(t)
    }
  }, [borradorGuardado, enviado, editSolicitud?.id, onAfterSave])

  const handleFormChange = useCallback((data: Partial<FormularioData>) => {
    setFormData(prev => ({ ...prev, ...data }))
  }, [])

  const { } = useSolicitudes()
  const { getPermisoActivo, consumirPermiso } = useAutorizaciones()
  const { user } = useAuth()
  const [regimenPeriodo,      setRegimenPeriodo]      = useState<"" | "honorarios" | "asimilados" | "nombramiento">(editSolicitud?.regimen ?? "")
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(editSolicitud?.periodo ?? "")
  const { historicos } = useHistoricoStore()
  const excelRows = useExcelRows(historicos)
  const [foliosDB, setFoliosDB] = useState<FolioExcel[]>([])
  const [calHonorarios,    setCalHonorarios]    = useState<PeriodoCap3000[]>([])
  const [calAsimilados,    setCalAsimilados]    = useState<PeriodoCap1000[]>([])
  const [calNombramiento,  setCalNombramiento]  = useState<PeriodoCap1000[]>([])
  const [calCargando,      setCalCargando]      = useState(true)
  useEffect(() => {
    const year = new Date().getFullYear()
    fetch(`/api/calendario?ejercicio=${year}`)
      .then((r) => r.json())
      .then((data) => {
        setCalHonorarios(data.honorarios ?? [])
        setCalAsimilados(data.asimilados ?? [])
        setCalNombramiento(data.nombramiento ?? [])
      })
      .catch(() => {})
      .finally(() => setCalCargando(false))
  }, [])

  const [catalogoTree, setCatalogoTree] = useState<OrganoCentralizadoNode[]>([])
  useEffect(() => {
    fetchCentralizadaTree().then(setCatalogoTree).catch(() => {})
  }, [])

  useEffect(() => {
    try { sessionStorage.removeItem("sisodi_folios_recientes") } catch {  }
  }, [])
  useEffect(() => {
    if (esRenovacion !== "si") return
    const usuarioId = (user as any)?.id ?? (user as any)?.uuid ?? null
    if (!usuarioId) return
    const secretaria = user?.secretariaTexto ?? user?.area ?? ""
    const params = new URLSearchParams({ tab: "Todas", pageSize: "200" })
    if (secretaria) params.set("secretaria", secretaria)
    fetch(`/api/mi-justificacion?${params.toString()}`, {
      headers: { "x-user-id": String(usuarioId) },
    })
      .then((r) => r.json())
      .then((json) => {
        const items: any[] = json.items ?? json.data ?? []
        const folios: FolioExcel[] = items
          .filter((s) =>
            (s.folio_justificacion || s.folio_recepcion) &&
            (s.estado?.nombre ?? "").toLowerCase() === "emitido"
          )
          .map((s) => {
            const folio = s.folio_justificacion ?? s.folio_recepcion ?? String(s.id)
            const fmt = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : ""
            return {
              id:                     folio,
              folioJustificacion:     s.folio_justificacion ?? folio,
              folioDictamen:          s.folio_dictamen      ?? folio,
              secretaria:             s.secretaria          ?? "",
              vigenciaInicio:         fmt(s.vigencia_inicio),
              vigenciaFin:            fmt(s.vigencia_fin),
              unidadAdscripcion:      s.unidad_administrativa ?? "",
              unidadResponsableGasto: s.unidad_responsable    ?? "",
              programaProyecto:       s.programa_proyecto     ?? "",
              tipoActividad:          s.tipo_actividades      ?? "",
              regimen:                s.regimen               ?? "",
              numPrestadores:         s.numero_prestadores != null ? String(s.numero_prestadores) : "",
              importeBruto:           s.importe_bruto != null ? String(s.importe_bruto) : "",
              nivelCategoria:         s.nivel_categoria       ?? "",
              objeto:                 s.objeto                ?? "",
              actividades:            Array.isArray(s.actividades)       ? s.actividades.join("\n")       : (s.actividades       ?? ""),
              responsabilidades:      Array.isArray(s.responsabilidades) ? s.responsabilidades.join("\n") : (s.responsabilidades ?? ""),
              escolaridad:            Array.isArray(s.escolaridad)       ? s.escolaridad[0]               : (s.escolaridad       ?? ""),
              compAdm:                Array.isArray(s.comp_adm)          ? s.comp_adm.join("\n")          : (s.comp_adm          ?? ""),
              compTec:                Array.isArray(s.comp_tec)          ? s.comp_tec.join("\n")          : (s.comp_tec          ?? ""),
              compSoc:                Array.isArray(s.comp_soc)          ? s.comp_soc.join("\n")          : (s.comp_soc          ?? ""),
              valores:                Array.isArray(s.valores)           ? s.valores.join("\n")           : (s.valores           ?? ""),
              areasExp:               Array.isArray(s.areas_exp)         ? s.areas_exp.join("\n")         : (s.areas_exp         ?? ""),
            }
          })
        setFoliosDB(folios)
      })
      .catch(() => { })
  }, [esRenovacion, user])

  const periodoInfo = useMemo(() => {
    if (!regimenPeriodo || !periodoSeleccionado) return null
    const row = regimenPeriodo === "honorarios"
      ? calHonorarios.find((r) => r.mes === periodoSeleccionado)
      : regimenPeriodo === "asimilados"
      ? calAsimilados.find((r) => r.quincena === periodoSeleccionado)
      : calNombramiento.find((r) => r.quincena === periodoSeleccionado)
    if (!row) return null
    const limiteDODate = parseDateDMY(row.limiteDO)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const enTiempo = today <= limiteDODate
    return { row, limiteDODate, enTiempo }
  }, [regimenPeriodo, periodoSeleccionado, calHonorarios, calAsimilados, calNombramiento])

  const periodoVencido = periodoSeleccionado ? (periodoInfo ? !periodoInfo.enTiempo : false) : false
  const permisoActivo = regimenPeriodo && periodoSeleccionado && user?.id
    ? getPermisoActivo(user.id, regimenPeriodo, periodoSeleccionado) : null

  const calendarioCompleto = useMemo(() => {
    if (calCargando) return false
    const isDateFilled = (s: string) => /^\d{1,2}\/\d{2}\/\d{4}$/.test(s)
    const honOk  = calHonorarios.length   >= 12 && calHonorarios.every(r  => isDateFilled(r.limiteDO)  && isDateFilled(r.limiteDGRH))
    const asimOk = calAsimilados.length   >= 22 && calAsimilados.every(r  => isDateFilled(r.limiteDO)  && isDateFilled(r.limiteDGRH))
    const nomOk  = calNombramiento.length >= 22 && calNombramiento.every(r => isDateFilled(r.limiteDO) && isDateFilled(r.limiteDGRH))
    return honOk && asimOk && nomOk
  }, [calCargando, calHonorarios, calAsimilados, calNombramiento])

  const puedeAvanzarDeTipo = !!(tipo && regimenPeriodo && periodoSeleccionado && (!periodoVencido || permisoActivo) && calendarioCompleto)
  const [secretariaFrescaTexto, setSecretariaFrescaTexto] = useState<string | null>(null)
  useEffect(() => {
    const sesionTieneSecretaria = !!(user?.secretariaTexto ?? user?.area)
    if (sesionTieneSecretaria || !user?.id) return
    fetch(`/api/auth?action=perfil&id=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        const texto = data.secretariaTexto ?? data.area ?? null
        if (texto) setSecretariaFrescaTexto(texto)
      })
      .catch(() => {})
  }, [user?.id, user?.secretariaTexto, user?.area])

  const userSecretariaRaiz = useMemo(() => {
    const texto = user?.secretariaTexto ?? user?.area ?? secretariaFrescaTexto ?? null
    if (!texto) return null
    return norm(texto.split(" > ")[0])
  }, [user, secretariaFrescaTexto])

  const userSecretariaOriginal = useMemo(() => {
    const texto = user?.secretariaTexto ?? user?.area ?? secretariaFrescaTexto ?? null
    if (!texto) return null
    const raiz = texto.split(" > ")[0]
    const todas = filtrarSecretarias("")
    const exacta = todas.find((s) => norm(s) === norm(raiz))
    return exacta ?? raiz
  }, [user, secretariaFrescaTexto])

  const userUAOriginal = useMemo(() => {
    const texto = user?.secretariaTexto ?? secretariaFrescaTexto ?? null
    if (!texto) return null
    const partes = texto.split(" > ")
    if (partes.length < 2) return null
    const uaTexto = partes[1]
    const uas = getUAsForSecretaria(userSecretariaOriginal ?? "")
    const exacta = uas.find((ua) => norm(ua) === norm(uaTexto))
    if (exacta) return exacta
    const parcial = uas.find((ua) => norm(ua).includes(norm(uaTexto)) || norm(uaTexto).includes(norm(ua)))
    return parcial ?? uaTexto
  }, [user, secretariaFrescaTexto, userSecretariaOriginal])

  const userClaveReporte = useMemo(() => {
    if (user?.claveReportePlazas) return user.claveReportePlazas
    return getClaveForUA(userSecretariaOriginal ?? "", userUAOriginal ?? "") || null
  }, [user?.claveReportePlazas, userSecretariaOriginal, userUAOriginal])

  const normCat = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ")

  const catalogoUAsDelUsuario = useMemo((): { clave: string; nombre: string }[] => {
    if (!userSecretariaOriginal || catalogoTree.length === 0) return []
    const secNorm = normCat(userSecretariaOriginal)
    const rootNode = catalogoTree.find((n) => {
      const nn = normCat(n.nombre)
      return nn === secNorm || nn.includes(secNorm) || secNorm.includes(nn)
    })
    if (!rootNode) return []
    return rootNode.children
      .map((ua) => ({
        clave:  ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? "",
        nombre: ua.nombre,
      }))
  }, [catalogoTree, userSecretariaOriginal])
  const foliosReales = useMemo((): FolioExcel[] => {
    const foliosExcel = excelRows.length === 0 ? [] : excelRows
      .filter((row) => {
        const folioDictamen      = getCell(row, COL.folioDictamen)
        const folioJustificacion = getCell(row, COL.folioJustificacion)
        const folioId = folioDictamen || folioJustificacion
        if (!esFolioValido(folioId)) return false
        if (userSecretariaRaiz) {
          const secRow = norm(getCell(row, COL.secretaria))
          if (!secRow.includes(userSecretariaRaiz) && !userSecretariaRaiz.includes(secRow)) return false
        }
        const reg = normalizaRegimen(getCell(row, COL.regimen))
        if (tipo === "nombramiento" && reg !== "nombramiento") return false
        if (tipo === "prestacion"   && reg === "nombramiento") return false
        if (periodoSeleccionado && esRenovacion !== "si") return rowEnPeriodo(row, periodoSeleccionado)
        return true
      })
      .reduce<FolioExcel[]>((acc, row) => {
        const folioDictamen      = getCell(row, COL.folioDictamen)
        const folioJustificacion = getCell(row, COL.folioJustificacion) || folioDictamen
        const idUnico            = folioDictamen || folioJustificacion
        if (!idUnico || !esFolioValido(idUnico)) return acc
        if (acc.find((f) => f.id === idUnico)) return acc
        acc.push({
          id: idUnico, folioJustificacion, folioDictamen,
          secretaria:             getCell(row, COL.secretaria),
          vigenciaInicio:         getCell(row, COL.vigenciaInicio),
          vigenciaFin:            getCell(row, COL.vigenciaTermino),
          unidadAdscripcion:      getCell(row, COL.unidadAdscripcion),
          unidadResponsableGasto: getCell(row, COL.unidadResponsableGasto),
          programaProyecto:       getCell(row, COL.programaProyecto),
          tipoActividad:          getCell(row, COL.tipoActividad),
          regimen:                getCell(row, COL.regimen),
          numPrestadores:         getCell(row, COL.numPrestadores),
          importeBruto:           getCell(row, COL.importeBruto),
          nivelCategoria:         getCell(row, COL.nivelCategoria),
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
      .sort((a, b) => a.id.localeCompare(b.id))

    const idsExcel = new Set(foliosExcel.map((f) => f.id))
    const dbUnicos  = foliosDB.filter((f) => {
      if (idsExcel.has(f.id)) return false
      if (!userSecretariaRaiz || !f.secretaria) return true
      const secNorm = norm(f.secretaria)
      return secNorm.includes(userSecretariaRaiz) || userSecretariaRaiz.includes(secNorm)
    })
    return [...dbUnicos, ...foliosExcel]
  }, [excelRows, tipo, periodoSeleccionado, esRenovacion, foliosDB, userSecretariaRaiz])
  const hayFoliosReales = foliosReales.length > 0
  const foliosDBIds = useMemo(() => new Set(foliosDB.map((f) => f.id)), [foliosDB])
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
    if (step === "formulario" && editSolicitud) { onCancel?.(); return }
    if (step === "formulario") setStep("renovacion")
    else if (step === "renovacion") setStep("tipo")
  }, [step, editSolicitud, onCancel])

  const folioSeleccionadoData = folioSeleccionado
    ? foliosReales.find((f) => f.id === folioSeleccionado) : null
  const handleGuardarBorrador = useCallback(async () => {
    setGuardandoBorrador(true)
    setErrorBorrador(null)
    try {
      if (esRenovacion !== "si") {
        const faltantes = validarCamposCompletos(formData, tipo)
        if (faltantes.length > 0) {
          setErrorBorrador(`Campos obligatorios incompletos: ${faltantes.join(", ")}`)
          setGuardandoBorrador(false)
          return
        }
      }
      const usuarioId = (user as any)?.id ?? (user as any)?.uuid ?? null
      if (!usuarioId) { setErrorBorrador("No se pudo identificar al usuario."); setGuardandoBorrador(false); return }

      if (editSolicitud?.id) {
        const campos = buildSolicitudPayload({ usuarioId, tipo, regimenPeriodo, periodoNombre: periodoSeleccionado, esExtemporanea: false, esRenovacion, folioSeleccionado, formData, tipoAdministracion: user?.tipoAdministracion })
        const res = await fetch("/api/solicitudes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitudId: Number(editSolicitud.id), ...campos }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) { setErrorBorrador(json.error ?? "Error al actualizar el borrador."); setGuardandoBorrador(false); return }
        setFolioBorradorGuardado(json.data?.folio_justificacion ?? editSolicitud.id)
        // Al guardar desde un estado observado, reenviar al estado de revisión correspondiente
        const estadoOrig = (editSolicitud.estado ?? "").toLowerCase()
        const nuevoEstadoTrasCorreccion = (() => {
          if (
            estadoOrig.includes("observada por uefa") ||
            estadoOrig.includes("observado por uefa") ||
            (estadoOrig.includes("observado por validacion") && !estadoOrig.includes("final"))
          ) return "En Validacion Justificaciones"
          if (estadoOrig.includes("observado por revisor")) return "En Revision Revisor"
          if (estadoOrig.includes("observado por validacion final")) return "En Validacion Final"
          if (estadoOrig.includes("observado por emisor")) return "En Revision Emisor"
          if (estadoOrig.includes("observado do filtro 1")) return "En revision DO Filtro 1"
          if (estadoOrig.includes("observado do filtro 2")) return "En revision DO Filtro 2"
          if (estadoOrig.includes("observado do filtro 3")) return "En revision DO Filtro 3"
          if (estadoOrig.includes("observado por do") || estadoOrig.includes("devuelta por do")) return "En proceso DO"
          return null
        })()
        if (nuevoEstadoTrasCorreccion) {
          await fetch("/api/validacion", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              solicitudId: Number(editSolicitud.id),
              nuevoEstado: nuevoEstadoTrasCorreccion,
              usuarioId,
              comentario: "Correcciones aplicadas y reenviado a revisión por el capturista",
            }),
          })
        }
      } else {
        const payload = { ...buildSolicitudPayload({ usuarioId, tipo, regimenPeriodo, periodoNombre: periodoSeleccionado, esExtemporanea: false, esRenovacion, folioSeleccionado, formData, tipoAdministracion: user?.tipoAdministracion }), estado_nombre: "Borrador" }
        const res = await fetch("/api/solicitudes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const json = await res.json()
        if (!res.ok || !json.ok) { setErrorBorrador(json.error ?? "Error al guardar el borrador."); setGuardandoBorrador(false); return }
        setFolioBorradorGuardado(json.folio ?? json.data?.folio_recepcion ?? "")
      }
      setBorradorGuardado(true)
    } catch { setErrorBorrador("Error de conexión.") } finally { setGuardandoBorrador(false) }
  }, [user, tipo, regimenPeriodo, esRenovacion, folioSeleccionado, formData, editSolicitud])

  const handleEnviarAValidacion = useCallback(
    async (periodoStillValid: boolean, hasPermiso: boolean, isEditingBorrador: boolean) => {
      if (!periodoStillValid && !hasPermiso && !isEditingBorrador) return
      setEnviando(true); setErrorEnvio(null)
      try {
        if (!periodoStillValid && hasPermiso && user?.id && regimenPeriodo && periodoSeleccionado) {
          await consumirPermiso(user.id, regimenPeriodo, periodoSeleccionado)
        }
        const usuarioId = (user as any)?.id ?? (user as any)?.uuid ?? null
        if (!usuarioId) { setErrorEnvio("No se pudo identificar al usuario."); setEnviando(false); return }

        let solicitudId: number | undefined

        if (editSolicitud?.id) {
          const campos = buildSolicitudPayload({ usuarioId, tipo, regimenPeriodo, periodoNombre: periodoSeleccionado, esExtemporanea: !periodoStillValid && hasPermiso, esRenovacion, folioSeleccionado, formData, tipoAdministracion: user?.tipoAdministracion })
          const res = await fetch("/api/solicitudes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ solicitudId: Number(editSolicitud.id), ...campos }),
          })
          const json = await res.json()
          if (!res.ok || !json.ok) { setErrorEnvio(json.error ?? "Error al actualizar la solicitud."); setEnviando(false); return }
          solicitudId = Number(editSolicitud.id)
          setFolioGenerado(json.data?.folio_justificacion ?? editSolicitud.id)
        } else {
          const payload = buildSolicitudPayload({ usuarioId, tipo, regimenPeriodo, periodoNombre: periodoSeleccionado, esExtemporanea: !periodoStillValid && hasPermiso, esRenovacion, folioSeleccionado, formData, tipoAdministracion: user?.tipoAdministracion })
          const res = await fetch("/api/solicitudes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          const json = await res.json()
          if (!res.ok || !json.ok) { setErrorEnvio(json.error ?? "Error al registrar la solicitud."); setEnviando(false); return }
          solicitudId = json.data?.id
          if (!solicitudId) { setErrorEnvio("No se pudo obtener el ID de la solicitud."); setEnviando(false); return }
          setFolioGenerado(json.folio ?? json.data?.folio_justificacion ?? json.data?.folio_recepcion ?? "")
        }

        if (archivoAdjunto && solicitudId) {
          try {
            const fd = new FormData()
            fd.append("file", archivoAdjunto)
            fd.append("solicitudId", String(solicitudId))
            await fetch("/api/adjunto", { method: "POST", body: fd })
          } catch {  }
        }

        const patchRes = await fetch("/api/validacion", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitudId, nuevoEstado: "En Validacion Justificaciones", usuarioId, comentario: "Solicitud enviada a Validacion de Justificaciones por la URG" }),
        })
        const patchJson = await patchRes.json()
        if (!patchRes.ok || !patchJson.ok) console.warn("No se pudo cambiar el estado:", patchJson.error)
        if (patchJson.folio_dictamen) setFolioGenerado(patchJson.folio_dictamen)
        setEnviado(true)
      } catch { setErrorEnvio("Error de conexión.") } finally { setEnviando(false) }
    },
    [user, regimenPeriodo, periodoSeleccionado, consumirPermiso, tipo, formData, archivoAdjunto, esRenovacion, folioSeleccionado, editSolicitud]
  )

  const handleReset = useCallback(() => {
    setEnviado(false); setBorradorGuardado(false)
    setFolioGenerado(""); setFolioBorradorGuardado("")
    setStep("tipo"); setTipo("")
    setEsRenovacion(""); setFolioSeleccionado(""); setCondicionRenovacion("")
    setPrefilled(false); setLockVigenciaOnly(false); setDatosRenovacion(null)
    setRegimenPeriodo(""); setPeriodoSeleccionado("")
    setErrorEnvio(null); setErrorBorrador(null); setFormData({})
  }, [])

  if (enviado) {
    return (
      <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-secondary/30">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
              <CheckCircle2 className="h-9 w-9 text-secondary" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-lg font-semibold text-card-foreground">Solicitud enviada a validación</p>
              <p className="text-sm text-muted-foreground">La solicitud fue enviada exitosamente. Puede seguir su seguimiento en Validación Justificación.</p>
            </div>
            {folioGenerado && (
              <Badge className="bg-primary/10 text-primary border-0 text-sm px-4 py-1.5">Folio: {folioGenerado}</Badge>
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
  if (borradorGuardado) {
    const esEdicion = !!editSolicitud?.id
    return (
      <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
        <Card className="shadow-sm border-2 border-muted">
          <CardContent className="flex flex-col items-center gap-5 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Save className="h-9 w-9 text-muted-foreground" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-lg font-semibold text-card-foreground">
                {esEdicion ? "Cambios guardados correctamente" : "Borrador guardado correctamente"}
              </p>
              <p className="text-sm text-muted-foreground">
                {esEdicion
                  ? "Los cambios han sido guardados. Puede cerrar esta pantalla."
                  : "Puede continuar la captura desde \"Mis Solicitudes\" → pestaña \"Borradores\"."}
              </p>
            </div>
            {folioBorradorGuardado && (
              <Badge className="bg-muted text-muted-foreground border-0 text-sm px-4 py-1.5">Folio: {folioBorradorGuardado}</Badge>
            )}
            {!esEdicion && (
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  <FilePlus className="mr-1.5 h-4 w-4" />Nueva Solicitud
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <PageLayout title="Nueva solicitud" description="Inicia el registro de una solicitud para su análisis y emisión de dictamen u opinión técnica funcional.">
      <div className="py-2 -mx-4 px-4 -mt-3 mb-1">
        <div className="max-w-4xl mx-auto w-full flex justify-center">
          <StepIndicator step={step} tipo={tipo} />
        </div>
      </div>


      {step === "tipo" && (
        <>
          {calCargando && (
            <Card className="shadow-sm border-border">
              <CardContent className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Verificando Calendario de Recepción...
              </CardContent>
            </Card>
          )}
          {!calCargando && !calendarioCompleto && (
            <Card className="shadow-sm border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 px-4 py-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-destructive">Calendario de Recepción Incompleto!</span>
                  <span className="text-xs text-muted-foreground">
                    Para continuar con el  registro  es Necesario Contar  con las fechas de
                    los <strong> 3 Regímenes</strong> (Honorarios, Asimilados y Nombramiento)
                    <strong> Todos los  Meses/Quincenas   </strong> Deben tener fecha Configurada.
                  </span>z
                </div>
              </CardContent>
            </Card>
          )}
              <Card className={`shadow-sm border-secondary/30 border-2 ${!calendarioCompleto ? "opacity-50 pointer-events-none" : ""}`}>
              <CardHeader className="px-4 pt-3 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Calendar className="h-4 w-4 text-secondary" />Período de Aplicación
              </CardTitle>
              <CardDescription>Seleccione el régimen y período para consultar las fechas límite de recepción</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-4 pb-3 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Régimen de Contratación<span className="text-destructive ml-0.5">*</span></Label>
                  <Select value={regimenPeriodo} onValueChange={(v) => {
                    const nuevo = v as "honorarios" | "asimilados" | "nombramiento"
                    setRegimenPeriodo(nuevo); setPeriodoSeleccionado(""); setFolioSeleccionado("")
                    if (nuevo === "nombramiento") setTipo("nombramiento")
                    else setTipo("prestacion")
                  }}>
                    <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione régimen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorarios">Honorarios</SelectItem>
                      <SelectItem value="asimilados">Honorarios asimilados a Salarios</SelectItem>
                      <SelectItem value="nombramiento">Nombramiento por Tiempo Determinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {regimenPeriodo === "honorarios" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Mes de aplicación<span className="text-destructive ml-0.5">*</span></Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione mes" /></SelectTrigger>
                      <SelectContent>{calHonorarios.map((r) => <SelectItem key={r.mes} value={r.mes}>{r.mes}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {regimenPeriodo === "asimilados" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Quincena de aplicación<span className="text-destructive ml-0.5">*</span></Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione quincena" /></SelectTrigger>
                      <SelectContent>{calAsimilados.map((r) => <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {regimenPeriodo === "nombramiento" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Quincena de aplicación<span className="text-destructive ml-0.5">*</span></Label>
                    <Select value={periodoSeleccionado} onValueChange={(v) => { setPeriodoSeleccionado(v); setFolioSeleccionado("") }}>
                      <SelectTrigger className="bg-background w-full"><SelectValue placeholder="Seleccione quincena" /></SelectTrigger>
                      <SelectContent>{calNombramiento.map((r) => <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {periodoSeleccionado && periodoInfo && (
                <div className={`rounded-lg border-2 p-4 flex flex-col gap-3 ${periodoInfo.enTiempo ? "border-secondary/30 bg-secondary/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Límite DO (Dictamen)</span>
                      <span className="text-sm font-semibold text-card-foreground">{periodoInfo.row.limiteDO}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Límite DGRH (Alta)</span>
                      <span className="text-sm font-semibold text-card-foreground">{periodoInfo.row.limiteDGRH}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {periodoInfo.enTiempo ? (
                      <Badge className="bg-secondary/15 text-secondary border-0 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />En tiempo
                      </Badge>
                    ) : permisoActivo ? (
                      <div className="flex items-start gap-2 w-full">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#f97316" }} />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold" style={{ color: "#f97316" }}>Período vencido — temporalmente habilitado</span>
                          <span className="text-xs text-muted-foreground">Tiene autorización para registrar fuera de tiempo.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 w-full">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-destructive">Período vencido — No se puede Registrar</span>
                          <span className="text-xs text-muted-foreground">La Fecha  límite DO ({periodoInfo.row.limiteDO}) ya Expiro .</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`shadow-sm border-border ${(periodoVencido && !permisoActivo) || !calendarioCompleto ? "opacity-50 pointer-events-none" : ""}`}>
            <CardContent className="flex justify-end px-2 py-2">
              <Button onClick={handleContinueToRenovacion} disabled={!puedeAvanzarDeTipo}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Continuar<ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {step === "renovacion" && (
        <Card className="shadow-sm border-border">
          <CardHeader className="px-4 pt-3 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <FileText className="h-4 w-4 text-secondary" />Renovación
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-4 pb-3 pt-0">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">¿Es renovación de un dictamen anterior? *</Label>
              <RadioGroup value={esRenovacion} onValueChange={setEsRenovacion} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="si" id="ren-si" />
                  <Label htmlFor="ren-si" className="text-sm font-normal cursor-pointer">Sí</Label>
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
                    Folio del Dictamen/Opinión Anterior
                    {hayFoliosReales && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({foliosReales.length} encontrados{periodoSeleccionado ? ` · ${periodoSeleccionado}` : ""})
                      </span>
                    )}
                  </Label>
                  {excelRows.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
                      <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Sin Dictamen/Opinion Anterior</span>
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
                            <span className="font-medium">{formatFolioJustificacion(f.folioJustificacion)}</span>{" / "}
                            <span className="font-medium">{formatFolioDictamen(f.folioDictamen)}</span>
                            {f.secretaria && <span className="text-muted-foreground"> - {f.secretaria}</span>}
                            {foliosDBIds.has(f.id) && <span className="ml-1.5 text-[10px] text-blue-500 font-semibold"> BD</span>}
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
                        <span className="text-xs text-muted-foreground">Folio de Justificación</span>
                        <span className="text-sm font-medium text-card-foreground">{formatFolioJustificacion(folioSeleccionadoData.folioJustificacion)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Folio de Dictamen/Opinión</span>
                        <span className="text-sm font-medium text-card-foreground">{formatFolioDictamen(folioSeleccionadoData.folioDictamen)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Secretaría</span>
                        <span className="text-sm font-medium text-card-foreground">{folioSeleccionadoData.secretaria || "—"}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <Label className="text-sm font-medium">Condición de Renovación</Label>
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
                          <span className="text-xs text-muted-foreground">Marque si confirma que no hay cambios respecto al dictamen anterior</span>
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
                              <span className="text-sm font-semibold text-card-foreground">¿Confirmar mismas condiciones?</span>
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
                              <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Campos editables en renovación</span>
                              <ul className="text-sm text-card-foreground flex flex-col gap-1">
                                <li className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-secondary shrink-0" />Vigencia</li>
                                <li className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-secondary shrink-0" />Oficio de Suficiencia</li>
                                <li className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5 text-secondary shrink-0" />Número de Prestadores de Servicios</li>
                              </ul>
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
                  (esRenovacion === "si" && !folioSeleccionado) ||
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


   {step === "formulario" && (
     <>
       <div className="flex flex-col gap-2">
         <div>
           <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5">
             <ArrowLeft className="h-4 w-4" />Anterior
           </Button>


           {prefilled && datosRenovacion && (
             <Badge variant="outline" className="border-secondary text-secondary gap-1">
               <Lock className="h-3 w-3" />Renovación
             </Badge>


           )}
         </div>
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
              onArchivoChange={setArchivoAdjunto}
              secretariaFija={userSecretariaOriginal}
              unidadFija={userUAOriginal}
              claveReportePlazas={userClaveReporte}
              catalogoUAs={catalogoUAsDelUsuario}
              initialData={editSolicitud?.formData}
            />
          ) : (
            <FormularioNombramiento
              prefilled={prefilled}
              esRenovacion={esRenovacion === "si"}
              excelRows={excelRows}
              datosRenovacion={datosRenovacion}
              onFormChange={handleFormChange}
              onArchivoChange={setArchivoAdjunto}
              secretariaFija={userSecretariaOriginal}
              unidadFija={userUAOriginal}
              claveReportePlazas={userClaveReporte}
              catalogoUAs={catalogoUAsDelUsuario}
              tipoAdministracionUsuario={editSolicitud?.formData?.tipoAdministracionNom ?? user?.tipoAdministracion ?? "centralizada"}
              initialData={editSolicitud?.formData}
            />
          )}

          {(() => {
            const periodoStillValid = periodoInfo?.enTiempo ?? false
            const hasPermiso = !!permisoActivo
            const isEditingBorrador = !!editSolicitud?.id
            const vigenciaOk = hasPermiso || isEditingBorrador
              ? !!(formData.vigenciaInicio) && !!(formData.vigenciaFin)
              : !esFechaPasada(formData.vigenciaInicio ?? "") &&
                !esFechaPasada(formData.vigenciaFin    ?? "") &&
                !!(formData.vigenciaInicio) && !!(formData.vigenciaFin)
            const camposFaltantes = esRenovacion !== "si" ? validarCamposCompletos(formData, tipo) : []
            const camposOk = camposFaltantes.length === 0
            const canSend = (periodoStillValid || hasPermiso || isEditingBorrador) && !enviando && !guardandoBorrador && vigenciaOk && camposOk

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
                {esRenovacion !== "si" && camposFaltantes.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Campos obligatorios pendientes ({camposFaltantes.length}):
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-500">
                        {camposFaltantes.join(" · ")}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <Button variant="outline" onClick={handleBack} disabled={enviando || guardandoBorrador}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />Anterior
                  </Button>
                  <div className="flex items-center gap-3">
                    {isEditingBorrador ? (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[160px]"
                        disabled={guardandoBorrador || enviando} onClick={handleGuardarBorrador}>
                        {guardandoBorrador
                          ? <><Clock className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</>
                          : <><Save className="mr-1.5 h-4 w-4" />Guardar Cambios</>
                        }
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" disabled={guardandoBorrador || enviando} onClick={handleGuardarBorrador} className="gap-1.5">
                          {guardandoBorrador
                            ? <><Clock className="h-4 w-4 animate-spin" />Guardando...</>
                            : <><Save className="mr-1.5 h-4 w-4" />Guardar Borrador</>
                          }
                        </Button>
                        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[160px]"
                          disabled={!canSend} onClick={() => handleEnviarAValidacion(periodoStillValid, hasPermiso, isEditingBorrador)}>
                          {enviando
                            ? <><Clock className="mr-1.5 h-4 w-4 animate-spin" />Enviando...</>
                            : <><SendHorizonal className="mr-1.5 h-4 w-4" />Enviar a Validación</>
                          }
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </PageLayout>
  )
}