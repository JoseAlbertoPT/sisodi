import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { puedeAdministrarCatalogo, puedeConsultarCatalogo } from "@/lib/api-guard"
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
                    text-align:center;padding:24px;background:var(--sem-support-disabled-low);
                    border-radius:8px;color:#1e3a5f;margin:24px 0">
          ${codigo}
        </div>
        <p style="color:var(--sem-content-low);font-size:13px">
          Si no solicitó este código, ignore este mensaje.
        </p>
      </div>
    `,
  })
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

// Como err(), pero además manda cuántos ms faltan para que se levante el
// bloqueo — así el cliente puede deshabilitar el formulario y reactivarlo
// solo, sin que la persona tenga que reintentar a ciegas.
function errBloqueo(msg: string, retryAfterMs: number) {
  return NextResponse.json({ error: msg, retryAfterMs }, { status: 429 })
}

function maskEmail(correo: string) {
  const [local, dominio] = correo.split("@")
  if (!local || !dominio) return "****@****.***"
  return local[0] + "***" + local[local.length - 1] + "@" + dominio
}

/**
 * Bloqueo escalonado por intentos fallidos de login (usuario.intentos_fallidos
 * / bloqueado_hasta / nivel_bloqueo): la primera vez, 5 intentos fallidos
 * bloquean la cuenta 2 minutos. Una vez que se llegó a bloquear alguna vez
 * (nivel_bloqueo >= 1), el umbral baja a 3 intentos y la duración sube a 5
 * minutos — y ese umbral/duración más estrictos se mantienen para cualquier
 * bloqueo posterior (nivel_bloqueo se topa en 1, no sigue escalando). Un
 * login exitoso reinicia todo a cero.
 */
const INTENTOS_UMBRAL_INICIAL = 5
const DURACION_BLOQUEO_INICIAL_MS = 2 * 60 * 1000
const INTENTOS_UMBRAL_ESCALADO = 3
const DURACION_BLOQUEO_ESCALADO_MS = 5 * 60 * 1000

function formatearEspera(ms: number): string {
  const totalSeg = Math.max(1, Math.ceil(ms / 1000))
  if (totalSeg < 60) return `${totalSeg} segundo${totalSeg !== 1 ? "s" : ""}`
  const min = Math.ceil(totalSeg / 60)
  return `${min} minuto${min !== 1 ? "s" : ""}`
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

      let usuario = await prisma.usuario.findUnique({
        where:   { rfc: rfc.trim().toUpperCase() },
        include: { rol: true, area: true, organo_centralizado: true },
      })

      if (!usuario)        return err("Credenciales incorrectas", 401)
      if (!usuario.activo) return err("Su cuenta está desactivada. Contacte al administrador.", 403)

      const ahora = new Date()

      if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > ahora) {
        const restanteMs = usuario.bloqueado_hasta.getTime() - ahora.getTime()
        return errBloqueo(`Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intente de nuevo en ${formatearEspera(restanteMs)}.`, restanteMs)
      }

      // El bloqueo anterior ya expiró: se limpia y se arranca el conteo de
      // intentos desde cero, pero conservando nivel_bloqueo (umbral más
      // estricto para el siguiente bloqueo).
      if (usuario.bloqueado_hasta) {
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data:  { bloqueado_hasta: null, intentos_fallidos: 0 },
          include: { rol: true, area: true, organo_centralizado: true },
        })
      }

      const valida = await bcrypt.compare(password, usuario.password_hash)
      if (!valida) {
        const escalado = usuario.nivel_bloqueo >= 1
        const umbral = escalado ? INTENTOS_UMBRAL_ESCALADO : INTENTOS_UMBRAL_INICIAL
        const nuevosIntentos = usuario.intentos_fallidos + 1

        if (nuevosIntentos >= umbral) {
          const duracionMs = escalado ? DURACION_BLOQUEO_ESCALADO_MS : DURACION_BLOQUEO_INICIAL_MS
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              intentos_fallidos: 0,
              bloqueado_hasta:   new Date(ahora.getTime() + duracionMs),
              nivel_bloqueo:     Math.min(usuario.nivel_bloqueo + 1, 1),
            },
          })
          return errBloqueo(`Demasiados intentos fallidos. Cuenta bloqueada por ${formatearEspera(duracionMs)}.`, duracionMs)
        }

        await prisma.usuario.update({ where: { id: usuario.id }, data: { intentos_fallidos: nuevosIntentos } })
        return err("Credenciales incorrectas", 401)
      }

      if (usuario.intentos_fallidos > 0 || usuario.nivel_bloqueo > 0) {
        await prisma.usuario.update({ where: { id: usuario.id }, data: { intentos_fallidos: 0, bloqueado_hasta: null, nivel_bloqueo: 0 } })
      }

      const [catalogoAdministracion, catalogoConsulta] = await Promise.all([
        puedeAdministrarCatalogo(usuario.id),
        puedeConsultarCatalogo(usuario.id),
      ])
      await prisma.usuario.update({ where: { id: usuario.id }, data: { ultima_actividad: new Date() } })

      return NextResponse.json({
        id:                  usuario.id,
        nombre:              usuario.nombre,
        correo:              usuario.correo,
        rfc:                 usuario.rfc,
        rol:                 usuario.rol.nombre,
        area:                usuario.area?.nombre ?? null,
        secretariaTexto:     usuario.secretaria_texto ?? usuario.organo_centralizado?.nombre ?? null,
        secretariaId:        usuario.secretaria_id ?? null,
        organoNombre:        usuario.organo_centralizado?.nombre ?? null,
        claveReportePlazas:  usuario.organo_centralizado?.clave_reporte_plazas ?? null,
        mustChangePassword:  usuario.must_change_password ?? false,
        tipoAdministracion:  usuario.organo_centralizado ? "centralizada" : "paraestatal",
        catalogoAdministracion,
        catalogoConsulta,
      })
    }
    if (action === "heartbeat") {
      const { usuarioId } = body
      if (!usuarioId) return err("usuarioId requerido")
      await prisma.usuario.updateMany({
        where: { id: usuarioId },
        data:  { ultima_actividad: new Date() },
      })
      return NextResponse.json({ ok: true })
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
        // Restablecer por correo ya verifica identidad (código enviado a su
        // correo) — de paso se limpia cualquier bloqueo por intentos
        // fallidos, para no dejarlo bloqueado después de recuperar el acceso.
        data:  { password_hash: hash, must_change_password: false, intentos_fallidos: 0, bloqueado_hasta: null, nivel_bloqueo: 0 },
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