"use client"

import * as XLSX from "xlsx"

export interface OrganismoImportRow {
  organismo: string
  area: string
}

export interface OrganismoImportSkip {
  fila: number
  motivo: string
}

export interface ParseOrganismosResult {
  rows: OrganismoImportRow[]
  skipped: OrganismoImportSkip[]
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function normHeader(s: string): string {
  return stripAccents(String(s).trim().toLowerCase())
}

const ORGANISMO_HEADERS = ["organismo", "organismo paraestatal", "dependencia"]
const AREA_HEADERS = ["area", "área", "area interna", "área interna", "nombre area", "nombre área"]

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normHeader)
  for (const c of candidates) {
    const idx = normalized.indexOf(c)
    if (idx !== -1) return idx
  }
  return -1
}

function cell(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

export async function parseOrganismosExcel(file: File): Promise<ParseOrganismosResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) return { rows: [], skipped: [] }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][]
  if (raw.length < 2) return { rows: [], skipped: [] }

  const headers = raw[0].map((h) => cell(h))
  const orgCol = findColumn(headers, ORGANISMO_HEADERS)
  const areaCol = findColumn(headers, AREA_HEADERS)

  if (orgCol === -1 || areaCol === -1) {
    throw new Error('El archivo debe tener columnas "Organismo" y "Área".')
  }

  const rows: OrganismoImportRow[] = []
  const skipped: OrganismoImportSkip[] = []

  for (let i = 1; i < raw.length; i++) {
    const line = raw[i]
    const isEmpty = !line || line.every((c) => cell(c) === "")
    if (isEmpty) continue

    const organismo = cell(line[orgCol])
    const area = cell(line[areaCol])
    const filaNum = i + 1

    if (!organismo || !area) {
      skipped.push({ fila: filaNum, motivo: "Falta organismo o área" })
      continue
    }

    rows.push({ organismo, area })
  }

  return { rows, skipped }
}

export function downloadOrganismosTemplate() {
  const headers = ["Organismo", "Área"]
  const ejemplos = [
    ["Instituto Morelense de la Vivienda", "Dirección General"],
    ["Instituto Morelense de la Vivienda", "Subdirección de Finanzas"],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos])
  ws["!cols"] = [{ wch: 40 }, { wch: 36 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Organismos")
  XLSX.writeFile(wb, "plantilla_organismos.xlsx")
}
