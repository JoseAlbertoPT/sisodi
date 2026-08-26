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
 * Consulta y Administración de Catálogo se otorgan de forma independiente
 * (checkboxes separados en el modal de Permisos, ver menu-permiso-tree.tsx):
 * - Sin override explícito para este usuario (acciones = []): se usa el
 *   default — Administración según ROLES_ADMIN_CATALOGO, Consulta para
 *   cualquiera (comportamiento histórico).
 * - Con override explícito (acciones no vacío): es autoritativo para AMBAS
 *   pestañas — solo se ve lo que esté marcado, aunque el rol normalmente
 *   diera acceso a la otra. Por eso "acciones.length > 0" corta el fallback
 *   al rol en los dos casos de abajo.
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
  if (acciones.length > 0) return acciones.includes(CATALOGO_ACCION_ADMINISTRACION)
  return ROLES_ADMIN_CATALOGO.includes(usuario.rol.nombre)
}

export async function puedeConsultarCatalogo(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      usuario_menu: {
        where: { menu: { key: CATALOGO_MENU_KEY } },
        select: { acciones: true },
      },
    },
  })
  if (!usuario) return false
  const acciones = usuario.usuario_menu[0]?.acciones ?? []
  if (acciones.length > 0) return acciones.includes(CATALOGO_ACCION_CONSULTA)
  return true
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

export async function requireCatalogoConsulta(userId: string | null): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  if (!(await puedeConsultarCatalogo(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}

export const VERIFICACION_MENU_KEY = "bandeja-filtro2"
// Bandera de BLOQUEO, no de permiso — con una sola acción posible, una
// bandera de "permiso" no puede distinguir "explícitamente desactivado" de
// "nunca configurado" (quitarla del arreglo lo deja en [] en ambos casos).
export const VERIFICACION_ACCION_SIN_FIRMA = "sin_firma"

/**
 * Firma en Verificación es libre por rol (ver firmar-interno/route.ts:
 * bandejaLibrePorRol) — cualquier Verificador puede firmar cualquier
 * solicitud ahí. Este checkbox ("Firma" en Permisos de menús, ver
 * menu-permiso-tree.tsx) solo sirve para REVOCAR esa capacidad a un usuario
 * puntual sin quitarle el acceso de solo lectura a la bandeja. Sin override
 * explícito (acciones vacío) se mantiene el comportamiento histórico:
 * cualquiera con acceso puede firmar.
 */
export async function puedeFirmarVerificacion(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      usuario_menu: {
        where: { menu: { key: VERIFICACION_MENU_KEY } },
        select: { acciones: true },
      },
    },
  })
  if (!usuario) return false
  const acciones = usuario.usuario_menu[0]?.acciones ?? []
  return !acciones.includes(VERIFICACION_ACCION_SIN_FIRMA)
}
