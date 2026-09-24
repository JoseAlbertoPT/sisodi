import * as XLSX from "xlsx"
import type { PrismaClient } from "./generated/prisma"
import { buildRomanNumberedList } from "./roman-list"
import { contenidoParaCatalogo } from "./catalogo-contenido"

export const SHEET_NAME_LEGACY = "BASE CONSOLIDADA"
export const ADMIN_CORREO_DEFAULT = "admin@sisodij.gob.mx"
export const ESTADO_FINAL = "Emitido"
export const ESTADO_SIN_DICTAMEN = "En Revision Emisor"
export const ESTADO_BORRADOR = "Borrador"

export const COL_LEGACY = {
  folioJustificacion:     "FOLIO DE JUSTIFICACIÓN/DESCRIPCIÓN",
  fechaJustificacion:     "FECHA DE EMISION DE LA JUSTIFICACION/DESCRIPCION",
  folioDictamen:          "FOLIO DE DICTAMEN/OPINIÓN",
  fechaDictamen:          "FECHA DE EMISION DEL DICTAMEN/OPINION",
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
  actividades:             "ACTIVIDADES A REALIZAR POR EL PRESTADOR DE SERVICIOS",
  responsabilidades:       "RESPONSABILIDADES A CUMPLIR POR EL PRESTADOR DE SERVICIOS",
  escolaridad:             "ESCOLARIDAD MÍNIMA",
  compAdm:                 "COMPETENCIAS ADMINISTRATIVAS",
  compTec:                 "COMPETENCIAS TÉCNICAS",
  compSoc:                 "COMPETENCIAS SOCIALES",
  valores:                 "VALORES",
  areasExp:                "ÁREAS DE EXPERIENCIA",
} as const

export const MANUAL_OVERRIDES: Record<string, string> = {
  "JEFATURA DE LA OFICINA DE LA GOBERNATURA DEL ESTADO": "Jefatura de la Oficina de la Gubernatura del Estado",
  // Nombre corto ("Secretaria de Administracion", sin acentos ni "y Finanzas")
  // que usa el catálogo local estático de app/solicitudes/nueva/page.tsx y
  // components/pages/nueva-solicitud-page.tsx como clave/valor por default —
  // no coincide con el nombre oficial en organo_centralizado, así que sin
  // este alias "Programa o Proyecto" (SIGeF) se queda en configured:false.
  "SECRETARIA DE ADMINISTRACION": "Secretaría de Administración y Finanzas",
}

const HOJA_FIELD_MATCHERS: [string, (h: string) => boolean][] = [
  ["folioJustificacion",     (h) => h.includes("FOLIO") && h.includes("JUSTIFICACION") && !h.includes("DICTAMEN")],
  ["folioDictamen",          (h) => h.includes("FOLIO") && h.includes("DICTAMEN")],
  ["fechaJustificacion",     (h) => h.includes("FECHA") && h.includes("JUSTIFICACION")],
  ["fechaDictamen",          (h) => h.includes("FECHA") && h.includes("DICTAMEN")],
  ["secretaria",             (h) => h.includes("SECRETARIA")],
  ["unidadAdscripcion",      (h) => h.includes("ADSCRIPCION") || h.includes("ADCRIPCION")],
  ["unidadResponsableGasto", (h) => h.includes("GASTO")],
  ["programaProyecto",       (h) => h.includes("PROGRAMA") && h.includes("PROYECTO")],
  ["regimen",                (h) => h.includes("REGIMEN")],
  ["tipoActividad",          (h) => h.includes("TIPO DE ACTIVIDAD")],
  ["numPrestadores",         (h) => h.includes("PRESTADORES")],
  ["vigenciaInicio",         (h) => h.includes("VIGENCIA") && h.includes("INICIO")],
  ["vigenciaTermino",        (h) => h.includes("VIGENCIA") && h.includes("TERMINO")],
  ["tipoPago",               (h) => h.includes("TIPO DE PAGO")],
  ["importeBruto",           (h) => h.includes("IMPORTE")],
  ["nivelCategoria",         (h) => h.includes("NIVEL") && h.includes("CATEGORIA")],
  ["nivel",                  (h) => h.includes("NIVEL") && !h.includes("CATEGORIA")],
  ["categoria",              (h) => h.includes("CATEGORIA") && !h.includes("NIVEL")],
  ["objeto",                 (h) => h.includes("OBJETO")],
  ["actividades",            (h) => h.includes("ACTIVIDADES") && h.includes("REALIZAR")],
  ["responsabilidades",      (h) => h.includes("RESPONSABILIDADES") && h.includes("CUMPLIR")],
  ["escolaridad",            (h) => h.includes("ESCOLARIDAD")],
  ["compAdm",                (h) => h.includes("COMPETENCIAS") && h.includes("ADMINISTRATIVA")],
  ["compTec",                (h) => h.includes("COMPETENCIAS") && h.includes("TECNICA")],
  ["compSoc",                (h) => h.includes("COMPETENCIAS") && h.includes("SOCIAL")],
  ["valores",                (h) => h === "VALORES"],
  ["areasExp",               (h) => h.includes("AREAS") && h.includes("EXPERIENCIA")],
]

