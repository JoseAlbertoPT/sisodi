import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estadoParam = searchParams.get("estado") ?? "En Captura"
    const usuarioId   = searchParams.get("usuarioId")

    const where: any = {}

    if (estadoParam !== "todos") {
      const estado = await prisma.estado.findFirst({
        where: { nombre: estadoParam },
      })
      if (!estado) {
        return NextResponse.json({ ok: true, data: [] })
      }
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
            estado_historial_solicitud_estado_nuevo_idToestado: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
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
    const { usuarioId, tipo_solicitud, periodoId, esExtemporanea } = body

    if (!usuarioId) {
      return NextResponse.json(
        { ok: false, error: "usuarioId es requerido" },
        { status: 400 }
      )
    }
    if (!tipo_solicitud) {
      return NextResponse.json(
        { ok: false, error: "tipo_solicitud es requerido" },
        { status: 400 }
      )
    }

    const estadoInicial = await prisma.estado.findFirst({
      where: { nombre: "En Captura" },
    })
    if (!estadoInicial) {
      return NextResponse.json(
        { ok: false, error: "Estado 'En Captura' no existe en la base de datos" },
        { status: 500 }
      )
    }

    const nueva = await prisma.solicitud.create({
      data: {
        usuario_id:      usuarioId,
        estado_id:       estadoInicial.id,
        tipo_solicitud,
        periodo_id:      periodoId ?? null,
        es_extemporanea: esExtemporanea ?? false,
      },
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

    return NextResponse.json(
      {
        ok:    true,
        data:  nueva,
        folio: nueva.folio_recepcion ?? null,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[POST /api/solicitudes]", error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Error al crear solicitud" },
      { status: 500 }
    )
  }
}