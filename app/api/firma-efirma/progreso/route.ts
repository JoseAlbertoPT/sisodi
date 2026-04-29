import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const BYPASS = process.env.EFIRMA_BYPASS === "true"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const usuarioId = url.searchParams.get("usuarioId") ?? undefined
    const soloPendientesPorMi = url.searchParams.get("pendientePorMi") === "1"

    const procesos = await prisma.firma_proceso.findMany({
      where: (soloPendientesPorMi && usuarioId
        ? {
            solicitud: { NOT: { estado: { nombre: "Emitido" } } },
            OR: [
              {
                firmantes: BYPASS
                  ? { some: { tipo: "interno", firmado: false } }
                  : {
                      some: {
                        tipo: "interno",
                        firmado: false,
                        OR: [{ usuario_id: usuarioId }, { usuario_id: null }],
                      },
                    },
              },
              {
                firmantes: {
                  some: {
                    tipo: "interno",
                    bandeja: "emision",
                    firmado: true,
                    usuario_id: usuarioId,
                  },
                },
              },
            ],
          }
        : {}) as any,
      orderBy: { fecha_creacion: "desc" },
      include: {
        solicitud: {
          select: {
            id: true,
            folio_justificacion: true,
            folio_recepcion: true,
            folio_dictamen: true,
            tipo_solicitud: true,
            modalidad_firma: true,
            estado: { select: { nombre: true } },
            documento_sellado: { where: { etapa: "emision" }, select: { id: true } },
          },
        },
        firmantes: {
          orderBy: { orden: "asc" },
          include: { usuario: { select: { id: true, nombre: true, rfc: true } } },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      procesos: procesos.map(p => {
        const externosTotal = p.firmantes.filter(f => f.tipo === "externo").length
        const externosFirmados = p.firmantes.filter(f => f.tipo === "externo" && f.firmado).length
        const externosCompletos = externosTotal === 0 || externosFirmados === externosTotal
        // Mi firma pendiente: primero busco un slot asignado a mí; si no hay, busco uno interno sin asignar
        // (usuario_id === null) que podré reclamar al firmar. Esto permite que el flujo cascada funcione
        // aunque el historial no tenga todavía las aprobaciones cuando UEFA inicia la firma.
        const miFirmaPendiente = usuarioId
          ? (
              p.firmantes.find(f => f.tipo === "interno" && f.usuario_id === usuarioId && !f.firmado)
              ?? p.firmantes.find(f => f.tipo === "interno" && f.usuario_id === null && !f.firmado)
              ?? null
            )
          : null
        const estadoSolicitud = p.solicitud?.estado?.nombre ?? null
        const yaEmitido = (estadoSolicitud ?? "").toLowerCase() === "emitido"
        const tieneSelladoEmision = ((p.solicitud as any)?.documento_sellado?.length ?? 0) > 0
        // Mi firma de emisor ya hecha pero pendiente de emitir el dictamen
        const miEmisorFirmado = usuarioId
          ? p.firmantes.find(f => f.tipo === "interno" && f.bandeja === "emision" && f.usuario_id === usuarioId && f.firmado) ?? null
          : null
        const procesoCompleto = (p.total_firmantes ?? 0) > 0 && p.firmados >= (p.total_firmantes ?? 0)
        const pendienteEmisionPorMi = !!(miEmisorFirmado && procesoCompleto && !yaEmitido)
        return {
          id: p.id,
          solicitud_id: p.solicitud_id,
          folio_justificacion: p.solicitud?.folio_justificacion ?? null,
          folio_recepcion: p.solicitud?.folio_recepcion ?? null,
          folio_dictamen: (p.solicitud as any)?.folio_dictamen ?? null,
          tipo_solicitud: p.solicitud?.tipo_solicitud ?? null,
          modalidad_firma: p.solicitud?.modalidad_firma ?? null,
          estado_solicitud: estadoSolicitud,
          pendiente_emision_por_mi: pendienteEmisionPorMi,
          mi_firmante_emisor_id: miEmisorFirmado?.id ?? null,
          sellado_emision_subido: tieneSelladoEmision,
          tipo: p.tipo,
          estado: p.estado,
          firmados: p.firmados,
          total_firmantes: p.total_firmantes,
          fecha_creacion: p.fecha_creacion,
          fecha_completado: p.fecha_completado,
          externos_completos: externosCompletos,
          externos_total: externosTotal,
          externos_firmados: externosFirmados,
          mi_firmante_pendiente: miFirmaPendiente
            ? { id: miFirmaPendiente.id, rol: miFirmaPendiente.rol, cargo: miFirmaPendiente.cargo, bandeja: miFirmaPendiente.bandeja, bloqueado: !externosCompletos }
            : null,
          firmantes: p.firmantes.map(f => ({
            id: f.id,
            orden: f.orden,
            rol: f.rol,
            cargo: f.cargo,
            tipo: f.tipo,
            bandeja: f.bandeja,
            firmado: f.firmado,
            fecha_firma: f.fecha_firma,
            nombre: f.nombre ?? f.usuario?.nombre ?? null,
            rfc: f.rfc ?? f.usuario?.rfc ?? null,
            cargo_firmante: f.cargo_firmante ?? null,
          })),
        }
      }),
    })
  } catch (err: any) {
    console.error("[firma-efirma/progreso]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