const COL_HOJAS: Record<string, string> = Object.fromEntries(
  HOJA_FIELD_MATCHERS.map(([field]) => [field, field])
)

function resolveHeaderMapHoja(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => norm(h ?? ""))
  const map: Record<string, string> = {}
  for (const [field, test] of HOJA_FIELD_MATCHERS) {
    const idx = normalized.findIndex((h) => h !== "" && test(h))
    if (idx >= 0) map[field] = headers[idx]
  }
  if (!map.folioJustificacion && normalized[0] === "") {
    map.folioJustificacion = headers[0]
  }
  return map
}

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g")
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(COMBINING_MARKS_RE, "")
    .toUpperCase().trim().replace(/\s+/g, " ")
}

function stripParenAcronym(s: string): string {
  return s.replace(/\([^)]*\)\s*$/, "").trim()
}

function parseFechaDMY(raw: string): { date: Date | null; error: string | null } {
  const s = (raw ?? "").trim()
  if (!s) return { date: null, error: null }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return { date: null, error: `formato irreconocible: "${s}"` }
  const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { date: null, error: `fecha inválida: "${s}"` }
  if (y < 2015 || y > 2035) return { date: null, error: `año fuera de rango razonable: "${s}"` }
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCMonth() !== mo - 1) return { date: null, error: `día fuera de rango para el mes: "${s}"` }
  return { date, error: null }
}

function parseImporte(raw: string): { value: number | null; error: string | null } {
  let s = (raw ?? "").trim()
  if (!s) return { value: null, error: null }
  s = s.replace(/^\$/, "").trim()
  const commaCount = (s.match(/,/g) ?? []).length
  const dotCount   = (s.match(/\./g) ?? []).length
  let normalized: string
  if (commaCount >= 2) {
    const parts = s.split(",")
    const dec = parts.pop()
    normalized = parts.join("") + "." + dec
  } else if (dotCount === 1 && commaCount === 1) {
    const idxComma = s.indexOf(",")
    const idxDot = s.indexOf(".")
    normalized = idxComma < idxDot
      ? s.replace(/,/g, "")
      : s.replace(/\./g, "").replace(",", ".")
  } else if (commaCount === 1) {
    normalized = s.replace(",", ".")
  } else {
    normalized = s
  }
  const value = parseFloat(normalized)
  if (isNaN(value)) return { value: null, error: `importe irreconocible: "${raw}"` }
  return { value, error: null }
}

function parseTipoPago(raw: string): string {
  const u = norm(raw)
  if (u.includes("POR HORA")) return "Por_hora"
  if (u.includes("POR DIA")) return "Por_dia"
  if (u.includes("POR TALLER")) return "Por_taller"
  if (u.includes("UNICO")) return "Unico"
  return "Mensual"
}

function parseListField(raw: string): string[] {
  const s = (raw ?? "").trim()
  if (!s) return []
  return s
    .split(/\r\n|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function normalizeRegimen(raw: string): string | null {
  const u = (raw ?? "").toUpperCase().trim()
  if (u.includes("ASIMILADO")) return "asimilados"
  if (u.includes("HONORARIO")) return "honorarios"
  if (u.includes("NOMBRAMIENTO") || u.includes("TIEMPO DETERMINADO")) return "nombramiento"
  return null
}

export function getCell(row: Record<string, unknown>, col: string | undefined): string {
  if (!col) return ""
  const v = row[col]
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ""
    const dd = String(v.getUTCDate()).padStart(2, "0")
    const mm = String(v.getUTCMonth() + 1).padStart(2, "0")
    return `${dd}/${mm}/${v.getUTCFullYear()}`
  }
  return (v ?? "").toString().trim()
}

function fechaDesdeCelda(
  row: Record<string, unknown>,
  col: string | undefined,
  parserTexto: (s: string) => { date: Date | null; error: string | null },
): { date: Date | null; error: string | null } {
  if (!col) return { date: null, error: null }
  const raw = row[col]
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { date: null, error: "fecha inválida" }
    const y = raw.getUTCFullYear(), mo = raw.getUTCMonth(), d = raw.getUTCDate()
    if (y < 2015 || y > 2035) return { date: null, error: `año fuera de rango razonable: "${y}-${mo + 1}-${d}"` }
    return { date: new Date(Date.UTC(y, mo, d)), error: null }
  }
  const s = (raw ?? "").toString().trim()
  if (!s) return { date: null, error: null }
  return parserTexto(s)
}

function extraerMesAnioDeFolio(folio: string): { mes: number; anio: number } | null {
  const m = (folio ?? "").trim().match(/(\d{1,2})\/(\d{4})\s*$/)
  if (!m) return null
  const mes = parseInt(m[1]), anio = parseInt(m[2])
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) return null
  return { mes, anio }
}

// ── Lectura del workbook (desde buffer, sirve tanto para archivo local como subido por HTTP) ──
export interface WorkbookLeido {
  rows: Record<string, unknown>[]
  colActivo: Record<string, string>
  formatoMultiHoja: boolean
  formatoLabel: string
}

