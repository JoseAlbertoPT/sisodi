import "dotenv/config"
import * as XLSX from "xlsx"
import { prisma } from "../lib/prisma"

// Completa catalogo_justificacion.tipo_pago para registros que ya fueron cargados
// desde BD-CATALOGO-SISODIJ-DGSAC_CONSOLIDADO.xlsx pero quedaron con tipo_pago = null
// porque el proceso que los insertó no leyó la periodicidad de la celda
// "IMPORTE BRUTO (mensual/por día/por hora)" (solo el monto). No se toca la tabla
// solicitud aquí: import-historico-consolidado.ts ya se encarga de eso para futuras cargas.

const FILE_PATH = process.argv.find((a) => !a.startsWith("--") && a.endsWith(".xlsx"))
  ?? "C:/Users/SAFDGSAC035/Downloads/BD-CATALOGO-SISODIJ-DGSAC_CONSOLIDADO.xlsx"
const SHEET_NAME = "BASE CONSOLIDADA"
const COMMIT = process.argv.includes("--commit")

const COL = {
  folioJustificacion: "FOLIO DE JUSTIFICACIÓN/DESCRIPCIÓN",
  folioDictamen:      "FOLIO DE DICTAMEN/OPINIÓN",
  importeBruto:       "IMPORTE BRUTO (mensual/por día/por hora)",
  programaProyecto:   "PROGRAMA O PROYECTO",
}

function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().trim().replace(/\s+/g, " ")
}

function parseTipoPago(raw: string): string {
  const u = norm(raw)
  if (u.includes("POR HORA")) return "Por_hora"
  if (u.includes("POR DIA")) return "Por_dia"
  if (u.includes("POR TALLER")) return "Por_taller"
  if (u.includes("UNICO")) return "Unico"
  return "Mensual"
}

function parseImporte(raw: string): number | null {
  let s = (raw ?? "").trim()
  if (!s) return null
  s = s.replace(/^\$/, "").trim()
  const commaCount = (s.match(/,/g) ?? []).length
  const dotCount   = (s.match(/\./g) ?? []).length
  let normalized: string
  if (commaCount >= 2) {
    const parts = s.split(",")
    const dec = parts.pop()
    normalized = parts.join("") + "." + dec
  } else if (dotCount >= 1 && commaCount === 1) {
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else if (commaCount === 1) {
    normalized = s.replace(",", ".")
  } else {
    normalized = s
  }
  const value = parseFloat(normalized)
  return isNaN(value) ? null : value
}

function getCell(row: Record<string, string | undefined>, col: string): string {
  return (row[col] ?? "").toString().trim()
}

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

  type ExcelRow = { folioJustificacion: string; folioDictamen: string; tipoImporte: string; importeValue: number | null; programa: string }
  const excelRows: ExcelRow[] = rows.map((row) => ({
    folioJustificacion: getCell(row, COL.folioJustificacion),
    folioDictamen:      getCell(row, COL.folioDictamen),
    tipoImporte:        parseTipoPago(getCell(row, COL.importeBruto)),
    importeValue:       parseImporte(getCell(row, COL.importeBruto)),
    programa:           getCell(row, COL.programaProyecto),
  }))

  const byFolioJustificacion = new Map<string, ExcelRow[]>()
  const byFolioDictamen = new Map<string, ExcelRow[]>()
  for (const er of excelRows) {
    if (er.folioJustificacion) {
      const arr = byFolioJustificacion.get(er.folioJustificacion) ?? []
      arr.push(er)
      byFolioJustificacion.set(er.folioJustificacion, arr)
    }
    if (er.folioDictamen) {
      const arr = byFolioDictamen.get(er.folioDictamen) ?? []
      arr.push(er)
      byFolioDictamen.set(er.folioDictamen, arr)
    }
  }

  const candidatos = await prisma.catalogo_justificacion.findMany({
    where: { tipo_pago: null, OR: [{ folio_dictamen: { not: null } }, { folio_justificacion: { not: null } }] },
    select: { id: true, folio_dictamen: true, folio_justificacion: true, programa_proyecto: true, importe_bruto: true },
  })
  console.log(`Registros candidatos (tipo_pago null, con folio): ${candidatos.length}`)

  const updates: { id: number; tipoImporte: string }[] = []
  const ambiguos: typeof candidatos = []
  const sinMatch: typeof candidatos = []

  for (const c of candidatos) {
    const dbImporte = c.importe_bruto != null ? Number(c.importe_bruto) : null

    let matches: ExcelRow[] = []
    if (c.folio_justificacion && byFolioJustificacion.has(c.folio_justificacion)) {
      matches = byFolioJustificacion.get(c.folio_justificacion)!
    } else if (c.folio_dictamen && byFolioDictamen.has(c.folio_dictamen)) {
      matches = byFolioDictamen.get(c.folio_dictamen)!
    }

    if (matches.length === 0) {
      sinMatch.push(c)
      continue
    }
    if (matches.length > 1) {
      // desambiguar por importe (y de coincidir varios, por programa)
      const porImporte = matches.filter((m) => dbImporte != null && m.importeValue != null && Math.abs(m.importeValue - dbImporte) < 0.01)
      if (porImporte.length === 1) {
        matches = porImporte
      } else {
        const porPrograma = matches.filter((m) => norm(m.programa) === norm(c.programa_proyecto ?? ""))
        if (porPrograma.length === 1) {
          matches = porPrograma
        } else {
          ambiguos.push(c)
          continue
        }
      }
    }

    updates.push({ id: c.id, tipoImporte: matches[0].tipoImporte })
  }

  const porTipo: Record<string, number> = {}
  for (const u of updates) porTipo[u.tipoImporte] = (porTipo[u.tipoImporte] ?? 0) + 1

  console.log(`\n──────── REPORTE ────────`)
  console.log(`Para actualizar (match único):  ${updates.length}`)
  console.log(`  Por tipo: ${JSON.stringify(porTipo)}`)
  console.log(`Ambiguos (varias filas del Excel comparten folio, no se pudo desambiguar): ${ambiguos.length}`)
  for (const a of ambiguos.slice(0, 20)) {
    console.log(`  cj.id=${a.id} folio_dictamen=${a.folio_dictamen} folio_justificacion=${a.folio_justificacion} importe=${a.importe_bruto}`)
  }
  console.log(`Sin match en el Excel: ${sinMatch.length}`)
  for (const s of sinMatch.slice(0, 20)) {
    console.log(`  cj.id=${s.id} folio_dictamen=${s.folio_dictamen} folio_justificacion=${s.folio_justificacion} importe=${s.importe_bruto}`)
  }

  if (!COMMIT) {
    console.log(`\nModo dry-run (sin --commit). No se escribió nada en la base de datos.`)
    return
  }

  console.log(`\nActualizando ${updates.length} registros...`)
  for (const u of updates) {
    await prisma.catalogo_justificacion.update({ where: { id: u.id }, data: { tipo_pago: u.tipoImporte } })
  }
  console.log(`Listo.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
