import "dotenv/config"
import * as XLSX from "xlsx"
import { prisma } from "../lib/prisma"

const FILE_PATH   = process.argv.find((a) => !a.startsWith("--") && a.endsWith(".xlsx"))
  ?? "C:/Users/SAFDGSAC035/Downloads/BD-CATALOGO-SISODIJ-DGSAC_CONSOLIDADO.xlsx"
const SHEET_NAME    = "BASE CONSOLIDADA"
const COMMIT        = process.argv.includes("--commit")
const MODO_BORRADOR = process.argv.includes("--borradores")
const ADMIN_CORREO  = "admin@sisodij.gob.mx"
const ESTADO_FINAL        = "Emitido"
const ESTADO_SIN_DICTAMEN = "En Revision Emisor"
const ESTADO_BORRADOR     = "Borrador"
const COL = {
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
  if (!map.folioJustificacion && normalized[0] === "") {
    map.folioJustificacion = headers[0]
  }
  return map
}

function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
    // Con una coma y un punto, cuál es el separador de miles depende de cuál
    // aparece primero: "22,027.98" (MX/EUA: coma miles, punto decimal) vs
    // "12.500,00" (europeo: punto miles, coma decimal). Asumir siempre el
    // formato europeo aquí truncaba de forma silenciosa los montos en pesos
    // del formato mexicano (ej. "$22,027.98" quedaba en 22.03).
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

async function loadCatalogoSecretarias() {
  const centralizadas = await prisma.organo_centralizado.findMany({ where: { tipo: "SECRETARIA" } })
  const paraestatales  = await prisma.organo_paraestatal.findMany()

  const exactMap = new Map<string, string>() // normalizado → nombre canónico
  for (const s of centralizadas) exactMap.set(norm(s.nombre), s.nombre)
  for (const p of paraestatales) {
    exactMap.set(norm(p.nombre), p.nombre)
    exactMap.set(norm(stripParenAcronym(p.nombre)), p.nombre)
  }
  for (const [k, v] of Object.entries(MANUAL_OVERRIDES)) exactMap.set(norm(k), v)

  function match(raw: string): { canonico: string | null } {
    if (!raw) return { canonico: null }
    const partes = raw.split("/").map((p) => p.trim()).filter(Boolean)
    // probar de la más específica (después del "/") a la más general
    for (const parte of [...partes].reverse()) {
      const hit = exactMap.get(norm(parte)) ?? exactMap.get(norm(stripParenAcronym(parte)))
      if (hit) return { canonico: hit }
    }
    return { canonico: null }
  }

  return { match }
}

