import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function maskEmail(correo: string) {
  const [local, dominio] = correo.split("@")
  if (!local || !dominio) return "****@****.***"
  return local[0] + "***" + local[local.length - 1] + "@" + dominio
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")

  try {
    const body = await req.json()

    // ── LOGIN ────────────────────────────────────────────────────────────────
    if (action === "login") {
      const { rfc, password } = body

      console.log("=== LOGIN DEBUG ===")
      console.log("RFC recibido:", rfc)
      console.log("RFC procesado:", rfc.trim().toUpperCase())

      if (!rfc || !password) return err("RFC y contraseña son requeridos")

      const usuario = await prisma.usuario.findUnique({
        where: { rfc: rfc.trim().toUpperCase() },
        include: { rol: true, area: true },
      })

      console.log("Usuario encontrado:", usuario ? "SÍ" : "NO")
      if (usuario) {
        console.log("Hash en DB:", usuario.password_hash)
        const pruebaHash = await bcrypt.compare(password, usuario.password_hash)
        console.log("Contraseña válida:", pruebaHash)
        console.log("Activo:", usuario.activo)
      }

      if (!usuario)        return err("Credenciales incorrectas", 401)
      if (!usuario.activo) return err("Su cuenta está desactivada. Contacte al administrador.", 403)

      const valida = await bcrypt.compare(password, usuario.password_hash)
      if (!valida) return err("Credenciales incorrectas", 401)

      return NextResponse.json({
        id:                 usuario.id,
        nombre:             usuario.nombre,
        correo:             usuario.correo,
        rfc:                usuario.rfc,
        rol:                usuario.rol.nombre,
        area:               usuario.area?.nombre ?? null,
        secretariaTexto:    usuario.secretaria_texto ?? null,
        mustChangePassword: usuario.must_change_password ?? false,
      })
    }

    // ── CAMBIAR CONTRASEÑA (primer ingreso) ──────────────────────────────────
    if (action === "change-password") {
      const { rfc, nuevaPassword } = body
      if (!rfc || !nuevaPassword) return err("Datos incompletos")

      const hash = await bcrypt.hash(nuevaPassword, 12)
      const updated = await prisma.usuario.updateMany({
        where: { rfc: rfc.trim().toUpperCase(), activo: true },
        data:  { password_hash: hash, must_change_password: false },
      })

      if (updated.count === 0) return err("Usuario no encontrado", 404)
      return NextResponse.json({ ok: true })
    }

    // ── RECUPERAR · paso 1 ───────────────────────────────────────────────────
    if (action === "recuperar-rfc") {
      const { rfc } = body
      if (!rfc) return err("RFC requerido")

      const usuario = await prisma.usuario.findFirst({
        where:  { rfc: rfc.trim().toUpperCase(), activo: true },
        select: { id: true, correo: true },
      })

      if (!usuario) return err("No se encontró ninguna cuenta asociada a ese RFC.", 404)

      const codigo   = Math.floor(100000 + Math.random() * 900000).toString()
      const expiraEn = new Date(Date.now() + 10 * 60 * 1000)

      await prisma.codigo_recuperacion.upsert({
        where:  { usuario_id: usuario.id },
        create: { usuario_id: usuario.id, codigo, expira_en: expiraEn, usado: false },
        update: { codigo, expira_en: expiraEn, usado: false },
      })

      console.log(`[DEV] Código para ${rfc}: ${codigo}`)

      return NextResponse.json({
        ok: true,
        correoMascarado: maskEmail(usuario.correo),
      })
    }

    // ── RECUPERAR · paso 2 ───────────────────────────────────────────────────
    if (action === "recuperar-codigo") {
      const { rfc, codigo } = body
      if (!rfc || !codigo) return err("Datos incompletos")

      const registro = await prisma.codigo_recuperacion.findFirst({
        where: {
          codigo,
          usado:   false,
          usuario: { rfc: rfc.trim().toUpperCase() },
        },
      })

      if (!registro)
        return err("Código incorrecto. Verifique e intente de nuevo.", 400)

      if (new Date() > new Date(registro.expira_en))
        return err("El código ha expirado. Solicite uno nuevo.", 400)

      await prisma.codigo_recuperacion.update({
        where: { id: registro.id },
        data:  { usado: true },
      })

      return NextResponse.json({ ok: true })
    }

    // ── RECUPERAR · paso 3 ───────────────────────────────────────────────────
    if (action === "recuperar-reset") {
      const { rfc, nuevaPassword } = body
      if (!rfc || !nuevaPassword) return err("Datos incompletos")

      const hash    = await bcrypt.hash(nuevaPassword, 12)
      const updated = await prisma.usuario.updateMany({
        where: { rfc: rfc.trim().toUpperCase(), activo: true },
        data:  { password_hash: hash, must_change_password: false },
      })

      if (updated.count === 0) return err("Usuario no encontrado", 404)

      const usuario = await prisma.usuario.findFirst({
        where:  { rfc: rfc.trim().toUpperCase() },
        select: { id: true },
      })
      if (usuario) {
        await prisma.codigo_recuperacion.deleteMany({
          where: { usuario_id: usuario.id },
        })
      }

      return NextResponse.json({ ok: true })
    }

    return err("Acción no reconocida", 400)

  } catch (e) {
    console.error("[/api/auth]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}