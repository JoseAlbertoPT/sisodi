import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET() {
  try {
    const organos = await prisma.organo_paraestatal.findMany({
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    })
    return NextResponse.json(organos)
  } catch (e) {
    console.error("[GET /api/catalogo/paraestatal/organos]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, categoriaId, orden, ua_clave_administrativa, clave_reporte_plazas } = await req.json()
    if (!nombre?.trim()) return err("El nombre es requerido")
    if (!categoriaId) return err("La categoría es requerida")

    const created = await prisma.organo_paraestatal.create({
      data: {
        nombre: nombre.trim(),
        categoria_id: categoriaId,
        orden: orden ?? 0,
        ua_clave_administrativa: ua_clave_administrativa?.trim() || null,
        clave_reporte_plazas: clave_reporte_plazas?.trim() || null,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/paraestatal/organos]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}