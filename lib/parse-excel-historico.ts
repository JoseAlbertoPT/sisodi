"use client"

import * as XLSX from "xlsx"

/**
 * Row from the justificaciones Excel. Keys match column headers exactly
 * (e.g. "SECRETARÍA/SUBSECRETARÍA/DEPENDENCIA/ORGANISMO AUXILIAR").
 */
export type HistoricoRow = Record<string, string | undefined>

export interface ParseExcelResult {
  sheetNames: string[]
  getRowsBySheet: (sheetName: string) => HistoricoRow[]
}

function trimCell(value: unknown): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s === "" ? undefined : s
}

/**
 * Parses an Excel file and returns sheet names plus a function to get
 * rows per sheet (first row = headers, remaining rows = data as key-value by header).
 */
export async function parseExcelFile(file: File): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetNames = workbook.SheetNames.filter(Boolean)
  const sheetRowsCache: Record<string, HistoricoRow[]> = {}

  function getRowsBySheet(sheetName: string): HistoricoRow[] {
    if (sheetRowsCache[sheetName]) return sheetRowsCache[sheetName]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return []
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][]
    if (raw.length < 2) {
      sheetRowsCache[sheetName] = []
      return sheetRowsCache[sheetName]
    }
    const headers = raw[0].map((h) => trimCell(h) ?? "")
    const rows: HistoricoRow[] = []
    for (let i = 1; i < raw.length; i++) {
      const row: HistoricoRow = {}
      const cells = raw[i]
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j]
        if (key) row[key] = trimCell(cells[j])
      }
      rows.push(row)
    }
    sheetRowsCache[sheetName] = rows
    return sheetRowsCache[sheetName]
  }

  return { sheetNames, getRowsBySheet }
}
