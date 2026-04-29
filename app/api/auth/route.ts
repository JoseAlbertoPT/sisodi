import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

async function enviarCodigoRecuperacion(correo: string, codigo: string) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to:      correo,
    subject: "Código de recuperación de contraseña",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Recuperación de contraseña</h2>
        <p>Use el siguiente código para restablecer su contraseña.
           Es válido por <strong>10 minutos</strong>.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:12px;
                    text-align:center;padding:24px;background:#f3f4f6;
                    border-radius:8px;color:#1e3a5f;margin:24px 0">
          ${codigo}
        </div>
        <p style="color:#6b7280;font-size:13px">
          Si no solicitó este código, ignore este mensaje.
        </p>
      </div>
    `,
  })
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function maskEmail(correo: string) {
  const [local, dominio] = correo.split("@")
  if (!local || !dominio) return "****@****.***"
  return local[0] + "***" + local[local.length - 1] + "@" + dominio
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")
  const id     = req.nextUrl.searchParams.get("id")

  if (action === "perfil" && id) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where:   { id },
        include: { area: true, organo_centralizado: true },
      })
      if (!usuario) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        secretariaTexto: usuario.secretaria_texto ?? usuario.organo_centralizado?.nombre ?? null,
        area:            usuario.area?.nombre ?? null,
      })
    } catch (e) {
      return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")

  try {
    const body = await req.json()

    if (action === "login") {
      const { rfc, password } = body

      if (!rfc || !password) return err("RFC y contraseña son requeridos")

      const usuario = await prisma.usuario.findUnique({
        where:   { rfc: rfc.trim().toUpperCase() },
        include: { rol: true, area: true, organo_centralizado: true },
      })

      if (!usuario)        return err("Credenciales incorrectas", 401)
      if (!usuario.activo) return err("Su cuenta está desactivada. Contacte al administrador.", 403)

      const valida = await bcrypt.compare(password, usuario.password_hash)
      if (!valida) return err("Credenciales incorrectas", 401)

      return NextResponse.json({
        id:                  usuario.id,
        nombre:              usuario.nombre,
        correo:              usuario.correo,
        rfc:                 usuario.rfc,
        rol:                 usuario.rol.nombre,
        area:                usuario.area?.nombre ?? null,
        secretariaTexto:     usuario.secretaria_texto ?? usuario.organo_centralizado?.nombre ?? null,
        secretariaId:        usuario.secretaria_id ?? null,
        claveReportePlazas:  usuario.organo_centralizado?.clave_reporte_plazas ?? null,
        mustChangePassword:  usuario.must_change_password ?? false,
        tipoAdministracion:  usuario.organo_centralizado ? "centralizada" : "paraestatal",
      })
    }
    if (action === "change-password") {
      const { rfc, nuevaPassword } = body
      if (!rfc || !nuevaPassword) return err("Datos incompletos")

      const hash    = await bcrypt.hash(nuevaPassword, 12)
      const updated = await prisma.usuario.updateMany({
        where: { rfc: rfc.trim().toUpperCase(), activo: true },
        data:  { password_hash: hash, must_change_password: false },
      })

      if (updated.count === 0) return err("Usuario no encontrado", 404)
      return NextResponse.json({ ok: true })
    }

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

      
      try {
        await enviarCodigoRecuperacion(usuario.correo, codigo)
        console.log(`[mailer] Código enviado a ${maskEmail(usuario.correo)}`)
      } catch (emailError) {
        console.error("[mailer] Error al enviar correo:", emailError)
        return err("No se pudo enviar el correo de verificación. Verifique la configuración SMTP.", 500)
      }

      return NextResponse.json({
        ok:              true,
        correoMascarado: maskEmail(usuario.correo),
      })
    }

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