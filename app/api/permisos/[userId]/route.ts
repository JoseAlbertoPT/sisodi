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

  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: user.rol_id },
    include: {
      rol_menu_accion: {
        where: { activo: true },
        include: { accion: true },
      },
    },
  })

  const menuIds = rolMenus.map((rm) => String(rm.menu_id))
  const menuActions: Record<string, string[]> = {}
  for (const rm of rolMenus) {
    const actions = rm.rol_menu_accion.map((rma) => rma.accion.nombre)
    if (actions.length > 0) {
      menuActions[String(rm.menu_id)] = actions
    }
  }

  const result: PermisosUser = { menuIds, menuActions }
  return NextResponse.json(result)
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

  const rolId = user.rol_id

  await prisma.rol_menu_accion.deleteMany({
    where: { rol_menu: { rol_id: rolId } },
  })
  await prisma.rol_menu.deleteMany({
    where: { rol_id: rolId },
  })

  for (const menuIdStr of body.menuIds) {
    const menuId = parseInt(menuIdStr, 10)
    const rolMenu = await prisma.rol_menu.create({
      data: { rol_id: rolId, menu_id: menuId },
    })

    const actionNames = body.menuActions[menuIdStr] ?? []
    if (actionNames.length > 0) {
      const acciones = await prisma.accion.findMany({
        where: { nombre: { in: actionNames } },
      })
      for (const accion of acciones) {
        await prisma.rol_menu_accion.create({
          data: {
            rol_menu_id: rolMenu.id,
            accion_id: accion.id,
            activo: true,
          },
        })
      }
    }
  }

  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: rolId },
    include: {
      rol_menu_accion: {
        where: { activo: true },
        include: { accion: true },
      },
    },
  })

  const menuIds = rolMenus.map((rm) => String(rm.menu_id))
  const menuActions: Record<string, string[]> = {}
  for (const rm of rolMenus) {
    const actions = rm.rol_menu_accion.map((rma) => rma.accion.nombre)
    if (actions.length > 0) {
      menuActions[String(rm.menu_id)] = actions
    }
  }

  return NextResponse.json({ menuIds, menuActions })
}
