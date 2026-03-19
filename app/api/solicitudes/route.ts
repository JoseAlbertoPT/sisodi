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
    } = body

    if (!usuarioId)      return NextResponse.json({ ok: false, error: "usuarioId es requerido" }, { status: 400 })
    if (!tipo_solicitud) return NextResponse.json({ ok: false, error: "tipo_solicitud es requerido" }, { status: 400 })

    const estadoInicial = await prisma.estado.findFirst({ where: { nombre: "En Captura" } })
    if (!estadoInicial)  return NextResponse.json({ ok: false, error: "Estado 'En Captura' no existe" }, { status: 500 })

    const nueva = await prisma.solicitud.create({
      data: {
        usuario_id:           usuarioId,
        estado_id:            estadoInicial.id,
        tipo_solicitud,
        periodo_id:           periodoId ?? null,
        es_extemporanea:      esExtemporanea ?? false,
        secretaria:           secretaria ?? null,
        unidad_administrativa: unidad_administrativa ?? null,
        unidad_responsable:   unidad_responsable ?? null,
        programa_proyecto:    programa_proyecto ?? null,
        regimen:              regimen ?? null,
        tipo_actividades:     tipo_actividades ?? null,
        numero_prestadores:   numero_prestadores ?? null,
        denominacion:         denominacion ?? null,
        vigencia_inicio:      vigencia_inicio ? new Date(vigencia_inicio) : null,
        vigencia_fin:         vigencia_fin    ? new Date(vigencia_fin)    : null,
        importe_bruto:        importe_bruto ?? null,
        es_renovacion:        es_renovacion ?? false,
        folio_anterior:       folio_anterior ?? null,
        nivel_tabulador:      nivel_tabulador ?? null,
        categoria_tabulador:  categoria_tabulador ?? null,
        objeto:               objeto ?? null,
        actividades:          actividades ?? [],
        responsabilidades:    responsabilidades ?? [],
        escolaridad:          escolaridad ?? null,
        comp_adm:             comp_adm ?? null,
        comp_tec:             comp_tec ?? null,
        comp_soc:             comp_soc ?? null,
        valores:              valores ?? null,
        areas_exp:            areas_exp ?? null,
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
        comentario:      "Solicitud creada y enviada a validación UEFA",
      },
    })

    return NextResponse.json({ ok: true, data: nueva, folio: nueva.folio_recepcion ?? null }, { status: 201 })
  } catch (error: any) {
    console.error("[POST /api/solicitudes]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al crear solicitud" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, ...campos } = body

    if (!solicitudId) return NextResponse.json({ ok: false, error: "solicitudId es requerido" }, { status: 400 })

    const data: any = {}
    const map: Record<string, string> = {
      secretaria: "secretaria", unidad_administrativa: "unidad_administrativa",
      unidad_responsable: "unidad_responsable", programa_proyecto: "programa_proyecto",
      regimen: "regimen", tipo_actividades: "tipo_actividades",
      numero_prestadores: "numero_prestadores", denominacion: "denominacion",
      importe_bruto: "importe_bruto", es_renovacion: "es_renovacion",
      folio_anterior: "folio_anterior", nivel_tabulador: "nivel_tabulador",
      categoria_tabulador: "categoria_tabulador", objeto: "objeto",
      actividades: "actividades", responsabilidades: "responsabilidades",
      escolaridad: "escolaridad", comp_adm: "comp_adm", comp_tec: "comp_tec",
      comp_soc: "comp_soc", valores: "valores", areas_exp: "areas_exp",
    }
    for (const [k, v] of Object.entries(map)) {
      if (campos[k] !== undefined) data[v] = campos[k]
    }
    if (campos.vigencia_inicio !== undefined) data.vigencia_inicio = campos.vigencia_inicio ? new Date(campos.vigencia_inicio) : null
    if (campos.vigencia_fin    !== undefined) data.vigencia_fin    = campos.vigencia_fin    ? new Date(campos.vigencia_fin)    : null

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