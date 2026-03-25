import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

function toResponse(h: {
  id: string
  nombre_archivo: string
  subido_en: Date
  sheet_names: string[]
  sheets: unknown
}) {
  return {
    id: h.id,
    nombreArchivo: h.nombre_archivo,
    subidoEn: h.subido_en.toISOString(),
    sheetNames: h.sheet_names,
    sheets: h.sheets as Record<string, Record<string, string | undefined>[]>,
  }
}

export async function GET() {
  try {
    const list = await prisma.historico.findMany({
      orderBy: { subido_en: "desc" },
    })
    return NextResponse.json(list.map(toResponse))
  } catch (e) {
    console.error("[GET /api/historico]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetNames = workbook.SheetNames.filter(Boolean)

    const sheets: Record<string, Record<string, string | undefined>[]> = {}
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name]
      if (!sheet) continue
      const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as string[][]
      if (raw.length < 2) {
        sheets[name] = []
        continue
      }
      const headers = raw[0].map((h) => (h ? String(h).trim() : ""))
      const rows: Record<string, string | undefined>[] = []
      for (let i = 1; i < raw.length; i++) {
        const row: Record<string, string | undefined> = {}
        const cells = raw[i]
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j]
          if (key) {
            const val = cells[j] ? String(cells[j]).trim() : undefined
            row[key] = val === "" ? undefined : val
          }
        }
        rows.push(row)
      }
      sheets[name] = rows
    }

    const created = await prisma.historico.create({
      data: {
        nombre_archivo: file.name,
        sheet_names: sheetNames,
        sheets: sheets as any,
      },
    })

    return NextResponse.json(toResponse(created), { status: 201 })
  } catch (e) {
    console.error("[POST /api/historico]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