export function leerWorkbookDesdeBuffer(buffer: Buffer | ArrayBuffer): WorkbookLeido {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const rows: Record<string, unknown>[] = []
  let colActivo: Record<string, string>
  let formatoMultiHoja = false
  let formatoLabel: string

  if (wb.Sheets[SHEET_NAME_LEGACY]) {
    colActivo = COL_LEGACY
    const sheet = wb.Sheets[SHEET_NAME_LEGACY]
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as string[][]
    const headers = raw[0]
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r || r.every((c) => c === "")) continue
      const obj: Record<string, string | undefined> = {}
      headers.forEach((h, j) => { obj[h] = r[j] })
      rows.push(obj)
    }
    formatoLabel = `hoja única "${SHEET_NAME_LEGACY}"`
  } else {
    colActivo = COL_HOJAS
    formatoMultiHoja = true
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown[][]
      if (raw.length === 0) continue
      const headers = (raw[0] as unknown[]).map((h) => (h ?? "").toString())
      const headerMap = resolveHeaderMapHoja(headers)
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i]
        if (!r || r.every((c) => c === "")) continue
        const obj: Record<string, unknown> = {}
        headers.forEach((h, j) => { obj[h] = r[j] })
        const canonicalRow: Record<string, unknown> = { _hoja: sheetName }
        for (const [field, headerText] of Object.entries(headerMap)) {
          canonicalRow[field] = obj[headerText]
        }
        rows.push(canonicalRow)
      }
    }
    formatoLabel = `multi-hoja (${wb.SheetNames.length} hojas: ${wb.SheetNames.join(", ")})`
  }

  return { rows, colActivo, formatoMultiHoja, formatoLabel }
}

// ── Contexto de base de datos necesario para validar/insertar filas ──────
export interface SolicitudExistente {
  id: number
  estado_id: number
  folio_dictamen: string | null
  secretaria: string | null
  unidad_administrativa: string | null
  unidad_responsable: string | null
  programa_proyecto: string | null
  regimen: string | null
  tipo_actividades: string | null
  numero_prestadores: number | null
  vigencia_inicio: Date | null
  vigencia_fin: Date | null
  fecha_emision: Date | null
  importe_bruto: any
  tipo_importe: string | null
  nivel_tabulador: string | null
  categoria_tabulador: string | null
  objeto: string | null
  actividades: string[]
  responsabilidades: string[]
  escolaridad: string | null
  comp_adm: string | null
  comp_tec: string | null
  comp_soc: string | null
  valores: string | null
  areas_exp: string | null
}

export interface ContextoImport {
  match: (raw: string) => { canonico: string | null }
  admin: { id: string }
  estadoFinal: { id: number }
  estadoSinDictamen: { id: number }
  estadoBorrador: { id: number }
  periodoMap: Map<string, number>
  periodoHoyId: number | null
  yaImportadosPorJustificacion: Set<string>
  yaImportadosPorDictamen: Set<string>
  existentePorFolioJustificacion: Map<string, SolicitudExistente>
  existentePorFolioDictamen: Map<string, SolicitudExistente>
}

export async function cargarContexto(prisma: PrismaClient, adminCorreo = ADMIN_CORREO_DEFAULT): Promise<ContextoImport> {
  const centralizadas = await prisma.organo_centralizado.findMany({ where: { tipo: "SECRETARIA" } })
  const paraestatales  = await prisma.organo_paraestatal.findMany()
  const exactMap = new Map<string, string>()
  for (const s of centralizadas) exactMap.set(norm(s.nombre), s.nombre)
  for (const p of paraestatales) {
    exactMap.set(norm(p.nombre), p.nombre)
    exactMap.set(norm(stripParenAcronym(p.nombre)), p.nombre)
  }
  for (const [k, v] of Object.entries(MANUAL_OVERRIDES)) exactMap.set(norm(k), v)
  function match(raw: string): { canonico: string | null } {
    if (!raw) return { canonico: null }
    const partes = raw.split("/").map((p) => p.trim()).filter(Boolean)
    for (const parte of [...partes].reverse()) {
      const hit = exactMap.get(norm(parte)) ?? exactMap.get(norm(stripParenAcronym(parte)))
      if (hit) return { canonico: hit }
    }
    return { canonico: null }
  }

  const admin = await prisma.usuario.findUniqueOrThrow({ where: { correo: adminCorreo } })
  const estadoFinal = await prisma.estado.findUniqueOrThrow({ where: { nombre: ESTADO_FINAL } })
  const estadoSinDictamen = await prisma.estado.findUniqueOrThrow({ where: { nombre: ESTADO_SIN_DICTAMEN } })
  const estadoBorrador = await prisma.estado.findUniqueOrThrow({ where: { nombre: ESTADO_BORRADOR } })
  const periodos = await prisma.periodo.findMany()
  const periodoMap = new Map(periodos.map((p) => [`${p.mes}-${p.anio}`, p.id]))
  const hoy = new Date()
  const periodoHoyId = periodoMap.get(`${hoy.getUTCMonth() + 1}-${hoy.getUTCFullYear()}`) ?? null

  const existentes = await prisma.solicitud.findMany({
    select: {
      id: true, estado_id: true, folio_justificacion: true, folio_dictamen: true,
      secretaria: true, unidad_administrativa: true, unidad_responsable: true,
      programa_proyecto: true, regimen: true, tipo_actividades: true, numero_prestadores: true,
      vigencia_inicio: true, vigencia_fin: true, fecha_emision: true, importe_bruto: true, tipo_importe: true,
      nivel_tabulador: true, categoria_tabulador: true, objeto: true, actividades: true, responsabilidades: true,
      escolaridad: true, comp_adm: true, comp_tec: true, comp_soc: true, valores: true, areas_exp: true,
    },
  })
  // Los catalogo_justificacion "huérfanos" (sin solicitud_id) no aparecen en `solicitud` —
  // hay que incluirlos también (por folio_justificacion Y folio_dictamen) o el dedup no los
  // ve y el import los duplica. No tienen solicitud asociada, así que nunca son candidatos a actualizar.
  const catalogoHuerfanos = await prisma.catalogo_justificacion.findMany({
    where: { solicitud_id: null },
    select: { folio_justificacion: true, folio_dictamen: true },
  })

  const existentePorFolioJustificacion = new Map<string, SolicitudExistente>()
  const existentePorFolioDictamen = new Map<string, SolicitudExistente>()
  for (const { folio_justificacion, folio_dictamen, ...snapshot } of existentes) {
    if (folio_justificacion) existentePorFolioJustificacion.set(folio_justificacion, { ...snapshot, folio_dictamen })
    else if (folio_dictamen) existentePorFolioDictamen.set(folio_dictamen, { ...snapshot, folio_dictamen })
  }

  const yaImportadosPorJustificacion = new Set([
    ...existentePorFolioJustificacion.keys(),
    ...catalogoHuerfanos.map((c) => c.folio_justificacion).filter(Boolean),
  ] as string[])
  const yaImportadosPorDictamen = new Set([
    ...existentePorFolioDictamen.keys(),
    ...catalogoHuerfanos.filter((c) => !c.folio_justificacion).map((c) => c.folio_dictamen).filter(Boolean),
  ] as string[])

  return {
    match, admin, estadoFinal, estadoSinDictamen, estadoBorrador, periodoMap, periodoHoyId,
    yaImportadosPorJustificacion, yaImportadosPorDictamen,
    existentePorFolioJustificacion, existentePorFolioDictamen,
  }
}

