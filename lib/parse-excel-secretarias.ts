"use client"

import * as XLSX from "xlsx"

export interface SecretariaImportRow {
  secretaria: string
  ua: string
  clave: string
}

export interface SecretariaImportSkip {
  fila: number
  motivo: string
}

export interface ParseSecretariasResult {
  rows: SecretariaImportRow[]
  skipped: SecretariaImportSkip[]
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function normHeader(s: string): string {
  return stripAccents(String(s).trim().toLowerCase())
}

const SECRETARIA_HEADERS = ["secretaria", "dependencia"]
const UA_HEADERS = ["unidad administrativa", "ua", "unidad", "nombre ua"]
const CLAVE_HEADERS = ["clave", "clave reporte plazas", "clave administrativa", "clave ua"]

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

export async function parseSecretariasExcel(file: File): Promise<ParseSecretariasResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) return { rows: [], skipped: [] }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][]
  if (raw.length < 2) return { rows: [], skipped: [] }

  const headers = raw[0].map((h) => cell(h))
  const secCol = findColumn(headers, SECRETARIA_HEADERS)
  const uaCol = findColumn(headers, UA_HEADERS)
  const claveCol = findColumn(headers, CLAVE_HEADERS)

  if (secCol === -1 || uaCol === -1) {
    throw new Error('El archivo debe tener columnas "Secretaría" y "Unidad Administrativa".')
  }

  const rows: SecretariaImportRow[] = []
  const skipped: SecretariaImportSkip[] = []

  for (let i = 1; i < raw.length; i++) {
    const line = raw[i]
    const isEmpty = !line || line.every((c) => cell(c) === "")
    if (isEmpty) continue

    const secretaria = cell(line[secCol])
    const ua = cell(line[uaCol])
    const claveRaw = claveCol !== -1 ? cell(line[claveCol]) : ""
    const claveDigits = claveRaw.replace(/\D/g, "")
    const filaNum = i + 1

    if (!secretaria || !ua) {
      skipped.push({ fila: filaNum, motivo: "Falta secretaría o unidad administrativa" })
      continue
    }
    if (claveDigits.length < 7) {
      skipped.push({ fila: filaNum, motivo: "Clave inválida o incompleta (mínimo 7 dígitos)" })
      continue
    }

    rows.push({ secretaria, ua, clave: claveDigits })
  }

  return { rows, skipped }
}

export function downloadSecretariasTemplate() {
  const headers = ["Secretaría", "Unidad Administrativa", "Clave"]
  const ejemplos = [
    ["Secretaría de Gobierno", "Subsecretaría de Gobierno", "1234567"],
    ["Secretaría de Gobierno", "Dirección General Jurídica", "2345678"],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos])
  ws["!cols"] = [{ wch: 32 }, { wch: 36 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Secretarías")
  XLSX.writeFile(wb, "plantilla_secretarias.xlsx")
}
