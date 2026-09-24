import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { esAdministrador, puedeGestionarUsuarios, requireGestionUsuarios } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const rolFiltro          = searchParams.get("rol")
    const secretariaIdFiltro = searchParams.get("secretariaId")
    const checkCorreo        = searchParams.get("checkCorreo")
    const checkRfc           = searchParams.get("checkRfc")
    const soloActivos        = searchParams.get("soloActivos") === "true"

    // Cualquier usuario con sesión puede listar (varias bandejas eligen
    // Revisores de aquí), pero RFC y las validaciones de duplicados son solo
    // para quien gestiona usuarios.
    const gestiona = await puedeGestionarUsuarios(sesion.id)
    if ((checkCorreo || checkRfc) && !gestiona) return err("No autorizado", 403)

    if (checkCorreo) {
      const existe = await prisma.usuario.findFirst({ where: { correo: checkCorreo.trim().toLowerCase() } })
      return NextResponse.json({ existe: !!existe })
    }
    if (checkRfc) {
      const existe = await prisma.usuario.findFirst({ where: { rfc: checkRfc.trim().toUpperCase() } })
      return NextResponse.json({ existe: !!existe })
    }

    const where: any = {}
    if (rolFiltro) {
      where.rol = { nombre: { equals: rolFiltro, mode: "insensitive" } }
    }
    if (secretariaIdFiltro) {
      where.secretaria_id = secretariaIdFiltro
    }
    if (soloActivos) {
      where.activo = true
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      include: { rol: true, area: true, organo_centralizado: true },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(
      usuarios.map((u) => ({
        id:                 u.id,
        nombre:             u.nombre,
        correo:             u.correo,
        rfc:                gestiona ? (u.rfc ?? null) : null,
        rol:                u.rol.nombre,
        secretaria:         u.secretaria_texto ?? u.area?.nombre ?? "Sin área",
        secretariaId:       u.secretaria_id ?? null,
        cargo:              u.cargo ?? null,
        estatus:            u.activo ? "Activo" : "Inactivo",
        tipoAdministracion: u.organo_centralizado ? "centralizada" : "paraestatal",
      }))
    )
  } catch (e) {
    console.error("[GET /api/usuarios]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requireGestionUsuarios()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { nombre, correo, rfc, password, rolNombre, areaNombre, secretariaId, secretariaTexto, cargo } = await req.json()

    if (!nombre?.trim())   return err("El nombre es requerido")
    if (!correo?.trim())   return err("El correo es requerido")
    if (!password?.trim()) return err("La contraseña es requerida")
    if (!rolNombre?.trim()) return err("El rol es requerido")

    const rol = await prisma.rol.findFirst({ where: { nombre: rolNombre } })
    if (!rol) return err(`Rol "${rolNombre}" no encontrado`, 404)
    // Misma regla que al editar (usuarios/[id]): solo un Administrador puede
    // dar el rol de Administrador.
    if (esAdministrador(rol.nombre) && !esAdministrador(sesion.rol)) {
      return err("Solo un administrador puede crear un usuario administrador", 403)
    }

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
        nombre:           nombre.trim(),
        correo:           correo.trim().toLowerCase(),
        rfc:              rfc ? rfc.trim().toUpperCase() : null,
        password_hash:    hash,
        rol_id:           rol.id,
        area_id:          area?.id ?? null,
        secretaria_id:    secretariaId || null,
        secretaria_texto: secretariaTexto || null,
        cargo:            cargo?.trim() || null,
        activo:           true,
        must_change_password: true,
      },
      include: { rol: true, area: true, organo_centralizado: true },
    })

    return NextResponse.json({
      id:                 nuevo.id,
      nombre:             nuevo.nombre,
      correo:             nuevo.correo,
      rfc:                nuevo.rfc ?? null,
      rol:                nuevo.rol.nombre,
      secretaria:         nuevo.secretaria_texto ?? nuevo.area?.nombre ?? "Sin área",
      secretariaId:       nuevo.secretaria_id ?? null,
      cargo:              nuevo.cargo ?? null,
      estatus:            "Activo",
      tipoAdministracion: nuevo.organo_centralizado ? "centralizada" : "paraestatal",
    }, { status: 201 })

  } catch (e) {
    console.error("[POST /api/usuarios]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
