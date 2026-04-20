import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ESTADOS_EXCLUIDOS_UEFA = ["En Captura", "Borrador"]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoNombre = searchParams.get("estado") ?? "En Captura"
    const usuarioId    = searchParams.get("usuarioId")
    const viewerUserId = searchParams.get("viewerId")

    let where: any = {}

    if (viewerUserId) {
      const viewer = await prisma.usuario.findUnique({
        where:  { id: viewerUserId },
        select: { secretaria_id: true, organo_centralizado: { select: { id: true } } },
      })
      if (viewer) {
        if (viewer.organo_centralizado !== null && viewer.secretaria_id) {
          // Usuario centralizado: ve su secretaría + todos los paraestatal (secretaria_id null)
          where.OR = [
            { usuario: { secretaria_id: viewer.secretaria_id } },
            { usuario: { secretaria_id: null } },
          ]
        } else {
          // Usuario paraestatal: ve solo paraestatal
          where.usuario = { organo_centralizado: { is: null } }
        }
      }
    }

    if (estadoNombre !== "todos") {
      const estado = await prisma.estado.findFirst({
        where: { nombre: { equals: estadoNombre, mode: "insensitive" } },
      })
      if (!estado) return NextResponse.json({ ok: true, data: [] })
      where.estado_id = estado.id
    } else {
      const estadosExcluidos = await prisma.estado.findMany({
        where: { nombre: { in: ESTADOS_EXCLUIDOS_UEFA, mode: "insensitive" } },
        select: { id: true },
      })
      if (estadosExcluidos.length > 0) {
        where.NOT = { estado_id: { in: estadosExcluidos.map((e) => e.id) } }
      }
    }

    if (usuarioId) where.usuario_id = usuarioId

    const solicitudes = await prisma.solicitud.findMany({
      where,
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true,
        usuario: {
          select: {
            id:           true,
            nombre:       true,
            correo:       true,
            rfc:          true,
            secretaria_id: true,
            area:         { select: { id: true, nombre: true } },
            rol:          { select: { id: true, nombre: true } },
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
        adjunto: true,
      },
      orderBy: { fecha_creacion: "desc" },
    })

    const sorted = [...solicitudes].sort((a, b) => {
      const ta = (a.fecha_envio ?? a.fecha_creacion ?? new Date(0)).getTime()
      const tb = (b.fecha_envio ?? b.fecha_creacion ?? new Date(0)).getTime()
      return tb - ta
    })

    const enriched = sorted.map((sol) => {
      const folioDictamen =
        (sol as any).folio_dictamen ??
        sol.dictamen?.folio         ??
        (sol as any).folio_anterior ??
        null

      return {
        ...sol,
        folioDictamen,
        _raw: { ...sol, folioDictamen },
      }
    })

    return NextResponse.json({ ok: true, data: enriched })
  } catch (error: any) {
    console.error("[GET /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al obtener solicitudes para validación" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, nuevoEstado, usuarioId, comentario, revisorId } = body

    if (!solicitudId || !nuevoEstado || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: solicitudId, nuevoEstado, usuarioId" },
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

    const solicitud = await prisma.solicitud.findUnique({
      where:   { id: idNum },
      include: { estado: true, usuario: { select: { secretaria_id: true } } },
    })

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }

    let estadoNuevo = await prisma.estado.findFirst({
      where: { nombre: { equals: nuevoEstado, mode: "insensitive" } },
    })
    if (!estadoNuevo) {
      estadoNuevo = await prisma.estado.create({
        data: { nombre: nuevoEstado, descripcion: `Estado: ${nuevoEstado}` },
      })
    }

    const esEnvioAValidacion =
      nuevoEstado.toLowerCase().includes("en validacion justificaciones") ||
      nuevoEstado.toLowerCase().includes("enviada a validacion")

    const esEnvioDGDO = nuevoEstado.toLowerCase() === "pendiente do"

    // Generar folio_recepcion global (FREC, formato AB-001) al enviar a DGDO
    let folioRecepcionNuevo: string | undefined
    if (esEnvioDGDO && !solicitud.folio_recepcion) {
      const MONTH_CODES = ["EN","FE","MR","AB","MY","JN","JL","AG","SE","OC","NO","DI"]
      const now    = new Date()
      const mesNum = now.getMonth() + 1
      const anioNum = now.getFullYear()
      const mesCode = MONTH_CODES[now.getMonth()]
      const registro = await prisma.consecutivo_folio.upsert({
        where:  { tipo_mes_anio: { tipo: "FREC", mes: mesNum, anio: anioNum } },
        update: { consecutivo: { increment: 1 } },
        create: { tipo: "FREC", mes: mesNum, anio: anioNum, consecutivo: 1 },
      })
      folioRecepcionNuevo = `${mesCode}-${String(registro.consecutivo ?? 1).padStart(3, "0")}`
    }

    // Si es un borrador enviado y aún no tiene folio, asignarlo ahora
    let folioJustificacionNuevo: string | undefined
    if (esEnvioAValidacion && !solicitud.folio_justificacion) {
      const year = new Date().getFullYear()
      const tipoFolio = solicitud.usuario?.secretaria_id
        ? `JUST-${solicitud.usuario.secretaria_id}`
        : "JUST-P"
      const registro = await prisma.consecutivo_folio.upsert({
        where:  { tipo_mes_anio: { tipo: tipoFolio, mes: 0, anio: year } },
        update: { consecutivo: { increment: 1 } },
        create: { tipo: tipoFolio, mes: 0, anio: year, consecutivo: 1 },
      })
      folioJustificacionNuevo = `JUST-${year}-${String(registro.consecutivo ?? 1).padStart(4, "0")}`
    }

    const solicitudActualizada = await prisma.solicitud.update({
      where:   { id: idNum },
      data:    {
        estado_id: estadoNuevo.id,
        ...(esEnvioAValidacion && { fecha_envio: new Date() }),
        ...(folioRecepcionNuevo    && { folio_recepcion:     folioRecepcionNuevo }),
        ...(folioJustificacionNuevo && { folio_justificacion: folioJustificacionNuevo }),
        ...(revisorId && { revisor_asignado_id: revisorId }),
      },
      include: { estado: true, periodo: true },
    })

    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:       idNum,
        usuario_id:         usuarioId,
        estado_anterior_id: solicitud.estado_id,
        estado_nuevo_id:    estadoNuevo.id,
        comentario:         comentario ?? null,
      },
    })

    return NextResponse.json({
      ok:    true,
      data:  solicitudActualizada,
      folio: folioJustificacionNuevo ?? solicitudActualizada.folio_justificacion ?? null,
    })
  } catch (error: any) {
    console.error("[PATCH /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al actualizar el estado" },
      { status: 500 }
    )
  }
}