async function main() {
  console.log(`Leyendo: ${FILE_PATH}`)
  const wb = XLSX.readFile(FILE_PATH)

  let rows: Record<string, unknown>[] = []
  let COL_ACTIVO: Record<string, string>
  let formatoMultiHoja = false

  if (wb.Sheets[SHEET_NAME]) {

    COL_ACTIVO = COL
    const sheet = wb.Sheets[SHEET_NAME]
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as string[][]
    const headers = raw[0]
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i]
      if (!r || r.every((c) => c === "")) continue
      const obj: Record<string, string | undefined> = {}
      headers.forEach((h, j) => { obj[h] = r[j] })
      rows.push(obj)
    }
    console.log(`Formato: hoja única "${SHEET_NAME}"`)
  } else {

    COL_ACTIVO = COL_HOJAS
    formatoMultiHoja = true
    const wbFechas = XLSX.readFile(FILE_PATH, { cellDates: true })
    for (const sheetName of wbFechas.SheetNames) {
      const sheet = wbFechas.Sheets[sheetName]
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
    console.log(`Formato: multi-hoja (${wbFechas.SheetNames.length} hojas: ${wbFechas.SheetNames.join(", ")})`)
  }
  console.log(`Filas con datos: ${rows.length}`)

  const { match } = await loadCatalogoSecretarias()
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { correo: ADMIN_CORREO } })
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
  // Los catalogo_justificacion "huérfanos" (sin solicitud_id, p. ej. registros históricos con
  // reutilizaciones que se preservaron a mano) no aparecen en `solicitud` — hay que incluirlos
  // también, si no el dedup no los ve y el import los vuelve a crear como duplicados.
  const catalogoHuerfanos = await prisma.catalogo_justificacion.findMany({
    where: { solicitud_id: null },
    select: { folio_dictamen: true },
  })
  const yaImportadosPorJustificacion = new Set(existentes.map((s) => s.folio_justificacion).filter(Boolean))
  const yaImportadosPorDictamen = new Set([
    ...existentes.filter((s) => !s.folio_justificacion).map((s) => s.folio_dictamen).filter(Boolean),
    ...catalogoHuerfanos.map((c) => c.folio_dictamen).filter(Boolean),
  ])

  type RowResult = {
    idx: number
    secretariaRaw: string
    secretariaMatch: string | null
    folioDictamen: string
    errores: string[]
    advertencias: string[]
  }
  const resultados: RowResult[] = []
  const secretariasNoMatch = new Map<string, number>()
  let sinFolioDictamen = 0
  let regimenNoReconocido = 0
  let sinPeriodo = 0

  const toInsert: any[] = []
  let yaImportadosCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errores: string[] = []

    const folioJustificacion = getCell(row, COL_ACTIVO.folioJustificacion)
    const folioDictamen      = getCell(row, COL_ACTIVO.folioDictamen)
    if (!folioDictamen) sinFolioDictamen++

    const yaExiste = folioJustificacion
      ? yaImportadosPorJustificacion.has(folioJustificacion)
      : (folioDictamen ? yaImportadosPorDictamen.has(folioDictamen) : false)
    if (yaExiste) {
      yaImportadosCount++
      continue
    }


    const secretariaRaw = getCell(row, COL_ACTIVO.secretaria) || getCell(row, "_hoja")
    const { canonico } = match(secretariaRaw)
    if (!canonico && secretariaRaw) {
      secretariasNoMatch.set(secretariaRaw, (secretariasNoMatch.get(secretariaRaw) ?? 0) + 1)
    }

    const advertencias: string[] = []
    const reportar = (msg: string) => { advertencias.push(msg); if (!MODO_BORRADOR) errores.push(msg) }

    const parserTexto = formatoMultiHoja ? parseFechaMDY : parseFechaDMY
    const { date: fechaDictamen, error: errFD } = fechaDesdeCelda(row, COL_ACTIVO.fechaDictamen, parserTexto)
    if (errFD) reportar(`FECHA DICTAMEN: ${errFD}`)
    const { date: vigenciaInicio, error: errVI } = fechaDesdeCelda(row, COL_ACTIVO.vigenciaInicio, parserTexto)
    if (errVI) reportar(`VIGENCIA INICIO: ${errVI}`)
    const { date: vigenciaFin, error: errVT } = fechaDesdeCelda(row, COL_ACTIVO.vigenciaTermino, parserTexto)
    if (errVT) reportar(`VIGENCIA TERMINO: ${errVT}`)

    const { value: importeBruto, error: errImp } = parseImporte(getCell(row, COL_ACTIVO.importeBruto))
    if (errImp) reportar(errImp)
    const tipoImporte = COL_ACTIVO.tipoPago
      ? parseTipoPago(getCell(row, COL_ACTIVO.tipoPago))
      : parseTipoPago(getCell(row, COL_ACTIVO.importeBruto))

    const regimen = normalizeRegimen(getCell(row, COL_ACTIVO.regimen))
    if (!regimen) { regimenNoReconocido++; reportar(`RÉGIMEN no reconocido: "${getCell(row, COL_ACTIVO.regimen)}"`) }


    const actividadesItems = parseListField(getCell(row, COL_ACTIVO.actividades))
    const responsabilidadesItems = parseListField(getCell(row, COL_ACTIVO.responsabilidades))
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
    if (!periodoId && MODO_BORRADOR && periodoHoyId) {
      periodoId = periodoHoyId
      periodoOrigen = "HOY (fallback borrador)"
      advertencias.push("Periodo asignado por defecto (hoy), no se pudo derivar de la fila")
    }
    if (!periodoId) { sinPeriodo++; errores.push("No se pudo resolver un periodo válido para esta fila") }

    resultados.push({ idx: i + 2, secretariaRaw, secretariaMatch: canonico, folioDictamen, errores, advertencias })

    if (errores.length === 0) {
      // Marcar el folio como visto de inmediato (no solo al final del run): si el mismo folio
      // se repite más adelante en este mismo archivo, la siguiente vuelta del loop ya lo detecta
      // como "ya importado" en vez de crear un duplicado silencioso.
      if (folioJustificacion) yaImportadosPorJustificacion.add(folioJustificacion)
      else if (folioDictamen) yaImportadosPorDictamen.add(folioDictamen)

      const estadoId = MODO_BORRADOR
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
        unidad_administrativa: getCell(row, COL_ACTIVO.unidadAdscripcion) || null,
        unidad_responsable:    getCell(row, COL_ACTIVO.unidadResponsableGasto) || null,
        programa_proyecto:     getCell(row, COL_ACTIVO.programaProyecto) || null,
        regimen,
        tipo_actividades:      getCell(row, COL_ACTIVO.tipoActividad) || null,
        numero_prestadores:    parseInt(getCell(row, COL_ACTIVO.numPrestadores)) || null,
        vigencia_inicio:       vigenciaInicio,
        vigencia_fin:          vigenciaFin,
        importe_bruto:         importeBruto,
        tipo_importe:          tipoImporte,
        nivel_tabulador:       getCell(row, COL_ACTIVO.nivelCategoria) || null,
        objeto:                getCell(row, COL_ACTIVO.objeto) || null,
        actividades:           actividadesItems,
        responsabilidades:     responsabilidadesItems,
        escolaridad:           getCell(row, COL_ACTIVO.escolaridad) || null,
        comp_adm:              getCell(row, COL_ACTIVO.compAdm) || null,
        comp_tec:              getCell(row, COL_ACTIVO.compTec) || null,
        comp_soc:              getCell(row, COL_ACTIVO.compSoc) || null,
        valores:               getCell(row, COL_ACTIVO.valores) || null,
        areas_exp:             getCell(row, COL_ACTIVO.areasExp) || null,
      })
    }
  }

  const conError = resultados.filter((r) => r.errores.length > 0)
  console.log("\n──────── REPORTE ────────")
  console.log(`Total filas:                 ${rows.length}`)
  console.log(`Ya importadas (se omiten):   ${yaImportadosCount}`)
  console.log(`Listas para importar:        ${toInsert.length}`)
  console.log(`Con errores (se omiten):     ${conError.length}`)
  console.log(`Sin folio de dictamen:       ${sinFolioDictamen}`)
  console.log(`Régimen no reconocido:       ${regimenNoReconocido}`)
  console.log(`Sin periodo (mes/año):       ${sinPeriodo}`)
  console.log(`Secretarías sin match en catálogo (se guardan tal cual, texto libre):`)
  for (const [nombre, count] of [...secretariasNoMatch.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  (${count}) ${nombre}`)
  }
  if (conError.length > 0) {
    console.log("\nDetalle de filas con error (fila de Excel, no se importan):")
    for (const r of conError) {
      console.log(`  Fila ${r.idx} [${r.secretariaRaw}] folio=${r.folioDictamen || "(sin folio)"}: ${r.errores.join(" | ")}`)
    }
  }

  const conAdvertencias = resultados.filter((r) => r.errores.length === 0 && r.advertencias.length > 0)
  if (conAdvertencias.length > 0) {
    console.log(`\n${conAdvertencias.length} filas se importan con advertencias, revisar manualmente:`)
    for (const r of conAdvertencias) {
      console.log(`  Fila ${r.idx} [${r.secretariaRaw}] folio=${r.folioDictamen || "(sin folio)"}: ${r.advertencias.join(" | ")}`)
    }
  }

  if (!COMMIT) {
    console.log("\nModo dry-run (sin --commit). No se escribió nada en la base de datos.")
    return
  }

  console.log(`\nEscribiendo ${toInsert.length} solicitudes...`)
  let creadas = 0
  for (const row of toInsert) {
    const { _periodoOrigen, _advertencias, ...data } = row
    const solicitud = await prisma.solicitud.create({ data })
    if (!MODO_BORRADOR && data.folio_dictamen) {
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
    if (MODO_BORRADOR) {
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
        usuario_id:      admin.id,
        estado_nuevo_id: data.estado_id,
        comentario:      comentario.slice(0, 1000),
      },
    })
    creadas++
  }
  console.log(`Listo. ${creadas} solicitudes creadas.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
