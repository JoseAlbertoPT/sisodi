import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { efirmaClient, firmadosCount, normalizarEstado } from "@/lib/efirma-client"
import { broadcastUpdate } from "@/lib/sse-manager"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const BYPASS = process.env.EFIRMA_BYPASS === "true"

function cookieNameFor(token: string) {
  return `firma_sess_${token.slice(0, 24)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uuid, token, usuario, cargoFirmante, certificado, clavePrivada, fraseClavePrivada } = body

    if (!uuid || !token || !usuario || !cargoFirmante) {
      return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 })
    }
    if (!BYPASS && (!certificado || !clavePrivada || !fraseClavePrivada)) {
      return NextResponse.json({ ok: false, error: "Faltan credenciales de e.firma" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: { firma_proceso: { include: { firmantes: true } } },
    })
    if (!firmante)                                    return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.uuid !== String(uuid))  return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.tipo !== "externo")                  return NextResponse.json({ ok: false, error: "Este link no es para firma externa" }, { status: 400 })
    if (firmante.firmado)                             return NextResponse.json({ ok: false, error: "Ya firmaste con este link." }, { status: 409 })
    if (firmante.firma_proceso.estado === "completado") return NextResponse.json({ ok: false, error: "El proceso ya está completado." }, { status: 409 })
    if (firmante.expira_en && firmante.expira_en < new Date()) {
      return NextResponse.json({ ok: false, error: "El link expiró. Solicita uno nuevo al responsable." }, { status: 410 })
    }

    const anterioresPendientes = firmante.firma_proceso.firmantes.filter(
      f => f.orden < firmante.orden && !f.firmado
    )
    if (anterioresPendientes.length > 0) {
      const siguiente = anterioresPendientes.sort((a, b) => a.orden - b.orden)[0]
      return NextResponse.json({
        ok: false,
        error: `Aún no es tu turno. Primero debe firmar #${siguiente.orden} (${siguiente.rol}).`,
      }, { status: 412 })
    }

    if (firmante.session_id) {
      const cookieName = cookieNameFor(String(token))
      const cookieVal  = req.cookies.get(cookieName)?.value
      if (cookieVal !== firmante.session_id) {
        return NextResponse.json({ ok: false, error: "Sesión inválida. Este link fue abierto en otro navegador." }, { status: 423 })
      }
    }

    if (!firmante.firma_proceso.proceso_id) {
      return NextResponse.json({ ok: false, error: "Proceso sin identificador del portal" }, { status: 500 })
    }

    const portalRes = BYPASS
      ? { firma: { responsable: String(usuario).toUpperCase() }, estado: "iniciado", bypass: true }
      : await efirmaClient.firmar({
          procesoId: firmante.firma_proceso.proceso_id,
          usuario: String(usuario).toUpperCase(),
          certificado,
          clavePrivada,
          fraseClavePrivada,
        })

    const firmadosPortal = firmadosCount(portalRes)
    const estadoPortal   = normalizarEstado(portalRes, "iniciado")

    const ahora = new Date()
    const result = await prisma.$transaction(async tx => {
      await tx.firma_firmante.update({
        where: { id: firmante.id },
        data: {
          firmado: true,
          fecha_firma: ahora,
          rfc: String(usuario).toUpperCase(),
          nombre: portalRes?.firma?.responsable ?? portalRes?.responsable ?? null,
          cargo_firmante: String(cargoFirmante).trim(),
        },
      })

      const firmadosLocal = await tx.firma_firmante.count({
        where: { firma_proceso_id: firmante.firma_proceso_id, firmado: true },
      })
      const completo = firmadosLocal >= (firmante.firma_proceso.total_firmantes ?? 0)

      await tx.firma_proceso.update({
        where: { id: firmante.firma_proceso_id },
        data: {
          firmados: firmadosLocal,
          estado: completo ? "completado" : estadoPortal,
          fecha_completado: completo ? ahora : null,
        },
      })

      return { firmadosLocal, completo }
    })

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok: true,
      firmados: result.firmadosLocal,
      estado: result.completo ? "completado" : estadoPortal,
      portal: portalRes,
    })
  } catch (err: any) {
    console.error("[firma-efirma/firmar]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
