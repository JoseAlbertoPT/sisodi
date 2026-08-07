import * as XLSX from "xlsx"
import type { PrismaClient } from "./generated/prisma"

export const SHEET_NAME_LEGACY = "BASE CONSOLIDADA"
export const ADMIN_CORREO_DEFAULT = "admin@sisodij.gob.mx"
export const ESTADO_FINAL = "Emitido"
export const ESTADO_SIN_DICTAMEN = "En Revision Emisor"
export const ESTADO_BORRADOR = "Borrador"

// ── Formato "consolidado" (una sola hoja "BASE CONSOLIDADA") ─────────────
const COL_LEGACY = {
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

const MANUAL_OVERRIDES: Record<string, string> = {
  "JEFATURA DE LA OFICINA DE LA GOBERNATURA DEL ESTADO": "Jefatura de la Oficina de la Gubernatura del Estado",
}

// ── Formato "multi-hoja" (una hoja por secretaría) ────────────────────────
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
  // La hoja BIENESTAR trae la primera columna (folio de justificación) sin
  // encabezado ("" tras normalizar) en vez de "FOLIO DE JUSTIFICACIÓN".
  if (!map.folioJustificacion && normalized[0] === "") {
    map.folioJustificacion = headers[0]
  }
  return map
}

// ── Utilidades de parseo (puras, sin dependencias externas) ──────────────
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

function parseFechaMDY(raw: string): { date: Date | null; error: string | null } {
  const s = (raw ?? "").trim()
  if (!s) return { date: null, error: null }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return { date: null, error: `formato irreconocible: "${s}"` }
  const mo = parseInt(m[1]), d = parseInt(m[2])
  let y = parseInt(m[3])
  if (y < 100) y += 2000
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

const ROMAN_MARKER_RE = /^[IVXLCDM]+\.\s/
function tieneFormatoNumeradoValido(items: string[]): boolean {
  return items.every((line) => ROMAN_MARKER_RE.test(line))
}

function normalizeRegimen(raw: string): string | null {
  const u = (raw ?? "").toUpperCase().trim()
  if (u.includes("ASIMILADO")) return "asimilados"
  if (u.includes("HONORARIO")) return "honorarios"
  if (u.includes("NOMBRAMIENTO") || u.includes("TIEMPO DETERMINADO")) return "nombramiento"
  return null
}

function getCell(row: Record<string, unknown>, col: string | undefined): string {
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
    select: { folio_justificacion: true, folio_dictamen: true },
  })
  // Los catalogo_justificacion "huérfanos" (sin solicitud_id) no aparecen en `solicitud` —
  // hay que incluirlos también (por folio_justificacion Y folio_dictamen) o el dedup no los
  // ve y el import los duplica.
  const catalogoHuerfanos = await prisma.catalogo_justificacion.findMany({
    where: { solicitud_id: null },
    select: { folio_justificacion: true, folio_dictamen: true },
  })
  const yaImportadosPorJustificacion = new Set([
    ...existentes.map((s) => s.folio_justificacion).filter(Boolean),
    ...catalogoHuerfanos.map((c) => c.folio_justificacion).filter(Boolean),
  ] as string[])
  const yaImportadosPorDictamen = new Set([
    ...existentes.filter((s) => !s.folio_justificacion).map((s) => s.folio_dictamen).filter(Boolean),
    ...catalogoHuerfanos.filter((c) => !c.folio_justificacion).map((c) => c.folio_dictamen).filter(Boolean),
  ] as string[])

  return { match, admin, estadoFinal, estadoSinDictamen, estadoBorrador, periodoMap, periodoHoyId, yaImportadosPorJustificacion, yaImportadosPorDictamen }
}

// ── Procesamiento fila por fila: valida, arma el reporte y las filas a insertar ──
export interface FilaResultado {
  idx: number
  secretariaRaw: string
  secretariaMatch: string | null
  folioDictamen: string
  errores: string[]
  advertencias: string[]
}

export interface ResumenImport {
  totalFilas: number
  yaImportadosCount: number
  listasParaImportar: number
  conErrores: number
  sinFolioDictamen: number
  regimenNoReconocido: number
  sinPeriodo: number
  secretariasNoMatch: { nombre: string; count: number }[]
  filasConError: FilaResultado[]
  filasConAdvertencia: FilaResultado[]
}

