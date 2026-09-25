import { NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { esAdministrador } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"

// Se resuelve por `menu.key` (no por id: los ids varían entre ambientes).
// Los encabezados (JUSTIFICACIONES, GESTIÓN DGDO, CONFIGURACIÓN) se agregan
// automáticamente a partir del parent_id de cada menú.
const ROL_MENUS: Record<string, string[] | "*"> = {
  "Administrador": "*",
  "Capturista":    ["nueva-solicitud", "mis-solicitudes"],
  "Emisor":        ["dashboard", "catalogo-justificaciones", "bandeja-filtro3", "dictamenes"],
  "Revisor":       ["dashboard", "bandeja-filtro1", "dictamenes"],
  "Verificador":   ["dashboard", "catalogo-justificaciones", "bandeja-filtro2", "dictamenes", "calendario", "usuarios", "entidades"],
  "UEFA":          ["catalogo-justificaciones", "validacion-uefa", "dictamenes"],
  "Enlace DGRH":   ["catalogo-justificaciones", "validacion-uefa", "dictamenes"],
  "Consulta":      ["dashboard", "catalogo-justificaciones"],
}

export async function POST() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  // Reescribe la matriz de menús de todos los roles: solo Administrador.
  if (!esAdministrador(sesion.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    const resultados: string[] = []
    const menus = await prisma.menu.findMany({ select: { id: true, key: true, parent_id: true } })

    for (const [rolNombre, keys] of Object.entries(ROL_MENUS)) {
      const hojas = keys === "*" ? menus : menus.filter((m) => m.key && keys.includes(m.key))
      const ids = new Set(hojas.map((m) => m.id))
      for (const m of hojas) if (m.parent_id != null) ids.add(m.parent_id)
      const menuIds = [...ids].sort((a, b) => a - b)

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
