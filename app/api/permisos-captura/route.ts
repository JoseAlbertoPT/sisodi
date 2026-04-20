import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function toClient(p: {
  id: number; usuario_id: string; regimen: string; periodo: string
  active: boolean; used: boolean; granted_at: Date; granted_by: string; consumed_at: Date | null
}) {
  return {
    id: p.id,
    userId: p.usuario_id,
    regimen: p.regimen,
    periodo: p.periodo,
    active: p.active,
    used: p.used,
    grantedAt: p.granted_at.toISOString().replace("T", " ").slice(0, 16),
    grantedBy: p.granted_by,
    consumedAt: p.consumed_at ? p.consumed_at.toISOString().replace("T", " ").slice(0, 16) : null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const usuarioId = req.nextUrl.searchParams.get("usuarioId")
    const rows = await prisma.permiso_captura.findMany({
      where: usuarioId ? { usuario_id: usuarioId } : undefined,
      orderBy: { granted_at: "desc" },
    })
    return NextResponse.json(rows.map(toClient))
  } catch (e) {
    console.error("[GET /api/permisos-captura]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { usuarioId, regimen, periodo, grantedBy } = await req.json()
    if (!usuarioId || !regimen || !periodo || !grantedBy)
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })

    await prisma.permiso_captura.updateMany({
      where: { usuario_id: usuarioId, regimen, periodo, active: true, used: false },
      data: { active: false },
    })

    const created = await prisma.permiso_captura.create({
      data: { usuario_id: usuarioId, regimen, periodo, granted_by: grantedBy },
    })
    return NextResponse.json(toClient(created), { status: 201 })
  } catch (e) {
    console.error("[POST /api/permisos-captura]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
