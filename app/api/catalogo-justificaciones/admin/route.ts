import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q     = searchParams.get("q")?.trim() ?? ""
    const page  = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")))
    const skip  = (page - 1) * limit

    const where = q
      ? {
          OR: [
            { programa_proyecto:        { contains: q, mode: "insensitive" as const } },
            { tipo_actividad:            { contains: q, mode: "insensitive" as const } },
            { denominacion_nombramiento: { contains: q, mode: "insensitive" as const } },
            { vigencia:                  { contains: q, mode: "insensitive" as const } },
            { regimen_contratacion:      { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}

    const [total, records] = await Promise.all([
      prisma.catalogo_justificacion.count({ where }),
      prisma.catalogo_justificacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { creado_en: "desc" },
        include: {
          solicitud: {
            select: {
              id: true,
              tipo_solicitud: true,
              folio_recepcion: true,
              folio_dictamen: true,
              secretaria: true,
              secretaria_txt_snapshot: true,
            },
          },
          _count: { select: { catalogo_solicitudes: true } },
          catalogo_solicitudes: {
            orderBy: { creado_en: "desc" },
            include: {
              usuario: { select: { nombre: true, rfc: true } },
            },
          },
        },
      }),
    ])

    return NextResponse.json({ records, total, page, limit })
  } catch (e) {
    console.error("[GET /api/catalogo-justificaciones/admin]", e)
    return NextResponse.json({ error: "Error al consultar catálogo (admin)" }, { status: 500 })
  }
}
