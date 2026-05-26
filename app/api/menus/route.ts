import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

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
  const userId    = req.nextUrl.searchParams.get("userId")
  if (!rolNombre) {
    return NextResponse.json({ error: "Falta parámetro 'rol'" }, { status: 400 })
  }

  try {
    const rolRes = await pool.query(
      "SELECT id FROM rol WHERE nombre = $1 AND activo = true LIMIT 1",
      [rolNombre]
    )
    if (rolRes.rowCount === 0) return NextResponse.json([])

    const rolId: number = rolRes.rows[0].id

    // Query 1: menus from role (always)
    const rolMenuRes = await pool.query(
      `SELECT DISTINCT m.id, m.nombre, m.ruta, m.orden, m.activo, m.icono, m.key, m.parent_id
       FROM menu m
       INNER JOIN rol_menu rm ON rm.menu_id = m.id
       WHERE rm.rol_id = $1 AND m.activo = true
       ORDER BY m.orden ASC`,
      [rolId]
    )

    // Query 2: extra menus for this specific user (optional — ignore if table missing)
    let userMenuRows: any[] = []
    if (userId) {
      try {
        const userMenuRes = await pool.query(
          `SELECT DISTINCT m.id, m.nombre, m.ruta, m.orden, m.activo, m.icono, m.key, m.parent_id
           FROM menu m
           INNER JOIN usuario_menu um ON um.menu_id = m.id
           WHERE um.usuario_id = $1 AND m.activo = true`,
          [userId]
        )
        userMenuRows = userMenuRes.rows
      } catch {
        // usuario_menu may not exist yet — silently ignore
      }
    }

    // Combine, deduplicating by id
    const seenIds = new Set<number>()
    const combined: any[] = []
    for (const row of [...rolMenuRes.rows, ...userMenuRows]) {
      if (!seenIds.has(row.id)) { seenIds.add(row.id); combined.push(row) }
    }

    // Fetch parent sections for any menu whose parent isn't already included
    const parentIds = combined
      .filter((r) => r.parent_id && !seenIds.has(r.parent_id))
      .map((r) => r.parent_id as number)

    let allRows = combined
    if (parentIds.length > 0) {
      const parentRes = await pool.query(
        `SELECT id, nombre, ruta, orden, activo, icono, key, parent_id
         FROM menu WHERE id = ANY($1::int[]) AND activo = true`,
        [parentIds]
      )
      allRows = [...parentRes.rows, ...combined]
    }

    // Build tree
    const nodeMap = new Map<number, MenuNode>()
    for (const m of allRows) {
      if (!nodeMap.has(m.id)) {
        nodeMap.set(m.id, {
          id: String(m.id),
          key: m.key ?? null,
          label: m.nombre,
          icon: m.icono ?? null,
          route: m.ruta ?? null,
          orden: m.orden ?? 0,
          children: [],
        })
      }
    }

    const roots: MenuNode[] = []
    for (const m of allRows) {
      const node = nodeMap.get(m.id)!
      if (m.parent_id && nodeMap.has(m.parent_id)) {
        const parent = nodeMap.get(m.parent_id)!
        if (!parent.children.some((c) => c.id === node.id)) {
          parent.children.push(node)
        }
      } else if (!roots.some((r) => r.id === node.id)) {
        roots.push(node)
      }
    }

    return NextResponse.json(roots)
  } catch (err) {
    console.error("[GET /api/menus] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    )
  }
}
