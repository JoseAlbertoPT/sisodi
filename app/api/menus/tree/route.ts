import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface TreeNode {
  id: string
  key: string | null
  label: string
  icon: string | null
  route: string | null
  orden: number
  children: TreeNode[]
  acciones: { code: string; label: string }[]
}
export async function GET() {
  // Get all active menus
  const allMenus = await prisma.menu.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
  })

  // Get all acciones
  const allAcciones = await prisma.accion.findMany()

  // Build tree
  const nodeMap = new Map<number, TreeNode>()
  for (const m of allMenus) {
    nodeMap.set(m.id, {
      id: String(m.id),
      key: m.key,
      label: m.nombre,
      icon: m.icono,
      route: m.ruta,
      orden: m.orden ?? 0,
      children: [],
      acciones: [],
    })
  }

  // Assign acciones to leaf menus (menus with a key/route)
  // Each leaf menu gets all available acciones
  for (const m of allMenus) {
    if (m.key && nodeMap.has(m.id)) {
      nodeMap.get(m.id)!.acciones = allAcciones.map((a) => ({
        code: a.nombre,
        label: a.descripcion ?? a.nombre,
      }))
    }
  }

  const roots: TreeNode[] = []
  for (const m of allMenus) {
    const node = nodeMap.get(m.id)!
    if (m.parent_id && nodeMap.has(m.parent_id)) {
      nodeMap.get(m.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return NextResponse.json(roots)
}