export function procesarFilas(
  rows: Record<string, unknown>[],
  colActivo: Record<string, string>,
  formatoMultiHoja: boolean,
  contexto: ContextoImport,
  modoBorrador = false,
): { resultados: FilaResultado[]; toInsert: any[]; resumen: ResumenImport } {
  const { match, admin, estadoFinal, estadoSinDictamen, estadoBorrador, periodoMap, periodoHoyId, yaImportadosPorJustificacion, yaImportadosPorDictamen } = contexto

  const resultados: FilaResultado[] = []
  const secretariasNoMatch = new Map<string, number>()
  let sinFolioDictamen = 0
  let regimenNoReconocido = 0
  let sinPeriodo = 0
  const toInsert: any[] = []
  let yaImportadosCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errores: string[] = []

    const folioJustificacion = getCell(row, colActivo.folioJustificacion)
    const folioDictamen      = getCell(row, colActivo.folioDictamen)
    if (!folioDictamen) sinFolioDictamen++

    const yaExiste = folioJustificacion
      ? yaImportadosPorJustificacion.has(folioJustificacion)
      : (folioDictamen ? yaImportadosPorDictamen.has(folioDictamen) : false)
    if (yaExiste) {
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

    const parserTexto = formatoMultiHoja ? parseFechaMDY : parseFechaDMY
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

    const actividadesItems = parseListField(getCell(row, colActivo.actividades))
    const responsabilidadesItems = parseListField(getCell(row, colActivo.responsabilidades))
    if (actividadesItems.length > 0 && !tieneFormatoNumeradoValido(actividadesItems)) {
      advertencias.push("ACTIVIDADES: hay líneas sin numeral romano al inicio; revisar formato de origen en el Excel (columna Q)")
    }
    if (responsabilidadesItems.length > 0 && !tieneFormatoNumeradoValido(responsabilidadesItems)) {
      advertencias.push("RESPONSABILIDADES: hay líneas sin numeral romano al inicio; revisar formato de origen en el Excel (columna R)")
    }

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

    if (errores.length === 0) {
      if (folioJustificacion) yaImportadosPorJustificacion.add(folioJustificacion)
      else if (folioDictamen) yaImportadosPorDictamen.add(folioDictamen)

      const estadoId = modoBorrador
        ? estadoBorrador.id
        : (folioDictamen ? estadoFinal.id : estadoSinDictamen.id)
      toInsert.push({
        _periodoOrigen: periodoOrigen,
        _advertencias:  advertencias,
        usuario_id:            admin.id,
        estado_id:             estadoId,
        periodo_id:            periodoId,
        tipo_solicitud:        regimen === "nombramiento" ? "Nombramiento Tiempo Determinado" : "Prestacion de Servicios",
        folio_justificacion:   folioJustificacion || null,
        folio_dictamen:        folioDictamen || null,
        fecha_emision:         fechaDictamen,
        secretaria:            canonico ?? (secretariaRaw || null),
        secretaria_txt_snapshot: secretariaRaw || null,
        modalidad_firma:       "autografa",
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
        nivel_tabulador:       getCell(row, colActivo.nivelCategoria) || null,
        objeto:                getCell(row, colActivo.objeto) || null,
        actividades:           actividadesItems,
        responsabilidades:     responsabilidadesItems,
        escolaridad:           getCell(row, colActivo.escolaridad) || null,
        comp_adm:              getCell(row, colActivo.compAdm) || null,
        comp_tec:              getCell(row, colActivo.compTec) || null,
        comp_soc:              getCell(row, colActivo.compSoc) || null,
        valores:               getCell(row, colActivo.valores) || null,
        areas_exp:             getCell(row, colActivo.areasExp) || null,
      })
    }
  }

  const conError = resultados.filter((r) => r.errores.length > 0)
  const conAdvertencias = resultados.filter((r) => r.errores.length === 0 && r.advertencias.length > 0)

  const resumen: ResumenImport = {
    totalFilas: rows.length,
    yaImportadosCount,
    listasParaImportar: toInsert.length,
    conErrores: conError.length,
    sinFolioDictamen,
    regimenNoReconocido,
    sinPeriodo,
    secretariasNoMatch: [...secretariasNoMatch.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, count]) => ({ nombre, count })),
    filasConError: conError,
    filasConAdvertencia: conAdvertencias,
  }

  return { resultados, toInsert, resumen }
}

// ── Inserción real en base de datos ───────────────────────────────────────
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

// ── Sincronización de catalogo_justificacion desde solicitudes emitidas ──
export interface ResultadoSincronizar {
  insertados: number
  total: number
  errores: string[]
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
        },
      })
      insertados++
    } catch (e: any) {
      errores.push(`solicitud ${sol.id}: ${e?.message ?? "error"}`)
    }
  }

  return { insertados, total: solicitudes.length, errores }
}
