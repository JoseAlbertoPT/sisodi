import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureOrganismoParaestatal } from "@/lib/sync-organismo-paraestatal"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

interface FlatNode {
  id: string
  nombre: string
  orden: number
  tipo: string | null
  parent_id: string | null
  ua_clave_administrativa: string | null
  clave_reporte_plazas: string | null
}

interface TreeNode extends FlatNode {
  children: TreeNode[]
}

function buildTree(flat: FlatNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of flat) {
    map.set(node.id, { ...node, children: [] })
  }

  for (const node of flat) {
    const treeNode = map.get(node.id)!
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(treeNode)
    } else {
      roots.push(treeNode)
    }
  }

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}

export async function GET() {
  try {
    const all = await prisma.organo_centralizado.findMany({
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    })
    return NextResponse.json(buildTree(all))
  } catch (e) {
    console.error("[GET /api/catalogo/centralizada]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, parentId, orden, tipo, ua_clave_administrativa, clave_reporte_plazas } = await req.json()
    if (!nombre?.trim()) return err("El nombre es requerido")

    const duplicate = await prisma.organo_centralizado.findFirst({
      where: {
        nombre: { equals: nombre.trim(), mode: "insensitive" },
        parent_id: parentId || null,
      },
    })
    if (duplicate) return err("Ya existe un registro con ese nombre")

    const created = await prisma.$transaction(async (tx) => {
      const secretaria = await tx.organo_centralizado.create({
        data: {
          nombre: nombre.trim(),
          parent_id: parentId || null,
          orden: orden ?? 0,
          tipo: tipo || null,
          ua_clave_administrativa: ua_clave_administrativa?.trim() || null,
          clave_reporte_plazas: clave_reporte_plazas?.trim() || null,
        },
      })
      if (!parentId) await ensureOrganismoParaestatal(tx, secretaria.nombre)
      return secretaria
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo/centralizada]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
