import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoParam = searchParams.get("estado") ?? "En Captura"
    const usuarioId   = searchParams.get("usuarioId")

    const where: any = {}

    if (estadoParam !== "todos") {
      const estado = await prisma.estado.findFirst({ where: { nombre: estadoParam } })
      if (!estado) return NextResponse.json({ ok: true, data: [] })
      where.estado_id = estado.id
    }
    if (usuarioId) where.usuario_id = usuarioId
    const solicitudes = await prisma.solicitud.findMany({
      where,
      include: {
        estado: true,
        periodo: true,
        usuario: {
          select: {
            id: true, nombre: true, correo: true, rfc: true,
            area: { select: { id: true, nombre: true } },
            rol:  { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "desc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
        adjunto: true,
      },
      orderBy: { fecha_creacion: "desc" },
    })
    return NextResponse.json({ ok: true, data: solicitudes })
  } catch (error: any) {
    console.error("[GET /api/solicitudes]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      usuarioId, tipo_solicitud, periodoId, esExtemporanea,
      secretaria, unidad_administrativa, unidad_responsable,
      programa_proyecto, regimen, tipo_actividades, numero_prestadores,
      denominacion, vigencia_inicio, vigencia_fin, importe_bruto,
      es_renovacion, folio_anterior,
      nivel_tabulador, categoria_tabulador,
      objeto, actividades, responsabilidades, 
      escolaridad, comp_adm, comp_tec, comp_soc, valores, areas_exp,
      puesto_jefe_inmediato, marco_normativo, condiciones_riesgos, 
      tipo_importe,
      riesgo_caidas, riesgo_mutilaciones, riesgo_golpes, riesgo_otros,
      condicion_cambio_domicilio, condicion_horario, condicion_viajar, resguardo_activos,
      estado_nombre,
    } = body

    if (!usuarioId)      return NextResponse.json({ ok: false, error: "usuarioId es requerido" }, { status: 400 })
    if (!tipo_solicitud) return NextResponse.json({ ok: false, error: "tipo_solicitud es requerido" }, { status: 400 })

    const usuarioCreador = await prisma.usuario.findUnique({
      where:  { id: usuarioId },
      select: { secretaria_id: true },
    })
    // Contador independiente por secretaría (centralizado) o compartido para paraestatal
    const tipoFolioJUST = usuarioCreador?.secretaria_id
      ? `JUST-${usuarioCreador.secretaria_id}`
      : "JUST-P"

    const estadoNombre = estado_nombre ?? "En Captura"
    let estadoInicial = await prisma.estado.findFirst({
      where: { nombre: { equals: estadoNombre, mode: "insensitive" } },
    })
    if (!estadoInicial && estadoNombre === "Borrador") {
      estadoInicial = await prisma.estado.findFirst({
        where: { nombre: { equals: "En Captura", mode: "insensitive" } },
      })
    }
    if (!estadoInicial) {
      return NextResponse.json(
        { ok: false, error: `Estado '${estadoNombre}' no existe en la base de datos` },
        { status: 500 }
      )
    }

    const nueva = await prisma.solicitud.create({
      data: {
        usuario_id:            usuarioId,
        estado_id:             estadoInicial.id,
        tipo_solicitud,
        periodo_id:            periodoId ?? null,
        es_extemporanea:       esExtemporanea ?? false,
        secretaria:            secretaria ?? null,
        unidad_administrativa: unidad_administrativa ?? null,
        unidad_responsable:    unidad_responsable ?? null,
        programa_proyecto:     programa_proyecto ?? null,
        regimen:               regimen ?? null,
        tipo_actividades:      tipo_actividades ?? null,
        numero_prestadores:    numero_prestadores ?? null,
        denominacion:          denominacion ?? null,
        vigencia_inicio:       vigencia_inicio ? new Date(vigencia_inicio) : null,
        vigencia_fin:          vigencia_fin    ? new Date(vigencia_fin)    : null,
        importe_bruto:         importe_bruto ?? null,
        es_renovacion:         es_renovacion ?? false,
        folio_anterior:        folio_anterior ?? null,
        nivel_tabulador:       nivel_tabulador ?? null,
        categoria_tabulador:   categoria_tabulador ?? null,
        objeto:                objeto ?? null,
        actividades:           actividades ?? [],
        responsabilidades:     responsabilidades ?? [],
        escolaridad:           escolaridad ?? null,
        comp_adm:              comp_adm ?? null,
        comp_tec:              comp_tec ?? null,
        comp_soc:              comp_soc ?? null,
        valores:               valores ?? null,
        areas_exp:             areas_exp ?? null,
        puesto_jefe_inmediato: puesto_jefe_inmediato ?? null,
        marco_normativo:       marco_normativo ?? [],
        condiciones_riesgos:   condiciones_riesgos ?? [],
        tipo_importe:          tipo_importe ?? null,
        riesgo_caidas:              riesgo_caidas ?? null,
        riesgo_mutilaciones:        riesgo_mutilaciones ?? null,
        riesgo_golpes:              riesgo_golpes ?? null,
        riesgo_otros:               riesgo_otros ?? null,
        condicion_cambio_domicilio: condicion_cambio_domicilio ?? false,
        condicion_horario:          condicion_horario ?? false,
        condicion_viajar:           condicion_viajar ?? false,
        resguardo_activos:          typeof resguardo_activos === "boolean" ? (resguardo_activos ? "si" : "no") : (resguardo_activos ?? null),
      },
    })

    // Generate folios based on state
    const fechaCreacion = nueva.fecha_creacion ?? new Date()
    const year          = fechaCreacion.getFullYear()
    const esBorrador    = estadoNombre === "Borrador"

    let folioJustificacion: string | null = null
    if (!esBorrador) {
      if (esExtemporanea) {
        const registroActual = await prisma.consecutivo_folio.findFirst({
          where: { tipo: tipoFolioJUST, mes: 0, anio: year },
        })
        const ultimoConsecutivo = registroActual?.consecutivo ?? 1
        const basePadded    = String(ultimoConsecutivo).padStart(4, "0")
        const baseParaFolio = `JUST-${year}-${basePadded}`

        const yaExistentes = await prisma.solicitud.findMany({
          where:  { folio_justificacion: { startsWith: `${baseParaFolio}-` } },
          select: { folio_justificacion: true },
        })
        const sufijo = yaExistentes.length + 1
        folioJustificacion = `${baseParaFolio}-${sufijo}`
      } else {
        const registro = await prisma.consecutivo_folio.upsert({
          where:  { tipo_mes_anio: { tipo: tipoFolioJUST, mes: 0, anio: year } },
          update: { consecutivo: { increment: 1 } },
          create: { tipo: tipoFolioJUST, mes: 0, anio: year, consecutivo: 1 },
        })
        folioJustificacion = `JUST-${year}-${String(registro.consecutivo ?? 1).padStart(4, "0")}`
      }
    }

    const nuevaConFolio = await prisma.solicitud.update({
      where: { id: nueva.id },
      data: {
        folio_justificacion: folioJustificacion,
      },
      include: {
        estado: true, periodo: true,
        usuario: {
          select: {
            id: true, nombre: true, correo: true, rfc: true,
            area: { select: { id: true, nombre: true } },
            rol:  { select: { id: true, nombre: true } },
          },
        },
      },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:    nueva.id,
        estado_nuevo_id: estadoInicial.id,
        usuario_id:      usuarioId,
        comentario:      estadoNombre === "Borrador"
          ? "Borrador guardado por la URG"
          : "Solicitud creada y enviada a validación UEFA",
      },
    })

    return NextResponse.json({ ok: true, data: nuevaConFolio, folio: folioJustificacion }, { status: 201 })
  } catch (error: any) {
    console.error("[POST /api/solicitudes]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al crear solicitud" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId: rawId, ...campos } = body

    if (!rawId) return NextResponse.json({ ok: false, error: "solicitudId es requerido" }, { status: 400 })
    const solicitudId = Number(rawId)
    if (isNaN(solicitudId)) return NextResponse.json({ ok: false, error: "solicitudId debe ser un número" }, { status: 400 })

    const data: any = {}
    const map: Record<string, string> = {
      secretaria:            "secretaria",
      unidad_administrativa: "unidad_administrativa",
      unidad_responsable:    "unidad_responsable",
      programa_proyecto:     "programa_proyecto",
      regimen:               "regimen",
      tipo_actividades:      "tipo_actividades",
      numero_prestadores:    "numero_prestadores",
      denominacion:          "denominacion",
      importe_bruto:         "importe_bruto",
      es_renovacion:         "es_renovacion",
      folio_anterior:        "folio_anterior",
      nivel_tabulador:       "nivel_tabulador",
      categoria_tabulador:   "categoria_tabulador",
      objeto:                "objeto",
      actividades:           "actividades",
      responsabilidades:     "responsabilidades",
      marco_normativo:       "marco_normativo",
      escolaridad:           "escolaridad",
      comp_adm:              "comp_adm",
      comp_tec:              "comp_tec",
      comp_soc:              "comp_soc",
      valores:               "valores",
      areas_exp:             "areas_exp",
      puesto_jefe_inmediato: "puesto_jefe_inmediato",
      condiciones_riesgos:   "condiciones_riesgos",
      tipo_importe:          "tipo_importe",
      riesgo_caidas:         "riesgo_caidas",
      riesgo_mutilaciones:   "riesgo_mutilaciones",
      riesgo_golpes:         "riesgo_golpes",
      riesgo_otros:          "riesgo_otros",
      condicion_cambio_domicilio: "condicion_cambio_domicilio",
      condicion_horario:     "condicion_horario",
      condicion_viajar:      "condicion_viajar",
      resguardo_activos:     "resguardo_activos",
    }
    for (const [k, v] of Object.entries(map)) {
      if (campos[k] !== undefined) {
        if (v === "resguardo_activos") {
          data[v] = typeof campos[k] === "boolean" ? (campos[k] ? "si" : "no") : campos[k]
        } else {
          data[v] = campos[k]
        }
      }
    }
    if (campos.vigencia_inicio !== undefined)
      data.vigencia_inicio = campos.vigencia_inicio ? new Date(campos.vigencia_inicio) : null
    if (campos.vigencia_fin !== undefined)
      data.vigencia_fin = campos.vigencia_fin ? new Date(campos.vigencia_fin) : null

    const updated = await prisma.solicitud.update({
      where: { id: solicitudId },
      data,
      include: {
        estado: true, periodo: true,
        usuario: {
          select: {
            id: true, nombre: true, correo: true, rfc: true,
            area: { select: { id: true, nombre: true } },
            rol:  { select: { id: true, nombre: true } },
          },
        },
      },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/solicitudes]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al actualizar solicitud" }, { status: 500 })
  }
}