import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}

function estadoEnRevision(filtro: number) {
  if (filtro === 1) return "En Revision Revisor"
  if (filtro === 2) return "En Validacion Final"
  return "En Revision Emisor"
}
function estadoObservado(filtro: number) {
  if (filtro === 1) return "Observado por Revisor"
  if (filtro === 2) return "Observado por Validacion Final"
  return "Observado por Emisor"
}

function generarFolioTemporal(id: number, fecha: Date | null | undefined): string {
  const f   = fecha ?? new Date()
  const mes = f.getMonth() + 1
  const ini = INICIALES_MES[mes] ?? "XX"
  const num = String(id).padStart(3, "0")
  return `${ini}-${num}`
}

async function generarFolioDictamen(tipo: "dictamen" | "opinion"): Promise<string> {
  const ahora = new Date()
  const mes   = ahora.getMonth() + 1
  const anio  = ahora.getFullYear()
  const ini   = INICIALES_MES[mes] ?? "XX"
  const clave = tipo === "dictamen" ? "DICT" : "OPI"

  const registro = await prisma.consecutivo_folio.upsert({
    where:  { tipo_mes_anio: { tipo: clave, mes, anio } },
    update: { consecutivo: { increment: 1 } },
    create: { tipo: clave, mes, anio, consecutivo: 1 },
  })

  const num = String(registro.consecutivo ?? 1).padStart(3, "0")
  return `${ini}-${num}-${anio}`
}

