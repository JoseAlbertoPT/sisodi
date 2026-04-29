import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { nombre, correo, rfc, password, rolNombre, areaNombre, activo, secretariaId, secretariaTexto } = await req.json()

    const usuarioActual = await prisma.usuario.findUnique({ where: { id } })
    if (!usuarioActual) return err("Usuario no encontrado", 404)

    let rol_id = usuarioActual.rol_id
    if (rolNombre) {
      const rol = await prisma.rol.findFirst({ where: { nombre: rolNombre } })
      if (!rol) return err(`Rol "${rolNombre}" no encontrado`, 404)
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

    if (password) {
      data.password_hash = await bcrypt.hash(password, 12)
      data.must_change_password = true
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data,
      include: { rol: true, area: true },
    })

    return NextResponse.json({
      id:           actualizado.id,
      nombre:       actualizado.nombre,
      correo:       actualizado.correo,
      rfc:          actualizado.rfc ?? null,
      rol:          actualizado.rol.nombre,
      secretaria:   actualizado.secretaria_texto ?? actualizado.area?.nombre ?? "Sin área",
      secretariaId: actualizado.secretaria_id ?? null,
      estatus:      actualizado.activo ? "Activo" : "Inactivo",
    })

  } catch (e) {
    console.error("[PATCH /api/usuarios/:id]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
