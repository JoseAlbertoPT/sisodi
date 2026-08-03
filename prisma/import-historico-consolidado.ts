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
  } else if (dotCount >= 1 && commaCount === 1) {
    // "$12.500,00" → punto miles, coma decimal
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else if (commaCount === 1) {
    // "$14,999,99" con 1 sola coma sería raro; tratamos coma como decimal
    normalized = s.replace(",", ".")
  } else {
    normalized = s
  }
  const value = parseFloat(normalized)
  if (isNaN(value)) return { value: null, error: `importe irreconocible: "${raw}"` }
  return { value, error: null }
}

function splitBullets(raw: string): string[] {
  const s = (raw ?? "").trim()
  if (!s) return []
  const byRoman = s.split(/\n?\s*(?=[IVXLCDM]{1,6}\.\s)/g).map((x) => x.trim()).filter(Boolean)
  if (byRoman.length > 1) return byRoman
  return s.split(/\n+/).map((x) => x.replace(/^[•\-]\s*/, "").trim()).filter(Boolean)
}

function normalizeRegimen(raw: string): string | null {
  const u = (raw ?? "").toUpperCase().trim()
  if (u.includes("ASIMILADO")) return "asimilados"
  if (u.includes("HONORARIO")) return "honorarios"
  if (u.includes("NOMBRAMIENTO") || u.includes("TIEMPO DETERMINADO")) return "nombramiento"
  return null
}

function getCell(row: Record<string, string | undefined>, col: string): string {
  return (row[col] ?? "").toString().trim()
}

function extraerMesAnioDeFolio(folio: string): { mes: number; anio: number } | null {
  const m = (folio ?? "").trim().match(/(\d{1,2})\/(\d{4})\s*$/)
  if (!m) return null
  const mes = parseInt(m[1]), anio = parseInt(m[2])
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) return null
  return { mes, anio }
}

// ── Carga de catálogo (organo_centralizado + organo_paraestatal) ─────────
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

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Leyendo: ${FILE_PATH}`)
  const wb = XLSX.readFile(FILE_PATH)
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) throw new Error(`No se encontró la hoja "${SHEET_NAME}". Hojas disponibles: ${wb.SheetNames.join(", ")}`)

  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as string[][]
  const headers = raw[0]
  const rows: Record<string, string | undefined>[] = []
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r || r.every((c) => c === "")) continue
    const obj: Record<string, string | undefined> = {}
    headers.forEach((h, j) => { obj[h] = r[j] })
    rows.push(obj)
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
  // folio_dictamen NO es único globalmente en este histórico (cada secretaría llevaba su propio
  // conteo en el proceso en papel) — deduplicar por folio_justificacion, que sí trae prefijo de
  // secretaría y es mucho más confiable como identificador único de fila.
  const existentes = await prisma.solicitud.findMany({
    select: { folio_justificacion: true, folio_dictamen: true },
  })
  const yaImportadosPorJustificacion = new Set(existentes.map((s) => s.folio_justificacion).filter(Boolean))
  const yaImportadosPorDictamen = new Set(existentes.filter((s) => !s.folio_justificacion).map((s) => s.folio_dictamen).filter(Boolean))

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

    const folioJustificacion = getCell(row, COL.folioJustificacion)
    const folioDictamen      = getCell(row, COL.folioDictamen)
    if (!folioDictamen) sinFolioDictamen++

    const yaExiste = folioJustificacion
      ? yaImportadosPorJustificacion.has(folioJustificacion)
      : (folioDictamen ? yaImportadosPorDictamen.has(folioDictamen) : false)
    if (yaExiste) {
      yaImportadosCount++
      continue
    }

    const secretariaRaw = getCell(row, COL.secretaria)
    const { canonico } = match(secretariaRaw)
    if (!canonico && secretariaRaw) {
      secretariasNoMatch.set(secretariaRaw, (secretariasNoMatch.get(secretariaRaw) ?? 0) + 1)
    }

    const advertencias: string[] = []
    const reportar = (msg: string) => { advertencias.push(msg); if (!MODO_BORRADOR) errores.push(msg) }

    const { date: fechaDictamen, error: errFD } = parseFechaDMY(getCell(row, COL.fechaDictamen))
    if (errFD) reportar(`FECHA DICTAMEN: ${errFD}`)
    const { date: vigenciaInicio, error: errVI } = parseFechaDMY(getCell(row, COL.vigenciaInicio))
    if (errVI) reportar(`VIGENCIA INICIO: ${errVI}`)
    const { date: vigenciaFin, error: errVT } = parseFechaDMY(getCell(row, COL.vigenciaTermino))
    if (errVT) reportar(`VIGENCIA TERMINO: ${errVT}`)

    const { value: importeBruto, error: errImp } = parseImporte(getCell(row, COL.importeBruto))
    if (errImp) reportar(errImp)

    const regimen = normalizeRegimen(getCell(row, COL.regimen))
    if (!regimen) { regimenNoReconocido++; reportar(`RÉGIMEN no reconocido: "${getCell(row, COL.regimen)}"`) }

    // Cadena de resolución de periodo: vigencia inicio -> folio dictamen -> folio justificación -> (solo en modo borrador) periodo de hoy.
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
        unidad_administrativa: getCell(row, COL.unidadAdscripcion) || null,
        unidad_responsable:    getCell(row, COL.unidadResponsableGasto) || null,
        programa_proyecto:     getCell(row, COL.programaProyecto) || null,
        regimen,
        tipo_actividades:      getCell(row, COL.tipoActividad) || null,
        numero_prestadores:    parseInt(getCell(row, COL.numPrestadores)) || null,
        vigencia_inicio:       vigenciaInicio,
        vigencia_fin:          vigenciaFin,
        importe_bruto:         importeBruto,
        nivel_tabulador:       getCell(row, COL.nivelCategoria) || null,
        objeto:                getCell(row, COL.objeto) || null,
        actividades:           splitBullets(getCell(row, COL.actividades)),
        responsabilidades:     splitBullets(getCell(row, COL.responsabilidades)),
        escolaridad:           getCell(row, COL.escolaridad) || null,
        comp_adm:              getCell(row, COL.compAdm) || null,
        comp_tec:              getCell(row, COL.compTec) || null,
        comp_soc:              getCell(row, COL.compSoc) || null,
        valores:               getCell(row, COL.valores) || null,
        areas_exp:             getCell(row, COL.areasExp) || null,
      })
    }
  }

  // ── Reporte ──────────────────────────────────────────────────────────
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
  if (MODO_BORRADOR) {
    const conAdvertencias = resultados.filter((r) => r.errores.length === 0 && r.advertencias.length > 0)
    if (conAdvertencias.length > 0) {
      console.log(`\nModo borrador: ${conAdvertencias.length} filas se van a importar igual, con estos datos incompletos/dudosos para revisión manual:`)
      for (const r of conAdvertencias) {
        console.log(`  Fila ${r.idx} [${r.secretariaRaw}] folio=${r.folioDictamen || "(sin folio)"}: ${r.advertencias.join(" | ")}`)
      }
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
