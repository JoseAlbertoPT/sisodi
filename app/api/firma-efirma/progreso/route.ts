import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const BYPASS = process.env.EFIRMA_BYPASS === "true"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const usuarioId = url.searchParams.get("usuarioId") ?? undefined
    const soloPendientesPorMi = url.searchParams.get("pendientePorMi") === "1"

    const procesos = await prisma.firma_proceso.findMany({
      where: soloPendientesPorMi && usuarioId
        ? {
            estado: { not: "completado" },
            firmantes: BYPASS
              ? { some: { tipo: "interno", firmado: false } }
              : {
                  some: {
                    tipo: "interno",
                    firmado: false,
                    OR: [{ usuario_id: usuarioId }, { usuario_id: null }],
                  },
                },
          }
        : {},
      orderBy: { fecha_creacion: "desc" },
      include: {
        solicitud: {
          select: {
            id: true,
            folio_justificacion: true,
            folio_recepcion: true,
            tipo_solicitud: true,
            modalidad_firma: true,
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
        return {
          id: p.id,
          solicitud_id: p.solicitud_id,
          folio_justificacion: p.solicitud?.folio_justificacion ?? null,
          folio_recepcion: p.solicitud?.folio_recepcion ?? null,
          tipo_solicitud: p.solicitud?.tipo_solicitud ?? null,
          modalidad_firma: p.solicitud?.modalidad_firma ?? null,
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
