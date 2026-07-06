"use client"

import { normalizeText, applyTextRules } from "@/lib/utils"
import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PageLayout } from "@/components/page-layout"
import { FileDropZone, UploadedFileRow } from "@/components/ui/file-drop-zone"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ConfirmToast } from "@/components/ui/confirm-toast"
import { Separator } from "@/components/ui/separator"
import {

  FilePlus, Upload, ArrowLeft, ArrowRight, Plus, Trash2,
  FileText, ClipboardList, Save, SendHorizonal, AlertCircle,
  ShieldAlert, CheckCircle2, Clock, Lock, X, Search, Loader2,
  Edit3, RotateCcw, Megaphone,

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
function dmyToIso(dmy?: string): string {
  if (!dmy || !dmy.includes("/")) return ""
  const [d, m, y] = dmy.split("/")
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
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

function OficioUpload({
  vigenciaInicio, onFilesChange,
  existingFiles,
}: {
  vigenciaInicio: string
  onFilesChange?: (files: File[]) => void
  existingFiles?: { id: number; nombre_archivo: string; ruta: string }[]
}) {
  const [archivos, setArchivos] = useState<File[]>([])

  const VALID_EXTS = ["pdf","doc","docx","xls","xlsx","ppt","pptx","png","jpg","jpeg","gif","webp","zip","rar","txt","odt","ods"]

  const handleFilesChange = (files: File[]) => {
    const filtered = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
      return VALID_EXTS.includes(ext)
    })
    setArchivos(filtered)
    onFilesChange?.(filtered)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Archivos existentes ya subidos al servidor */}
      {existingFiles && existingFiles.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-1">
          {existingFiles.map((adj) => (
            <UploadedFileRow key={adj.id} nombre={adj.nombre_archivo} ruta={adj.ruta} />
          ))}
          <p className="text-xs text-muted-foreground">Para agregar o reemplazar archivos, cargue nuevos:</p>
        </div>
      )}

      <FileDropZone
        hint="PDF, DOC, XLSX, PPT, imágenes, ZIP · máx. 10 MB · 1 archivo"
        files={archivos}
        onFilesChange={handleFilesChange}
        multiple={false}
      />
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
  return s.split(/[\n\r•·]+/).map(t => t.trim()).filter(Boolean)
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

const TIPO_ACTIVIDAD_LABELS: Record<string, string> = {}

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
;(Object.values(FALLBACK_TIPOS_ACTIVIDAD).flat() as { value: string; label: string }[]).forEach(({ value, label }) => {
  TIPO_ACTIVIDAD_LABELS[value] = label
  const labelSlug = label.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "")
  TIPO_ACTIVIDAD_LABELS[labelSlug] = label
})

function resolverTipoActividadInit(stored: string | undefined | null): string {
  if (!stored) return ""
  const allOptions = Object.values(FALLBACK_TIPOS_ACTIVIDAD).flat()
  if (allOptions.some((o) => o.value === stored)) return stored
  const byLabel = allOptions.find((o) => o.label.toLowerCase() === stored.toLowerCase())
  if (byLabel) return byLabel.value
  const asSlug = stored.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "").trim()
  const bySlug = allOptions.find((o) => o.label.toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "") === asSlug)
  return bySlug ? bySlug.value : asSlug
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
type Step = "tipo" | "formulario"

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
      {hint && <p className="text-xs text-muted-foreground flex items-center gap-1"><img src="/iconos2/Icon.svg" alt="" className="h-3 w-3 shrink-0" />{hint}</p>}
    </div>
  )
}

function syncLength(arr: string[], count: number): string[] {
  if (arr.length === count) return arr
  if (arr.length < count) return [...arr, ...Array(count - arr.length).fill("")]
  return arr.slice(0, count)
}

function DynamicList({
  label, items, onChange, max = 100, readonly = false,
  minRequired, nivelTabulador, forbiddenTexts, onBlurItem, matchCountLabel = false,
  }: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  max?: number
  readonly?: boolean
  minRequired?: number
  nivelTabulador?: string
  forbiddenTexts?: Set<string>
  onBlurItem?: (value: string) => string
  matchCountLabel?: boolean
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
  const dupFlags = useMemo(() => {
    const normalized = items.map(i => normalizeText(i.trim()))
    return normalized.map((n, i) => {
      if (!n) return false
      if (forbiddenTexts?.has(n)) return true
      return normalized.indexOf(n) !== i
    })
  }, [items, forbiddenTexts])
  const hasDups = dupFlags.some(Boolean)
  const itemRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const prevLengthRef = useRef(items.length)
  const internalAddRef = useRef(false)
  useEffect(() => {
    if (items.length > prevLengthRef.current && internalAddRef.current) {
      itemRefs.current[items.length - 1]?.focus()
    }
    internalAddRef.current = false
    prevLengthRef.current = items.length
  }, [items.length])
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
        <div key={idx} className="flex flex-col gap-1">
          <div className="flex items-start gap-2 w-full">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary mt-[10px]">
              {idx + 1}
            </span>
            {readonly && !item ? (
              <span className="text-sm text-muted-foreground py-2">—</span>
            ) : readonly ? (
              <span
                className="flex-1 text-sm text-muted-foreground py-2"
                style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "break-word", minWidth: 0 }}
              >
                {item}
              </span>
            ) : (
              <textarea
                ref={(el) => {
                  itemRefs.current[idx] = el
                  if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px" }
                }}
                value={item}
                rows={1}
                onChange={(e) => {
                  const copy = [...items]; copy[idx] = e.target.value; onChange(copy)
                  const el = e.currentTarget
                  el.style.height = "auto"; el.style.height = el.scrollHeight + "px"
                }}
                onBlur={() => {
                  if (onBlurItem && item.trim()) {
                    const transformed = onBlurItem(item)
                    if (transformed !== item) {
                      const copy = [...items]; copy[idx] = transformed; onChange(copy)
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && items.length < maxEfectivo) {
                    e.preventDefault()
                    internalAddRef.current = true
                    onChange([...items, ""])
                  }
                  if ((e.key === "Backspace" || e.key === "Delete") && item === "" && items.length > 1) {
                    e.preventDefault()
                    onChange(items.filter((_, i) => i !== idx))
                    const focusIdx = idx > 0 ? idx - 1 : 0
                    setTimeout(() => { itemRefs.current[focusIdx]?.focus() }, 0)
                  }
                }}
                placeholder={`${label || "Item"} ${idx + 1}`}
                className={`ds-list-input flex-1${dupFlags[idx] ? " ds-list-input--error" : ""}`}
                style={{
                  resize: "none", overflow: "hidden",
                  whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "break-word",
                  minWidth: 0, lineHeight: "1.5rem",
                }}
              />
            )}
            {!readonly && items.length > 1 && (
              <button
                type="button"
                onClick={() => { const copy = items.filter((_, i) => i !== idx); onChange(copy) }}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-[15px]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {dupFlags[idx] && !readonly && (
            <p className="text-xs flex items-center gap-1 pl-8" style={{ color: "#D32F2F" }}>
              <AlertCircle className="h-3 w-3 shrink-0" />Este texto ya existe en otra sección o se repite.
            </p>
          )}
        </div>
      ))}
      {!readonly && items.length < maxEfectivo && (
        <Button type="button" variant="outline" size="sm" className="w-fit mt-1"
          onClick={() => { internalAddRef.current = true; onChange([...items, ""]) }}>
          <Plus className="mr-1 h-4 w-4" />Agregar
        </Button>
      )}
      {!readonly && (
        <p className={`text-xs flex items-center gap-1 mt-0.5 ${belowMin || hasDups ? "text-destructive" : "text-muted-foreground"}`}>
          <AlertCircle className="h-3 w-3 shrink-0" />
          {hasDups
            ? "Elimine los textos duplicados antes de continuar."
            : matchCountLabel
              ? `Se requieren el mismo número, ${minEfectivo} elementos. Llevas ${filledCount}.`
              : `Se requieren al menos ${minEfectivo} elementos. Llevas ${filledCount}.`}
        </p>
      )}
    </div>
  )
}

