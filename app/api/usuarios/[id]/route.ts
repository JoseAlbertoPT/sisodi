import { NextRequest, NextResponse } from "next/server"
import { cerrarSesionesDeUsuario } from "@/lib/session"
import { esAdministrador, requireGestionUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { broadcastForceLogout } from "@/lib/sse-manager"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await requireGestionUsuarios()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { id } = await params
    const { nombre, correo, rfc, password, rolNombre, areaNombre, activo, secretariaId, secretariaTexto, cargo } = await req.json()

    const usuarioActual = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } })
    if (!usuarioActual) return err("Usuario no encontrado", 404)

    // Solo un Administrador puede modificar/gestionar a otro usuario con rol
    // Administrador. Quién solicita sale de la sesión (antes de la cabecera
    // x-user-id, que el cliente podía falsear).
    if (esAdministrador(usuarioActual.rol?.nombre) && !esAdministrador(sesion.rol)) {
      return err("Solo un administrador puede modificar a un usuario administrador", 403)
    }

    let rol_id = usuarioActual.rol_id
    if (rolNombre) {
      const rol = await prisma.rol.findFirst({ where: { nombre: rolNombre } })
      if (!rol) return err(`Rol "${rolNombre}" no encontrado`, 404)
      // Tampoco se puede promover a Administrador sin serlo.
      if (rol.id !== usuarioActual.rol_id && esAdministrador(rol.nombre) && !esAdministrador(sesion.rol)) {
        return err("Solo un administrador puede asignar el rol de administrador", 403)
      }
      rol_id = rol.id
    }

    let area_id = usuarioActual.area_id
    if (areaNombre !== undefined) {
      if (areaNombre) {
        const area = await prisma.area.findFirst({ where: { nombre: areaNombre } })
        area_id = area?.id ?? null
      } else {
        area_id = null
      }
    }

    if (correo && correo !== usuarioActual.correo) {
      const dup = await prisma.usuario.findFirst({
        where: { correo: correo.trim().toLowerCase(), id: { not: id } },
      })
      if (dup) return err("Ya existe un usuario con ese correo", 409)
    }

    if (rfc && rfc !== usuarioActual.rfc) {
      const dup = await prisma.usuario.findFirst({
        where: { rfc: rfc.trim().toUpperCase(), id: { not: id } },
      })
      if (dup) return err("Ya existe un usuario con ese RFC", 409)
    }

    const data: Record<string, unknown> = {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(correo !== undefined && { correo: correo.trim().toLowerCase() }),
      ...(rfc    !== undefined && { rfc: rfc ? rfc.trim().toUpperCase() : null }),
      ...(activo !== undefined && { activo }),
      rol_id,
      area_id,
    }

    if (secretariaId !== undefined) {
      data.secretaria_id = secretariaId || null
    }
    if (secretariaTexto !== undefined) {
      data.secretaria_texto = secretariaTexto || null
    }
    if (cargo !== undefined) {
      data.cargo = cargo?.trim() || null
    }

    if (password) {
      data.password_hash = await bcrypt.hash(password, 12)
      data.must_change_password = true
    }

    // Detectar qué cambia realmente (para forzar cierre de sesión después). Estos son
    // campos que ya quedaron "congelados" en el snapshot de login (lib/auth-context.tsx)
    // o que afectan la identidad/alcance de la cuenta — sin recargar la sesión completa
    // el usuario seguiría viendo datos viejos hasta que cierre sesión por su cuenta.
    const secretariaIdCambia =
      secretariaId !== undefined && secretariaId !== usuarioActual.secretaria_id
    const secretariaTextoCambia =
      secretariaTexto !== undefined && secretariaTexto !== usuarioActual.secretaria_texto
    const rolCambia = rolNombre !== undefined && rol_id !== usuarioActual.rol_id
    const areaCambia = areaNombre !== undefined && area_id !== usuarioActual.area_id
    const nombreCambia = nombre !== undefined && nombre.trim() !== usuarioActual.nombre
    const rfcNuevo = rfc !== undefined ? (rfc ? rfc.trim().toUpperCase() : null) : undefined
    const rfcCambia = rfcNuevo !== undefined && rfcNuevo !== usuarioActual.rfc
    const cargoNuevo = cargo !== undefined ? (cargo?.trim() || null) : undefined
    const cargoCambia = cargoNuevo !== undefined && cargoNuevo !== usuarioActual.cargo
    const passwordCambia = !!password
    const seDeshabilita = activo === false && usuarioActual.activo !== false

    // Conservar permisos de menú: si al editar cambia el contexto del usuario
    // (secretaría, tipo de administración o rol) y el usuario aún NO tiene permisos
    // explícitos (usa los del rol por defecto), congelamos sus menús efectivos ACTUALES
    // en usuario_menu. Así sus permisos quedan fijos y no se pierden con el cambio; a
    // partir de aquí solo se modifican desde el módulo de Permisos de Menú.
    if (secretariaIdCambia || secretariaTextoCambia || rolCambia) {
      const permisosExplicitos = await prisma.usuario_menu.count({ where: { usuario_id: id } })
      if (permisosExplicitos === 0) {
        const rolMenus = await prisma.rol_menu.findMany({
          where: { rol_id: usuarioActual.rol_id },
          select: { menu_id: true },
        })
        if (rolMenus.length > 0) {
          await prisma.usuario_menu.createMany({
            data: rolMenus.map((rm) => ({ usuario_id: id, menu_id: rm.menu_id })),
            skipDuplicates: true,
          })
        }
      }
    }

    // Antes de actualizar la secretaría, fijar el snapshot en las solicitudes del usuario
    // que aún lo tienen en null. Usamos la secretaría ANTERIOR para que esos registros
    // queden anclados a donde pertenecían, evitando que "sigan" al usuario a la nueva
    // secretaría y se mezclen con los registros de otra dependencia.
    if (secretariaId !== undefined && usuarioActual.secretaria_id) {
      await prisma.solicitud.updateMany({
        where: {
          usuario_id:             id,
          secretaria_id_snapshot: null,
          tipo_administracion:    { not: "paraestatal" },
        },
        data: { secretaria_id_snapshot: usuarioActual.secretaria_id },
      })
    }
    if (secretariaTexto !== undefined && usuarioActual.secretaria_texto) {
      await prisma.solicitud.updateMany({
        where: {
          usuario_id:              id,
          secretaria_txt_snapshot: null,
          tipo_administracion:     "paraestatal",
        },
        data: { secretaria_txt_snapshot: usuarioActual.secretaria_texto },
      })
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data,
      include: { rol: true, area: true, organo_centralizado: true },
    })

    // Segundo backfill: solo cuando el usuario NO tenía secretaría antes (registros
    // sin snapshot son genuinamente sin dueño y se asignan a la nueva secretaría).
    // Si ya tenía secretaría, el primer backfill ya ancló los nulls a la secretaría
    // anterior; correr esto de nuevo los reasignaría incorrectamente a la nueva.
    if (actualizado.secretaria_id && !usuarioActual.secretaria_id) {
      await prisma.solicitud.updateMany({
        where: {
          usuario_id:             id,
          secretaria_id_snapshot: null,
          tipo_administracion:    { not: "paraestatal" },
        },
        data: { secretaria_id_snapshot: actualizado.secretaria_id },
      })
    }
    if (actualizado.secretaria_texto && !usuarioActual.secretaria_texto) {
      await prisma.solicitud.updateMany({
        where: {
          usuario_id:              id,
          secretaria_txt_snapshot: null,
          tipo_administracion:     "paraestatal",
        },
        data: { secretaria_txt_snapshot: actualizado.secretaria_texto },
      })
    }

    // Rol, contraseña, RFC, nombre, cargo, secretaría o dirección cambiados: forzar
    // cierre de sesión al usuario afectado para que su próximo login recargue el
    // snapshot completo. Deshabilitar también fuerza el cierre: si sigue con la
    // sesión abierta en el navegador, no debe poder seguir usando el sistema.
    if (secretariaIdCambia || secretariaTextoCambia || rolCambia || areaCambia || nombreCambia || rfcCambia || cargoCambia || passwordCambia || seDeshabilita) {
      broadcastForceLogout([id])
      // Además de avisarle al navegador, invalida sus sesiones en el servidor.
      await cerrarSesionesDeUsuario(id)
    }

    return NextResponse.json({
      id:                 actualizado.id,
      nombre:             actualizado.nombre,
      correo:             actualizado.correo,
      rfc:                actualizado.rfc ?? null,
      rol:                actualizado.rol.nombre,
      secretaria:         actualizado.secretaria_texto ?? actualizado.area?.nombre ?? "Sin área",
      secretariaId:       actualizado.secretaria_id ?? null,
      cargo:              actualizado.cargo ?? null,
      estatus:            actualizado.activo ? "Activo" : "Inactivo",
      tipoAdministracion: actualizado.organo_centralizado ? "centralizada" : "paraestatal",
    })

  } catch (e) {
    console.error("[PATCH /api/usuarios/:id]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
