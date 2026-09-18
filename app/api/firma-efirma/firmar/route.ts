import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { firmaDatosEx } from "@/lib/firma-oficio-client"
import { s3Download } from "@/lib/s3"
import { broadcastUpdate } from "@/lib/sse-manager"
import { ESTADO_POR_BANDEJA_PENDIENTE } from "@/lib/firma-plantillas"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const FIRMA_S3_PREFIX = "firma-efirma"

const BYPASS = process.env.EFIRMA_BYPASS === "true"

// El uuid del PDF en S3 (nuestra key interna) es distinto del uuid del
// "documento multifirma" que WSFirmaOficio genera y regresa en la primera
// firma real — hay que reenviar ESE (guardado en firma_proceso.uuid_ws_firma)
// en las firmas siguientes, o el servicio responde codigoRespuesta 1027
// ("El documento no existe o no pertenece a multifirma"). En la primera firma
// del proceso uuidWsFirma todavía es null: se manda sin uuid y el servicio
// asigna uno, que se guarda para las firmas siguientes (ver POST más abajo).
async function firmarConWsFirmaOficio(opts: {
  uuidS3: string
  uuidWsFirma: string | null
  folio: string
  usuarioRfc: string
  nombreFirmante: string
  certificado: string
  clavePrivada: string
  fraseClavePrivada: string
}) {
  // "contenido" se manda como texto corto (folio + huella SHA-256 del PDF),
  // no el PDF completo en base64 — mandar el documento entero (~cientos de KB
  // dentro de un solo campo XML) hacía tronar el servicio con codigoRespuesta
  // 5000 ("Ocurrió un incidente"), un Axis/JAX-WS viejo probablemente sin
  // límite de tamaño de mensaje bien manejado. La huella sigue ligando la
  // firma al documento exacto sin mandar el archivo.
  const pdfBuffer = await s3Download(`${FIRMA_S3_PREFIX}/${opts.uuidS3}.pdf`)
  const huella = createHash("sha256").update(pdfBuffer).digest("hex")
  const contenido = `Folio ${opts.folio} — SHA-256 ${huella} — ${opts.usuarioRfc} — ${new Date().toISOString()}`
  // A pesar de que el XSD marca fechaDocumento y destinatario como
  // opcionales (minOccurs="0"), el servicio responde codigoRespuesta 1000
  // ("Todos los parámetros son requeridos, excepto CURP y RFC") si se
  // omiten — solo CURP y RFC dentro de destinatario son realmente opcionales.
  return firmaDatosEx({
    certificado: opts.certificado,
    clavePrivada: opts.clavePrivada,
    fraseClavePrivada: opts.fraseClavePrivada,
    folioDocumento: opts.folio,
    fechaDocumento: new Date().toISOString().slice(0, 10),
    contenido,
    destinatario: { nombreCompleto: opts.nombreFirmante, rfc: opts.usuarioRfc },
    uuid: opts.uuidWsFirma ?? undefined,
  })
}

