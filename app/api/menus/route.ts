import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface MenuNode {
  id: string
  key: string | null
  label: string
  icon: string | null
  route: string | null
  orden: number
  children: MenuNode[]
}

export async function GET(req: NextRequest) {
  const rolNombre = req.nextUrl.searchParams.get("rol")
  if (!rolNombre) {
    return NextResponse.json({ error: "Falta parámetro 'rol'" }, { status: 400 })
  }
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } })
  if (!rol) {
    return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
  }

  // Get menu IDs assigned to this role
  const rolMenus = await prisma.rol_menu.findMany({
    where: { rol_id: rol.id },
    select: { menu_id: true },
  })
  const menuIds = new Set(rolMenus.map((rm) => rm.menu_id))

  // Fetch all menus that are active and assigned to this role
  const allMenus = await prisma.menu.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
  })

  // Auto-include parents if a child is assigned but parent isn't
  for (const m of allMenus) {
    if (menuIds.has(m.id) && m.parent_id && !menuIds.has(m.parent_id)) {
      menuIds.add(m.parent_id)

    }
  }

  // Filter to only assigned menus
  const assigned = allMenus.filter((m) => menuIds.has(m.id))

  // Build tree (flat → nested)
  const nodeMap = new Map<number, MenuNode>()
  for (const m of assigned) {
    nodeMap.set(m.id, {
      id: String(m.id),
      key: m.key,
      label: m.nombre,
      icon: m.icono,
      route: m.ruta,
      orden: m.orden ?? 0,
      children: [],
    })
  }

  const roots: MenuNode[] = []
  for (const m of assigned) {
    const node = nodeMap.get(m.id)!
    if (m.parent_id && nodeMap.has(m.parent_id)) {
      nodeMap.get(m.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return NextResponse.json(roots)
}
