import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// IDs reales en DB: 1=Tablero, 2=JUSTIFICACIONES(header), 3=Nueva solicitud,
// 4=Mis solicitudes, 5=Validación UEFA, 6=GESTIÓN DGDO(header),
// 7=Revision, 8=Validacion, 9=Emision, 10=Dictámenes,
// 15=CONFIGURACIÓN(header), 11=Calendario, 12=Usuarios, 13=Catálogo
const ROL_MENUS: Record<string, number[]> = {
  "Administrador": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15],
  "Capturista":    [2, 3, 4, 6, 10],      // Nueva solicitud, Mis solicitudes, Dictámenes
  "Emisor":        [1, 6, 9, 10],         // Tablero, Emisión, Dictámenes
  "Revisor":       [6, 7, 10],            // Revisión, Dictámenes
  "Validador":     [1, 6, 8, 10],         // Tablero, Validación, Dictámenes
  "UEFA":          [2, 5, 6, 10],         // Validación UEFA, Dictámenes
  "Enlace DGRH":   [2, 5, 6, 10],         // Validación UEFA, Dictámenes
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