// ── Comparación fila-Excel vs. registro existente (para el modo "actualizar") ──
export interface CampoCambiado {
  campo: string
  anterior: string
  nuevo: string
}

function fechaISO(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

function decimalANumero(d: unknown): number | null {
  if (d === null || d === undefined) return null
  const n = Number(d as any)
  return isNaN(n) ? null : n
}

// Normaliza saltos de línea (\r\n / \r → \n) para que datos guardados en importaciones
// previas no se marquen como "distintos" solo por el estilo de salto de línea del Excel de origen.
function normalizarSaltos(s: string): string {
  return s.replace(/\r\n?/g, "\n")
}

function arraysIguales(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((v, i) => normalizarSaltos(v) === normalizarSaltos(b[i]))
}

function calcularCambios(existente: SolicitudExistente, nuevo: Record<string, any>): CampoCambiado[] {
  const cambios: CampoCambiado[] = []
  const vacio = "(vacío)"
  const cmp = (campo: string, a: string | number | null, b: string | number | null) => {
    const an = typeof a === "string" ? normalizarSaltos(a) : a
    const bn = typeof b === "string" ? normalizarSaltos(b) : b
    if ((an ?? null) !== (bn ?? null)) cambios.push({ campo, anterior: an === null || an === undefined ? vacio : String(an), nuevo: bn === null || bn === undefined ? vacio : String(bn) })
  }
  const cmpFecha = (campo: string, a: Date | null, b: Date | null) => cmp(campo, fechaISO(a), fechaISO(b))
  const cmpArr = (campo: string, a: string[], b: string[]) => {
    if (!arraysIguales(a, b)) cambios.push({ campo, anterior: `${a.length} línea(s)`, nuevo: `${b.length} línea(s)` })
  }

  cmp("Secretaría", existente.secretaria, nuevo.secretaria)
  cmp("Unidad administrativa", existente.unidad_administrativa, nuevo.unidad_administrativa)
  cmp("Unidad responsable", existente.unidad_responsable, nuevo.unidad_responsable)
  cmp("Programa/Proyecto", existente.programa_proyecto, nuevo.programa_proyecto)
  cmp("Régimen", existente.regimen, nuevo.regimen)
  cmp("Tipo de actividad", existente.tipo_actividades, nuevo.tipo_actividades)
  cmp("Número de prestadores", existente.numero_prestadores, nuevo.numero_prestadores)
  cmpFecha("Fecha de emisión", existente.fecha_emision, nuevo.fecha_emision)
  cmpFecha("Vigencia inicio", existente.vigencia_inicio, nuevo.vigencia_inicio)
  cmpFecha("Vigencia término", existente.vigencia_fin, nuevo.vigencia_fin)
  cmp("Importe bruto", decimalANumero(existente.importe_bruto), nuevo.importe_bruto)
  cmp("Tipo de importe", existente.tipo_importe, nuevo.tipo_importe)
  cmp("Nivel", existente.nivel_tabulador, nuevo.nivel_tabulador)
  cmp("Categoría", existente.categoria_tabulador, nuevo.categoria_tabulador)
  cmp("Objeto", existente.objeto, nuevo.objeto)
  cmpArr("Actividades", existente.actividades, nuevo.actividades)
  cmpArr("Responsabilidades", existente.responsabilidades, nuevo.responsabilidades)
  cmp("Escolaridad", existente.escolaridad, nuevo.escolaridad)
  cmp("Competencias administrativas", existente.comp_adm, nuevo.comp_adm)
  cmp("Competencias técnicas", existente.comp_tec, nuevo.comp_tec)
  cmp("Competencias sociales", existente.comp_soc, nuevo.comp_soc)
  cmp("Valores", existente.valores, nuevo.valores)
  cmp("Áreas de experiencia", existente.areas_exp, nuevo.areas_exp)

  return cambios
}

// ── Procesamiento fila por fila: valida, arma el reporte y las filas a insertar/actualizar ──
export interface FilaResultado {
  idx: number
  secretariaRaw: string
  secretariaMatch: string | null
  folioDictamen: string
  errores: string[]
  advertencias: string[]
}

export interface FilaActualizacion {
  idx: number
  secretariaRaw: string
  folioDictamen: string
  cambios: CampoCambiado[]
}

export interface ResumenImport {
  totalFilas: number
  yaImportadosCount: number
  listasParaImportar: number
  listasParaActualizar: number
  sinCambioCount: number
  conErrores: number
  sinFolioDictamen: number
  regimenNoReconocido: number
  sinPeriodo: number
  secretariasNoMatch: { nombre: string; count: number }[]
  filasConError: FilaResultado[]
  filasConAdvertencia: FilaResultado[]
  filasParaActualizar: FilaActualizacion[]
}

export function procesarFilas(
  rows: Record<string, unknown>[],
  colActivo: Record<string, string>,
  formatoMultiHoja: boolean,
  contexto: ContextoImport,
  modoBorrador = false,
  modoActualizar = false,
): { resultados: FilaResultado[]; toInsert: any[]; toUpdate: any[]; resumen: ResumenImport } {
  const {
    match, admin, estadoFinal, estadoSinDictamen, estadoBorrador, periodoMap, periodoHoyId,
    yaImportadosPorJustificacion, yaImportadosPorDictamen,
    existentePorFolioJustificacion, existentePorFolioDictamen,
  } = contexto

  const resultados: FilaResultado[] = []
  const secretariasNoMatch = new Map<string, number>()
  let sinFolioDictamen = 0
  let regimenNoReconocido = 0
  let sinPeriodo = 0
  const toInsert: any[] = []
  const toUpdate: any[] = []
  const filasParaActualizar: FilaActualizacion[] = []
  let yaImportadosCount = 0
  let sinCambioCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errores: string[] = []

    const folioJustificacion = getCell(row, colActivo.folioJustificacion)
    const folioDictamen      = getCell(row, colActivo.folioDictamen)
    if (!folioDictamen) sinFolioDictamen++

    const yaExiste = folioJustificacion
      ? yaImportadosPorJustificacion.has(folioJustificacion)
      : (folioDictamen ? yaImportadosPorDictamen.has(folioDictamen) : false)
    const existente = folioJustificacion
      ? existentePorFolioJustificacion.get(folioJustificacion)
      : (folioDictamen ? existentePorFolioDictamen.get(folioDictamen) : undefined)

    // Sin modo actualizar (o sin una solicitud real que actualizar, p.ej. huérfano de catálogo), se omite como antes.
    if (yaExiste && !(modoActualizar && existente)) {
      yaImportadosCount++
      continue
    }

    const secretariaRaw = getCell(row, colActivo.secretaria) || getCell(row, "_hoja")
    const { canonico } = match(secretariaRaw)
    if (!canonico && secretariaRaw) {
      secretariasNoMatch.set(secretariaRaw, (secretariasNoMatch.get(secretariaRaw) ?? 0) + 1)
    }

    const advertencias: string[] = []
    const reportar = (msg: string) => { advertencias.push(msg); if (!modoBorrador) errores.push(msg) }

    const parserTexto = parseFechaDMY
    const { date: fechaDictamen, error: errFD } = fechaDesdeCelda(row, colActivo.fechaDictamen, parserTexto)
    if (errFD) reportar(`FECHA DICTAMEN: ${errFD}`)
    const { date: vigenciaInicio, error: errVI } = fechaDesdeCelda(row, colActivo.vigenciaInicio, parserTexto)
    if (errVI) reportar(`VIGENCIA INICIO: ${errVI}`)
    const { date: vigenciaFin, error: errVT } = fechaDesdeCelda(row, colActivo.vigenciaTermino, parserTexto)
    if (errVT) reportar(`VIGENCIA TERMINO: ${errVT}`)

    const { value: importeBruto, error: errImp } = parseImporte(getCell(row, colActivo.importeBruto))
    if (errImp) reportar(errImp)
    const tipoImporte = colActivo.tipoPago
      ? parseTipoPago(getCell(row, colActivo.tipoPago))
      : parseTipoPago(getCell(row, colActivo.importeBruto))

    const regimen = normalizeRegimen(getCell(row, colActivo.regimen))
    if (!regimen) { regimenNoReconocido++; reportar(`RÉGIMEN no reconocido: "${getCell(row, colActivo.regimen)}"`) }

    // Se renumera siempre con numeral romano consecutivo (descartando el que ya traiga
    // el Excel, si trae alguno) para que quede uniforme sin importar el formato de origen —
    // mismo criterio que ya usa la generación de PDF (stripLeadingRomanNumeral + toRoman).
    const actividadesItems = buildRomanNumberedList(parseListField(getCell(row, colActivo.actividades)))
    const responsabilidadesItems = buildRomanNumberedList(parseListField(getCell(row, colActivo.responsabilidades)))

    let periodoId: number | null = null
    let periodoOrigen = ""
    const candidatosPeriodo: { origen: string; mesAnio: { mes: number; anio: number } | null }[] = [
      { origen: "VIGENCIA INICIO", mesAnio: vigenciaInicio ? { mes: vigenciaInicio.getUTCMonth() + 1, anio: vigenciaInicio.getUTCFullYear() } : null },
      { origen: "FOLIO DICTAMEN",  mesAnio: extraerMesAnioDeFolio(folioDictamen) },
      { origen: "FOLIO JUSTIFICACIÓN", mesAnio: extraerMesAnioDeFolio(folioJustificacion) },
    ]
    for (const c of candidatosPeriodo) {
      if (!c.mesAnio) continue
      const key = `${c.mesAnio.mes}-${c.mesAnio.anio}`
      const id = periodoMap.get(key)
      if (id) { periodoId = id; periodoOrigen = c.origen; break }
    }
    if (!periodoId && modoBorrador && periodoHoyId) {
      periodoId = periodoHoyId
      periodoOrigen = "HOY (fallback borrador)"
      advertencias.push("Periodo asignado por defecto (hoy), no se pudo derivar de la fila")
    }
    if (!periodoId) { sinPeriodo++; errores.push("No se pudo resolver un periodo válido para esta fila") }

    resultados.push({ idx: i + 2, secretariaRaw, secretariaMatch: canonico, folioDictamen, errores, advertencias })

    const contenido = {
      tipo_solicitud:        regimen === "nombramiento" ? "Nombramiento Tiempo Determinado" : "Prestacion de Servicios",
      fecha_emision:         fechaDictamen,
      secretaria:            canonico ?? (secretariaRaw || null),
      secretaria_txt_snapshot: canonico ?? (secretariaRaw || null),
      unidad_administrativa: getCell(row, colActivo.unidadAdscripcion) || null,
      unidad_responsable:    getCell(row, colActivo.unidadResponsableGasto) || null,
      programa_proyecto:     getCell(row, colActivo.programaProyecto) || null,
      regimen,
      tipo_actividades:      getCell(row, colActivo.tipoActividad) || null,
      numero_prestadores:    parseInt(getCell(row, colActivo.numPrestadores)) || null,
      vigencia_inicio:       vigenciaInicio,
      vigencia_fin:          vigenciaFin,
      importe_bruto:         importeBruto,
      tipo_importe:          tipoImporte,
      nivel_tabulador:       getCell(row, colActivo.nivelCategoria) || getCell(row, colActivo.nivel) || null,
      categoria_tabulador:   getCell(row, colActivo.categoria) || null,
      objeto:                getCell(row, colActivo.objeto) || null,
      actividades:           actividadesItems,
      responsabilidades:     responsabilidadesItems,
      escolaridad:           getCell(row, colActivo.escolaridad) || null,
      comp_adm:              getCell(row, colActivo.compAdm) || null,
      comp_tec:              getCell(row, colActivo.compTec) || null,
      comp_soc:              getCell(row, colActivo.compSoc) || null,
      valores:               getCell(row, colActivo.valores) || null,
      areas_exp:             getCell(row, colActivo.areasExp) || null,
    }

    if (errores.length === 0) {
      if (folioJustificacion) yaImportadosPorJustificacion.add(folioJustificacion)
      else if (folioDictamen) yaImportadosPorDictamen.add(folioDictamen)

      if (modoActualizar && existente) {
        const cambios = calcularCambios(existente, contenido)
        if (cambios.length === 0) {
          sinCambioCount++
        } else {
          filasParaActualizar.push({ idx: i + 2, secretariaRaw, folioDictamen, cambios })
          toUpdate.push({ id: existente.id, estadoId: existente.estado_id, cambios, data: contenido })
        }
        continue
      }

      const estadoId = modoBorrador
        ? estadoBorrador.id
        : (folioDictamen ? estadoFinal.id : estadoSinDictamen.id)
      toInsert.push({
        _periodoOrigen: periodoOrigen,
        _advertencias:  advertencias,
        usuario_id:            admin.id,
        estado_id:             estadoId,
        periodo_id:            periodoId,
        folio_justificacion:   folioJustificacion || null,
        folio_dictamen:        folioDictamen || null,
        modalidad_firma:       "autografa",
        ...contenido,
      })
    }
  }

  const conError = resultados.filter((r) => r.errores.length > 0)
  const conAdvertencias = resultados.filter((r) => r.errores.length === 0 && r.advertencias.length > 0)

  const resumen: ResumenImport = {
    totalFilas: rows.length,
    yaImportadosCount,
    listasParaImportar: toInsert.length,
    listasParaActualizar: toUpdate.length,
    sinCambioCount,
    conErrores: conError.length,
    sinFolioDictamen,
    regimenNoReconocido,
    sinPeriodo,
    secretariasNoMatch: [...secretariasNoMatch.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count })),
    filasConError: conError,
    filasConAdvertencia: conAdvertencias,
    filasParaActualizar,
  }

  return { resultados, toInsert, toUpdate, resumen }
}

