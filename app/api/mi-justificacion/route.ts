import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSecretariaScopeIds } from "@/lib/secretaria-scope"

export async function GET(req: NextRequest) {
  try {
    const usuarioId = req.headers.get("x-user-id")
    if (!usuarioId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const viewer = await prisma.usuario.findUnique({
      where:  { id: usuarioId },
      select: {
        rol:                 { select: { nombre: true } },
        secretaria_id:       true,
        secretaria_texto:    true,
        organo_centralizado: { select: { id: true } },
      },
    })
    const esAdmin = viewer?.rol?.nombre?.toLowerCase() === "administrador"

    // Filtro por tipo de administración: cada usuario solo ve solicitudes de su
    // ámbito. Un usuario con órgano centralizado ve lo centralizado (incluye
    // registros sin tipo definido, tratados como centralizada); un usuario sin
    // órgano centralizado (paraestatal) solo ve lo paraestatal.
    // `{ not: "paraestatal" }` excluye los NULL en SQL; por eso el OR explícito
    // con null para que los registros sin tipo se traten como centralizada.
    const tipoAdminFilter: Record<string, unknown> | null = viewer
      ? viewer.organo_centralizado
        ? { OR: [{ tipo_administracion: { not: "paraestatal" } }, { tipo_administracion: null }] }
        : { tipo_administracion: "paraestatal" }
      : null

    // Filtro por secretaría: el usuario solo ve solicitudes de SU secretaría actual.
    // secretaria_id_snapshot ancla la solicitud a la secretaría vigente al momento de
    // crearla; si el usuario cambió de área, sus registros anteriores permanecen en la
    // secretaría anterior y ya no aparecen aquí.
    // El null fallback se elimina a propósito: registros sin snapshot no tienen secretaría
    // definida y mostrarlos causaría que se vean solicitudes de la secretaría anterior.
    // El segundo backfill en PATCH /api/usuarios/:id asigna snapshot a cualquier null restante.
    // Alcance a nivel Secretaría: se incluyen todos los nodos (Direcciones,
    // Subdirecciones, etc.) de la misma Secretaría que el usuario, no solo su nodo
    // exacto, para que un usuario de una Dirección vea todo lo de su Secretaría.
    let secretariaSnapshotFilter: Record<string, unknown> = {}
    if (viewer) {
      if (viewer.secretaria_id) {
        const scopeIds = await getSecretariaScopeIds(viewer.secretaria_id)
        secretariaSnapshotFilter = { secretaria_id_snapshot: { in: scopeIds } }
      } else if (viewer.secretaria_texto) {
        secretariaSnapshotFilter = { secretaria_txt_snapshot: viewer.secretaria_texto }
      } else if (!esAdmin) {
        // Non-admin sin secretaría configurada: no mostrar nada
        return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 0, tabCounts: { Borradores: 0, "En aprobación": 0, "Observadas / Devueltas": 0, "En proceso DGDO": 0, Emitidas: 0, Todas: 0 } })
      }
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
        "Devuelta por DO",
        "Observado DO Filtro 1",
        "Observado DO Filtro 2",
        "Observado DO Filtro 3",
        "Observado por Emisor",
        "Observada por Emisor",
        "Observado por Validacion Final",
        "Observada por Validacion Final",
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

    const andConditions: Record<string, unknown>[] = []
    if (Object.keys(secretariaSnapshotFilter).length > 0) {
      andConditions.push(secretariaSnapshotFilter)
    }
    if (tipoAdminFilter) {
      andConditions.push(tipoAdminFilter)
    }
    if (search) {
      andConditions.push({
        OR: [
          { folio_justificacion: { contains: search, mode: "insensitive" } },
          { folio_recepcion:     { contains: search, mode: "insensitive" } },
          { denominacion:        { contains: search, mode: "insensitive" } },
          { secretaria:          { contains: search, mode: "insensitive" } },
        ],
      })
    }

    const where: Parameters<typeof prisma.solicitud.findMany>[0]["where"] = {
      // Vista global por secretaría: todos los capturistas de la misma secretaría
      // ven las solicitudes de su dependencia (el filtro por secretaria_id_snapshot
      // más abajo ya restringe el alcance), no solo las que creó cada quien.
      ...(estadoNames.length > 0 && {
        estado: { nombre: { in: estadoNames, mode: "insensitive" } },
      }),
      ...(secretaria && {
        secretaria: { contains: secretaria.split(" > ")[0], mode: "insensitive" },
      }),
      ...(andConditions.length > 0 && { AND: andConditions }),
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

    const hoy = new Date()
    const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())

    const items = solicitudes.map((s) => {
      const slaRestante: number | null = s.periodo?.fecha_fin
        ? (() => {
            const fin = new Date(s.periodo.fecha_fin)
            const finUTC = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate())
            return Math.ceil((finUTC - hoyUTC) / (1000 * 60 * 60 * 24))
          })()
        : null

      return ({
      id:                    s.id,
      folio_justificacion:   s.folio_justificacion,
      folio_recepcion:       s.folio_recepcion,
      folio_dictamen:        s.folio_dictamen,
      tipo_solicitud:        s.tipo_solicitud,
      tipo_administracion:   s.tipo_administracion ?? "centralizada",
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
      marco_normativo:           s.marco_normativo ?? [],
      condiciones_riesgos:       s.condiciones_riesgos ?? [],
      resguardo_activos:         s.resguardo_activos ?? null,
      tipo_importe:              s.tipo_importe ?? null,
      riesgo_caidas:             s.riesgo_caidas ?? null,
      riesgo_mutilaciones:       s.riesgo_mutilaciones ?? null,
      riesgo_golpes:             s.riesgo_golpes ?? null,
      riesgo_otros:              s.riesgo_otros ?? null,
      condicion_cambio_domicilio: s.condicion_cambio_domicilio ?? false,
      condicion_horario:         s.condicion_horario ?? false,
      condicion_viajar:          s.condicion_viajar ?? false,
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
      reingresoCount: (() => {
        const hist = s.historial_solicitud
        const firstObsIdx = hist.findIndex((h) =>
          (h.estado_historial_solicitud_estado_nuevo_idToestado.nombre ?? "").toLowerCase().includes("observad")
        )
        if (firstObsIdx === -1) return 0
        return hist.slice(firstObsIdx + 1).filter((h) => {
          const nn = (h.estado_historial_solicitud_estado_nuevo_idToestado.nombre ?? "").toLowerCase()
          return nn.includes("enviada a validacion") || nn.includes("en validacion justificaciones")
        }).length
      })(),
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
      slaRestante,
    })})
    const countAnd: Record<string, unknown>[] = []
    if (Object.keys(secretariaSnapshotFilter).length > 0) countAnd.push(secretariaSnapshotFilter)
    if (tipoAdminFilter) countAnd.push(tipoAdminFilter)
    const counts = await prisma.solicitud.groupBy({
      by: ["estado_id"],
      where: {
        // Conteos de tabs alineados con la vista global por secretaría (ver where principal).
        ...(countAnd.length > 0 && { AND: countAnd }),
      },
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