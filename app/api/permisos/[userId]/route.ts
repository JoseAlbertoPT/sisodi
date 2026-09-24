import { NextRequest, NextResponse } from "next/server"
import { requireGestionUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

interface PermisosUser {
  menuIds: string[]
  menuActions: Record<string, string[]>
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const sesion = await requireGestionUsuarios()
  if (sesion instanceof NextResponse) return sesion

  const { userId } = await params

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol_id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // If the user has custom permissions saved → use those
  const userMenus = await prisma.usuario_menu.findMany({
    where: { usuario_id: userId },
  })

  if (userMenus.length > 0) {
    // User has explicit permissions — return them
    const menuActions: Record<string, string[]> = {}
    for (const um of userMenus) {
      if (um.acciones.length > 0) menuActions[String(um.menu_id)] = um.acciones
    }
    return NextResponse.json({
      menuIds: userMenus.map((um) => String(um.menu_id)),
      menuActions,
    } satisfies PermisosUser)
  }

  // First time: no custom permissions yet — pre-load from role defaults,
  // but exclude Tablero (dashboard) so it must be explicitly enabled per user
  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: user.rol_id },
    include: { menu: { select: { key: true } } },
  })

  return NextResponse.json({
    menuIds: rolMenus
      .filter((rm) => rm.menu?.key !== "dashboard")
      .map((rm) => String(rm.menu_id)),
    menuActions: {},
  } satisfies PermisosUser)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const sesion = await requireGestionUsuarios()
  if (sesion instanceof NextResponse) return sesion

  const { userId } = await params
  const body: PermisosUser = await req.json()

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol_id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const menuIds = body.menuIds
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id))
  const menuActions = body.menuActions ?? {}

  // Replace the user's complete permission list
  await prisma.usuario_menu.deleteMany({ where: { usuario_id: userId } })
  if (menuIds.length > 0) {
    await prisma.usuario_menu.createMany({
      data: menuIds.map((menuId) => ({
        usuario_id: userId,
        menu_id: menuId,
        acciones: menuActions[String(menuId)] ?? [],
      })),
    })
  }

  const savedMenuActions: Record<string, string[]> = {}
  for (const menuId of menuIds) {
    const acciones = menuActions[String(menuId)] ?? []
    if (acciones.length > 0) savedMenuActions[String(menuId)] = acciones
  }

  // Para que el usuario afectado vea sus apartados habilitados/deshabilitados
  // al instante, sin recargar la página.
  broadcastUpdate(["permisos"])

  return NextResponse.json({
    menuIds: menuIds.map(String),
    menuActions: savedMenuActions,
  } satisfies PermisosUser)
}
