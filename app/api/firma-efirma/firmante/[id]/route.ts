import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Permite corregir el nombre / cargo impreso de un firmante que YA firmó,
// para arreglar errores de captura (typos, mayúsculas de más, etc.) sin
// deshacer su firma electrónica ya completada. Solo aplica mientras el
// proceso de firma sigue en curso — una vez "completado" (dictamen emitido),
// cualquier corrección debe pasar por un proceso formal, no por aquí.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { id } = await params
    const idNum = Number(id)
    if (!Number.isInteger(idNum)) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })
    }

    const { nombre, cargo_firmante } = await req.json()
    if (nombre === undefined && cargo_firmante === undefined) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { id: idNum },
      include: { firma_proceso: { select: { estado: true } } },
    })
    if (!firmante) return NextResponse.json({ ok: false, error: "Firmante no encontrado" }, { status: 404 })
    if (!firmante.firmado) {
      return NextResponse.json({ ok: false, error: "Este firmante todavía no ha firmado" }, { status: 400 })
    }
    if (firmante.firma_proceso.estado === "completado") {
      return NextResponse.json({ ok: false, error: "El proceso de firma ya está completado; no se puede editar" }, { status: 409 })
    }

    const data: Record<string, string> = {}
    if (nombre !== undefined) {
      if (!String(nombre).trim()) return NextResponse.json({ ok: false, error: "El nombre no puede quedar vacío" }, { status: 400 })
      data.nombre = String(nombre).trim()
    }
    if (cargo_firmante !== undefined) {
      if (!String(cargo_firmante).trim()) return NextResponse.json({ ok: false, error: "El cargo no puede quedar vacío" }, { status: 400 })
      data.cargo_firmante = String(cargo_firmante).trim()
    }

    const actualizado = await prisma.firma_firmante.update({ where: { id: idNum }, data })

    return NextResponse.json({
      ok: true,
      firmante: { id: actualizado.id, nombre: actualizado.nombre, cargo_firmante: actualizado.cargo_firmante },
    })
  } catch (err: any) {
    console.error("[PATCH /api/firma-efirma/firmante/:id]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
