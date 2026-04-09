import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface ImportRow {
  nombre: string
  ua_clave_administrativa?: string
  clave_reporte_plazas?: string
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json() as { rows: ImportRow[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Sin filas para importar" }, { status: 400 })
    }

    const data = rows
      .filter((r) => r.nombre?.trim())
      .map((r, i) => ({
        nombre: r.nombre.trim(),
        ua_clave_administrativa: r.ua_clave_administrativa?.trim() || null,
        clave_reporte_plazas: r.clave_reporte_plazas?.trim() || null,
        orden: i,
        parent_id: null,
        tipo: null,
      }))

    await prisma.organo_centralizado.createMany({ data, skipDuplicates: false })

    return NextResponse.json({ inserted: data.length }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/centralizada/import]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
