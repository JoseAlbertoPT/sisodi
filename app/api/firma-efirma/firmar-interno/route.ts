import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { efirmaClient, firmadosCount, normalizarEstado } from "@/lib/efirma-client"
import { broadcastUpdate } from "@/lib/sse-manager"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const norm = (s: string) => s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().trim()

const BYPASS = process.env.EFIRMA_BYPASS === "true"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firmanteId, usuarioId, cargoFirmante, certificado, clavePrivada, fraseClavePrivada, skipEmit } = body

    if (!firmanteId || !usuarioId || !cargoFirmante) {
      return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 })
    }
    if (!BYPASS && (!certificado || !clavePrivada || !fraseClavePrivada)) {
      return NextResponse.json({ ok: false, error: "Faltan credenciales de e.firma" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { id: Number(firmanteId) },
      include: {
        firma_proceso: { include: { firmantes: true } },
        usuario: true,
      },
    })
    if (!firmante)                          return NextResponse.json({ ok: false, error: "Firmante no encontrado" }, { status: 404 })
    if (firmante.tipo !== "interno")        return NextResponse.json({ ok: false, error: "Este firmante no es interno" }, { status: 400 })

    const slotSinAsignar = !firmante.usuario_id
    if (!BYPASS && !slotSinAsignar && firmante.usuario_id !== usuarioId) {
      return NextResponse.json({ ok: false, error: "No te corresponde firmar este bloque" }, { status: 403 })
    }
    // El bloque UEFA no está atado a quien aprobó ("Pendiente DO"), sino a
    // cualquier usuario con rol UEFA: se verifica aquí en vez de confiar en
    // el usuario_id de la solicitud, que el cliente podría falsear.
    if (!BYPASS && slotSinAsignar && firmante.bandeja === "uefa") {
      const solicitante = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        include: { rol: true },
      })
      const rolSolicitante = norm(solicitante?.rol.nombre ?? "")
      if (!solicitante || (rolSolicitante !== "uefa" && rolSolicitante !== "administrador")) {
        return NextResponse.json({ ok: false, error: "Solo un usuario con rol UEFA puede firmar este bloque" }, { status: 403 })
      }
    }
    if (firmante.firmado)                   return NextResponse.json({ ok: false, error: "Ya firmaste" }, { status: 409 })
    if (firmante.firma_proceso.estado === "completado") {
      return NextResponse.json({ ok: false, error: "El proceso ya está completado" }, { status: 409 })
    }
    if (!firmante.firma_proceso.proceso_id) {
      return NextResponse.json({ ok: false, error: "Proceso sin identificador del portal" }, { status: 500 })
    }

    // Revisor (Filtro 1) no depende de que UEFA haya firmado: su revisión
    // corre en paralelo, solo espera a que los externos (Elaboró) firmen.
    const anterioresPendientes = firmante.bandeja === "revision"
      ? firmante.firma_proceso.firmantes.filter(f => f.tipo === "externo" && !f.firmado)
      : firmante.firma_proceso.firmantes.filter(f => f.orden < firmante.orden && !f.firmado)
    if (anterioresPendientes.length > 0) {
      const siguiente = anterioresPendientes.sort((a, b) => a.orden - b.orden)[0]
      return NextResponse.json({
        ok: false,
        error: `Aún no es tu turno. Primero debe firmar #${siguiente.orden} (${siguiente.rol}).`,
      }, { status: 412 })
    }

    const usuarioEfectivo = slotSinAsignar
      ? await prisma.usuario.findUnique({ where: { id: usuarioId } })
      : firmante.usuario
    const rfcUsuario = usuarioEfectivo?.rfc
    if (!rfcUsuario) {
      return NextResponse.json({ ok: false, error: "Tu usuario no tiene RFC registrado. Contacta al administrador." }, { status: 400 })
    }

    const portalRes = BYPASS
      ? { firma: { responsable: usuarioEfectivo?.nombre ?? null }, estado: "iniciado", bypass: true }
      : await efirmaClient.firmar({
          procesoId: firmante.firma_proceso.proceso_id,
          usuario: rfcUsuario.toUpperCase(),
          certificado,
          clavePrivada,
          fraseClavePrivada,
        })

    const estadoPortal = normalizarEstado(portalRes, "iniciado")
    const ahora = new Date()

    const result = await prisma.$transaction(async tx => {
      await tx.firma_firmante.update({
        where: { id: firmante.id },
        data: {
          firmado: true,
          fecha_firma: ahora,
          rfc: rfcUsuario.toUpperCase(),
          nombre: usuarioEfectivo?.nombre ?? portalRes?.firma?.responsable ?? null,
          cargo_firmante: String(cargoFirmante).trim(),
          ...(slotSinAsignar ? { usuario_id: usuarioId } : {}),
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

    if (!result.completo) {
      // El siguiente estado depende de cuál es el firmante interno de MENOR
      // orden que todavía falta por firmar — no de cuál bandeja acaba de
      // firmar. Revisor puede firmar antes que UEFA (no se esperan entre
      // sí), así que si UEFA sigue pendiente, el estado no debe saltarse su
      // turno aunque Revisor ya haya firmado.
      const estadoPorBandejaPendiente: Record<string, string> = {
        uefa:       "Pendiente Firma Justificacion",
        revision:   "Pendiente Firma Revision",
        validacion: "Pendiente Firma Validacion",
        emision:    "Pendiente Firma Emisor",
      }
      const siguientePendiente = firmante.firma_proceso.firmantes
        .filter(f => f.tipo === "interno" && f.id !== firmante.id && !f.firmado)
        .sort((a, b) => a.orden - b.orden)[0]
      const siguienteEstado = siguientePendiente
        ? estadoPorBandejaPendiente[siguientePendiente.bandeja ?? ""]
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
              usuario_id: usuarioId,
              estado_anterior_id: solicitudActual?.estado_id ?? null,
              estado_nuevo_id: estadoSig.id,
              comentario: `Firma completada en bandeja ${firmante.bandeja}. Avanza a ${siguienteEstado}.`,
            },
          }),
        ])
      }
    }

    let emisionHecha = false
    let folioDictamenFinal: string | null = null
    if (result.completo && firmante.bandeja === "emision" && !skipEmit) {
      try {
        const solicitudId = firmante.firma_proceso.solicitud_id
        const solicitud = await prisma.solicitud.findUnique({
          where: { id: solicitudId },
          include: { dictamen: true },
        })
        if (solicitud) {
          const modalidad = (solicitud as any).modalidad_firma ?? "electronica"
          const folioJust = (solicitud as any).folio_justificacion ?? null
          folioDictamenFinal = (solicitud as any).folio_dictamen ?? solicitud.dictamen?.folio ?? folioJust

          const estadoEmitido = await prisma.estado.findFirst({
            where: { nombre: { equals: "Emitido", mode: "insensitive" } },
          })
          if (!estadoEmitido) {
            return NextResponse.json(
              { ok: false, error: 'Estado "Emitido" no existe en BD. Corre el seed de estados.' },
              { status: 500 },
            )
          }

          const ops: any[] = [
            prisma.solicitud.update({
              where: { id: solicitudId },
              data: { estado_id: estadoEmitido.id, fecha_emision: ahora, ...(folioDictamenFinal ? { folio_dictamen: folioDictamenFinal } : {}) } as any,
            }),
            prisma.historial_solicitud.create({
              data: {
                solicitud_id: solicitudId,
                usuario_id: usuarioId,
                estado_anterior_id: solicitud.estado_id,
                estado_nuevo_id: estadoEmitido.id,
                comentario: `Dictamen emitido tras firma completa. Modalidad: ${modalidad}${folioDictamenFinal ? ` | Folio: ${folioDictamenFinal}` : ""}`,
              },
            }),
          ]
          if (!solicitud.dictamen && folioDictamenFinal) {
            ops.unshift(
              prisma.dictamen.create({
                data: {
                  solicitud_id: solicitudId,
                  folio: folioDictamenFinal,
                  fecha_emision: ahora,
                  tipo_firma: modalidad,
                  archivo_pdf: null,
                },
              })
            )
          } else if (solicitud.dictamen) {
            ops.push(
              prisma.dictamen.update({
                where: { solicitud_id: solicitudId },
                data: { tipo_firma: modalidad, fecha_emision: ahora },
              })
            )
          }
          await prisma.$transaction(ops)
          emisionHecha = true
        }
      } catch (emitErr: any) {
        console.error("[firma-efirma/firmar-interno] emisión automática falló:", emitErr)
      }
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({
      ok: true,
      firmados: result.firmadosLocal,
      estado: result.completo ? "completado" : estadoPortal,
      emision: emisionHecha ? { folio: folioDictamenFinal } : null,
      portal: portalRes,
    })
  } catch (err: any) {
    console.error("[firma-efirma/firmar-interno]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