// ── Resolver folio dictamen desde TODAS las fuentes posibles ─────────────────
function resolverFolioDictamen(item: any): string | null {
  return (
    item?.folioDictamen         ??
    item?.dictamen?.folio       ??
    item?.folio_dictamen        ??
    item?.folio_anterior        ??   // renovaciones guardan el folio previo aquí
    item?._raw?.folioDictamen   ??
    item?._raw?.dictamen?.folio ??
    item?._raw?.folio_dictamen  ??
    item?._raw?.folio_anterior  ??
    null
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filtroParam = searchParams.get("filtro")
    const filtro      = filtroParam ? parseInt(filtroParam, 10) : null

    if (!filtro || ![1, 2, 3].includes(filtro)) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'filtro' requerido (1, 2 o 3)" },
        { status: 400 }
      )
    }

    const estadosNombres = [
      estadoEnRevision(filtro),
      estadoObservado(filtro),
      ...(filtro === 3 ? ["Pendiente Firma Dictamen"] : []),
    ]

    // ── FIX CRÍTICO: búsqueda insensible a mayúsculas/acentos ────────────────
    // PostgreSQL hace comparación case-sensitive por defecto, lo que causaba
    // que solicitudes con estados como "En Revisión DO Filtro 1" (con acento)
    // no aparecieran en la bandeja aunque el badge las mostrara correctamente.
    const estados = await prisma.estado.findMany({
      where: {
        OR: estadosNombres.map((nombre) => ({
          nombre: { equals: nombre, mode: "insensitive" as const },
        })),
      },
    })

    if (estados.length === 0) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const estadoIds = estados.map((e) => e.id)

    const solicitudes = await prisma.solicitud.findMany({
      where: { estado_id: { in: estadoIds } },
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true, // CRÍTICO: incluir siempre para resolver folioDictamen
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            rfc:    true,
            area:   { select: { id: true, nombre: true } },
            rol:    { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "desc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado:    true,
            estado_historial_solicitud_estado_anterior_idToestado: true,
            usuario: { select: { id: true, nombre: true, correo: true } },
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
        lastObservacion?.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? null

      const lastObservedStage = (() => {
        if (!lastObservedEstado) return null
        const n = lastObservedEstado.toLowerCase()
        if (n.includes("revisor")) return 1
        if (n.includes("validacion final")) return 2
        if (n.includes("emisor")) return 3
        // legacy pattern
        const m = lastObservedEstado.match(/filtro\s+(\d)/i)
        return m ? parseInt(m[1], 10) : null
      })()

      const lastObservedDate = lastObservacion?.fecha
        ? new Date(lastObservacion.fecha).toLocaleDateString("es-MX", {
            day: "2-digit", month: "2-digit", year: "numeric",
          })
        : null

      const fechaBase = sol.fecha_envio ?? sol.fecha_creacion
      let slaRestante: number | null = null
      if (fechaBase) {
        const diffDias = Math.floor(
          (new Date().getTime() - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24)
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
        const n = nombre.toLowerCase()
        if (!n.includes("observad")) return false
        if (filtro === 1) return n.includes("revisor") || n.includes("filtro 1")
        if (filtro === 2) return n.includes("validacion final") || n.includes("filtro 2")
        if (filtro === 3) return n.includes("emisor") || n.includes("filtro 3")
        return false
      })

      const isNuevaEnFiltro = !fueObservadaEnEsteFiltro && !openedInFiltro
      const fechaParaFolio  = sol.fecha_envio ?? sol.fecha_creacion
      const folioRecepcion  =
        sol.folio_recepcion ??
        generarFolioTemporal(sol.id, fechaParaFolio ? new Date(fechaParaFolio) : null)

      const fechaRecepcionDO = sol.fecha_envio
        ? new Date(sol.fecha_envio).toISOString().slice(0, 10)
        : sol.fecha_creacion
        ? new Date(sol.fecha_creacion).toISOString().slice(0, 10)
        : null

      // ── FIX: Resolver folio dictamen desde TODAS las fuentes ─────────────
      // Incluye folio_anterior para el caso de renovaciones donde el dictamen
      // previo se almacena en ese campo y no en la relación dictamen.
      const folioDictamen =
        sol.dictamen?.folio ??
        (sol as any).folio_dictamen ??
        (sol as any).folio_anterior ??
        null

      // _raw enriquecido con folioDictamen propagado al nivel raíz
      const rawEnriquecido = {
        ...sol,
        folioDictamen,
        folio_anterior: (sol as any).folio_anterior ?? null,
        dictamen: sol.dictamen
          ? { ...sol.dictamen, folio: sol.dictamen.folio }
          : folioDictamen
          ? { folio: folioDictamen }
          : null,
      }

      return {
        id:               String(sol.id),
        folioSolicitud:   folioRecepcion,
        folioRecepcion,
        folioDictamen,
        folioTemporal:    !sol.folio_recepcion,
        tipo:             sol.tipo_solicitud,
        denominacion:     (sol as any).denominacion || sol.tipo_solicitud || "—",
        secretaria:       sol.usuario?.area?.nombre ?? "—",
        estado:           sol.estado.nombre,
        esRegularizacion: (sol as any).es_extemporanea ?? false,
        fechaRecepcionDO,
        periodo:          sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        reingresoCount,
        lastObservedStage,
        lastObservedDate,
        lastObservedEstado,
        slaRestante,
        openedInFiltro:  { [filtro]: openedInFiltro }  as Record<number, boolean>,
        isNuevaEnFiltro: { [filtro]: isNuevaEnFiltro } as Record<number, boolean>,
        _raw: rawEnriquecido,
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
    const { solicitudId, accion, filtro, usuarioId, observaciones, folioDictamen } = body

    if (!solicitudId || !accion || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, accion, usuarioId" },
        { status: 400 }
      )
    }

    if (!["aprobar", "observar", "asignarFolio"].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Use 'aprobar', 'observar' o 'asignarFolio'" },
        { status: 400 }
      )
    }

    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json(
        { ok: false, error: "solicitudId debe ser un número válido" },
        { status: 400 }
      )
    }

    // ── asignarFolio ──────────────────────────────────────────────────────────
    if (accion === "asignarFolio") {
      if (!folioDictamen) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'folioDictamen' para la acción asignarFolio" },
          { status: 400 }
        )
      }

      const solicitudExistente = await prisma.solicitud.findUnique({
        where:   { id: idNum },
        include: { dictamen: true },
      })

      if (!solicitudExistente) {
        return NextResponse.json(
          { ok: false, error: "Solicitud no encontrada" },
          { status: 404 }
        )
      }

      if (solicitudExistente.dictamen) {
        await prisma.dictamen.update({
          where: { solicitud_id: idNum },
          data:  { folio: folioDictamen },
        })
      } else {
        await prisma.dictamen.create({
          data: {
            solicitud_id:  idNum,
            folio:         folioDictamen,
            fecha_emision: new Date(),
            tipo_firma:    "autografa",
            archivo_pdf:   null,
          },
        })
      }

      try {
        await prisma.solicitud.update({
          where: { id: idNum },
          data:  { folio_dictamen: folioDictamen } as any,
        })
      } catch {
        // campo puede no existir en el esquema aún — ignorar silenciosamente
      }

      return NextResponse.json({
        ok:            true,
        accion:        "asignarFolio",
        folioDictamen,
      })
    }

    // ── aprobar / observar ────────────────────────────────────────────────────
    if (!filtro) {
      return NextResponse.json(
        { ok: false, error: "Se requiere 'filtro' para las acciones aprobar/observar" },
        { status: 400 }
      )
    }

    const solicitud = await prisma.solicitud.findUnique({
      where:   { id: idNum },
      include: { estado: true, dictamen: true },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    let nombreEstadoNuevo: string
    if (accion === "aprobar") {
      if (filtro === 1)      nombreEstadoNuevo = "Pendiente Firma Justificacion"
      else if (filtro === 2) nombreEstadoNuevo = estadoEnRevision(3)
      else                   nombreEstadoNuevo = "Pendiente Firma Dictamen"
    } else {
      nombreEstadoNuevo = estadoObservado(filtro)
    }

    // Buscar estado con mode insensitive para consistencia
    let estadoNuevo = await prisma.estado.findFirst({
      where: { nombre: { equals: nombreEstadoNuevo, mode: "insensitive" } },
    })
    if (!estadoNuevo) {
      estadoNuevo = await prisma.estado.create({
        data: {
          nombre:      nombreEstadoNuevo,
          descripcion: `Estado creado automáticamente: ${nombreEstadoNuevo}`,
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
      where: { id: idNum },
      data:  { estado_id: estadoNuevo.id },
      include: {
        estado:  true,
        periodo: true,
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            area:   { select: { id: true, nombre: true } },
          },
        },
      },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:       idNum,
        usuario_id:         usuarioId,
        estado_anterior_id: solicitud.estado_id,
        estado_nuevo_id:    estadoNuevo.id,
        comentario,
      },
    })

    // ── AUTO-EMISIÓN cuando Emisor (filtro 3) aprueba ────────────────────────
    if (accion === "aprobar" && filtro === 3 && !solicitud.dictamen) {
      try {
        const esParaestatal =
          (solicitud.tipo_solicitud ?? "").toLowerCase().includes("paraestatal")
        const tipoDoc: "dictamen" | "opinion" = esParaestatal ? "opinion" : "dictamen"
        const folio = await generarFolioDictamen(tipoDoc)

        let estadoEmitido = await prisma.estado.findFirst({
          where: { nombre: { equals: "Emitido", mode: "insensitive" } },
        })
        if (!estadoEmitido) {
          estadoEmitido = await prisma.estado.create({
            data: {
              nombre:      "Emitido",
              descripcion: "Dictamen/Opinión emitido por la Dirección de Organización",
            },
          })
        }

        const ahora = new Date()

        await prisma.$transaction([
          prisma.dictamen.create({
            data: {
              solicitud_id:  idNum,
              folio,
              fecha_emision: ahora,
              tipo_firma:    "autografa",
              archivo_pdf:   null,
            },
          }),
          prisma.solicitud.update({
            where: { id: idNum },
            data: {
              estado_id:      estadoEmitido.id,
              folio_dictamen: folio,
              fecha_emision:  ahora,
            } as any,
          }),
          prisma.historial_solicitud.create({
            data: {
              solicitud_id:       idNum,
              usuario_id:         usuarioId,
              estado_anterior_id: estadoNuevo.id,
              estado_nuevo_id:    estadoEmitido.id,
              comentario: `Dictamen emitido. Folio: ${folio} | Tipo firma: autografa`,
            },
          }),
        ])

        return NextResponse.json({
          ok:            true,
          estadoNuevo:   "Emitido",
          folioDictamen: folio,
          data:          solicitudActualizada,
        })
      } catch (emisionError: any) {
        console.error("[AUTO-EMISION Filtro 3]", emisionError)
        return NextResponse.json({
          ok:               true,
          estadoNuevo:      nombreEstadoNuevo,
          folioDictamen:    null,
          autoEmisionError: emisionError?.message ?? "Error en auto-emisión",
          data:             solicitudActualizada,
        })
      }
    }

    return NextResponse.json({
      ok:            true,
      estadoNuevo:   nombreEstadoNuevo,
      folioDictamen: solicitud.dictamen?.folio ?? (solicitud as any).folio_anterior ?? null,
      data:          solicitudActualizada,
    })
  } catch (error: any) {
    console.error("[PATCH /api/filtro]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al procesar la acción del filtro" },
      { status: 500 }
    )
  }
}