function cookieNameFor(token: string) {
  return `firma_sess_${token.slice(0, 24)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uuid, token, usuario, nombre, cargoFirmante, certificado, clavePrivada, fraseClavePrivada } = body

    if (!uuid || !token || !usuario || !nombre || !cargoFirmante) {
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

    let sello: Awaited<ReturnType<typeof firmaDatosEx>> | null = null
    if (!BYPASS) {
      const solicitudMeta = await prisma.solicitud.findUnique({
        where: { id: firmante.firma_proceso.solicitud_id },
        select: { folio_recepcion: true, folio_justificacion: true },
      })
      const folio = solicitudMeta?.folio_recepcion ?? solicitudMeta?.folio_justificacion ?? String(firmante.firma_proceso.solicitud_id)
      sello = await firmarConWsFirmaOficio({
        uuidS3: firmante.firma_proceso.uuid!,
        uuidWsFirma: firmante.firma_proceso.uuid_ws_firma ?? null,
        folio,
        usuarioRfc: String(usuario).toUpperCase(),
        nombreFirmante: String(nombre).trim(),
        certificado,
        clavePrivada,
        fraseClavePrivada,
      })
      // Primera firma real de este proceso: el servicio asignó el uuid del
      // documento multifirma — guardarlo para que las firmas siguientes lo
      // reenvíen (ver comentario en firmarConWsFirmaOficio).
      if (!firmante.firma_proceso.uuid_ws_firma && sello.uuid) {
        await prisma.firma_proceso.update({
          where: { id: firmante.firma_proceso_id },
          data: { uuid_ws_firma: sello.uuid },
        })
      }
    }
    const estadoPortal = "iniciado"

    const ahora = new Date()
    const result = await prisma.$transaction(async tx => {
      await tx.firma_firmante.update({
        where: { id: firmante.id },
        data: {
          firmado: true,
          fecha_firma: ahora,
          rfc: String(usuario).toUpperCase(),
          nombre: String(nombre).trim(),
          cargo_firmante: String(cargoFirmante).trim(),
          ...(sello ? {
            sello_digital: sello.selloDigital,
            estampado_tiempo: sello.estampadoTiempo,
            sello_estampado_tiempo: sello.selloEstampadoTiempo,
            no_certificado_gem: sello.noCertificadoGEM,
            rfc_gem: sello.rfcGEM,
            url_validacion: sello.urlValidacion,
            url_validacion_corta: sello.urlValidacionCorta,
            uuid_firma: sello.uuid,
          } : {}),
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

    // Bug crítico corregido: a diferencia de /api/firma-efirma/firmar-interno,
    // esta ruta (firmante externo) no avanzaba el estado de la solicitud al
    // siguiente firmante interno pendiente ni dejaba rastro en el historial —
    // por eso, tras completarse la firma externa, el hand-off a UEFA (o al
    // interno que corresponda) dependía de que el estado ya viniera correcto
    // por casualidad desde antes. Se replica aquí la misma lógica que usa
    // firmar-interno para que esta transición quede respaldada igual que las
    // demás del flujo.
    if (!result.completo) {
      const siguientePendiente = firmante.firma_proceso.firmantes
        .filter(f => f.tipo === "interno" && !f.firmado)
        .sort((a, b) => a.orden - b.orden)[0]
      const siguienteEstado = siguientePendiente
        ? ESTADO_POR_BANDEJA_PENDIENTE[(siguientePendiente.bandeja ?? "") as keyof typeof ESTADO_POR_BANDEJA_PENDIENTE]
        : null
      if (siguienteEstado) {
        const estadoSig = await prisma.estado.findFirst({
          where: { nombre: { equals: siguienteEstado, mode: "insensitive" } },
        })
        if (!estadoSig) {
          return NextResponse.json(
            { ok: false, error: `Estado "${siguienteEstado}" no existe en BD. Corre el seed de estados.` },
            { status: 500 },
          )
        }
        const solicitudActual = await prisma.solicitud.findUnique({
          where: { id: firmante.firma_proceso.solicitud_id },
          select: { estado_id: true },
        })
        await prisma.$transaction([
          prisma.solicitud.update({
            where: { id: firmante.firma_proceso.solicitud_id },
            data: { estado_id: estadoSig.id },
          }),
          prisma.historial_solicitud.create({
            data: {
              solicitud_id: firmante.firma_proceso.solicitud_id,
              // No hay usuario_id: quien firma es externo y no tiene cuenta en
              // el sistema. Se atribuye al usuario que inició el proceso de firma.
              usuario_id: firmante.firma_proceso.creado_por_id,
              estado_anterior_id: solicitudActual?.estado_id ?? null,
              estado_nuevo_id: estadoSig.id,
              comentario: `Firma externa completada (${firmante.rol}). Avanza a ${siguienteEstado}.`,
            },
          }),
        ])
      }
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok: true,
      firmados: result.firmadosLocal,
      estado: result.completo ? "completado" : estadoPortal,
      sello,
    })
  } catch (err: any) {
    console.error("[firma-efirma/firmar]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
