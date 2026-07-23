import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

/**
 * Emite el dictamen una vez que el emisor ya firmó electrónicamente Y subió
 * el dictamen sellado. Equivale a la lógica de auto-emisión que estaba en
 * /firmar-interno, pero se invoca explícitamente al final del flujo.
 *
 * Body: { solicitudId, usuarioId }
 *
 * Validaciones:
 *  - El proceso de firma debe estar completado (todas las firmas listas).
 *  - Debe existir un documento_sellado para etapa="emision".
 *  - La solicitud no puede estar ya en estado "Emitido".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, usuarioId } = body
    if (!solicitudId || !usuarioId) {
      return NextResponse.json({ ok: false, error: "Faltan solicitudId o usuarioId" }, { status: 400 })
    }

    const sid = Number(solicitudId)
    if (isNaN(sid)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }

    const solicitud = await prisma.solicitud.findUnique({
      where: { id: sid },
      include: { dictamen: true, estado: true, firma_proceso: true },
    })
    if (!solicitud) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 })
    }

    if ((solicitud.estado?.nombre ?? "").toLowerCase() === "emitido") {
      return NextResponse.json({ ok: false, error: "El dictamen ya fue emitido" }, { status: 400 })
    }

    const firmaProceso = solicitud.firma_proceso
    if (!firmaProceso) {
      return NextResponse.json({ ok: false, error: "Esta solicitud no tiene proceso de firma" }, { status: 400 })
    }
    const totalFirmantes = firmaProceso.total_firmantes ?? 0
    if (totalFirmantes === 0 || firmaProceso.firmados < totalFirmantes) {
      return NextResponse.json({ ok: false, error: "Aún faltan firmas por completar" }, { status: 400 })
    }

    const sellado = await prisma.documento_sellado.findUnique({
      where: { solicitud_id_etapa: { solicitud_id: sid, etapa: "emision" } },
    })

    const ahora = new Date()
    const modalidad = (solicitud as any).modalidad_firma ?? "electronica"
    const folioJust = (solicitud as any).folio_justificacion ?? null
    const folioDictamenFinal = (solicitud as any).folio_dictamen ?? solicitud.dictamen?.folio ?? folioJust

    let estadoEmitido = await prisma.estado.findFirst({
      where: { nombre: { equals: "Emitido", mode: "insensitive" } },
    })
    if (!estadoEmitido) {
      estadoEmitido = await prisma.estado.create({
        data: { nombre: "Emitido", descripcion: "Dictamen emitido tras firma completa" },
      })
    }

    const ops: any[] = [
      prisma.solicitud.update({
        where: { id: sid },
        data: {
          estado_id: estadoEmitido.id,
          fecha_emision: ahora,
          ...(folioDictamenFinal ? { folio_dictamen: folioDictamenFinal } : {}),
        } as any,
      }),
      prisma.historial_solicitud.create({
        data: {
          solicitud_id: sid,
          usuario_id: usuarioId,
          estado_anterior_id: solicitud.estado_id,
          estado_nuevo_id: estadoEmitido.id,
          comentario: `Dictamen emitido tras firma completa y sellado. Modalidad: ${modalidad}${folioDictamenFinal ? ` | Folio: ${folioDictamenFinal}` : ""}`,
        },
      }),
    ]
    if (!solicitud.dictamen && folioDictamenFinal) {
      ops.unshift(
        prisma.dictamen.create({
          data: {
            solicitud_id: sid,
            folio: folioDictamenFinal,
            fecha_emision: ahora,
            tipo_firma: modalidad,
            archivo_pdf: sellado?.archivo ?? null,
          },
        })
      )
    } else if (solicitud.dictamen) {
      ops.push(
        prisma.dictamen.update({
          where: { solicitud_id: sid },
          data: { tipo_firma: modalidad, fecha_emision: ahora, ...(sellado ? { archivo_pdf: sellado.archivo } : {}) },
        })
      )
    }
    await prisma.$transaction(ops)

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, folio: folioDictamenFinal })
  } catch (error: any) {
    console.error("[POST /api/firma-efirma/emitir-dictamen]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 })
  }
}
