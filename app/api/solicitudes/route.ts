import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { getEstadoId } from "@/lib/estado-cache"

function parseDate(v: unknown): Date | null {
  if (!v) return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]
async function resolverPeriodoId(periodoId?: number, mes?: number, anio?: number): Promise<number | undefined> {
  if (mes && anio) {
    let periodo = await prisma.periodo.findUnique({ where: { mes_anio: { mes, anio } } })
    if (!periodo) {
      const primerDia = new Date(Date.UTC(anio, mes - 1, 1))
      const ultimoDia = new Date(Date.UTC(anio, mes, 0))
      periodo = await prisma.periodo.create({ data: { mes, anio, fecha_inicio: primerDia, fecha_fin: ultimoDia } })
    }
    return periodo.id
  }
  return periodoId
}

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
      usuarioId, tipo_solicitud, periodoId, periodoMes, periodoAnio, esExtemporanea,
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
      estado_nombre, tipo_administracion,
    } = body
    if (!usuarioId)      return NextResponse.json({ ok: false, error: "usuarioId es requerido" }, { status: 400 })
    if (!tipo_solicitud) return NextResponse.json({ ok: false, error: "tipo_solicitud es requerido" }, { status: 400 })
    const estadoNombre = estado_nombre ?? "En Captura"

    const [usuarioCreador, estadoIdResuelto, periodoIdResuelto] = await Promise.all([
      prisma.usuario.findUnique({
        where:  { id: usuarioId },
        select: { secretaria_id: true, secretaria_texto: true, area_id: true },
      }),
      (async () => {
        const id = await getEstadoId(estadoNombre)
        if (id) return id
        if (estadoNombre === "Borrador") return getEstadoId("En Captura")
        return null
      })(),
      resolverPeriodoId(periodoId, periodoMes, periodoAnio),
    ])

    if (!estadoIdResuelto) {
      return NextResponse.json(
        { ok: false, error: `Estado '${estadoNombre}' no existe en la base de datos` },
        { status: 500 }
      )
    }

    const tipoFolioJUST = usuarioCreador?.secretaria_id
      ? `JUST-${usuarioCreador.secretaria_id}`
      : usuarioCreador?.area_id
        ? `JUST-A-${usuarioCreador.area_id}`
        : secretaria
          ? `JUST-SEC-${secretaria.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 30)}`
          : "JUST-P"

    const trunc = (val: string | null | undefined, max: number): string | null =>
        val ? val.substring(0, max) : null

    const year       = new Date().getFullYear()
    const esBorrador = estadoNombre === "Borrador"
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

    const nueva = await prisma.solicitud.create({
      data: {
        usuario_id:            usuarioId,
        estado_id:             estadoIdResuelto,
        tipo_solicitud,
        tipo_administracion:      trunc(tipo_administracion ?? "centralizada", 20),
        secretaria_id_snapshot:   (tipo_administracion ?? "centralizada") !== "paraestatal"
                                    ? (usuarioCreador?.secretaria_id ?? null)
                                    : null,
        secretaria_txt_snapshot:  (tipo_administracion ?? "centralizada") === "paraestatal"
                                    ? (usuarioCreador?.secretaria_texto ?? null)
                                    : null,
        periodo_id:            (periodoIdResuelto ?? periodoId ?? 1) as number,
        folio_justificacion:   folioJustificacion,
        es_extemporanea:       esExtemporanea ?? false,
        secretaria:            trunc(secretaria, 200),
        unidad_administrativa: trunc(unidad_administrativa, 200),
        unidad_responsable:    trunc(unidad_responsable, 200),
        programa_proyecto:     trunc(programa_proyecto, 200),
        regimen:               trunc(regimen, 100),
        tipo_actividades:      trunc(tipo_actividades, 200),
        numero_prestadores:    numero_prestadores != null && numero_prestadores !== "" ? Math.min(Math.max(1, Math.round(Number(numero_prestadores))), 2147483647) || null : null,
        denominacion:          trunc(denominacion, 200),
        vigencia_inicio:       parseDate(vigencia_inicio),
        vigencia_fin:          parseDate(vigencia_fin),
        importe_bruto:         importe_bruto ?? null,
        es_renovacion:         es_renovacion ?? false,
        folio_anterior:        trunc(folio_anterior, 50),
        nivel_tabulador:       trunc(nivel_tabulador, 20),
        categoria_tabulador:   trunc(categoria_tabulador, 10),
        objeto:                objeto ?? null,
        actividades:           actividades ?? [],
        responsabilidades:     responsabilidades ?? [],
        escolaridad:           escolaridad ?? null,
        comp_adm:              comp_adm ?? null,
        comp_tec:              comp_tec ?? null,
        comp_soc:              comp_soc ?? null,
        valores:               valores ?? null,
        areas_exp:             areas_exp ?? null,
        puesto_jefe_inmediato: trunc(puesto_jefe_inmediato, 200),
        marco_normativo:       marco_normativo ?? [],
        condiciones_riesgos:   condiciones_riesgos ?? [],
        tipo_importe:          trunc(tipo_importe, 20),
        riesgo_caidas:              trunc(riesgo_caidas, 20),
        riesgo_mutilaciones:        trunc(riesgo_mutilaciones, 20),
        riesgo_golpes:              trunc(riesgo_golpes, 20),
        riesgo_otros:               trunc(riesgo_otros, 20),
        condicion_cambio_domicilio: condicion_cambio_domicilio ?? false,
        condicion_horario:          condicion_horario ?? false,
        condicion_viajar:           condicion_viajar ?? false,
        resguardo_activos:          typeof resguardo_activos === "boolean" ? (resguardo_activos ? "si" : "no") : trunc(resguardo_activos, 10),
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
        estado_nuevo_id: estadoIdResuelto,
        usuario_id:      usuarioId,
        comentario:      estadoNombre === "Borrador"
          ? "Borrador guardado por la URG"
          : "Solicitud creada y enviada a validación UEFA",
      },
    })
    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, data: nueva, folio: folioJustificacion }, { status: 201 })
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
    const trunc = (val: string | null | undefined, max: number): string | null =>
      val ? val.substring(0, max) : null
    const data: any = {}
    const varcharLimits: Record<string, number> = {
      tipo_administracion: 20, secretaria: 200, unidad_administrativa: 200,
      unidad_responsable: 200, programa_proyecto: 200, regimen: 100,
      tipo_actividades: 200, denominacion: 200, folio_anterior: 50,
      nivel_tabulador: 20, categoria_tabulador: 10, puesto_jefe_inmediato: 200,
      tipo_importe: 20, riesgo_caidas: 20, riesgo_mutilaciones: 20,
      riesgo_golpes: 20, riesgo_otros: 20, resguardo_activos: 10,
    }
    const map: Record<string, string> = {
      tipo_administracion:   "tipo_administracion",
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
          data[v] = typeof campos[k] === "boolean" ? (campos[k] ? "si" : "no") : trunc(campos[k], 10)
        } else if (v === "numero_prestadores") {
          data[v] = campos[k] != null && campos[k] !== "" ? Math.min(Math.max(1, Math.round(Number(campos[k]))), 2147483647) || null : null
        } else if (varcharLimits[v]) {
          data[v] = trunc(campos[k], varcharLimits[v])
        } else {
          data[v] = campos[k]
        }
      }
    }
    if (campos.vigencia_inicio !== undefined)
      data.vigencia_inicio = parseDate(campos.vigencia_inicio)
    if (campos.vigencia_fin !== undefined)
      data.vigencia_fin = parseDate(campos.vigencia_fin)
    if (campos.periodoMes !== undefined && campos.periodoAnio !== undefined) {
      const pid = await resolverPeriodoId(undefined, Number(campos.periodoMes), Number(campos.periodoAnio))
      if (pid) data.periodo_id = pid
    }
    const usuarioId    = campos.usuarioId ?? null
    const historialDiff: { campo: string; de: string; a: string }[] | undefined =
      Array.isArray(campos.historialDiff) ? campos.historialDiff : undefined

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

    if (usuarioId && historialDiff && historialDiff.length > 0) {
      const estadoModId = await getEstadoId("Modificada", {
        crearSiNoExiste: { descripcion: "Solicitud editada por el capturista" },
      })
      await prisma.historial_solicitud.create({
        data: {
          solicitud_id:       solicitudId,
          usuario_id:         usuarioId,
          estado_anterior_id: updated.estado_id ?? null,
          estado_nuevo_id:    estadoModId!,
          comentario:         JSON.stringify({ tipo: "edicion", cambios: historialDiff }),
        },
      })
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/solicitudes]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al actualizar solicitud" }, { status: 500 })
  }
}