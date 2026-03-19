import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoNombre = searchParams.get("estado") ?? "En Captura"
    const usuarioId    = searchParams.get("usuarioId")


    const estado = await prisma.estado.findFirst({
      where: { nombre: estadoNombre },
    })
    if (!estado) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const where: any = { estado_id: estado.id }
    if (usuarioId) where.usuario_id = usuarioId
    const solicitudes = await prisma.solicitud.findMany({
      where,
      include: {
        estado:  true,
        periodo: true,
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
          take: 1,
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado: true,
          },
        },
      },
      orderBy: { fecha_creacion: "desc" },
    })

    return NextResponse.json({ ok: true, data: solicitudes })
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


    const solicitud = await prisma.solicitud.findUnique({
      where: { id: solicitudId },
      include: { estado: true },
    })
    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      )
    }


    let estadoNuevo = await prisma.estado.findFirst({
      where: { nombre: nuevoEstado },
    })
    if (!estadoNuevo) {
      estadoNuevo = await prisma.estado.create({
        data: { nombre: nuevoEstado, descripcion: `Estado: ${nuevoEstado}` },
      })
    }


    const solicitudActualizada = await prisma.solicitud.update({
      where: { id: solicitudId },
      data:  { estado_id: estadoNuevo.id },
      include: { estado: true, periodo: true },
    })


    await prisma.historial_solicitud.create({
      data: {
        solicitud_id:       solicitudId,
        usuario_id:         usuarioId,
        estado_anterior_id: solicitud.estado_id,
        estado_nuevo_id:    estadoNuevo.id,
        comentario:         comentario ?? null,
      },
    })

    return NextResponse.json({
      ok:   true,
      data: solicitudActualizada,
    })
  } catch (error: any) {
    console.error("[PATCH /api/validacion]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al actualizar el estado" },
      { status: 500 }
    )
  }
}