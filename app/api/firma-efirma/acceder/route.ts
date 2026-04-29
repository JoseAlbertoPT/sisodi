import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

const TTL_MINUTES = 30

function cookieNameFor(token: string) {
  return `firma_sess_${token.slice(0, 24)}`
}

export async function POST(req: NextRequest) {
  try {
    const { uuid, token } = await req.json()
    if (!uuid || !token) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: { firma_proceso: true },
    })

    if (!firmante)                                   return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.uuid !== String(uuid)) return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firmado)                            return NextResponse.json({ ok: false, error: "Ya firmaste con este link." }, { status: 409 })
    if (firmante.firma_proceso.estado === "completado") return NextResponse.json({ ok: false, error: "El proceso ya está completado." }, { status: 409 })

    const ahora = new Date()
    if (firmante.expira_en && firmante.expira_en < ahora) {
      return NextResponse.json({ ok: false, error: "El link expiró. Solicita uno nuevo." }, { status: 410 })
    }

    const cookieName = cookieNameFor(String(token))
    const cookieVal  = req.cookies.get(cookieName)?.value

    // Caso A: primer acceso
    if (!firmante.accedido_en || !firmante.session_id) {
      const sessionId = randomBytes(32).toString("hex")
      const expiraEn  = new Date(ahora.getTime() + TTL_MINUTES * 60 * 1000)
      await prisma.firma_firmante.update({
        where: { id: firmante.id },
        data: { accedido_en: ahora, expira_en: expiraEn, session_id: sessionId },
      })
      const res = NextResponse.json({
        ok: true,
        status: "iniciado",
        expira_en: expiraEn,
        ttl_minutos: TTL_MINUTES,
      })
      res.cookies.set(cookieName, sessionId, {
        httpOnly: true, sameSite: "lax", path: "/",
        expires: expiraEn,
      })
      return res
    }

    // Caso B: misma sesión
    if (cookieVal === firmante.session_id) {
      return NextResponse.json({
        ok: true,
        status: "en_curso",
        expira_en: firmante.expira_en,
        ttl_minutos: TTL_MINUTES,
      })
    }

    // Caso C: otra sesión
    return NextResponse.json({
      ok: false,
      status: "otra_sesion",
      error: "Este link ya fue abierto por otra persona y está esperando a que firme. Si necesitas acceso, pide uno nuevo al responsable.",
    }, { status: 423 })
  } catch (err: any) {
    console.error("[firma-efirma/acceder]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
