import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      catalogo_justificacion_id,
      usuario_id,
      nueva_vigencia,
      nuevo_numero_personas,
      nuevos_numero_prestadores,
    } = body

    if (!catalogo_justificacion_id || !usuario_id || !nueva_vigencia?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const catalogo = await prisma.catalogo_justificacion.findUnique({
      where: { id: Number(catalogo_justificacion_id) },
    })
    if (!catalogo) {
      return NextResponse.json({ error: "Registro de catálogo no encontrado" }, { status: 404 })
    }

    const record = await prisma.catalogo_solicitud.create({
      data: {
        catalogo_justificacion_id: Number(catalogo_justificacion_id),
        usuario_id: String(usuario_id),
        nueva_vigencia: String(nueva_vigencia).trim(),
        nuevo_numero_personas: nuevo_numero_personas ? Number(nuevo_numero_personas) : null,
        nuevos_numero_prestadores: nuevos_numero_prestadores ? Number(nuevos_numero_prestadores) : null,
      },
    })

    return NextResponse.json({ record }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/catalogo-justificaciones/solicitar]", e)
    return NextResponse.json({ error: "Error al crear solicitud de reutilización" }, { status: 500 })
  }
}
