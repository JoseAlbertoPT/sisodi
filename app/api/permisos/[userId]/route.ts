import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface PermisosUser {
  menuIds: string[]
  menuActions: Record<string, string[]>
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol_id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Menus from role (defaults)
  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: user.rol_id },
    include: {
      rol_menu_accion: { where: { activo: true }, include: { accion: true } },
    },
  })

  // Extra menus assigned individually to this user
  const userMenus = await prisma.usuario_menu.findMany({
    where: { usuario_id: userId },
  })

  const rolMenuIdSet = new Set(rolMenus.map((rm) => String(rm.menu_id)))
  const extraMenuIds = userMenus
    .map((um) => String(um.menu_id))
    .filter((id) => !rolMenuIdSet.has(id))

  const menuIds = [...rolMenuIdSet, ...extraMenuIds]

  const menuActions: Record<string, string[]> = {}
  for (const rm of rolMenus) {
    const actions = rm.rol_menu_accion.map((rma) => rma.accion.nombre)
    if (actions.length > 0) menuActions[String(rm.menu_id)] = actions
  }

  return NextResponse.json({ menuIds, menuActions } satisfies PermisosUser)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const body: PermisosUser = await req.json()

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol_id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  // Role defaults — never modified
  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: user.rol_id },
  })
  const rolMenuIdSet = new Set(rolMenus.map((rm) => String(rm.menu_id)))

  // Only save extras (menus beyond the role defaults) to usuario_menu
  const extraMenuIds = body.menuIds
    .filter((id) => !rolMenuIdSet.has(id))
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id))

  // Replace this user's extras
  await prisma.usuario_menu.deleteMany({ where: { usuario_id: userId } })
  for (const menuId of extraMenuIds) {
    await prisma.usuario_menu.create({ data: { usuario_id: userId, menu_id: menuId } })
  }

  // Return combined result
  const userMenus = await prisma.usuario_menu.findMany({ where: { usuario_id: userId } })
  const allMenuIds = [
    ...rolMenus.map((rm) => String(rm.menu_id)),
    ...userMenus.map((um) => String(um.menu_id)),
  ]

  const rolMenusFull = await prisma.rol_menu.findMany({
    where: { rol_id: user.rol_id },
    include: {
      rol_menu_accion: { where: { activo: true }, include: { accion: true } },
    },
  })
  const menuActions: Record<string, string[]> = {}
  for (const rm of rolMenusFull) {
    const actions = rm.rol_menu_accion.map((rma) => rma.accion.nombre)
    if (actions.length > 0) menuActions[String(rm.menu_id)] = actions
  }

  return NextResponse.json({ menuIds: allMenuIds, menuActions } satisfies PermisosUser)
}
