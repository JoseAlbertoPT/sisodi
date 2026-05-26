import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ROL_MENUS: Record<string, number[]> = {
  "Administrador": [1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13],
  "Capturista":    [1, 3, 4],
  "UEFA":          [1, 5],
  "Enlace DGRH":   [1, 5],
  "Revisor":       [1, 7],
  "Validador":     [1, 8],
  "Emisor":        [1, 9, 10],
  "Consulta":      [1],
}

export async function POST() {
  try {
    const resultados: string[] = []

    for (const [rolNombre, menuIds] of Object.entries(ROL_MENUS)) {
      const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } })
      if (!rol) { resultados.push(`⚠️  Rol "${rolNombre}" no encontrado`); continue }

      // Borrar todos los menús actuales del rol
      await prisma.rol_menu_accion.deleteMany({ where: { rol_menu: { rol_id: rol.id } } })
      await prisma.rol_menu.deleteMany({ where: { rol_id: rol.id } })

      // Insertar solo los menús correctos
      for (const menuId of menuIds) {
        await prisma.rol_menu.create({ data: { rol_id: rol.id, menu_id: menuId } })
      }

      resultados.push(`✅ ${rolNombre}: menús [${menuIds.join(", ")}]`)
    }

    return NextResponse.json({ ok: true, resultados })
  } catch (err) {
    console.error("[POST /api/menus/seed-roles]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
