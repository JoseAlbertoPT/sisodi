import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ESTADOS_EXCLUIDOS_UEFA = ["En Captura", "Borrador"]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoNombre = searchParams.get("estado") ?? "En Captura"
    const usuarioId    = searchParams.get("usuarioId")

    let where: any = {}

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
      },
      orderBy: { fecha_creacion: "desc" },
    })

    const enriched = solicitudes.map((sol) => {
      const folioDictamen =
        sol.dictamen?.folio ??
        (sol as any).folio_dictamen ??
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
    const { solicitudId, nuevoEstado, usuarioId, comentario } = body

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
      include: { estado: true },
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

    const solicitudActualizada = await prisma.solicitud.update({
      where:   { id: idNum },
      data:    {
        estado_id: estadoNuevo.id,
        ...(nuevoEstado === "Enviada a Validacion (UEFA)" && {
          fecha_envio: new Date(),
        }),
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

    return NextResponse.json({ ok: true, data: solicitudActualizada })
  } catch (error: any) {
    console.error("[PATCH /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al actualizar el estado" },
      { status: 500 }
    )
  }
}