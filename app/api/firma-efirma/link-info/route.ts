import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { prisma } from "@/lib/prisma"

function cookieNameFor(token: string) {
  return `firma_sess_${token.slice(0, 24)}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const uuid = url.searchParams.get("uuid")
    const token = url.searchParams.get("t")
    if (!uuid || !token) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: {
        firma_proceso: {
          include: {
            solicitud: {
              select: {
                secretaria: true,
                secretaria_txt_snapshot: true,
                tipo_solicitud: true,
                fecha_creacion: true,
                folio_recepcion: true,
                folio_justificacion: true,
              },
            },
          },
        },
      },
    })

    if (!firmante)                                    return NextResponse.json({ ok: true, status: "invalido" })
    if (firmante.firma_proceso.uuid !== String(uuid))  return NextResponse.json({ ok: true, status: "invalido" })
    if (firmante.firma_proceso.estado === "completado") return NextResponse.json({ ok: true, status: "completado" })
    if (firmante.firmado)                             return NextResponse.json({ ok: true, status: "completado" })
    if (firmante.expira_en && firmante.expira_en < new Date()) {
      return NextResponse.json({ ok: true, status: "expirado" })
    }

    const cookieName = cookieNameFor(String(token))
    const cookieVal  = req.cookies.get(cookieName)?.value

    const firmanteInfo = { rol: firmante.rol, cargo: firmante.cargo }
    const sol = firmante.firma_proceso.solicitud
    const documentoInfo = {
      secretaria: sol.secretaria ?? sol.secretaria_txt_snapshot ?? null,
      tipo: sol.tipo_solicitud ?? null,
      fecha: sol.fecha_creacion,
      folio: sol.folio_recepcion ?? sol.folio_justificacion ?? null,
    }

    if (!firmante.accedido_en || !firmante.session_id) {
      return NextResponse.json({ ok: true, status: "disponible", firmante: firmanteInfo, documento: documentoInfo })
    }

    if (cookieVal === firmante.session_id) {
      return NextResponse.json({
        ok: true,
        status: "en_curso_mi_sesion",
        expira_en: firmante.expira_en,
        firmante: firmanteInfo,
        documento: documentoInfo,
      })
    }

    return NextResponse.json({ ok: true, status: "otra_sesion", firmante: firmanteInfo, documento: documentoInfo })
  } catch (err: any) {
    console.error("[firma-efirma/link-info]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
