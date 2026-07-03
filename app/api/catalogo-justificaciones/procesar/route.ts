import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function trunc(val: string | null | undefined, max: number): string | null {
  return val ? val.substring(0, max) : null
}

export async function POST(req: NextRequest) {
  try {
    const { catalogo_solicitud_id, admin_usuario_id } = await req.json()

    if (!catalogo_solicitud_id || !admin_usuario_id) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const id = Number(catalogo_solicitud_id)

    // Verificar y marcar como procesada atómicamente (evita duplicados)
    const locked = await prisma.$executeRaw`
      UPDATE catalogo_solicitud SET procesado = true WHERE id = ${id} AND procesado = false
    `
    if (locked === 0) {
      return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 })
    }

    // Cargar datos completos
    const catSol = await prisma.catalogo_solicitud.findUnique({
      where: { id },
      include: {
        catalogo_justificacion: {
          include: { solicitud: true },
        },
      },
    })

    if (!catSol) {
      return NextResponse.json({ error: "Solicitud de reutilización no encontrada" }, { status: 404 })
    }

    const original = catSol.catalogo_justificacion.solicitud

    // Parsear nueva vigencia "YYYY-MM-DD / YYYY-MM-DD"
    const partes = catSol.nueva_vigencia.split("/").map((s) => s.trim())
    const nuevaInicio = parseDate(partes[0])
    const nuevaFin    = parseDate(partes[1] ?? null)

    if (!nuevaInicio || !nuevaFin) {
      await prisma.$executeRaw`UPDATE catalogo_solicitud SET procesado = false WHERE id = ${id}`
      return NextResponse.json({ error: "Formato de vigencia inválido" }, { status: 400 })
    }

    const [estadoInicial, usuarioCreador] = await Promise.all([
      prisma.estado.findFirst({
        where: { nombre: { equals: "En Captura", mode: "insensitive" } },
      }),
      prisma.usuario.findUnique({
        where:  { id: catSol.usuario_id },
        select: { secretaria_id: true, area_id: true, secretaria_texto: true },
      }),
    ])
    if (!estadoInicial) {
      await prisma.$executeRaw`UPDATE catalogo_solicitud SET procesado = false WHERE id = ${id}`
      return NextResponse.json({ error: "Estado 'En Captura' no existe" }, { status: 500 })
    }

    const nuevosPersonas = catSol.nuevo_numero_personas ?? catSol.nuevos_numero_prestadores

    // Crear nueva solicitud copiando todos los campos del original con la nueva vigencia
    const nueva = await prisma.solicitud.create({
      data: {
        usuario_id:                  catSol.usuario_id,
        estado_id:                   estadoInicial.id,
        periodo_id:                  original.periodo_id,
        tipo_solicitud:              original.tipo_solicitud,
        tipo_administracion:         original.tipo_administracion ?? "centralizada",
        // Usar secretaria actual del usuario para que aparezca en Mis Solicitudes
        secretaria_id_snapshot:      usuarioCreador?.secretaria_id ?? original.secretaria_id_snapshot ?? null,
        secretaria_txt_snapshot:     usuarioCreador?.secretaria_texto ?? original.secretaria_txt_snapshot ?? null,
        es_extemporanea:             false,
        secretaria:                  original.secretaria,
        unidad_administrativa:       original.unidad_administrativa,
        unidad_responsable:          original.unidad_responsable,
        programa_proyecto:           trunc(original.programa_proyecto, 200),
        regimen:                     trunc(original.regimen, 100),
        tipo_actividades:            trunc(original.tipo_actividades, 200),
        numero_prestadores:          nuevosPersonas ?? original.numero_prestadores,
        denominacion:                trunc(original.denominacion, 200),
        vigencia_inicio:             nuevaInicio,
        vigencia_fin:                nuevaFin,
        importe_bruto:               original.importe_bruto,
        es_renovacion:               true,
        folio_anterior:              original.folio_justificacion ?? original.folio_dictamen ?? null,
        nivel_tabulador:             original.nivel_tabulador,
        categoria_tabulador:         original.categoria_tabulador,
        objeto:                      original.objeto,
        actividades:                 original.actividades ?? [],
        responsabilidades:           original.responsabilidades ?? [],
        marco_normativo:             original.marco_normativo ?? [],
        escolaridad:                 original.escolaridad,
        comp_adm:                    original.comp_adm,
        comp_tec:                    original.comp_tec,
        comp_soc:                    original.comp_soc,
        valores:                     original.valores,
        areas_exp:                   original.areas_exp,
        puesto_jefe_inmediato:       trunc(original.puesto_jefe_inmediato, 200),
        condiciones_riesgos:         original.condiciones_riesgos ?? [],
        tipo_importe:                original.tipo_importe,
        riesgo_caidas:               original.riesgo_caidas,
        riesgo_mutilaciones:         original.riesgo_mutilaciones,
        riesgo_golpes:               original.riesgo_golpes,
        riesgo_otros:                original.riesgo_otros,
        condicion_cambio_domicilio:  original.condicion_cambio_domicilio ?? false,
        condicion_horario:           original.condicion_horario ?? false,
        condicion_viajar:            original.condicion_viajar ?? false,
        resguardo_activos:           original.resguardo_activos,
      },
    })

    // Folio
    const year = nueva.fecha_creacion?.getFullYear() ?? new Date().getFullYear()
    const tipoFolio = usuarioCreador?.secretaria_id
      ? `JUST-${usuarioCreador.secretaria_id}`
      : usuarioCreador?.area_id
        ? `JUST-A-${usuarioCreador.area_id}`
        : "JUST-P"

    const registro = await prisma.consecutivo_folio.upsert({
      where:  { tipo_mes_anio: { tipo: tipoFolio, mes: 0, anio: year } },
      update: { consecutivo: { increment: 1 } },
      create: { tipo: tipoFolio, mes: 0, anio: year, consecutivo: 1 },
    })
    const folioJustificacion = `JUST-${year}-${String(registro.consecutivo ?? 1).padStart(4, "0")}`

    await prisma.solicitud.update({
      where: { id: nueva.id },
      data:  { folio_justificacion: folioJustificacion },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:    nueva.id,
        estado_nuevo_id: estadoInicial.id,
        usuario_id:      admin_usuario_id,
        comentario:      `Solicitud generada por reutilización del catálogo (dictamen ${original.folio_dictamen ?? original.folio_justificacion ?? original.id})`,
      },
    })

    // Guardar id de la nueva solicitud
    await prisma.$executeRaw`
      UPDATE catalogo_solicitud
      SET procesado_en = NOW(), solicitud_nueva_id = ${nueva.id}
      WHERE id = ${id}
    `

    broadcastUpdate(["catalogo"])

    return NextResponse.json({ ok: true, solicitud_id: nueva.id, folio: folioJustificacion }, { status: 201 })
  } catch (e: any) {
    console.error("[POST /api/catalogo-justificaciones/procesar]", e)
    return NextResponse.json({
      error:  "Error al procesar reutilización",
      detail: e?.message ?? String(e),
    }, { status: 500 })
  }
}
