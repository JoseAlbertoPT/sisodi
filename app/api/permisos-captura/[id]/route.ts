import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { puedeGestionarUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { id } = await params
    const { action } = await req.json()
    const numId = Number(id)
    if (!numId) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

    // Revocar: solo quien gestiona usuarios. Consumir: solo el dueño del permiso.
    const permiso = await prisma.permiso_captura.findUnique({ where: { id: numId }, select: { usuario_id: true } })
    if (!permiso) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    const autorizado = action === "consume"
      ? permiso.usuario_id === sesion.id
      : await puedeGestionarUsuarios(sesion.id)
    if (!autorizado) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

    let updated
    if (action === "revoke") {
      updated = await prisma.permiso_captura.update({
        where: { id: numId },
        data: { active: false },
      })
    } else if (action === "consume") {
      updated = await prisma.permiso_captura.update({
        where: { id: numId },
        data: { active: false, used: true, consumed_at: new Date() },
      })
    } else {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
    }

    broadcastUpdate(["permisos-captura"])

    return NextResponse.json({
      id: updated.id, userId: updated.usuario_id, regimen: updated.regimen,
      periodo: updated.periodo, active: updated.active, used: updated.used,
      grantedAt: updated.granted_at.toISOString().replace("T", " ").slice(0, 16),
      grantedBy: updated.granted_by,
      consumedAt: updated.consumed_at ? updated.consumed_at.toISOString().replace("T", " ").slice(0, 16) : null,
    })
  } catch (e) {
    console.error("[PATCH /api/permisos-captura/[id]]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