export async function insertarSolicitudes(
  toInsert: any[],
  contexto: ContextoImport,
  prisma: PrismaClient,
  modoBorrador = false,
): Promise<number> {
  let creadas = 0
  for (const row of toInsert) {
    const { _periodoOrigen, _advertencias, ...data } = row
    const solicitud = await prisma.solicitud.create({ data })
    if (!modoBorrador && data.folio_dictamen) {
      await prisma.dictamen.create({
        data: {
          solicitud_id:  solicitud.id,
          folio:         data.folio_dictamen,
          fecha_emision: data.fecha_emision ?? new Date(),
          tipo_firma:    "autografa",
        },
      })
    }
    let comentario: string
    if (modoBorrador) {
      comentario = `Importado como borrador de histórico consolidado DGSAC (datos incompletos, requiere revisión manual)`
      if (_advertencias.length > 0) comentario += `: ${_advertencias.join(" | ")}`
      if (_periodoOrigen) comentario += ` [periodo tomado de: ${_periodoOrigen}]`
    } else {
      comentario = data.folio_dictamen
        ? "Importado de histórico consolidado DGSAC"
        : "Importado de histórico consolidado DGSAC (sin folio de dictamen, pendiente de emisión)"
    }
    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:    solicitud.id,
        usuario_id:      contexto.admin.id,
        estado_nuevo_id: data.estado_id,
        comentario:      comentario.slice(0, 1000),
      },
    })
    creadas++
  }
  return creadas
}

