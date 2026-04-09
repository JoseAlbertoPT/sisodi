import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** PATCH /api/permisos-captura/[id]  { action: "revoke" | "consume" } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { action } = await req.json()
    const numId = Number(id)
    if (!numId) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

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
