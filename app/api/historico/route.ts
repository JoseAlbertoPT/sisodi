import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

function toResponse(h: {
  id: string
  nombre_archivo: string
  subido_en: Date
  sheet_names: string[]
  sheets: unknown
  nombre_archivo2?: string | null
  sheet_names2?: string[] | null
  sheets2?: unknown
}) {
  return {
    id: h.id,
    nombreArchivo: h.nombre_archivo,
    subidoEn: h.subido_en.toISOString(),
    sheetNames: h.sheet_names,
    sheets: h.sheets as Record<string, Record<string, string | undefined>[]>,
    nombreArchivo2: h.nombre_archivo2 ?? null,
    sheetNames2: h.sheet_names2 ?? null,
    sheets2: (h.sheets2 ?? null) as Record<string, Record<string, string | undefined>[]> | null,
  }
}

function cellValueToString(rawValue: unknown, cellObj: XLSX.CellObject | undefined): string {
  if (rawValue === null || rawValue === undefined || rawValue === "") return ""
  if (cellObj?.w && String(cellObj.w).trim() !== "") return String(cellObj.w).trim()
  if (typeof rawValue === "number" && rawValue > 40000 && rawValue < 60000) {
    const date = XLSX.SSF.parse_date_code(rawValue)
    if (date) {
      const d = String(date.d).padStart(2, "0")
      const m = String(date.m).padStart(2, "0")
      return `${d}/${m}/${date.y}`
    }
  }
  if (rawValue instanceof Date) {
    const d = String(rawValue.getDate()).padStart(2, "0")
    const m = String(rawValue.getMonth() + 1).padStart(2, "0")
    const y = rawValue.getFullYear()
    return `${d}/${m}/${y}`
  }
  return String(rawValue).trim()
}

function parseXlsxFile(buffer: ArrayBuffer): {
  sheetNames: string[]
  sheets: Record<string, Record<string, string | undefined>[]>
} {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    cellText: true,
    raw: true,
  })

  const sheetNames = workbook.SheetNames.filter(Boolean)
  const sheets: Record<string, Record<string, string | undefined>[]> = {}

  for (const name of sheetNames) {
    const ws = workbook.Sheets[name]
    if (!ws) continue

    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1")
    const headers: string[] = []

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c: col })
      const cell: XLSX.CellObject | undefined = ws[cellAddr]
      headers.push(cell ? cellValueToString(cell.v, cell) : "")
    }

    if (headers.every((h) => !h)) { sheets[name] = []; continue }

    const rows: Record<string, string | undefined>[] = []

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const rowObj: Record<string, string | undefined> = {}
      let hasData = false

      for (let col = range.s.c; col <= range.e.c; col++) {
        const key = headers[col - range.s.c]
        if (!key) continue
        const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
        const cell: XLSX.CellObject | undefined = ws[cellAddr]
        if (!cell || cell.v === undefined || cell.v === null || cell.v === "") {
          rowObj[key] = undefined
          continue
        }
        const val = cellValueToString(cell.v, cell)
        rowObj[key] = val === "" ? undefined : val
        if (val !== "") hasData = true
      }

      if (hasData) rows.push(rowObj)
    }

    sheets[name] = rows
  }

  return { sheetNames, sheets }
}

export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const list = await prisma.historico.findMany({ orderBy: { subido_en: "desc" } })
    return NextResponse.json(list.map(toResponse))
  } catch (e) {
    console.error("[GET /api/historico]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (!file.name.toLowerCase().endsWith(".xlsx"))
      return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 })

    const { sheetNames, sheets } = parseXlsxFile(await file.arrayBuffer())

    const file2 = formData.get("file2") as File | null
    let nombreArchivo2: string | null = null
    let sheetNames2: string[] | null = null
    let sheets2: Record<string, Record<string, string | undefined>[]> | null = null

    if (file2 && file2.size > 0) {
      if (!file2.name.toLowerCase().endsWith(".xlsx"))
        return NextResponse.json({ error: "El segundo archivo debe ser .xlsx" }, { status: 400 })

      const parsed2 = parseXlsxFile(await file2.arrayBuffer())
      nombreArchivo2 = file2.name
      sheetNames2 = parsed2.sheetNames
      sheets2 = parsed2.sheets
    }

    const created = await prisma.historico.create({
      data: {
        nombre_archivo: file.name,
        sheet_names: sheetNames,
        sheets: sheets as any,
        nombre_archivo2: nombreArchivo2,
        sheet_names2: sheetNames2 ?? [],
        sheets2: sheets2 as any ?? {},
      },
    })

    return NextResponse.json(toResponse(created), { status: 201 })
  } catch (e) {
    console.error("[POST /api/historico]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}