export async function actualizarSolicitudes(
  toUpdate: { id: number; estadoId: number; cambios: CampoCambiado[]; data: Record<string, any> }[],
  contexto: ContextoImport,
  prisma: PrismaClient,
): Promise<number> {
  let actualizadas = 0
  for (const { id, estadoId, cambios, data } of toUpdate) {
    await prisma.solicitud.update({ where: { id }, data })

    const vigencia = data.vigencia_inicio && data.vigencia_fin
      ? `${data.vigencia_inicio.toISOString().slice(0, 10)} / ${data.vigencia_fin.toISOString().slice(0, 10)}`
      : null
    // No todas las solicitudes tienen catalogo_justificacion (solo las que ya se sincronizaron);
    // updateMany no falla si no hay ninguna coincidencia.
    await prisma.catalogo_justificacion.updateMany({
      where: { solicitud_id: id },
      data: {
        // También el contenido de la carta/dictamen (ver lib/catalogo-contenido.ts).
        ...(await contenidoParaCatalogo(prisma, id)),
        regimen_contratacion:    data.regimen ?? undefined,
        programa_proyecto:       data.programa_proyecto ?? undefined,
        tipo_actividad:          data.tipo_actividades ?? null,
        numero_personas:         data.numero_prestadores ?? null,
        tipo_pago:               data.tipo_importe ?? null,
        importe_bruto:           data.importe_bruto ?? null,
        vigencia,
        tipo_solicitud:          data.tipo_solicitud ?? null,
        secretaria:              data.secretaria ?? null,
        secretaria_txt_snapshot: data.secretaria_txt_snapshot ?? null,
      },
    })

    const resumenCambios = cambios.map((c) => `${c.campo}: "${c.anterior}" → "${c.nuevo}"`).join(" | ")
    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:    id,
        usuario_id:      contexto.admin.id,
        estado_nuevo_id: estadoId,
        comentario:      `Actualizado por reimportación de histórico consolidado DGSAC: ${resumenCambios}`.slice(0, 1000),
      },
    })
    actualizadas++
  }
  return actualizadas
}

