import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { puedeGestionarUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { otorgadoMinimoVigente, permisoVencido, venceEnPermiso, fechaHoraMx } from "@/lib/permiso-expiracion"

function toClient(p: {
  id: number; usuario_id: string; regimen: string; periodo: string
  active: boolean; used: boolean; granted_at: Date; granted_by: string; consumed_at: Date | null
}) {
  return {
    id: p.id,
    userId: p.usuario_id,
    regimen: p.regimen,
    periodo: p.periodo,
    active: p.active && !permisoVencido(p.granted_at),
    used: p.used,
    grantedAt: fechaHoraMx(p.granted_at),
    /** ISO completo: el cliente lo usa para dejar de tratarlo como activo al vencer. */
    venceAt: venceEnPermiso(p.granted_at).toISOString(),
    grantedBy: p.granted_by,
    consumedAt: p.consumed_at ? fechaHoraMx(p.consumed_at) : null,
  }
}

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const usuarioId = req.nextUrl.searchParams.get("usuarioId")
    // Los permisos vencidos (más de 3 días desde que se otorgaron) se
    // desactivan en la BD, para que ninguna otra consulta los tome por activos.
    await prisma.permiso_captura.updateMany({
      where: { active: true, used: false, granted_at: { lte: otorgadoMinimoVigente() } },
      data:  { active: false },
    })
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
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  // Otorgar captura se hace desde Configuración > Usuarios.
  if (!(await puedeGestionarUsuarios(sesion.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const { usuarioId, regimen, periodo, grantedBy } = await req.json()
    if (!usuarioId || !regimen || !periodo || !grantedBy)
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })

    await prisma.permiso_captura.updateMany({
      where: { usuario_id: usuarioId, regimen, periodo, active: true, used: false },
      data: { active: false },
    })

    const created = await prisma.permiso_captura.create({
      // Quien otorga es el usuario de la sesión (el cliente manda su propio nombre).
      data: { usuario_id: usuarioId, regimen, periodo, granted_by: sesion.nombre || grantedBy },
    })
    broadcastUpdate(["permisos-captura"])
    return NextResponse.json(toClient(created), { status: 201 })
  } catch (e) {
    console.error("[POST /api/permisos-captura]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
