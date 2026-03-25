import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const organo = await prisma.organo_centralizado.findUnique({ where: { id } })
    if (!organo) return err("No encontrado", 404)
    return NextResponse.json(organo)
  } catch (e) {
    console.error("[GET /api/catalogo/centralizada/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.nombre !== undefined) data.nombre = body.nombre.trim()
    if (body.parentId !== undefined) data.parent_id = body.parentId || null
    if (body.orden !== undefined) data.orden = body.orden
    if (body.tipo !== undefined) data.tipo = body.tipo || null

    const updated = await prisma.organo_centralizado.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    console.error("[PATCH /api/catalogo/centralizada/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.organo_centralizado.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/catalogo/centralizada/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