export interface ResultadoSincronizar {
  insertados: number
  total: number
  errores: string[]
}

// Solicitudes que vinieron de la importación del Excel: insertarSolicitudes les deja
// en el historial un comentario "Importado...". Sirve para marcar el origen del
// registro de catálogo (la pestaña Consulta solo muestra origen = "excel").
export async function idsSolicitudesImportadas(prisma: PrismaClient, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.historial_solicitud.findMany({
    where: { solicitud_id: { in: ids }, comentario: { startsWith: "Importado", mode: "insensitive" } },
    select: { solicitud_id: true },
    distinct: ["solicitud_id"],
  })
  return new Set(rows.map((r) => r.solicitud_id))
}

export async function sincronizarCatalogo(prisma: PrismaClient): Promise<ResultadoSincronizar> {
  const [dictamenes, estadoEmitido] = await Promise.all([
    prisma.dictamen.findMany({ select: { solicitud_id: true } }),
    prisma.estado.findFirst({ where: { nombre: { equals: "Emitido", mode: "insensitive" } } }),
  ])

  const idsSet = new Set<number>(dictamenes.map((d) => d.solicitud_id))
  if (estadoEmitido) {
    const emitidas = await prisma.solicitud.findMany({ where: { estado_id: estadoEmitido.id }, select: { id: true } })
    emitidas.forEach((s) => idsSet.add(s.id))
  }

  if (idsSet.size === 0) return { insertados: 0, total: 0, errores: [] }

  const solicitudes = await prisma.solicitud.findMany({ where: { id: { in: Array.from(idsSet) } } })
  const importadas = await idsSolicitudesImportadas(prisma, solicitudes.map((s) => s.id))

  let insertados = 0
  const errores: string[] = []

  for (const sol of solicitudes) {
    const existing = await prisma.catalogo_justificacion.findUnique({ where: { solicitud_id: sol.id } })
    if (existing) continue

    try {
      const vigencia = sol.vigencia_inicio && sol.vigencia_fin
        ? `${sol.vigencia_inicio.toISOString().slice(0, 10)} / ${sol.vigencia_fin.toISOString().slice(0, 10)}`
        : null

      await prisma.catalogo_justificacion.create({
        data: {
          // Copia propia del contenido: el catálogo no debe depender de que la solicitud siga existiendo.
          ...(await contenidoParaCatalogo(prisma, Number(sol.id))),
          solicitud_id:              sol.id,
          regimen_contratacion:      (sol as any).regimen ?? "honorarios",
          programa_proyecto:         (sol as any).programa_proyecto ?? "",
          tipo_actividad:            (sol as any).tipo_actividades ?? null,
          denominacion_nombramiento: (sol as any).denominacion ?? null,
          puesto_jefe_inmediato:     (sol as any).puesto_jefe_inmediato ?? null,
          numero_personas:           (sol as any).numero_prestadores ?? null,
          tipo_pago:                 (sol as any).tipo_importe ?? null,
          importe_bruto:             (sol as any).importe_bruto ?? null,
          importe_neto:              null,
          vigencia,
          activo:                    true,
          tipo_solicitud:            sol.tipo_solicitud ?? null,
          secretaria:                (sol as any).secretaria ?? null,
          secretaria_txt_snapshot:   (sol as any).secretaria_txt_snapshot ?? null,
          folio_recepcion:           sol.folio_recepcion ?? null,
          folio_dictamen:            (sol as any).folio_dictamen ?? null,
          origen:                    importadas.has(sol.id) ? "excel" : "sistema",
        },
      })
      insertados++
    } catch (e: any) {
      errores.push(`solicitud ${sol.id}: ${e?.message ?? "error"}`)
    }
  }

  return { insertados, total: solicitudes.length, errores }
}

