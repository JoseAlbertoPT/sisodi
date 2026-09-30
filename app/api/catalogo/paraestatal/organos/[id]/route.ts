import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, ENTIDADES_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, ENTIDADES_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.nombre !== undefined) data.nombre = body.nombre.trim()
    if (body.orden !== undefined) data.orden = body.orden
    if (body.ua_clave_administrativa !== undefined) data.ua_clave_administrativa = body.ua_clave_administrativa?.trim() || null
    if (body.clave_reporte_plazas !== undefined) data.clave_reporte_plazas = body.clave_reporte_plazas?.trim() || null

    const updated = await prisma.organo_paraestatal.update({
      where: { id: Number(id) },
      data,
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
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, ENTIDADES_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const { id } = await params
    const organo = await prisma.organo_paraestatal.findUnique({
      where: { id: Number(id) },
    })
    if (!organo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const usuariosCount = await prisma.usuario.count({
      where: {
        secretaria_id: null,
        OR: [
          { secretaria_texto: { equals: organo.nombre, mode: "insensitive" } },
          { secretaria_texto: { endsWith: ` > ${organo.nombre}`, mode: "insensitive" } },
        ],
      },
    })
    if (usuariosCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${usuariosCount} usuario${usuariosCount !== 1 ? "s" : ""} asignado${usuariosCount !== 1 ? "s" : ""}` },
        { status: 400 }
      )
    }
    await prisma.organo_paraestatal.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/catalogo/paraestatal/organos/:id]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}