function StepIndicator({ step, tipo }: { step: Step; tipo: TipoSolicitud }) {
  const steps = [
    { key: "tipo",       label: "Tipo de Solicitud" },
    { key: "formulario", label: tipo === "prestacion" ? "Prestación de Servicios" : "Nombramiento" },
  ]
  const currentIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="flex items-start w-full">
      {steps.map((s, i) => {
        const isDone    = i < currentIndex
        const isActive  = i === currentIndex

        /* Circle style */
        const circleStyle: React.CSSProperties = isDone
          ? { width: 32, height: 32, flexShrink: 0, position: 'relative', zIndex: 1 }
          : isActive
          ? { width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ffffff', border: '2px solid #773357', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }
          : { width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ffffff', border: '2px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }

        /* Label style */
        const labelStyle: React.CSSProperties = isActive
          ? { fontSize: 12, fontWeight: 600, color: '#773357', textAlign: 'center', maxWidth: 120, lineHeight: 1.3 }
          : isDone
          ? { fontSize: 12, fontWeight: 400, color: '#6B7280', textAlign: 'center', maxWidth: 120, lineHeight: 1.3 }
          : { fontSize: 12, fontWeight: 400, color: '#9CA3AF', textAlign: 'center', maxWidth: 120, lineHeight: 1.3 }

        return (
          <div key={s.key} className="flex flex-1 flex-col items-center" style={{ position: 'relative' }}>

            {/* ── Connector line (between circles) ────────── */}
            {i > 0 && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: '-50%',
                width: '100%',
                height: 2,
                backgroundColor: isDone ? '#2A3B29' : '#D1D5DB',
                zIndex: 0,
              }} />
            )}

            {/* ── Circle + label ────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={circleStyle}>
                {isDone ? (
                  <img src="/Iconos1/step-check.svg" width={32} height={32} alt="paso completado" />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#773357' : '#9CA3AF', lineHeight: 1 }}>
                    {i + 1}
                  </span>
                )}
              </div>
              <span style={labelStyle}>{s.label}</span>
            </div>
          </div>
        )
      })}
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

function TabuladorNiveles({ nivelCategoria, importeBruto, readonly = false, onSeleccionadoChange, secretaria, initialNivel, initialCategoria }: {
  nivelCategoria?: string; importeBruto?: string; readonly?: boolean
  onSeleccionadoChange?: (nivel: string, categoria: string) => void
  secretaria?: string
  initialNivel?: string
  initialCategoria?: string
}) {
  const normalizedImporte = parseImporteBruto(importeBruto || "")
  const loadedImporteRef = useRef<string | null>(null)
  const [busqueda, setBusqueda]         = useState(() => parseImporteBruto(importeBruto || "") || "")
  const [seleccionado, setSeleccionado] = useState<TabuladorEntry | null>(
    initialNivel ? { nivel: initialNivel, categoria: initialCategoria ?? "" } : null
  )
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
    setBusqueda(q)
    if (initialNivel) {
      if (!q) return
      if (loadedImporteRef.current === null) {
        loadedImporteRef.current = importeBruto ?? ""
        return
      }
      if (importeBruto === loadedImporteRef.current) return
      loadedImporteRef.current = importeBruto ?? ""
    }
    if (!q) { setSeleccionado(null); return }
    const val = parseMoney(q)
    if (val >= 0) {
      const match = rangosActivos.find((r) => val >= r.min && val <= r.max)
      if (match) { setSeleccionado({ nivel: match.nivel, categoria: match.categoria }); return }
    }
    setSeleccionado(null)
  }, [importeBruto, rangosActivos, initialNivel])
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
              <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[#F5A800] bg-[#FFFBEB] px-4 py-3">
                <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-[#374151]">
                  Hay varias coincidencias — seleccione el nivel que corresponda.
                </span>
              </div>
            )}
            {seleccionado && (
              <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[#22C55E] bg-[#F0FDF4] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-[#374151]">
                  Nivel seleccionado: <strong>{seleccionado.nivel}</strong>
                  {seleccionado.categoria ? ` — categoría ${seleccionado.categoria}` : ""}
                </span>
              </div>
            )}
            {busqueda.trim() === "" ? (
              <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[#9CA3AF] bg-[#F9FAFB] px-4 py-3">
                <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4 shrink-0 mt-0.5 opacity-60" />
                <span className="text-sm text-[#374151]">Ingrese el importe para ver coincidencias</span>
              </div>
            ) : coincidencias.length === 0 ? (
              <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[#EF4444] bg-[#FFF5F5] px-4 py-3">
                <AlertCircle className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span className="text-sm text-[#DC2626]">Sin coincidencias en el tabulador.</span>
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
      <SelectTrigger
        className={`w-full rounded-[12px]
          data-[state=open]:bg-white
          ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span className="block truncate text-sm pr-1">
          {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-lg p-1.5">
        {/* ── Buscador interno ── */}
        <div className="sticky top-0 z-10 bg-white pb-1.5 px-0.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF] pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="h-9 rounded-full border-[#E5E7EB] bg-white text-sm pl-9 pr-8 focus:border-[#2D3B2D]"
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {busqueda && (
            <p className="text-[10px] text-[#9CA3AF] mt-1 pl-3">
              {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* ── Opciones ── */}
        <div className="max-h-52 overflow-y-auto">
          {filtradas.length === 0
            ? <div className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados para "{busqueda}"</div>
            : filtradas.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="rounded-[8px] focus:bg-[#f0ede6] focus:text-[#773357] data-[state=checked]:bg-[#f0ede6] data-[state=checked]:text-[#773357]"
              >
                {o.label}
              </SelectItem>
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
      <div className="relative z-10 w-full max-w-md bg-white flex flex-col overflow-hidden"
        style={{ borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#F3E8F0", border: "1px solid #E8D0E0" }}>
            <img src="/iconos2/Icon.svg" alt="" className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-base font-bold text-[#111827]">Marco Normativo</span>
            <span className="text-sm text-[#6B7280]">Aviso importante antes de continuar</span>
          </div>
          <button onClick={onDismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-3">
          <p className="text-sm text-[#374151]">
            Este apartado deberá contar con <strong>validación previa por la UEF</strong> o su equivalente antes de su envío.
          </p>
          <p className="text-sm text-[#374151]">
            La información registrada será <strong>responsabilidad de la persona titular</strong> de la Unidad de Enlace Financiero Administrativo o equivalente.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4" style={{ borderTop: "1px solid #E5E7EB" }}>
          <button
            type="button"
            onClick={onAccept}
            style={{
              border: "none",
              borderRadius: 9999,
              background: "#773357",
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Entendido, continuar
          </button>
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
      <div
        className="relative z-10 w-full bg-white flex flex-col overflow-hidden"
        style={{ maxWidth: 580, borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>Fórmula de llenado</span>
            <span className="text-sm text-[#6B7280]">Guía para redactar correctamente el campo</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Separador ── */}
        <div style={{ borderBottom: "1px solid #E5E7EB" }} />

        {/* ── Contenido / Tabla ── */}
        <div className="overflow-auto px-6 py-4" style={{ maxHeight: "65vh" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <td
                    className="align-top"
                    style={{
                      width: "40%",
                      padding: "12px 16px",
                      backgroundColor: "#F9FAFB",
                      color: "#6B7280",
                      fontWeight: 500,
                      borderRight: "1px solid #E5E7EB",
                    }}
                  >
                    {fila.elemento}
                  </td>
                  <td
                    className="align-top leading-relaxed"
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    {fila.ejemplo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex justify-end px-6 py-4"
          style={{ borderTop: "1px solid #E5E7EB" }}
        >
          <button
            onClick={onClose}
            style={{
              border: "1.5px solid #ccc",
              borderRadius: 9999,
              background: "white",
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: "#374151",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            Cerrar
          </button>
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
  initialData, existingAdjuntos, periodoFechaInicio, periodoFechaFin,
}: {
  prefilled: boolean
  lockVigenciaOnly?: boolean
  regimenPeriodo?: string
  excelRows?: HistoricoRow[]
  esRenovacion?: boolean
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
  onArchivoChange?: (files: File[]) => void
  secretariaFija?: string | null
  unidadFija?: string | null
  claveReportePlazas?: string | null
  catalogoUAs?: { clave: string; nombre: string }[]
  initialData?: Partial<FormularioData>
  existingAdjuntos?: { id: number; nombre_archivo: string; ruta: string }[]
  periodoFechaInicio?: string
  periodoFechaFin?: string
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
  const [claveUA, setClaveUA] = useState(fmtClave(initialData?.unidadAdministrativa ?? claveReportePlazas ?? ""))
  const [urgSeleccionada,      setUrgSeleccionada]      = useState(
    datosRenovacion?.unidadResponsableGasto
    ?? initialData?.unidadResponsable
    ?? (secretariaFija && unidadFija ? getClaveForUA(secretariaFija, unidadFija) : "")
    ?? ""
  )
  const didReconcileUARef  = useRef(false)
  const didReconcileURGRef = useRef(false)
  useEffect(() => {
    if (didReconcileUARef.current || catalogoUAs.length === 0 || !claveUA) return
    didReconcileUARef.current = true
    if (catalogoUAs.some((u) => u.clave !== "" && u.clave === claveUA)) return
    const normStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    const byNombre = catalogoUAs.find((u) => normStr(u.nombre) === normStr(claveUA))
    if (byNombre && byNombre.clave !== "") { setClaveUA(byNombre.clave); setUnidadSeleccionada(byNombre.nombre) }
  }, [catalogoUAs])
  useEffect(() => {
    if (didReconcileURGRef.current || catalogoUAs.length === 0 || !urgSeleccionada) return
    didReconcileURGRef.current = true
    const normStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (catalogoUAs.some((u) => normStr(u.nombre) === normStr(urgSeleccionada))) return
    const byClave = catalogoUAs.find((u) => u.clave === urgSeleccionada)
    if (byClave) setUrgSeleccionada(byClave.nombre)
  }, [catalogoUAs])
  const [tipoAdministracionForm, setTipoAdministracionForm] = useState<"centralizada" | "paraestatal">(initialData?.tipoAdministracionNom ?? "centralizada")
  const [programaSeleccionado, setProgramaSeleccionado] = useState(
    datosRenovacion?.programaProyecto ?? initialData?.programaProyecto ?? ""
  )
  const [tipoActividadSeleccionado, setTipoActividadSeleccionado] = useState(
    resolverTipoActividadInit(datosRenovacion?.tipoActividad ?? initialData?.tipoActividades)
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
      return SECRETARIAS_CATALOGO.filter((s) => normalizeText(s).includes(normalizeText(secretariaInput)))
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
  const tiposActividadBase = programaSeleccionado && tiposActividadPorPrograma.length > 0
    ? tiposActividadPorPrograma : tiposActividadPorRegimen
  const tiposActividad = useMemo(() => {
    if (!tipoActividadSeleccionado || tiposActividadBase.some(t => t.value === tipoActividadSeleccionado)) return tiposActividadBase
    const storedLabel = initialData?.tipoActividades ?? tipoActividadSeleccionado
    return [{ value: tipoActividadSeleccionado, label: storedLabel }, ...tiposActividadBase]
  }, [tiposActividadBase, tipoActividadSeleccionado, initialData?.tipoActividades])
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

  const forbiddenTextsPS = useMemo(() => {
    const norm = (arr: string[]) => arr.map(t => normalizeText(t.trim())).filter(Boolean)
    const a = norm(actividades), r = norm(responsabilidades), ca = norm(compAdm),
      ct = norm(compTec), cs = norm(compSoc), v = norm(valores), ae = norm(areasExp)
    const union = (...arrs: string[][]): Set<string> => { const s = new Set<string>(); arrs.forEach(ar => ar.forEach(t => s.add(t))); return s }
    return {
      actividades:       union(r, ca, ct, cs, v, ae),
      responsabilidades: union(a, ca, ct, cs, v, ae),
      compAdm:           union(a, r, ct, cs, v, ae),
      compTec:           union(a, r, ca, cs, v, ae),
      compSoc:           union(a, r, ca, ct, v, ae),
      valores:           union(a, r, ca, ct, cs, ae),
      areasExp:          union(a, r, ca, ct, cs, v),
    }
  }, [actividades, responsabilidades, compAdm, compTec, compSoc, valores, areasExp])

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
      escolaridad:          escolaridad.join("\n"),
      compAdm:              compAdm.join("\n"),
      compTec:              compTec.join("\n"),
      compSoc:              compSoc.join("\n"),
      valores:              valores.join("\n"),
      areasExp:             areasExp.join("\n"),
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

  const seccion = useMemo(() => {
    const niv = nivelTabulador.trim().toUpperCase()
    const min = (niv === "105" || niv === "504") ? 7 : 5
    return {
      I:   !!(urgSeleccionada && programaSeleccionado && regimenEfectivo && tipoActividadSeleccionado && numeroPrestadores && vigenciaInicio && vigenciaFin && importeBruto && nivelTabulador && categoriaTabulador),
      II:  !!(objeto?.trim()),
      III: actividades.filter(a => a.trim()).length >= min,
      IV:  responsabilidades.filter(r => r.trim()).length >= min,
      V:   escolaridad.some(e => e.trim()) && compAdm.some(c => c.trim()) && compTec.some(c => c.trim()) && compSoc.some(c => c.trim()) && valores.some(v => v.trim()) && areasExp.some(a => a.trim()),
    }
  }, [urgSeleccionada, programaSeleccionado, regimenEfectivo, tipoActividadSeleccionado, numeroPrestadores, vigenciaInicio, vigenciaFin, importeBruto, nivelTabulador, categoriaTabulador, objeto, actividades, responsabilidades, escolaridad, compAdm, compTec, compSoc, valores, areasExp])
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
  const catalogoUAsConGuardada = useMemo(() => {
    if (!claveUA || !catalogoUAs.some(u => u.clave !== "") || catalogoUAs.some(u => u.clave === claveUA)) return catalogoUAs
    return [{ clave: claveUA, nombre: claveUA }, ...catalogoUAs]
  }, [claveUA, catalogoUAs])
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
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccion.I ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>I</span>
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
              <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#ccc] bg-muted/40 px-4 py-3 min-h-[44px]">
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
              ) : catalogoUAsConGuardada.some((u) => u.clave !== "") ? (
                <Select
                  value={claveUA}
                  onValueChange={(clave) => {
                    const ua = catalogoUAsConGuardada.find((u) => u.clave === clave)
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
                    {catalogoUAsConGuardada.filter((u) => u.clave !== "").map((u) => (
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
                  maxLength={200}
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
              </Label>
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
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Número de Prestadores de Servicios
              </Label>
              <Input
                type="number" min={1} max={9999}
                inputMode="numeric"
                value={numeroPrestadores}
                onChange={(e) => setNumeroPrestadores(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab"].includes(e.key)) e.preventDefault() }}
                placeholder="Ej. 5"
                className="ns-ds-field bg-background"
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
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteBruto(e.target.value.replace(/[^0-9.,]/g, "")) }}
                  onKeyDown={(e) => { if (!/[0-9.,]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab","Home","End"].includes(e.key)) e.preventDefault() }}
                  onBlur={(e) => { if (!bloqueadoPorRenovacion) setImporteBruto(parseImporteBruto(e.target.value)) }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`ns-ds-field pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
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
              {(() => {
                const periodoVigMin = dmyToIso(periodoFechaInicio)
                const periodoVigMax = dmyToIso(periodoFechaFin)
                const vigMin = periodoVigMin || undefined
                const vigMax = periodoVigMax || undefined
                const efectivoMin = vigMin || vigenciaInicio || ""
                const inicioError = !!vigenciaInicio && !!vigMin && vigenciaInicio < vigMin
                const finError    = !!vigenciaFin    && !!vigMax && vigenciaFin    > vigMax
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Inicio</span>
                      <DatePickerHabil
                        value={isoToDate(vigenciaInicio)}
                        fromDate={vigMin ? isoToDate(vigMin) : undefined}
                        toDate={vigMax ? isoToDate(vigMax) : undefined}
                        startMonth={isoToDate(vigenciaInicio || efectivoMin)}
                        onChange={(d) => d && setVigenciaInicio(dateToIso(d))}
                        placeholder="Seleccionar inicio"
                        className={inicioError ? "border-destructive" : ""}
                      />
                      {inicioError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />Fecha anterior al inicio del periodo.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Término</span>
                      <DatePickerHabil
                        value={isoToDate(vigenciaFin)}
                        fromDate={isoToDate(vigenciaInicio || efectivoMin)}
                        toDate={vigMax ? isoToDate(vigMax) : undefined}
                        startMonth={isoToDate(vigenciaFin || vigenciaInicio || efectivoMin)}
                        onChange={(d) => d && setVigenciaFin(dateToIso(d))}
                        placeholder="Seleccionar término"
                        className={finError ? "border-destructive" : ""}
                      />
                      {finError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />Fecha posterior al fin del periodo.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <OficioUpload vigenciaInicio={vigenciaInicio} onFilesChange={onArchivoChange} existingFiles={existingAdjuntos} />
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
        initialNivel={nivelTabulador || undefined}
        initialCategoria={categoriaTabulador || undefined}
      />

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccion.II ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>II</span>
            Objeto de la Contratación
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 text-[#9ca3af] hover:text-[#7B2D5E] transition-colors" title="Ver fórmula de llenado">
              <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4" />
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
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccion.III ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>III</span>
            Actividades a Realizar
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 text-[#9ca3af] hover:text-[#7B2D5E] transition-colors" title="Ver fórmula de llenado">
              <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4" />
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
            max={10}
            forbiddenTexts={forbiddenTextsPS.actividades}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccion.IV ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>IV</span>
            Responsabilidades
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-2">
          <DynamicList
            label="" items={responsabilidades}
            onChange={(newItems) => {
              setResponsabilidades(newItems)
            }}
            readonly={bloqueadoPorRenovacion}
            minRequired={actividades.length}
            matchCountLabel
            max={10}
            forbiddenTexts={forbiddenTextsPS.responsabilidades}
          />

          <div className="flex flex-col items-start gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 text-sm font-medium text-[#2563EB]">
              <Megaphone className="h-3.5 w-3.5" />Las responsabilidades deberán ser congruentes con las actividades registradas.
            </span>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccion.V ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>V</span>
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
              onBlurItem={applyTextRules}
              readonly={bloqueadoPorRenovacion}
              minRequired={1}
              max={1}
            />
          </div>

          {([
            { sub: "II.1", label: "Competencias Administrativas", items: compAdm,  setter: setCompAdm,  fKey: "compAdm"  as const },
            { sub: "II.2", label: "Competencias Técnicas",        items: compTec,  setter: setCompTec,  fKey: "compTec"  as const },
            { sub: "II.3", label: "Competencias Sociales",        items: compSoc,  setter: setCompSoc,  fKey: "compSoc"  as const },
            { sub: null,   label: "Áreas de Experiencia",         items: areasExp, setter: setAreasExp, fKey: "areasExp" as const },
            { sub: null,   label: "Valores",                      items: valores,  setter: setValores,  fKey: "valores"  as const },
          ] as const).map(({ sub, label, items, setter, fKey }) => (
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
                onChange={(newItems) => {
                  setter(newItems)
                }}
                readonly={bloqueadoPorRenovacion}
                minRequired={actividades.length}
                matchCountLabel
                max={10}
                forbiddenTexts={forbiddenTextsPS[fKey]}
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
  tipoAdministracionUsuario = "centralizada", initialData, existingAdjuntos, periodoFechaInicio, periodoFechaFin, regimenPeriodo = "",
}: {
  prefilled: boolean; esRenovacion?: boolean; excelRows?: HistoricoRow[]
  datosRenovacion?: FolioExcel | null
  onFormChange: (data: Partial<FormularioData>) => void
  onArchivoChange?: (files: File[]) => void
  secretariaFija?: string | null
  unidadFija?: string | null
  claveReportePlazas?: string | null
  catalogoUAs?: { clave: string; nombre: string }[]
  tipoAdministracionUsuario?: "centralizada" | "paraestatal"
  initialData?: Partial<FormularioData>
  existingAdjuntos?: { id: number; nombre_archivo: string; ruta: string }[]
  periodoFechaInicio?: string
  periodoFechaFin?: string
  regimenPeriodo?: string
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
  const [claveUA, setClaveUA] = useState(fmtClave(initialData?.unidadAdministrativa ?? claveReportePlazas ?? ""))
  const [urgSeleccionada, setUrgSeleccionada] = useState(
    datosRenovacion?.unidadResponsableGasto ?? initialData?.unidadResponsable ?? ""
  )
  const didReconcileUARef2  = useRef(false)
  const didReconcileURGRef2 = useRef(false)
  useEffect(() => {
    if (didReconcileUARef2.current || catalogoUAs.length === 0 || !claveUA) return
    didReconcileUARef2.current = true
    if (catalogoUAs.some((u) => u.clave !== "" && u.clave === claveUA)) return
    const normStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    const byNombre = catalogoUAs.find((u) => normStr(u.nombre) === normStr(claveUA))
    if (byNombre && byNombre.clave !== "") { setClaveUA(byNombre.clave); setUnidadAdscripcion(byNombre.nombre) }
  }, [catalogoUAs])
  useEffect(() => {
    if (didReconcileURGRef2.current || catalogoUAs.length === 0 || !urgSeleccionada) return
    didReconcileURGRef2.current = true
    const normStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (catalogoUAs.some((u) => normStr(u.nombre) === normStr(urgSeleccionada))) return
    const byClave = catalogoUAs.find((u) => u.clave === urgSeleccionada)
    if (byClave) setUrgSeleccionada(byClave.nombre)
  }, [catalogoUAs])
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

  const forbiddenTextsNom = useMemo(() => {
    const norm = (arr: string[]) => arr.map(t => normalizeText(t.trim())).filter(Boolean)
    const a = norm(funciones), r = norm(responsabilidades), ca = norm(compAdm),
      ct = norm(compTec), cs = norm(compSoc), v = norm(valores), ae = norm(areasExp)
    const union = (...arrs: string[][]): Set<string> => { const s = new Set<string>(); arrs.forEach(ar => ar.forEach(t => s.add(t))); return s }
    return {
      funciones:         union(r, ca, ct, cs, v, ae),
      responsabilidades: union(a, ca, ct, cs, v, ae),
      compAdm:           union(a, r, ct, cs, v, ae),
      compTec:           union(a, r, ca, cs, v, ae),
      compSoc:           union(a, r, ca, ct, v, ae),
      valores:           union(a, r, ca, ct, cs, ae),
      areasExp:          union(a, r, ca, ct, cs, v),
    }
  }, [funciones, responsabilidades, compAdm, compTec, compSoc, valores, areasExp])

  const [tipoActividadSeleccionado, setTipoActividadSeleccionado] = useState(
    resolverTipoActividadInit(datosRenovacion?.tipoActividad ?? initialData?.tipoActividades)
  )
  const tipoAdministracion = tipoAdministracionUsuario
  const tiposActividadNomPorPrograma = useTiposActividadPorPrograma(
    programaInput, "nombramiento", excelRows, tipoAdministracion, secretariaConfirmada
  )
  const tiposActividadNomPorRegimen = useTiposActividad(
    "nombramiento", excelRows, tipoAdministracion, secretariaConfirmada
  )
  const tiposActividadNomBase = programaInput && tiposActividadNomPorPrograma.length > 0
    ? tiposActividadNomPorPrograma : tiposActividadNomPorRegimen
  const tiposActividadNom = useMemo(() => {
    if (!tipoActividadSeleccionado || tiposActividadNomBase.some(t => t.value === tipoActividadSeleccionado)) return tiposActividadNomBase
    const storedLabel = initialData?.tipoActividades ?? tipoActividadSeleccionado
    return [{ value: tipoActividadSeleccionado, label: storedLabel }, ...tiposActividadNomBase]
  }, [tiposActividadNomBase, tipoActividadSeleccionado, initialData?.tipoActividades])
  const tipoActividadNomLabel = tipoActividadSeleccionado
    ? tiposActividadNom.find(t => t.value === tipoActividadSeleccionado)?.label
    : undefined
  const sugerencias = useMemo(() => {
    if (esRenovacion) {
      if (!secretariaInput) return SECRETARIAS_CATALOGO
      return SECRETARIAS_CATALOGO.filter((s) => normalizeText(s).includes(normalizeText(secretariaInput)))
    }
    return filtrarSecretarias(secretariaInput)
  }, [secretariaInput, esRenovacion])
  const datosRelacionados = useMemo(() => getDatosSecretaria(secretariaConfirmada, excelRows), [secretariaConfirmada, excelRows])
  const clavesAdscripcion = useMemo((): { clave: string; nombre: string }[] => {
    const base = catalogoUAs.some((u) => u.clave !== "")
      ? catalogoUAs.filter((u) => u.clave !== "")
      : getUAsForSecretaria(secretariaConfirmada)
          .map((ua) => ({ clave: getClaveForUA(secretariaConfirmada, ua), nombre: ua }))
          .filter((u) => u.clave !== "")
    if (claveUA && base.length > 0 && !base.some(u => u.clave === claveUA)) {
      return [{ clave: claveUA, nombre: claveUA }, ...base]
    }
    return base
  }, [catalogoUAs, secretariaConfirmada, claveUA])
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
      escolaridad: escolaridad.join("\n"),
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

  const seccionNom = useMemo(() => {
    const niv = nivelTabulador.trim().toUpperCase()
    const min = (niv === "105" || niv === "504") ? 7 : 5
    return {
      I:    !!(urgSeleccionada && programaInput && tipoActividadSeleccionado && numeroPrestadores && vigenciaInicio && vigenciaFin && importeNeto && nivelTabulador && categoriaTabulador && denominacion && puestoJefeInmediato),
      II:   !!(objetoNombramiento?.trim()),
      III:  funciones.filter(a => a.trim()).length >= min,
      IV:   responsabilidades.filter(r => r.trim()).length >= min,
      VIII: escolaridad.some(e => e.trim()) && compAdm.some(c => c.trim()) && compTec.some(c => c.trim()) && compSoc.some(c => c.trim()) && valores.some(v => v.trim()) && areasExp.some(a => a.trim()),
    }
  }, [urgSeleccionada, programaInput, tipoActividadSeleccionado, numeroPrestadores, vigenciaInicio, vigenciaFin, importeNeto, nivelTabulador, categoriaTabulador, denominacion, puestoJefeInmediato, objetoNombramiento, funciones, responsabilidades, escolaridad, compAdm, compTec, compSoc, valores, areasExp])

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
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccionNom.I ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>I</span>
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
              <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#ccc] bg-muted/40 px-4 py-3 min-h-[44px]">
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
                maxLength={200}
                className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                readOnly={bloqueadoPorRenovacion}
                disabled={!bloqueadoPorRenovacion && !camposDependientesHabilitados}
              />
              {!bloqueadoPorRenovacion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <img src="/iconos2/Icon.svg" alt="" className="h-3 w-3 shrink-0" />Puede Obtenerse desde el Oficio de Suficiencia Presupuestal.
                </p>
              )}
            </div>

            {/* Régimen de Contratación — readonly, valor del paso 1 */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Régimen de Contratación
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#ccc] bg-muted/40 px-4 py-3 min-h-[44px]">
                <span className="text-sm text-muted-foreground">
                  {regimenPeriodo === "honorarios"    ? "Honorarios"
                  : regimenPeriodo === "asimilados"   ? "Honorarios asimilados a Salarios"
                  : regimenPeriodo === "nombramiento" ? "Nombramiento por Tiempo Determinado"
                  : regimenPeriodo || "—"}
                </span>
              </div>
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
                  maxLength={200}
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
                  maxLength={200}
                  className={`${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Tipo de Actividad
                </Label>
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
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Número de Personas a Contratar
                </Label>
                <Input
                  type="number" min={1} max={9999}
                  inputMode="numeric"
                  value={numeroPrestadores}
                  onChange={(e) => setNumeroPrestadores(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab"].includes(e.key)) e.preventDefault() }}
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

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Importe Neto
                {bloqueadoPorRenovacion && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text" value={importeNeto}
                  onChange={(e) => { if (!bloqueadoPorRenovacion) setImporteNeto(e.target.value.replace(/[^0-9.,]/g, "")) }}
                  onKeyDown={(e) => { if (!/[0-9.,]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab","Home","End"].includes(e.key)) e.preventDefault() }}
                  onBlur={(e) => { if (!bloqueadoPorRenovacion) setImporteNeto(parseImporteBruto(e.target.value)) }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`ns-ds-field pl-7 ${bloqueadoPorRenovacion ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                  readOnly={bloqueadoPorRenovacion}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Vigencia
                {bloqueadoPorRenovacion && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary ml-1">Editable</Badge>}
              </Label>
              {(() => {
                const periodoVigMin = dmyToIso(periodoFechaInicio)
                const periodoVigMax = dmyToIso(periodoFechaFin)
                const vigMin = periodoVigMin || undefined
                const vigMax = periodoVigMax || undefined
                const efectivoMin = vigMin || vigenciaInicio || ""
                const inicioError = !!vigenciaInicio && !!vigMin && vigenciaInicio < vigMin
                const finError    = !!vigenciaFin    && !!vigMax && vigenciaFin    > vigMax
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Inicio</span>
                      <DatePickerHabil
                        value={isoToDate(vigenciaInicio)}
                        fromDate={vigMin ? isoToDate(vigMin) : undefined}
                        toDate={vigMax ? isoToDate(vigMax) : undefined}
                        startMonth={isoToDate(vigenciaInicio || efectivoMin)}
                        onChange={(d) => d && setVigenciaInicio(dateToIso(d))}
                        placeholder="Seleccionar inicio"
                        className={inicioError ? "border-destructive" : ""}
                      />
                      {inicioError && (
                        <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />Fecha anterior al inicio del periodo.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Término</span>
                      <DatePickerHabil
                        value={isoToDate(vigenciaFin)}
                        fromDate={isoToDate(vigenciaInicio || efectivoMin)}
                        toDate={vigMax ? isoToDate(vigMax) : undefined}
                        startMonth={isoToDate(vigenciaFin || vigenciaInicio || efectivoMin)}
                        onChange={(d) => d && setVigenciaFin(dateToIso(d))}
                        placeholder="Seleccionar término"
                        className={finError ? "border-destructive" : ""}
                      />
                      {finError && (
                        <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />Fecha posterior al fin del periodo.</p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <OficioUpload vigenciaInicio={vigenciaInicio} onFilesChange={onArchivoChange} existingFiles={existingAdjuntos} />
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
        initialNivel={nivelTabulador || undefined}
        initialCategoria={categoriaTabulador || undefined}
      />
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccionNom.II ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>II</span>
            Objeto del Nombramiento
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 text-[#9ca3af] hover:text-[#7B2D5E] transition-colors" title="Ver fórmula de llenado">
              <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4" />
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
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccionNom.III ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>III</span>
            Actividades a Realizar
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <button type="button" onClick={() => setShowFormulaModal(true)} className="ml-1 text-[#9ca3af] hover:text-[#7B2D5E] transition-colors" title="Ver fórmula de llenado">
              <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4" />
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
            max={10}
            forbiddenTexts={forbiddenTextsNom.funciones}
          />
        </CardContent>
      </Card>
      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccionNom.IV ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>IV</span>
            Responsabilidades
            {bloqueadoPorRenovacion && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 flex flex-col gap-2">
          <DynamicList
            label="" items={responsabilidades}
            onChange={(newItems) => {
              setResponsabilidades(newItems)
            }}
            readonly={bloqueadoPorRenovacion}
            minRequired={funciones.length}
            matchCountLabel
            max={10}
            forbiddenTexts={forbiddenTextsNom.responsabilidades}
          />
          <div className="flex flex-col items-start gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 text-sm font-medium text-[#2563EB]">
              <Megaphone className="h-3.5 w-3.5" />Las responsabilidades deberán ser congruentes con las actividades registradas
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="px-4 pt-3 pb-1">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            V. Marco Normativo
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary ml-1">Siempre editable</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <Textarea
            value={marcoNormativo.join("\n")}
            onChange={(e) => handleMarcoNormativoChange(e.target.value.split("\n"))}
            placeholder="Describa el marco normativo aplicable..."
            className="min-h-24 bg-background"
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
          {/* ── Condiciones de Trabajo ── */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Condiciones de Trabajo</Label>
            <div className="overflow-x-auto overflow-hidden rounded-[8px] border border-[#E5E7EB]">
              <table className="w-full table-fixed text-sm conditions-table">
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-2.5 text-left font-medium text-card-foreground">Condición</th>
                    <th className="py-2.5 font-medium">Sí</th>
                    <th className="py-2.5 font-medium">No</th>
                  </tr>
                </thead>
                <tbody>
                  {["Cambio de domicilio", "Horario especial", "Viajar"].map((c) => {
                    const key = c.toLowerCase().replace(/\s+/g, "-")
                    return (
                      <tr key={c} className="border-t border-border">
                        <td className="px-4 py-2.5 text-card-foreground">{c}</td>
                        {["si", "no"].map((opt) => (
                          <td key={opt} className="py-2.5">
                            <button
                              type="button"
                              onClick={() => setCondiciones(prev => ({ ...prev, [key]: opt }))}
                              aria-label={`${c}: ${opt === "si" ? "Sí" : "No"}`}
                              className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-2 transition-colors ${
                                condiciones[key] === opt
                                  ? "border-[#7B2D5E] bg-[#7B2D5E]"
                                  : "border-[#ccc] bg-white hover:border-[#7B2D5E]"
                              }`}
                            >
                              {condiciones[key] === opt && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Tabla de Riesgos ── */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Tabla de Riesgos</Label>
            <div className="overflow-x-auto overflow-hidden rounded-[8px] border border-[#E5E7EB]">
              <table className="w-full table-fixed text-sm conditions-table">
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "16.67%" }} />
                  <col style={{ width: "16.67%" }} />
                  <col style={{ width: "16.67%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Riesgo</th>
                    <th className="py-2.5 font-medium">Bajo</th>
                    <th className="py-2.5 font-medium">Medio</th>
                    <th className="py-2.5 font-medium">Alto</th>
                  </tr>
                </thead>
                <tbody>
                  {["Caídas", "Mutilaciones", "Golpes", "Otros"].map((r) => {
                    const key = r.toLowerCase()
                    return (
                      <tr key={r} className="border-t border-border">
                        <td className="px-4 py-2.5 text-card-foreground">{r}</td>
                        {["Bajo", "Medio", "Alto"].map((nivel) => (
                          <td key={nivel} className="py-2.5">
                            <button
                              type="button"
                              onClick={() => setRiesgos(prev => ({ ...prev, [key]: nivel }))}
                              aria-label={`${r}: ${nivel}`}
                              className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-2 transition-colors ${
                                riesgos[key] === nivel
                                  ? "border-[#7B2D5E] bg-[#7B2D5E]"
                                  : "border-[#ccc] bg-white hover:border-[#7B2D5E]"
                              }`}
                            >
                              {riesgos[key] === nivel && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
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
            <img src="/iconos2/Icon.svg" alt="" className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
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
            <span className={`flex h-7 w-7 items-center justify-center rounded ${seccionNom.VIII ? "bg-[#7B2D5E]" : "bg-primary"} text-xs font-bold text-primary-foreground`}>VIII</span>
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
              onBlurItem={applyTextRules}
              readonly={bloqueadoPorRenovacion}
              minRequired={1}
              max={1}
            />
          </div>
          {([
            { sub: "VIII.1", label: "Competencias Administrativas", items: compAdm,  setter: setCompAdm,  fKey: "compAdm"  as const },
            { sub: "VIII.2", label: "Competencias Técnicas",        items: compTec,  setter: setCompTec,  fKey: "compTec"  as const },
            { sub: "VIII.3", label: "Competencias Sociales",        items: compSoc,  setter: setCompSoc,  fKey: "compSoc"  as const },
            { sub: null,     label: "Áreas de Experiencia",         items: areasExp, setter: setAreasExp, fKey: "areasExp" as const },
            { sub: null,     label: "Valores",                      items: valores,  setter: setValores,  fKey: "valores"  as const },
          ] as const).map(({ sub, label, items, setter, fKey }) => (
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
                onChange={(newItems) => {
                  setter(newItems)
                }}
                readonly={bloqueadoPorRenovacion}
                minRequired={funciones.length}
                matchCountLabel
                max={10}
                forbiddenTexts={forbiddenTextsNom[fKey]}
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
               >Registrar Otra</Button>
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
        <Button variant="outline" onClick={onBack} className="border" style={{ backgroundColor: "#fce4f0", color: "#7c2d5e", borderColor: "#f0b0d0" }}><ArrowLeft className="mr-1.5 h-4 w-4" />Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
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
  const checkMinArray = (val: string[] | undefined, label: string, min: number) => {
    const count = (val ?? []).filter(v => v.trim()).length
    if (count < min) faltantes.push(`${label} (llevas ${count}, se requieren al menos ${min})`)
  }
  const checkMinStr = (val: string | undefined, label: string, min: number) => {
    const items = (val ?? "").split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)
    if (items.length < min) faltantes.push(`${label} (llevas ${items.length}, se requieren al menos ${min})`)
  }

  const niv = (formData.nivelTabulador ?? "").trim().toUpperCase()
  const minActResp = (niv === "105" || niv === "504") ? 7 : 5

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
  checkMinArray(formData.actividades,       "Actividades",       minActResp)
  checkMinArray(formData.responsabilidades, "Responsabilidades", minActResp)
  checkMinStr(formData.escolaridad, "Escolaridad",                1)
  checkMinStr(formData.compAdm,     "Competencias Administrativas", 3)
  checkMinStr(formData.compTec,     "Competencias Técnicas",        3)
  checkMinStr(formData.compSoc,     "Competencias Sociales",        3)
  checkMinStr(formData.valores,     "Valores",                     3)
  checkMinStr(formData.areasExp,    "Áreas de Experiencia",        3)
  if (tipo === "prestacion") {
    check(formData.regimen,         "Régimen de Contratación")
    check(formData.tipoActividades, "Tipo de Actividad")
  } else if (tipo === "nombramiento") {
    check(formData.denominacion,        "Denominación del Nombramiento")
    check(formData.puestoJefeInmediato, "Puesto del Jefe Inmediato")
    check(formData.numeroPrestadores,   "Número de Personas a Contratar")
  }
  return faltantes
}
const MESES_LOWER_BUILD = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
const MESES_CALENDAR    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function resolverPeriodoLabel(periodo: string, regimen: string, vigenciaFin?: string): string {
  if (!periodo) return ""
  if (!/^\d{1,2}\/\d{4}$/.test(periodo)) return periodo
  const mesNum = parseInt(periodo.split("/")[0], 10)
  const mesNombre = MESES_CALENDAR[mesNum - 1] ?? ""
  if (regimen === "honorarios") return mesNombre
  const dayStr = (vigenciaFin ?? "").split("-")[2] ?? ""
  const day = parseInt(dayStr, 10)
  const quincena = day > 0 && day <= 15 ? "1ra" : "2da"
  return `${quincena} ${mesNombre}`
}

function periodoNombreAMes(nombre: string): number | null {
  const lower = (nombre ?? "").toLowerCase()
  for (let i = 0; i < MESES_LOWER_BUILD.length; i++) {
    if (lower.includes(MESES_LOWER_BUILD[i])) return i + 1
  }
  return null
}

function buildSolicitudPayload({
  usuarioId, tipo, regimenPeriodo, periodoNombre, esExtemporanea, esRenovacion, folioSeleccionado, formData, tipoAdministracion,
}: {
  usuarioId: string; tipo: TipoSolicitud; regimenPeriodo: string; periodoNombre: string; esExtemporanea: boolean
  esRenovacion: string; folioSeleccionado: string; formData: Partial<FormularioData>; tipoAdministracion?: string
}) {
  const periodoMesResuelto = periodoNombreAMes(periodoNombre)
  return {
    usuarioId,
    tipo_administracion: tipoAdministracion ?? "centralizada",
    tipo_solicitud: tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
    ...(periodoMesResuelto !== null ? { periodoMes: periodoMesResuelto, periodoAnio: new Date().getFullYear() } : {}),
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

const DIFF_LIST_KEYS = new Set<keyof FormularioData>([
  "escolaridad", "compAdm", "compSoc", "valores", "compTec", "areasExp",
  "actividades", "responsabilidades",
])

function toItems(v: unknown, key: keyof FormularioData): string[] {
  if (v === null || v === undefined || v === "") return []
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean)
  if (DIFF_LIST_KEYS.has(key)) return String(v).split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)
  return []
}

function computeDiff(
  oldData: Partial<FormularioData>,
  newData: Partial<FormularioData>,
): { campo: string; de: string; a: string }[] {
  const LABELS: [keyof FormularioData, string][] = [
    ["secretaria",            "Secretaría"],
    ["unidadAdministrativa",  "Unidad Administrativa"],
    ["unidadResponsable",     "Unidad Responsable"],
    ["programaProyecto",      "Programa/Proyecto"],
    ["denominacion",          "Denominación"],
    ["puestoJefeInmediato",   "Puesto Jefe Inmediato"],
    ["numeroPrestadores",     "No. de Prestadores"],
    ["tipoActividades",       "Tipo de Actividades"],
    ["vigenciaInicio",        "Vigencia de Inicio"],
    ["vigenciaFin",           "Vigencia de Término"],
    ["importeBruto",          "Importe Bruto"],
    ["tipoImporte",           "Tipo de Importe"],
    ["nivelTabulador",        "Nivel Tabulador"],
    ["categoriaTabulador",    "Categoría Tabulador"],
    ["objeto",                "Objeto"],
    ["actividades",           "Actividades"],
    ["responsabilidades",     "Responsabilidades"],
    ["escolaridad",           "Escolaridad Mínima"],
    ["compAdm",               "Competencias Administrativas"],
    ["compSoc",               "Competencias Sociales"],
    ["valores",               "Valores"],
    ["compTec",               "Competencias Técnicas"],
    ["areasExp",              "Áreas de Experiencia"],
  ]

  const toActivitySlug = (v: unknown): string =>
    String(v).toLowerCase().replace(/\s+/g, "_").replace(/[()\/,]/g, "").trim()

  const cmp = (v: unknown, key: keyof FormularioData): string => {
    if (v === null || v === undefined || v === "") return ""
    if (key === "importeBruto") {
      const n = parseFloat(String(v).replace(/[$,\s]/g, ""))
      return isNaN(n) ? "" : n.toFixed(2)
    }
    if (key === "tipoActividades") return toActivitySlug(v)
    if (DIFF_LIST_KEYS.has(key)) return toItems(v, key).sort().join("\n")
    return String(v).trim()
  }

  return LABELS.flatMap(([key, label]) => {
    const oldCmp = cmp(oldData[key], key)
    const newCmp = cmp(newData[key], key)
    if (oldCmp === newCmp) return []

    if (DIFF_LIST_KEYS.has(key)) {
      const oldItems = toItems(oldData[key], key)
      const newItems = toItems(newData[key], key)
      return [{ campo: label, de: oldItems.join("\n") || "—", a: newItems.join("\n") || "—" }]
    }

    const fmt = (v: unknown): string => {
      if (v === null || v === undefined || v === "") return "—"
      const s = String(v).trim()
      if (!s) return "—"
      if (key === "importeBruto") {
        const n = parseFloat(s.replace(/[$,\s]/g, ""))
        return isNaN(n) ? s : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
      }
      if (key === "tipoActividades") {
        return TIPO_ACTIVIDAD_LABELS[toActivitySlug(s)] ?? s
      }
      return s
    }
    return [{ campo: label, de: fmt(oldData[key]), a: fmt(newData[key]) }]
  })
}

function ordinalRegreso(n: number): string {
  if (n === 1) return "1er Regreso"
  if (n === 2) return "2do Regreso"
  if (n === 3) return "3er Regreso"
  return `${n}° Regreso`
}


export type EditSolicitudPayload = {
  id: string
  tipo: TipoSolicitud
  regimen: "" | "honorarios" | "asimilados" | "nombramiento"
  periodo: string
  formData: Partial<FormularioData>
  estado?: string
  folio?: string
  observacionMotivo?: string
  reingresoCount?: number
  isCapturadorCorrection?: boolean
  estadoSiguienteTrasSave?: string
  adjuntos?: { id: number; nombre_archivo: string; ruta: string }[]
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
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[]>([])
  const [excelUploading, setExcelUploading] = useState(false)
  const [excelError,     setExcelError]     = useState<string | null>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

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
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(
    resolverPeriodoLabel(editSolicitud?.periodo ?? "", editSolicitud?.regimen ?? "", editSolicitud?.formData?.vigenciaFin)
  )
  useEffect(() => {
    if (regimenPeriodo === "nombramiento") setTipo("nombramiento")
    else if (regimenPeriodo === "honorarios" || regimenPeriodo === "asimilados") setTipo("prestacion")
  }, [regimenPeriodo])
  const { historicos, uploadHistorico, removeHistorico } = useHistoricoStore()
  const excelRows = useExcelRows(historicos)
  const handleExcelUpload = useCallback(async (file: File) => {
    setExcelUploading(true)
    setExcelError(null)
    try { await uploadHistorico(file) }
    catch (e) { setExcelError(e instanceof Error ? e.message : "Error al cargar el archivo") }
    finally { setExcelUploading(false) }
  }, [uploadHistorico])
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
            const fmt = (d: any) => { if (!d) return ""; const dt = new Date(d); return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10) }
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

  const periodoFechaInicioEffective = useMemo(() => {
    if (!periodoInfo?.row) return undefined
    if (periodoInfo.row.fechaInicio) return periodoInfo.row.fechaInicio
    const fechaFin = periodoInfo.row.fechaFin
    if (!fechaFin) return undefined
    const [, m, y] = fechaFin.split("/").map(Number)
    const label = regimenPeriodo === "honorarios"
      ? (periodoInfo.row as PeriodoCap3000).mes
      : (periodoInfo.row as PeriodoCap1000).quincena
    const startDay = label?.startsWith("2da") ? 16 : 1
    return `${String(startDay).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
  }, [periodoInfo, regimenPeriodo])

  const periodoVigenciaRange = useMemo(() => {
    const do_ = periodoInfo?.row?.limiteDO
    const dgrh = periodoInfo?.row?.limiteDGRH
    if (!do_ || !dgrh) return { min: undefined, max: undefined }
    const dateA = parseDateDMY(do_)
    const dateB = parseDateDMY(dgrh)
    const earlier = dateA <= dateB ? do_ : dgrh
    const later   = dateA <= dateB ? dgrh : do_
    return { min: earlier, max: later }
  }, [periodoInfo])

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
    if (puedeAvanzarDeTipo) {
      setDatosRenovacion(null)
      setPrefilled(false)
      setLockVigenciaOnly(false)
      setStep("formulario")
    }
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
    if (step === "formulario") setStep("tipo")
  }, [step, editSolicitud, onCancel])

  const folioSeleccionadoData = folioSeleccionado
    ? foliosReales.find((f) => f.id === folioSeleccionado) : null
  const handleGuardarBorrador = useCallback(async () => {
    setGuardandoBorrador(true)
    setErrorBorrador(null)
    try {
      if (esRenovacion !== "si") {
        const effectiveFormData = editSolicitud?.formData
          ? { ...editSolicitud.formData, ...formData }
          : formData
        const faltantes = validarCamposCompletos(effectiveFormData, tipo)
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
        const historialDiff = editSolicitud.formData ? computeDiff(editSolicitud.formData, formData) : []
        const res = await fetch("/api/solicitudes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitudId: Number(editSolicitud.id), ...campos, ...(historialDiff.length > 0 ? { historialDiff } : {}) }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) { setErrorBorrador(json.error ?? "Error al actualizar el borrador."); setGuardandoBorrador(false); return }
        setFolioBorradorGuardado(json.data?.folio_justificacion ?? editSolicitud.id)
        const estadoOrig = (editSolicitud.estado ?? "").toLowerCase()
        const nuevoEstadoTrasCorreccion = (() => {
          if (editSolicitud.estadoSiguienteTrasSave) return editSolicitud.estadoSiguienteTrasSave
          if (!editSolicitud.isCapturadorCorrection) return null
          if (estadoOrig.includes("observad") || estadoOrig.includes("devuelta por do") || estadoOrig.includes("dgdo")) {
            return "En Validacion Justificaciones"
          }
          return null
        })()
        if (nuevoEstadoTrasCorreccion) {
          const vRes = await fetch("/api/validacion", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              solicitudId: Number(editSolicitud.id),
              nuevoEstado: nuevoEstadoTrasCorreccion,
              usuarioId,
              comentario: "Correcciones aplicadas y reenviado a revisión por el capturista",
            }),
          })
          if (!vRes.ok) {
            const vJson = await vRes.json().catch(() => ({}))
            setErrorBorrador(vJson.error ?? "Error al actualizar el estado de la solicitud.")
            setGuardandoBorrador(false)
            return
          }
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
          const historialDiff = editSolicitud.formData ? computeDiff(editSolicitud.formData, formData) : []
          const res = await fetch("/api/solicitudes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ solicitudId: Number(editSolicitud.id), ...campos, ...(historialDiff.length > 0 ? { historialDiff } : {}) }),
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

        if (archivosAdjuntos.length > 0 && solicitudId) {
          try {
            await Promise.all(archivosAdjuntos.map((file) => {
              const fd = new FormData()
              fd.append("file", file)
              fd.append("solicitudId", String(solicitudId))
              return fetch("/api/adjunto", { method: "POST", body: fd })
            }))
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
    [user, regimenPeriodo, periodoSeleccionado, consumirPermiso, tipo, formData, archivosAdjuntos, esRenovacion, folioSeleccionado, editSolicitud]
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
      <>
        <ConfirmToast
          variant="success"
          title="Solicitud enviada a validación"
          description="La solicitud fue enviada exitosamente."
        />
        <div className="flex items-center justify-center min-h-[400px] w-full px-4 py-8">
          <div className="border border-[#E5E7EB] rounded-xl py-12 px-8 text-center w-full max-w-[600px]">
            <div className="flex items-center justify-center mx-auto mb-5"
              style={{ width: 48, height: 48, borderRadius: 12, background: "#d2fad2" }}>
              <CheckCircle2 style={{ width: 24, height: 24, color: "#1c7d29" }} />
            </div>
            <p className="text-lg font-bold mb-2">Solicitud enviada a validación</p>
            <p className="text-sm text-[#6B7280] mb-6">
              La solicitud fue enviada exitosamente. Puede seguir su seguimiento en Validación Justificación.
            </p>
            {folioGenerado && (
              <div className="flex justify-center mb-6">
                <span className="text-sm rounded-full px-4 py-1.5 bg-[#F3F4F6]">
                  Folio: {folioGenerado}
                </span>
              </div>
            )}
            <Button onClick={handleReset} className="rounded-full bg-white border-[1.5px] border-[#ccc] text-foreground hover:bg-gray-50 shadow-none">
              <FilePlus className="mr-1.5 h-4 w-4" />Nueva Solicitud
            </Button>
          </div>
        </div>
      </>
    )
  }
  if (borradorGuardado) {
    const esEdicion = !!editSolicitud?.id
    return (
      <>
        <ConfirmToast
          variant="success"
          title={esEdicion ? "Cambios guardados correctamente" : "Borrador guardado correctamente"}
          description={esEdicion ? "Los cambios han sido guardados." : "Puede continuar desde Mis Solicitudes → Borradores."}
        />
        <div className="flex items-center justify-center min-h-[400px] w-full px-4 py-8">
          <div className="border border-[#E5E7EB] rounded-xl py-12 px-8 text-center w-full max-w-[600px]">
            <div className="flex items-center justify-center mx-auto mb-5"
              style={{ width: 48, height: 48, borderRadius: 12, background: "#d2fad2" }}>
              <CheckCircle2 style={{ width: 24, height: 24, color: "#1c7d29" }} />
            </div>
            <p className="text-lg font-bold mb-2">
              {esEdicion ? "Cambios guardados correctamente" : "Borrador guardado correctamente"}
            </p>
            <p className="text-sm text-[#6B7280] mb-6">
              {esEdicion
                ? "Los cambios han sido guardados. Puede cerrar esta pantalla."
                : "Puede continuar la captura desde \"Mis Solicitudes\" → pestaña \"Borradores\"."}
            </p>
            {folioBorradorGuardado && (
              <div className="flex justify-center mb-6">
                <span className="text-sm rounded-full px-4 py-1.5 bg-[#F3F4F6]">
                  Folio: {folioBorradorGuardado}
                </span>
              </div>
            )}
            {!esEdicion && (
              <Button onClick={handleReset} className="rounded-full bg-white border-[1.5px] border-[#ccc] text-foreground hover:bg-gray-50 shadow-none">
                <FilePlus className="mr-1.5 h-4 w-4" />Nueva Solicitud
              </Button>
            )}
          </div>
        </div>
      </>
    )
  }
  if (errorEnvio && !enviando) {
    return (
      <>
        <ConfirmToast
          variant="error"
          title="La solicitud no se ha podido enviar"
          description={errorEnvio}
        />
        <div className="flex items-center justify-center min-h-[400px] w-full px-4 py-8">
          <div className="border border-[#E5E7EB] rounded-xl py-12 px-8 text-center w-full max-w-[600px]">
            <div className="flex items-center justify-center mx-auto mb-5"
              style={{ width: 48, height: 48, borderRadius: 12, background: "#FEE2E2" }}>
              <FileText style={{ width: 24, height: 24, color: "#DC2626" }} />
            </div>
            <p className="text-lg font-bold mb-2">La solicitud no se ha podido enviar</p>
            <p className="text-sm text-[#6B7280] mb-6">{errorEnvio}</p>
            <Button onClick={() => setErrorEnvio(null)} className="rounded-full bg-white border-[1.5px] border-[#ccc] text-foreground hover:bg-gray-50 shadow-none">
              Volver a la solicitud
            </Button>
          </div>
        </div>
      </>
    )
  }
  const isEditMode = !!editSolicitud?.id
  return (
    <div className="ns-select">
    <PageLayout
      title={isEditMode ? "Modificación de Solicitud" : "Nueva solicitud"}
      description={isEditMode
        ? "Revise y corrija los datos conforme a las observaciones recibidas antes de reenviar."
        : "Inicia el registro de una solicitud para su análisis y emisión de dictamen u opinión técnica funcional."}
    >
      {!isEditMode && (
        <div className="py-2 -mx-4 px-4 -mt-3 mb-1">
          <div className="max-w-4xl mx-auto w-full flex justify-center">
            <StepIndicator step={step} tipo={tipo} />
          </div>
        </div>
      )}


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
            <div className="flex items-start gap-3 rounded-[8px] border-l-4 border-l-[#EF4444] bg-[#FFF5F5] px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626] mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[#DC2626]">Calendario de Recepción Incompleto</span>
                <span className="text-sm text-[#374151]">
                  Para continuar con el registro es necesario contar con las fechas de los <strong>3 Regímenes</strong> (Honorarios, Asimilados y Nombramiento). <strong>Todos los Meses/Quincenas</strong> deben tener fecha configurada.
                </span>
              </div>
            </div>
          )}
                <Card className={`shadow-sm border-secondary/30 border-2 ${!calendarioCompleto ? "opacity-50 pointer-events-none" : ""}`}>
              <CardHeader className="px-4 pt-3 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              Período de Aplicación
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
                      <span className="text-xs text-muted-foreground">Fecha límite de recepción de solicitudes de dictamen/opiniones técnicas funcionales (DGDO) </span>
                      <span className="text-sm font-semibold text-card-foreground">{periodoInfo.row.limiteDO}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Fecha límite de recepción de solicitudes de alta de contrataciones (DGRH) </span>
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
            <CardContent className="flex justify-end px-4 pb-3 pt-2">
              <Button onClick={handleContinueToRenovacion} disabled={!puedeAvanzarDeTipo}
                className="disabled:opacity-50"
                style={{ backgroundColor: "#7b2d5e", color: "#fff" }}>
                Continuar<ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
      {false && (
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
                  <input
                    ref={excelInputRef} type="file" accept=".xlsx" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await handleExcelUpload(f); e.target.value = "" } }}
                  />
                  {historicos.length > 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-secondary/30 bg-secondary/5 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-secondary" />
                      <span className="text-xs text-secondary flex-1 truncate">{historicos[historicos.length - 1].nombreArchivo}</span>
                      <button
                        type="button"
                        onClick={() => removeHistorico(historicos[historicos.length - 1].id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {excelRows.length === 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => excelInputRef.current?.click()}
                        disabled={excelUploading}
                        className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-3 hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer w-full text-left"
                      >
                        {excelUploading
                          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                          : <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="text-sm text-muted-foreground">
                          {excelUploading ? "Cargando..." : "Cargar Excel histórico (.xlsx)"}
                        </span>
                      </button>
                      {excelError && <p className="text-xs text-destructive">{excelError}</p>}
                    </div>
                  ) : !hayFoliosReales ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
                      <img src="/iconos2/Icon.svg" alt="" className="h-4 w-4 shrink-0 opacity-50" />
                      <span className="text-sm text-muted-foreground">No se encontraron folios de dictamenes</span>
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
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModalMismasCondiciones(false)} />

                        {/* Modal — DS Cuadro de Diálogo */}
                        <div className="relative z-10 w-full bg-white flex flex-col overflow-hidden"
                          style={{ maxWidth: 480, borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>

                          {/* ── Header ── */}
                          <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4"
                            style={{ borderBottom: "1px solid #E5E7EB" }}>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full"
                              style={{ backgroundColor: "#F3E8F0", border: "1px solid #E8D0E0" }}>
                              <img src="/iconos2/Icon.svg" alt="" className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center">
                              <span className="text-base font-bold text-[#111827]">¿Confirmar mismas condiciones?</span>
                              <span className="text-sm text-[#6B7280]">Esta acción bloqueará los campos del formulario</span>
                            </div>
                          </div>

                          {/* ── Cuerpo ── */}
                          <div className="flex flex-col gap-3 px-6 py-6">
                            <p className="text-sm text-center text-[#374151]">
                              a) La persona Titular de la Unidad de Enlace Financiero Administrativo se compromete a que la justificación cuente con las mismas condiciones técnico funcionales.
                            </p>
                            <p className="text-sm text-center text-[#374151]">
                              b) La Dirección General de Desarrollo Organizacional emitirá la dictaminación correspondiente a la presente Justificación.
                            </p>
                            <div className="flex flex-col gap-2 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                                Campos editables en renovación
                              </span>
                              <ul className="flex flex-col gap-1.5">
                                <li className="flex items-center gap-2 text-sm text-[#374151]">
                                  <img src="/iconos2/calender-alt-1.svg" alt="" className="h-3.5 w-3.5 shrink-0 opacity-60" />Vigencia
                                </li>
                                <li className="flex items-center gap-2 text-sm text-[#374151]">
                                  <FileText className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />Oficio de Suficiencia
                                </li>
                                <li className="flex items-center gap-2 text-sm text-[#374151]">
                                  <ClipboardList className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />Número de Prestadores de Servicios
                                </li>
                              </ul>
                            </div>
                          </div>

                          {/* ── Footer ── */}
                          <div className="flex items-center justify-center gap-3 px-6 py-4"
                            style={{ borderTop: "1px solid #E5E7EB" }}>
                            <button
                              type="button"
                              onClick={() => setShowModalMismasCondiciones(false)}
                              style={{
                                border: "1.5px solid #ccc",
                                borderRadius: 9999,
                                background: "white",
                                padding: "10px 24px",
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#374151",
                                cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setCondicionRenovacion("mismas"); setShowModalMismasCondiciones(false) }}
                              style={{
                                border: "none",
                                borderRadius: 9999,
                                background: "#2D3B2D",
                                padding: "10px 24px",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "white",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Sí, confirmar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBack} className="rounded-full border-gray-300 text-gray-700 hover:bg-gray-100 bg-transparent"><ArrowLeft className="mr-1.5 h-4 w-4" />Anterior</Button>
              <Button
                onClick={handleContinueToFormulario}
                disabled={
                  !esRenovacion ||
                  (esRenovacion === "si" && !folioSeleccionado) ||
                  (esRenovacion === "si" && folioSeleccionado && condicionRenovacion !== "mismas")
                }
                style={{ backgroundColor: "#7b2d5e", color: "#fff" }}
              >
                Continuar<ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


   {step === "formulario" && (
     <>
       {isEditMode ? null : (
         <div className="flex flex-col gap-2">
           <div>
             <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5 rounded-full border-gray-300 text-gray-700 hover:bg-gray-100 bg-transparent">
               <ArrowLeft className="h-4 w-4" />Anterior
             </Button>
             {prefilled && datosRenovacion && (
               <Badge variant="outline" className="border-secondary text-secondary gap-1">
                 <Lock className="h-3 w-3" />Renovación
               </Badge>
             )}
           </div>
         </div>
       )}

          {tipo === "prestacion" ? (
            <FormularioPrestacion
              prefilled={prefilled}
              lockVigenciaOnly={lockVigenciaOnly}
              regimenPeriodo={regimenPeriodo}
              excelRows={excelRows}
              esRenovacion={esRenovacion === "si"}
              datosRenovacion={datosRenovacion}
              onFormChange={handleFormChange}
              onArchivoChange={setArchivosAdjuntos}
              secretariaFija={userSecretariaOriginal}
              unidadFija={userUAOriginal}
              claveReportePlazas={userClaveReporte}
              catalogoUAs={catalogoUAsDelUsuario}
              initialData={editSolicitud?.formData}
              existingAdjuntos={editSolicitud?.adjuntos}
              periodoFechaInicio={periodoVigenciaRange.min}
              periodoFechaFin={periodoVigenciaRange.max}
            />
          ) : (
            <FormularioNombramiento
              prefilled={prefilled}
              esRenovacion={esRenovacion === "si"}
              excelRows={excelRows}
              datosRenovacion={datosRenovacion}
              onFormChange={handleFormChange}
              onArchivoChange={setArchivosAdjuntos}
              secretariaFija={userSecretariaOriginal}
              unidadFija={userUAOriginal}
              claveReportePlazas={userClaveReporte}
              catalogoUAs={catalogoUAsDelUsuario}
              tipoAdministracionUsuario={editSolicitud?.formData?.tipoAdministracionNom ?? user?.tipoAdministracion ?? "centralizada"}
              initialData={editSolicitud?.formData}
              existingAdjuntos={editSolicitud?.adjuntos}
              periodoFechaInicio={periodoVigenciaRange.min}
              periodoFechaFin={periodoVigenciaRange.max}
              regimenPeriodo={regimenPeriodo}
            />
          )}

          {(() => {
            const periodoStillValid = periodoInfo?.enTiempo ?? false
            const hasPermiso = !!permisoActivo
            const isEditingBorrador = !!editSolicitud?.id
            const _periodoMin = dmyToIso(periodoVigenciaRange.min)
            const _periodoMax = dmyToIso(periodoVigenciaRange.max)
            const _inicioOk = !!formData.vigenciaInicio &&
              (!_periodoMin || formData.vigenciaInicio >= _periodoMin) &&
              (!_periodoMax || formData.vigenciaInicio <= _periodoMax)
            const _finOk = !!formData.vigenciaFin &&
              (!_periodoMax || formData.vigenciaFin <= _periodoMax) &&
              (!formData.vigenciaInicio || formData.vigenciaFin >= formData.vigenciaInicio)
            const vigenciaOk = hasPermiso || isEditingBorrador
              ? !!(formData.vigenciaInicio) && !!(formData.vigenciaFin)
              : _inicioOk && _finOk
            const effectiveFormDataForValidation = editSolicitud?.formData
              ? { ...editSolicitud.formData, ...formData }
              : formData
            const camposFaltantes = esRenovacion !== "si" ? validarCamposCompletos(effectiveFormDataForValidation, tipo) : []
            const camposOk = camposFaltantes.length === 0
            const canSend = (periodoStillValid || hasPermiso || isEditingBorrador) && !enviando && !guardandoBorrador && vigenciaOk && camposOk

            return (
              <div className="flex flex-col gap-3">
                {errorBorrador && (
                  <div className="flex items-start gap-3 rounded-[8px] border-l-4 border-l-[#EF4444] bg-[#FFF5F5] px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626] mt-0.5" />
                    <span className="text-sm text-[#DC2626]">{errorBorrador}</span>
                  </div>
                )}
                {esRenovacion !== "si" && camposFaltantes.length > 0 && (
                  <div className="flex items-start gap-3 rounded-[8px] border-l-4 border-l-[#F5A800] bg-[#FFFBEB] px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#D97706] mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[#374151]">
                        Campos obligatorios pendientes ({camposFaltantes.length}):
                      </span>
                      <span className="text-xs text-[#6B7280]">
                        {camposFaltantes.join(" · ")}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <Button variant="outline" onClick={handleBack} disabled={enviando || guardandoBorrador} className="rounded-full border-gray-300 text-gray-700 hover:bg-gray-100 bg-transparent">
                    <ArrowLeft className="mr-1.5 h-4 w-4" />Anterior
                  </Button>
                  <div className="flex items-center gap-3">
                    {isEditingBorrador ? (
                      <Button className="min-w-[160px]"
                        disabled={guardandoBorrador || enviando} onClick={handleGuardarBorrador}
                        style={{ backgroundColor: "#7b2d5e", color: "#fff" }}>
                        {guardandoBorrador
                          ? <><Clock className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</>
                          : <><Save className="mr-1.5 h-4 w-4" />Guardar Cambios</>
                        }
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" disabled={guardandoBorrador || enviando} onClick={handleGuardarBorrador}
                          className="gap-1.5" style={{ backgroundColor: "#fce4f0", color: "#7c2d5e", borderColor: "#7b2d5e" }}>
                          {guardandoBorrador
                            ? <><Clock className="h-4 w-4 animate-spin" />Guardando...</>
                            : <><Save className="mr-1.5 h-4 w-4" />Guardar Borrador</>
                          }
                        </Button>
                        <Button className="min-w-[160px]"
                          disabled={!canSend} onClick={() => handleEnviarAValidacion(periodoStillValid, hasPermiso, isEditingBorrador)}
                          style={{ backgroundColor: "#7b2d5e", color: "#fff" }}>
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
    </div>
  )
}