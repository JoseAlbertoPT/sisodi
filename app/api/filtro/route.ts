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

function generarFolioTemporal(id: number, fecha: Date | null | undefined, sufijo?: number): string {
  const f   = fecha ?? new Date()
  const mes = f.getMonth() + 1
  const ini = INICIALES_MES[mes] ?? "XX"
  const num = String(id).padStart(3, "0")
  return sufijo ? `${ini}-${num}-${sufijo}` : `${ini}-${num}`
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
    item?._raw?.folioDictamen   ??
    item?._raw?.dictamen?.folio ??
    item?._raw?.folio_dictamen  ??
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
      ...(filtro === 3 ? [estadoObservado(filtro)] : []),  // solo filtro 3 (Emisor) ve sus propias observadas
      ...(filtro === 3 ? ["Pendiente Firma Dictamen"] : []),
      ...(filtro === 1 ? [
        "Aceptado por Revisor",
        "Observado por Validacion Final",  // regresada desde Validacion Final → solo la ve el Revisor
      ] : []),
      ...(filtro === 2 ? [
        "Pendiente DO",           // llega de UEFA → tab: Pendientes de asignación
        "Observado por Emisor",   // regresada desde Emisor → tab: Observadas
        "Observado por DO",       // regresada desde Jefe DO → tab: Observadas en UEFA
        "Observado por Revisor",  // regresada por Revisor → tab: Observadas
      ] : []),
    ]

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

    const revisorId    = searchParams.get("revisorId")
    const viewerUserId = searchParams.get("userId")

    let organoFilter: any = {}
    let esRolRevisor = false

    if (viewerUserId) {
      const viewer = await prisma.usuario.findUnique({
        where:  { id: viewerUserId },
        select: {
          organo_centralizado: { select: { id: true } },
          rol: { select: { nombre: true } },
        },
      })
      if (viewer) {
        esRolRevisor = viewer.rol?.nombre?.toLowerCase() === "revisor"
        if (viewer.organo_centralizado !== null) {
          organoFilter = {
            OR: [
              { usuario: { organo_centralizado: { isNot: null } } },
              { usuario: { secretaria_id: null } },
            ],
          }
        } else {
          organoFilter = { usuario: { organo_centralizado: { is: null } } }
        }
      }
    }

    const whereClause: any = { estado_id: { in: estadoIds }, ...organoFilter }

    // Revisor solo ve solicitudes asignadas a él, sin importar el filtro
    if (esRolRevisor && viewerUserId) {
      whereClause.revisor_asignado_id = viewerUserId
    } else if (filtro === 1 && revisorId) {
      whereClause.revisor_asignado_id = revisorId
    }

    const solicitudes = await prisma.solicitud.findMany({
      where: whereClause,
      include: {
        estado:           true,
        periodo:          true,
        dictamen:         true,
        revisor_asignado: { select: { id: true, nombre: true, correo: true } },
        usuario: {
          select: {
            id:            true,
            nombre:        true,
            correo:        true,
            rfc:           true,
            secretaria_id: true,
            area:          { select: { id: true, nombre: true } },
            rol:           { select: { id: true, nombre: true } },
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
        adjunto: true,
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
      const tieneFolioDictamen = !!(sol.dictamen?.folio ?? (sol as any).folio_dictamen)
      const openedInFiltro = sol.checklist_detalle.some(
        (cd) => cd.checklist?.etapa === etapaFiltro
      ) || tieneFolioDictamen

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

      // Extraer número base y sufijo del folio JUST-YYYY-NNNN o JUST-YYYY-NNNN-S
      const { numParaFolioTemp, sufijoFolio } = (() => {
        if ((sol as any).folio_justificacion) {
          const partes = String((sol as any).folio_justificacion).split("-")
          // Formato: JUST(0) - YYYY(1) - NNNN(2) - [S(3)]
          if (partes.length >= 3) {
            const base = parseInt(partes[2], 10)
            const sufijo = partes.length === 4 ? parseInt(partes[3], 10) : undefined
            if (!isNaN(base) && base > 0) return { numParaFolioTemp: base, sufijoFolio: sufijo }
          }
        }
        return { numParaFolioTemp: sol.id, sufijoFolio: undefined }
      })()

      const folioRecepcion  = sol.folio_recepcion ?? null

      const fechaRecepcionDO = sol.fecha_envio
        ? new Date(sol.fecha_envio).toISOString().slice(0, 10)
        : sol.fecha_creacion
        ? new Date(sol.fecha_creacion).toISOString().slice(0, 10)
        : null

      const folioDictamen =
        sol.dictamen?.folio ??
        (sol as any).folio_dictamen ??
        null

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
        folioTemporal:    false,
        tipo:             sol.tipo_solicitud,
        denominacion:     (sol as any).denominacion || sol.tipo_solicitud || "—",
        secretaria:       (sol as any).secretaria ?? sol.usuario?.area?.nombre ?? "—",
        secretariaId:     sol.usuario?.secretaria_id ?? null,
        estado:           sol.estado.nombre,
        esRegularizacion: (sol as any).es_extemporanea ?? false,
        fechaRecepcionDO,
        periodo:          sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        reingresoCount,
        lastObservedStage,
        lastObservedDate,
        lastObservedEstado,
        slaRestante,
        openedInFiltro:   { [filtro]: openedInFiltro }  as Record<number, boolean>,
        isNuevaEnFiltro:  { [filtro]: isNuevaEnFiltro } as Record<number, boolean>,
        revisorAsignado:  (sol as any).revisor_asignado ?? null,
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
    const { solicitudId, accion, filtro, usuarioId, observaciones, folioDictamen, folioRecepcion, revisorId, modalidadFirma } = body

    if (!solicitudId || !accion || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, accion, usuarioId" },
        { status: 400 }
      )
    }

    if (!["aprobar", "observar", "asignarFolio", "asignarFolioRecepcion", "aceptar", "asignarRevisor"].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Use 'aprobar', 'observar', 'asignarFolio', 'asignarFolioRecepcion', 'aceptar' o 'asignarRevisor'" },
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

      const modalidadExistente = (solicitudExistente as any).modalidad_firma ?? "autografa"
      if (solicitudExistente.dictamen) {
        await prisma.dictamen.update({
          where: { solicitud_id: idNum },
          data:  { folio: folioDictamen, tipo_firma: modalidadExistente },
        })
      } else {
        await prisma.dictamen.create({
          data: {
            solicitud_id:  idNum,
            folio:         folioDictamen,
            fecha_emision: new Date(),
            tipo_firma:    modalidadExistente,
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

      // Actualizar consecutivo para que el siguiente folio sea auto-calculado
      try {
        const partes = folioDictamen.split("/")
        if (partes.length === 3) {
          const consecutivoNum = parseInt(partes[0], 10)
          const mesNum         = parseInt(partes[1], 10)
          const anioNum        = parseInt(partes[2], 10)
          if (!isNaN(consecutivoNum) && !isNaN(mesNum) && !isNaN(anioNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FDICT", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FDICT", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
        }
      } catch { /* ignorar */ }

      return NextResponse.json({
        ok:            true,
        accion:        "asignarFolio",
        folioDictamen,
      })
    }

    if (accion === "asignarFolioRecepcion") {
      if (!folioRecepcion) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'folioRecepcion' para la acción asignarFolioRecepcion" },
          { status: 400 }
        )
      }

      const solicitudExistente = await prisma.solicitud.findUnique({ where: { id: idNum } })
      if (!solicitudExistente) {
        return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 })
      }

      await prisma.solicitud.update({
        where: { id: idNum },
        data:  { folio_recepcion: folioRecepcion },
      })

      // Actualizar consecutivo FREC — formato AB-001
      try {
        const matchFrec = folioRecepcion.match(/^([A-Z]{2})-(\d+)$/)
        if (matchFrec) {
          const MONTH_CODES = ["EN","FE","MR","AB","MY","JN","JL","AG","SE","OC","NO","DI"]
          const mesNum         = MONTH_CODES.indexOf(matchFrec[1]) + 1
          const consecutivoNum = parseInt(matchFrec[2], 10)
          const anioNum        = new Date().getFullYear()
          if (mesNum > 0 && !isNaN(consecutivoNum)) {
            await prisma.consecutivo_folio.upsert({
              where:  { tipo_mes_anio: { tipo: "FREC", mes: mesNum, anio: anioNum } },
              update: { consecutivo: consecutivoNum },
              create: { tipo: "FREC", mes: mesNum, anio: anioNum, consecutivo: consecutivoNum },
            })
          }
        }
      } catch { /* ignorar */ }

      return NextResponse.json({ ok: true, accion: "asignarFolioRecepcion", folioRecepcion })
    }

    if (accion === "asignarRevisor") {
      if (!revisorId) {
        return NextResponse.json(
          { ok: false, error: "Se requiere 'revisorId' para la acción asignarRevisor" },
          { status: 400 }
        )
      }
      let estadoRevision = await prisma.estado.findFirst({
        where: { nombre: { equals: "En Revision Revisor", mode: "insensitive" } },
      })
      if (!estadoRevision) {
        estadoRevision = await prisma.estado.create({
          data: { nombre: "En Revision Revisor", descripcion: "Solicitud enviada a revisión por revisor asignado" },
        })
      }
      const solicitudActual = await prisma.solicitud.findUnique({
        where: { id: idNum },
        select: { estado_id: true },
      })

      await prisma.solicitud.update({
        where: { id: idNum },
        data:  {
          revisor_asignado_id: revisorId,
          estado_id: estadoRevision.id,
        },
      })
      await prisma.historial_solicitud.create({
        data: {
          solicitud_id:       idNum,
          usuario_id:         usuarioId,
          estado_anterior_id: solicitudActual?.estado_id ?? null,
          estado_nuevo_id:    estadoRevision.id,
          comentario:         "Enviada a revisión con revisor asignado desde Validación Final",
        },
      })
      return NextResponse.json({
        ok: true, accion: "asignarRevisor",
        estadoNuevo: "En Revision Revisor",
        revisorId,
      })
    }

    if (accion === "aceptar") {
      let estadoAceptado = await prisma.estado.findFirst({
        where: { nombre: { equals: "Aceptado por Revisor", mode: "insensitive" } },
      })
      if (!estadoAceptado) {
        estadoAceptado = await prisma.estado.create({
          data: { nombre: "Aceptado por Revisor", descripcion: "Solicitud aceptada por el Revisor asignado" },
        })
      }
      const solicitudActual = await prisma.solicitud.findUnique({ where: { id: idNum }, select: { estado_id: true } })
      await prisma.solicitud.update({ where: { id: idNum }, data: { estado_id: estadoAceptado.id } })
      await prisma.historial_solicitud.create({
        data: {
          solicitud_id:       idNum,
          usuario_id:         usuarioId,
          estado_anterior_id: solicitudActual?.estado_id ?? null,
          estado_nuevo_id:    estadoAceptado.id,
          comentario:         "Revisión aceptada por el Revisor",
        },
      })
      return NextResponse.json({ ok: true, estadoNuevo: "Aceptado por Revisor" })
    }

    if (!filtro) {
      return NextResponse.json(
        { ok: false, error: "Se requiere 'filtro' para las acciones aprobar/observar" },
        { status: 400 }
      )
    }

    const solicitud = await prisma.solicitud.findUnique({
      where:   { id: idNum },
      include: {
        estado: true,
        dictamen: true,
        historial_solicitud: {
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado: true,
          },
        },
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    const yaEsperoPorFiltro1 = solicitud.historial_solicitud.some((h) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      return nombre.toLowerCase().includes("en revision revisor")
    })

    let nombreEstadoNuevo: string
    if (accion === "aprobar") {
      if (filtro === 1) {
        nombreEstadoNuevo = estadoEnRevision(2)
      } else if (filtro === 2) {
        nombreEstadoNuevo = yaEsperoPorFiltro1 ? estadoEnRevision(3) : estadoEnRevision(1)
      } else {
        const estadoActual = solicitud.estado.nombre.toLowerCase()
        if (estadoActual.includes("pendiente firma dictamen")) {
          nombreEstadoNuevo = "Emitido"
        } else {
          nombreEstadoNuevo = "Pendiente Firma Justificacion"
        }
      }
    } else {
      const estadoActualNorm = solicitud.estado.nombre.toLowerCase()
      // Jefe DO observa desde "Aceptado por Revisor" → regresa a UEFA como "Observado por DO"
      if (filtro === 1 && estadoActualNorm.includes("aceptado por revisor")) {
        nombreEstadoNuevo = "Observado por DO"
      } else {
        nombreEstadoNuevo = estadoObservado(filtro)
      }
    }

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

    const asignarRevisor = filtro === 2 && nombreEstadoNuevo === estadoEnRevision(1) && revisorId
    const guardarModalidad = accion === "aprobar" && filtro === 3 && (modalidadFirma === "electronica" || modalidadFirma === "autografa")

    const solicitudActualizada = await prisma.solicitud.update({
      where: { id: idNum },
      data:  {
        estado_id: estadoNuevo.id,
        ...(asignarRevisor ? { revisor_asignado_id: revisorId } : {}),
        ...(guardarModalidad ? { modalidad_firma: modalidadFirma } : {}),
      },
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

    if (accion === "aprobar" && filtro === 3 && nombreEstadoNuevo === "Emitido") {
      try {
        const folioAsignado = (solicitud as any).folio_dictamen ?? solicitud.dictamen?.folio ?? null
        const ahora = new Date()

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

        const updates: any[] = [
          prisma.solicitud.update({
            where: { id: idNum },
            data:  { estado_id: estadoEmitido.id, fecha_emision: ahora } as any,
          }),
          prisma.historial_solicitud.create({
            data: {
              solicitud_id:       idNum,
              usuario_id:         usuarioId,
              estado_anterior_id: estadoNuevo.id,
              estado_nuevo_id:    estadoEmitido.id,
              comentario: folioAsignado
                ? `Dictamen emitido. Folio: ${folioAsignado} | Tipo firma: ${(solicitud as any).modalidad_firma ?? modalidadFirma ?? "autografa"}`
                : "Dictamen emitido",
            },
          }),
        ]

        const modalidadSolicitud = (solicitud as any).modalidad_firma ?? modalidadFirma ?? "autografa"
        if (folioAsignado && !solicitud.dictamen) {
          updates.unshift(
            prisma.dictamen.create({
              data: {
                solicitud_id:  idNum,
                folio:         folioAsignado,
                fecha_emision: ahora,
                tipo_firma:    modalidadSolicitud,
                archivo_pdf:   null,
              },
            })
          )
        } else if (solicitud.dictamen) {
          updates.push(
            prisma.dictamen.update({
              where: { solicitud_id: idNum },
              data: { tipo_firma: modalidadSolicitud },
            })
          )
        }

        await prisma.$transaction(updates)

        return NextResponse.json({
          ok:            true,
          estadoNuevo:   "Emitido",
          folioDictamen: folioAsignado,
          data:          solicitudActualizada,
        })
      } catch (emisionError: any) {
        console.error("[EMISION Filtro 3]", emisionError)
        return NextResponse.json({
          ok:               true,
          estadoNuevo:      nombreEstadoNuevo,
          folioDictamen:    null,
          autoEmisionError: emisionError?.message ?? "Error en emisión",
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