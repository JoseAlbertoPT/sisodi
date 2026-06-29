import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body  = await req.json()
    const { activo } = body

    if (typeof activo !== "boolean") {
      return NextResponse.json({ error: "Se requiere el campo 'activo' (boolean)" }, { status: 400 })
    }

    const record = await prisma.catalogo_justificacion.update({
      where: { id: Number(id) },
      data:  { activo },
    })

    return NextResponse.json({ record })
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 })
    }
    console.error("[PATCH /api/catalogo-justificaciones/[id]]", e)
    return NextResponse.json({ error: "Error al actualizar registro" }, { status: 500 })
  }
}
