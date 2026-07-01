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

    // El cliente Prisma puede estar cacheado y no devolver los campos nuevos
    // (procesado, procesado_en, solicitud_nueva_id). Los obtenemos via raw y los mergeamos.
    const solIds = records.flatMap((r: any) => r.catalogo_solicitudes.map((s: any) => s.id as number))
    if (solIds.length > 0) {
      const idList = solIds.join(",")
      // Traemos también el folio de la solicitud nueva para mostrarlo en la UI
      const extras = await prisma.$queryRawUnsafe<
        { id: number; procesado: boolean; procesado_en: Date | null; solicitud_nueva_id: number | null; folio_nueva: string | null }[]
      >(`
        SELECT cs.id,
               cs.procesado,
               cs.procesado_en,
               cs.solicitud_nueva_id,
               s.folio_justificacion AS folio_nueva
        FROM   catalogo_solicitud cs
        LEFT   JOIN solicitud s ON s.id = cs.solicitud_nueva_id
        WHERE  cs.id IN (${idList})
      `)
      const extrasMap = new Map(extras.map((e) => [e.id, e]))
      for (const rec of records as any[]) {
        for (const sol of rec.catalogo_solicitudes) {
          const extra = extrasMap.get(sol.id)
          if (extra) {
            sol.procesado           = extra.procesado
            sol.procesado_en        = extra.procesado_en
            sol.solicitud_nueva_id  = extra.solicitud_nueva_id
            sol.folio_nueva         = extra.folio_nueva
          }
        }
      }
    }

    return NextResponse.json({ records, total, page, limit })
  } catch (e) {
    console.error("[GET /api/catalogo-justificaciones/admin]", e)
    return NextResponse.json({ error: "Error al consultar catálogo (admin)" }, { status: 500 })
  }
}
