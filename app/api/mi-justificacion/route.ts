import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const usuarioId = req.headers.get("x-user-id")
    if (!usuarioId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tab        = searchParams.get("tab")        ?? "Todas"
    const search     = searchParams.get("search")     ?? ""
    const secretaria = searchParams.get("secretaria") ?? ""
    const page       = Math.max(1, Number(searchParams.get("page")     ?? 1))
    const pageSize   = Math.max(1, Number(searchParams.get("pageSize") ?? 50))

    const tabToEstados: Record<string, string[]> = {
      "Borradores": [
        "Borrador",
        "En Captura",
      ],
      "En aprobación": [
        "En Validacion Justificaciones",
        "Enviada a Validacion (UEFA)",
        "Enviada a Validacion",
        "Pendiente Firma Justificacion",
      ],
      "Observadas / Devueltas": [
        "Observado por Validacion",
        "Observada por UEFA",
        "Observado por UEFA",
        "Observado por Revisor",
        "Observado por DO",
        "Observado por Emisor",
        "Observado por Validacion Final",
        "Devuelta por DO",
        "Observado DO Filtro 1",
        "Observado DO Filtro 2",
        "Observado DO Filtro 3",
      ],
      "En proceso DGDO": [
        "Pendiente DO",
        "En Revision Revisor",
        "Aceptado por Revisor",
        "Aprobado por Revisor",
        "En Revision Emisor",
        "Pendiente Firma Dictamen",
        "En Validacion Final",
        "En revision DO Filtro 1",
        "En revision DO Filtro 2",
        "En revision DO Filtro 3",
        "En proceso DO",
        "Aprobado",
      ],
      "Emitidas": [
        "Emitido",
      ],
      "Todas": [],
    }

    const estadoNames = tabToEstados[tab] ?? []

    const where: Parameters<typeof prisma.solicitud.findMany>[0]["where"] = {
      usuario_id: usuarioId,
      ...(estadoNames.length > 0 && {
        estado: { nombre: { in: estadoNames, mode: "insensitive" } },
      }),
      ...(secretaria && {
        secretaria: { contains: secretaria.split(" > ")[0], mode: "insensitive" },
      }),
      ...(search && {
        OR: [
          { folio_justificacion: { contains: search, mode: "insensitive" } },
          { folio_recepcion:     { contains: search, mode: "insensitive" } },
          { denominacion:        { contains: search, mode: "insensitive" } },
          { secretaria:          { contains: search, mode: "insensitive" } },
        ],
      }),
    }

    const [total, solicitudesRaw] = await Promise.all([
      prisma.solicitud.count({ where }),
      prisma.solicitud.findMany({
        where,
        orderBy: { fecha_creacion: "desc" },
        skip:  (page - 1) * pageSize,
        take:  pageSize,
        include: {
          estado:  { select: { id: true, nombre: true } },
          periodo: { select: { mes: true, anio: true, fecha_inicio: true, fecha_fin: true } },
          historial_solicitud: {
            orderBy: { fecha: "asc" },
            include: {
              usuario: { select: { nombre: true } },
              estado_historial_solicitud_estado_nuevo_idToestado:    { select: { nombre: true } },
              estado_historial_solicitud_estado_anterior_idToestado: { select: { nombre: true } },
            },
          },
          adjunto: {
            select: { id: true, nombre_archivo: true, ruta: true, tipo: true, fecha_subida: true },
          },
          dictamen: {
            select: { folio: true, fecha_emision: true, tipo_firma: true, archivo_pdf: true },
          },
        },
      }),
    ])

    const solicitudes = [...solicitudesRaw].sort((a, b) => {
      const ta = (a.fecha_envio ?? a.fecha_creacion ?? new Date(0)).getTime()
      const tb = (b.fecha_envio ?? b.fecha_creacion ?? new Date(0)).getTime()
      return tb - ta
    })

    const items = solicitudes.map((s) => ({
      id:                    s.id,
      folio_justificacion:   s.folio_justificacion,
      folio_recepcion:       s.folio_recepcion,
      folio_dictamen:        s.folio_dictamen,
      tipo_solicitud:        s.tipo_solicitud,
      secretaria:            s.secretaria,
      unidad_administrativa: s.unidad_administrativa,
      unidad_responsable:    s.unidad_responsable,
      programa_proyecto:     s.programa_proyecto,
      regimen:               s.regimen,
      tipo_actividades:      s.tipo_actividades,
      numero_prestadores:    s.numero_prestadores,
      denominacion:          s.denominacion,
      vigencia_inicio:       s.vigencia_inicio,
      vigencia_fin:          s.vigencia_fin,
      importe_bruto:         s.importe_bruto ? Number(s.importe_bruto) : null,
      es_renovacion:         s.es_renovacion,
      folio_anterior:        s.folio_anterior,
      nivel_tabulador:       s.nivel_tabulador,
      categoria_tabulador:   s.categoria_tabulador,
      objeto:                s.objeto,
      actividades:           s.actividades,
      responsabilidades:     s.responsabilidades,
      escolaridad:           s.escolaridad,
      comp_adm:              s.comp_adm,
      comp_tec:              s.comp_tec,
      comp_soc:              s.comp_soc,
      valores:               s.valores,
      areas_exp:             s.areas_exp,
      puesto_jefe_inmediato: s.puesto_jefe_inmediato ?? null,
      marco_normativo:       s.marco_normativo ?? [],
      condiciones_riesgos:   s.condiciones_riesgos ?? [],
      resguardo_activos:     s.resguardo_activos ?? null,
      tipo_importe:          s.tipo_importe ?? null,
      es_extemporanea:       s.es_extemporanea,
      fecha_creacion:        s.fecha_creacion,
      fecha_envio:           s.fecha_envio,

      fecha_emision:         s.fecha_emision,
      estado:   { id: s.estado.id, nombre: s.estado.nombre },
      periodo:  {
        mes:          s.periodo.mes,
        anio:         s.periodo.anio,
        fecha_inicio: s.periodo.fecha_inicio,
        fecha_fin:    s.periodo.fecha_fin,
      },
      historial: s.historial_solicitud.map((h) => ({
        fecha:           h.fecha,
        usuario:         h.usuario.nombre,
        accion:          h.estado_historial_solicitud_estado_nuevo_idToestado.nombre,
        comentario:      h.comentario ?? null,
        estado_anterior: h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? null,
      })),
      adjuntos: s.adjunto.map((a) => ({
        id:             a.id,
        nombre_archivo: a.nombre_archivo,
        ruta:           a.ruta,
        tipo:           a.tipo,
        fecha_subida:   a.fecha_subida,
      })),
      dictamen: s.dictamen
        ? {
            folio:        s.dictamen.folio,
            fecha_emision: s.dictamen.fecha_emision,
            tipo_firma:   s.dictamen.tipo_firma,
            archivo_pdf:  s.dictamen.archivo_pdf,
          }
        : null,
    }))

    const counts = await prisma.solicitud.groupBy({
      by: ["estado_id"],
      where: { usuario_id: usuarioId },
      _count: { id: true },
    })
    const allEstados = await prisma.estado.findMany({ select: { id: true, nombre: true } })
    const estadoMap  = Object.fromEntries(allEstados.map((e) => [e.id, e.nombre]))

    const tabCountMap: Record<string, number> = {
      Borradores:               0,
      "En aprobación":          0,
      "Observadas / Devueltas": 0,
      "En proceso DGDO":        0,
      Emitidas:                 0,
      Todas:                    0,
    }

    for (const row of counts) {
      const nombre = estadoMap[row.estado_id] ?? ""
      const cnt    = row._count.id
      const n      = nombre.toLowerCase()

      tabCountMap["Todas"] += cnt

      if (n === "borrador" || n === "en captura") {
        tabCountMap["Borradores"] += cnt
      } else if (n.includes("observad") || n.includes("devuelta por do")) {

        tabCountMap["Observadas / Devueltas"] += cnt
      } else if (
        n.includes("en validacion justificaciones") ||
        n.includes("enviada a validacion")          ||
        n.includes("pendiente firma justificacion")
      ) {
        tabCountMap["En aprobación"] += cnt
      } else if (
        n === "pendiente do"                   ||
        n.includes("en revision revisor")      ||
        n === "aprobado por revisor"           ||
        n === "aceptado por revisor"           ||
        n.includes("en revision emisor")       ||
        n.includes("pendiente firma dictamen") ||
        n.includes("en validacion final")      ||
        n.includes("en revision do")           ||
        n === "en proceso do"                  ||
        n === "aprobado"
      ) {
        tabCountMap["En proceso DGDO"] += cnt
      } else if (n === "emitido") {
        tabCountMap["Emitidas"] += cnt
      }
    }

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      tabCounts:  tabCountMap,
    })
  } catch (error) {
    console.error("[mi-justificacion GET]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}