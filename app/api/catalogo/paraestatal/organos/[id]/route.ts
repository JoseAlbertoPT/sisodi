import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.nombre !== undefined) data.nombre = body.nombre.trim()
    if (body.categoriaId !== undefined) data.categoria_id = Number(body.categoriaId)
    if (body.orden !== undefined) data.orden = body.orden

    const updated = await prisma.organo_paraestatal.update({
      where: { id: Number(id) },
      data,
      include: { categoria: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error("[PATCH /api/catalogo/paraestatal/organos/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.organo_paraestatal.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/catalogo/paraestatal/organos/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