// ── Reemplazo de importación anterior: al marcar la opción "reemplazar", las
// solicitudes que vinieron de una importación previa (historial con comentario
// "Importado...") y cuyo folio ya NO aparece en el archivo que se está subiendo
// ahora se consideran obsoletas y se eliminan. Las solicitudes creadas por el
// flujo normal del sistema (sin ese comentario) nunca se tocan aquí.
export interface ObsoletoImportado {
  id: number
  folioDictamen: string | null
  folioJustificacion: string | null
  secretaria: string | null
}

export interface ResumenObsoletos {
  candidatos: number
  ejemplos: ObsoletoImportado[]
}

function foliosDelArchivo(rows: Record<string, unknown>[], colActivo: Record<string, string>): Set<string> {
  const folios = new Set<string>()
  for (const row of rows) {
    const fj = getCell(row, colActivo.folioJustificacion)
    const fd = getCell(row, colActivo.folioDictamen)
    if (fj) folios.add(fj)
    if (fd) folios.add(fd)
  }
  return folios
}

export async function calcularObsoletosPorReemplazo(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  colActivo: Record<string, string>,
): Promise<{ ids: number[]; resumen: ResumenObsoletos }> {
  const folios = foliosDelArchivo(rows, colActivo)

  const importadas = await prisma.$queryRawUnsafe<{
    id: number
    folio_justificacion: string | null
    folio_dictamen: string | null
    secretaria: string | null
  }[]>(`
    SELECT DISTINCT s.id, s.folio_justificacion, s.folio_dictamen, s.secretaria
    FROM solicitud s
    JOIN historial_solicitud hs ON hs.solicitud_id = s.id
    WHERE hs.comentario ILIKE 'Importado%'
  `)

  const obsoletas = importadas.filter((s) => {
    const enArchivo =
      (s.folio_justificacion && folios.has(s.folio_justificacion)) ||
      (s.folio_dictamen && folios.has(s.folio_dictamen))
    return !enArchivo
  })

  return {
    ids: obsoletas.map((s) => s.id),
    resumen: {
      candidatos: obsoletas.length,
      ejemplos: obsoletas.slice(0, 10).map((s) => ({
        id: s.id,
        folioDictamen: s.folio_dictamen,
        folioJustificacion: s.folio_justificacion,
        secretaria: s.secretaria,
      })),
    },
  }
}

export async function eliminarSolicitudesObsoletas(ids: number[], prisma: PrismaClient): Promise<number> {
  if (ids.length === 0) return 0
  await prisma.catalogo_justificacion.deleteMany({ where: { solicitud_id: { in: ids } } })
  await prisma.solicitud.deleteMany({ where: { id: { in: ids } } })
  return ids.length
}
