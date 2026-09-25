import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSesion, verificarActor } from "@/lib/session"

/**
 * Exige sesión y que el id que manda el cliente (si manda uno) sea el de la
 * sesión. Devuelve la respuesta de error o null.
 */
async function sesionDelActor(userId: string | null): Promise<NextResponse | null> {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  return verificarActor(sesion, userId)
}

// Pestañas del Catálogo por rol (default sin override por usuario):
//   UEFA: Consulta + Solicitud · Verificador: Administración ·
//   Emisor: Administración + Solicitud · Administrador: todas.
// Enlace DGRH y Consulta conservan la pestaña Consulta.
export const ROLES_ADMIN_CATALOGO = ["Administrador", "Emisor", "Verificador"]
export const ROLES_CONSULTA_CATALOGO = ["Administrador", "UEFA", "Enlace DGRH", "Consulta"]
export const ROLES_SOLICITUD_CATALOGO = ["Administrador", "UEFA", "Emisor"]
// En la pestaña Solicitud estos roles ven las de todas las secretarías; UEFA solo la suya.
export const ROLES_SOLICITUD_CATALOGO_TODAS = ["Administrador", "Emisor"]

export async function requireRol(userId: string | null, rolesPermitidos: string[]): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  const sesionErr = await sesionDelActor(userId)
  if (sesionErr) return sesionErr
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
 *   default por rol — ROLES_ADMIN_CATALOGO y ROLES_CONSULTA_CATALOGO.
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
      rol: { select: { nombre: true } },
      usuario_menu: {
        where: { menu: { key: CATALOGO_MENU_KEY } },
        select: { acciones: true },
      },
    },
  })
  if (!usuario) return false
  const acciones = usuario.usuario_menu[0]?.acciones ?? []
  if (acciones.length > 0) return acciones.includes(CATALOGO_ACCION_CONSULTA)
  return ROLES_CONSULTA_CATALOGO.includes(usuario.rol.nombre)
}

/** Pestaña Solicitud del Catálogo (reutilizaciones pendientes de firma). Solo por rol. */
export async function puedeVerSolicitudesCatalogo(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: { select: { nombre: true } } },
  })
  return !!usuario && ROLES_SOLICITUD_CATALOGO.includes(usuario.rol.nombre)
}

export async function requireCatalogoAdmin(userId: string | null): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  const sesionErr = await sesionDelActor(userId)
  if (sesionErr) return sesionErr
  if (!(await puedeAdministrarCatalogo(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}

export async function requireCatalogoConsulta(userId: string | null): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  const sesionErr = await sesionDelActor(userId)
  if (sesionErr) return sesionErr
  if (!(await puedeConsultarCatalogo(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return null
}

const normalizaRol = (s: string) =>
  s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().trim()

// La firma electrónica al reutilizar un registro del Catálogo (autofirma
// inmediata, ver dictamen-prestacion-completo/route.ts) solo la puede hacer
// UEFA o un Administrador — a diferencia de "Administrar Catálogo" (Emisor/
// Verificador/Revisor también pueden reutilizar/cancelar, ver
// puedeAdministrarCatalogo), firmar el Dictamen queda más restringido.
export const ROLES_FIRMA_CATALOGO = ["uefa", "administrador"]

export async function puedeFirmarCatalogo(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: { select: { nombre: true } } },
  })
  if (!usuario) return false
  return ROLES_FIRMA_CATALOGO.includes(normalizaRol(usuario.rol.nombre))
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

export const USUARIOS_MENU_KEY = "usuarios"

/**
 * Gestión de usuarios y de sus permisos (pantalla Configuración > Usuarios):
 * la puede usar quien tenga ese menú en sus permisos efectivos — los explícitos
 * de usuario_menu si tiene alguno, si no los de su rol (misma regla que
 * /api/menus para armar el sidebar) — y siempre un Administrador.
 */
export async function puedeGestionarUsuarios(userId: string): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      rol_id: true,
      rol: { select: { nombre: true } },
      usuario_menu: { select: { menu: { select: { key: true, activo: true } } } },
    },
  })
  if (!usuario) return false
  if (normalizaRol(usuario.rol.nombre) === "administrador") return true
  if (usuario.usuario_menu.length > 0) {
    return usuario.usuario_menu.some((um) => um.menu?.key === USUARIOS_MENU_KEY && um.menu?.activo !== false)
  }
  const porRol = await prisma.rol_menu.count({
    where: { rol_id: usuario.rol_id, menu: { key: USUARIOS_MENU_KEY, activo: true } },
  })
  return porRol > 0
}

/** Exige sesión con acceso a la gestión de usuarios. Devuelve el usuario o la respuesta de error. */
export async function requireGestionUsuarios(): Promise<{ id: string; nombre: string; rol: string } | NextResponse> {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  if (!(await puedeGestionarUsuarios(sesion.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return sesion
}

export const esAdministrador = (rolNombre: string | null | undefined) =>
  normalizaRol(rolNombre ?? "") === "administrador"
