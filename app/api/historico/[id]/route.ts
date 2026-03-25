import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const h = await prisma.historico.findUnique({ where: { id } })
    if (!h) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    return NextResponse.json(toResponse(h))
  } catch (e) {
    console.error("[GET /api/historico/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.historico.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/historico/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
