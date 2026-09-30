import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, ENTIDADES_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const categorias = await prisma.categoria_paraestatal.findMany({
      include: { organos: { orderBy: [{ orden: "asc" }, { nombre: "asc" }] } },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    })
    return NextResponse.json(categorias)
  } catch (e) {
    console.error("[GET /api/catalogo/paraestatal/categorias]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, ENTIDADES_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const { nombre, orden } = await req.json()
    if (!nombre?.trim()) return err("El nombre es requerido")

    const created = await prisma.categoria_paraestatal.create({
      data: { nombre: nombre.trim(), orden: orden ?? 0 },
      include: { organos: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/paraestatal/categorias]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}