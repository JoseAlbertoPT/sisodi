import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}
function generarFolioTemporal(id: number, fecha: Date | null | undefined): string {
  const f    = fecha ?? new Date()
  const mes  = f.getMonth() + 1                        // 1-12
  const ini  = INICIALES_MES[mes] ?? "XX"
  const num  = String(id).padStart(3, "0")
  return `${ini}-${num}`
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filtroParam = searchParams.get("filtro")
    const filtro = filtroParam ? parseInt(filtroParam, 10) : null

    if (!filtro || ![1, 2, 3].includes(filtro)) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'filtro' requerido (1, 2 o 3)" },
        { status: 400 }
      )
    }

    const estadosNombres = [
      `En revision DO Filtro ${filtro}`,
      `Observado DO Filtro ${filtro}`,
      ...(filtro === 3 ? ["Aprobado"] : []),
    ]

    const estados = await prisma.estado.findMany({
      where: { nombre: { in: estadosNombres } },
    })

    if (estados.length === 0) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const estadoIds = estados.map((e) => e.id)

    const solicitudes = await prisma.solicitud.findMany({
      where: { estado_id: { in: estadoIds } },
      include: {
        estado: true,
        periodo: true,
        dictamen: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            rfc: true,
            area: { select: { id: true, nombre: true } },
            rol:  { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "desc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado:     true,
            estado_historial_solicitud_estado_anterior_idToestado:  true,
            usuario: {
              select: { id: true, nombre: true, correo: true },
            },
          },
        },
        checklist_detalle: {
          include: { checklist: true },
        },
      },
      orderBy: { fecha_creacion: "desc" },
    })

    const enriched = solicitudes.map((sol) => {
      const historial = sol.historial_solicitud

      const reingresoCount = historial.filter((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("observad")
      }).length

      const lastObservacion = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("observad")
      })
      const lastObservedEstado =
        lastObservacion
          ?.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? null

      const lastObservedStageMatch = lastObservedEstado?.match(/filtro\s+(\d)/i)
      const lastObservedStage = lastObservedStageMatch
        ? parseInt(lastObservedStageMatch[1], 10)
        : null

      const lastObservedDate = lastObservacion?.fecha
        ? new Date(lastObservacion.fecha).toLocaleDateString("es-MX", {
            day:   "2-digit",
            month: "2-digit",
            year:  "numeric",
          })
        : null

      const fechaBase = sol.fecha_envio ?? sol.fecha_creacion
      let slaRestante: number | null = null
      if (fechaBase) {
        const diffDias = Math.floor(
          (new Date().getTime() - new Date(fechaBase).getTime()) /
            (1000 * 60 * 60 * 24)
        )
        slaRestante = Math.max(15 - diffDias, -99)
      }

      const etapaFiltro    = `F${filtro}`
      const openedInFiltro = sol.checklist_detalle.some(
        (cd) => cd.checklist?.etapa === etapaFiltro
      )

      const fueObservadaEnEsteFiltro = historial.some((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return (
          nombre.toLowerCase().includes("observad") &&
          nombre.toLowerCase().includes(`filtro ${filtro}`)
        )
      })

      const isNuevaEnFiltro = !fueObservadaEnEsteFiltro && !openedInFiltro
      const fechaParaFolio = sol.fecha_envio ?? sol.fecha_creacion
      const folioRecepcion =
        sol.folio_recepcion ??
        generarFolioTemporal(sol.id, fechaParaFolio ? new Date(fechaParaFolio) : null)

      const fechaRecepcionDO = sol.fecha_envio
        ? new Date(sol.fecha_envio).toISOString().slice(0, 10)
        : sol.fecha_creacion
        ? new Date(sol.fecha_creacion).toISOString().slice(0, 10)
        : null

      return {
        id: String(sol.id),
        folioSolicitud:  folioRecepcion,
        folioRecepcion,
        folioDictamen:   sol.dictamen?.folio ?? sol.folio_dictamen ?? null,
        folioTemporal:   !sol.folio_recepcion,
        tipo:            sol.tipo_solicitud,
        secretaria:      sol.usuario?.area?.nombre ?? "—",
        estado:          sol.estado.nombre,
        esRegularizacion: sol.es_extemporanea ?? false,
        fechaRecepcionDO,
        periodo:         sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        reingresoCount,
        lastObservedStage,
        lastObservedDate,
        lastObservedEstado,
        slaRestante,
        openedInFiltro:  { [filtro]: openedInFiltro } as Record<number, boolean>,
        isNuevaEnFiltro: { [filtro]: isNuevaEnFiltro } as Record<number, boolean>,
        _raw: sol,
      }
    })

    return NextResponse.json({ ok: true, data: enriched })
  } catch (error: any) {
    console.error("[GET /api/filtro]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes del filtro" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, accion, filtro, usuarioId, observaciones } = body

    if (!solicitudId || !accion || !filtro || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, accion, filtro, usuarioId" },
        { status: 400 }
      )
    }

    if (!["aprobar", "observar"].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Use 'aprobar' u 'observar'" },
        { status: 400 }
      )
    }

    const solicitud = await prisma.solicitud.findUnique({
      where: { id: Number(solicitudId) },
      include: { estado: true },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    let nombreEstadoNuevo: string
    if (accion === "aprobar") {
      if (filtro === 1)      nombreEstadoNuevo = "En revision DO Filtro 2"
      else if (filtro === 2) nombreEstadoNuevo = "En revision DO Filtro 3"
      else                   nombreEstadoNuevo = "Aprobado"
    } else {
      nombreEstadoNuevo = `Observado DO Filtro ${filtro}`
    }

    let estadoNuevo = await prisma.estado.findFirst({
      where: { nombre: nombreEstadoNuevo },
    })
    if (!estadoNuevo) {
      estadoNuevo = await prisma.estado.create({
        data: {
          nombre:      nombreEstadoNuevo,
          descripcion: `Estado generado automáticamente: ${nombreEstadoNuevo}`,
        },
      })
    }

    const comentario =
      accion === "observar" && observaciones
        ? Array.isArray(observaciones)
          ? observaciones.join(" | ")
          : String(observaciones)
        : null

    const solicitudActualizada = await prisma.solicitud.update({
      where: { id: Number(solicitudId) },
      data: {
        estado_id: estadoNuevo.id,
        ...(accion === "aprobar" && filtro === 3 ? { fecha_emision: new Date() } : {}),
      },
      include: {
        estado: true,
        periodo: true,
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            area: { select: { id: true, nombre: true } },
          },
        },
      },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:      Number(solicitudId),
        usuario_id:        usuarioId,
        estado_anterior_id: solicitud.estado_id,
        estado_nuevo_id:   estadoNuevo.id,
        comentario,
      },
    })

    return NextResponse.json({
      ok: true,
      estadoNuevo: nombreEstadoNuevo,
      data: solicitudActualizada,
    })
  } catch (error: any) {
    console.error("[PATCH /api/filtro]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al procesar la acción del filtro" },
      { status: 500 }
    )
  }
}