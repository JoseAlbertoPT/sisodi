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

    if (body.nombre !== undefined) {
      const nombre = body.nombre.trim()
      const current = await prisma.organo_centralizado.findUnique({ where: { id } })
      if (!current) return err("No encontrado", 404)

      const duplicate = await prisma.organo_centralizado.findFirst({
        where: {
          nombre: { equals: nombre, mode: "insensitive" },
          parent_id: current.parent_id,
          id: { not: id },
        },
      })
      if (duplicate) return err("Ya existe un registro con ese nombre")
      data.nombre = nombre
    }

    if (body.parentId !== undefined) data.parent_id = body.parentId || null
    if (body.orden !== undefined) data.orden = body.orden
    if (body.tipo !== undefined) data.tipo = body.tipo || null
    if (body.ua_clave_administrativa !== undefined) data.ua_clave_administrativa = body.ua_clave_administrativa?.trim() || null
    if (body.clave_reporte_plazas !== undefined) data.clave_reporte_plazas = body.clave_reporte_plazas?.trim() || null

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
    const usuariosCount = await prisma.usuario.count({ where: { secretaria_id: id } })
    if (usuariosCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${usuariosCount} usuario${usuariosCount !== 1 ? "s" : ""} asignado${usuariosCount !== 1 ? "s" : ""}` },
        { status: 400 }
      )
    }
    await prisma.organo_centralizado.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/catalogo/centralizada/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
