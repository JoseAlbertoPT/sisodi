import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: { rol: true, area: true },
      orderBy: { fecha_creacion: "desc" },
    })

    return NextResponse.json(
      usuarios.map((u) => ({
        id:        u.id,
        nombre:    u.nombre,
        correo:    u.correo,
        rfc:       u.rfc ?? null,
        rol:       u.rol.nombre,
        secretaria: u.area?.nombre ?? "Sin área",
        estatus:   u.activo ? "Activo" : "Inactivo",
      }))
    )
  } catch (e) {
    console.error("[GET /api/usuarios]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, correo, rfc, password, rolNombre, areaNombre } = await req.json()

    if (!nombre?.trim())   return err("El nombre es requerido")
    if (!correo?.trim())   return err("El correo es requerido")
    if (!password?.trim()) return err("La contraseña es requerida")
    if (!rolNombre?.trim()) return err("El rol es requerido")


    const rol = await prisma.rol.findFirst({ where: { nombre: rolNombre } })
    if (!rol) return err(`Rol "${rolNombre}" no encontrado`, 404)

    const area = areaNombre
      ? await prisma.area.findFirst({ where: { nombre: areaNombre } })
      : null


    const existe = await prisma.usuario.findFirst({
      where: {
        OR: [
          { correo: correo.trim().toLowerCase() },
          ...(rfc ? [{ rfc: rfc.trim().toUpperCase() }] : []),
        ],
      },
    })
    if (existe) {
      if (existe.correo === correo.trim().toLowerCase())
        return err("Ya existe un usuario con ese correo", 409)
      return err("Ya existe un usuario con ese RFC", 409)
    }

    const hash = await bcrypt.hash(password, 12)

    const nuevo = await prisma.usuario.create({
      data: {
        nombre:       nombre.trim(),
        correo:       correo.trim().toLowerCase(),
        rfc:          rfc ? rfc.trim().toUpperCase() : null,
        password_hash: hash,
        rol_id:       rol.id,
        area_id:      area?.id ?? null,
        activo:       true,
        must_change_password: false,
      },
      include: { rol: true, area: true },
    })

    return NextResponse.json({
      id:        nuevo.id,
      nombre:    nuevo.nombre,
      correo:    nuevo.correo,
      rfc:       nuevo.rfc ?? null,
      rol:       nuevo.rol.nombre,
      secretaria: nuevo.area?.nombre ?? "Sin área",
      estatus:   "Activo",
    }, { status: 201 })

  } catch (e) {
    console.error("[POST /api/usuarios]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}