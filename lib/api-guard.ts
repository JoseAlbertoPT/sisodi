import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const ROLES_ADMIN_CATALOGO = ["Administrador", "Emisor", "Verificador", "Revisor"]

export async function requireRol(userId: string | null, rolesPermitidos: string[]): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: { select: { nombre: true } } },
  })
  if (!usuario || !rolesPermitidos.includes(usuario.rol.nombre)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}

export const CATALOGO_MENU_KEY = "catalogo-justificaciones"
export const CATALOGO_ACCION_ADMINISTRACION = "administracion"
// Override explícito para NEGAR Administración a un usuario cuyo rol la tendría por defecto
// (ej. un Revisor puntual al que se le quiere dejar solo en Consulta).
export const CATALOGO_ACCION_CONSULTA = "consulta"

/**
 * Un permiso explícito por-usuario (guardado desde el modal de Permisos) siempre gana sobre el
 * acceso por rol: "administracion" lo otorga, "consulta" lo niega aunque el rol esté en
 * ROLES_ADMIN_CATALOGO. Sin override explícito, se usa el acceso por rol.
 */
export async function puedeAdministrarCatalogo(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      rol: { select: { nombre: true } },
      usuario_menu: {
        where: { menu: { key: CATALOGO_MENU_KEY } },
        select: { acciones: true },
      },
    },
  })
  if (!usuario) return false
  const acciones = usuario.usuario_menu[0]?.acciones ?? []
  if (acciones.includes(CATALOGO_ACCION_ADMINISTRACION)) return true
  if (acciones.includes(CATALOGO_ACCION_CONSULTA)) return false
  return ROLES_ADMIN_CATALOGO.includes(usuario.rol.nombre)
}

export async function requireCatalogoAdmin(userId: string | null): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (!(await puedeAdministrarCatalogo(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}
