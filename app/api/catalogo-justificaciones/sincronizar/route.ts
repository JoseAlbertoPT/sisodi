import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  try {
    const [totalDictamenes, totalCatalogo, estados] = await Promise.all([
      prisma.dictamen.count(),
      prisma.catalogo_justificacion.count(),
      prisma.$queryRawUnsafe<{ nombre: string; total: bigint }[]>(
        `SELECT e.nombre, COUNT(s.id) AS total
         FROM solicitud s JOIN estado e ON s.estado_id = e.id
         GROUP BY e.nombre ORDER BY total DESC LIMIT 20`
      ),
    ])
    return NextResponse.json({
      ok: true,
      totalDictamenes,
      totalCatalogo,
      estados: estados.map((r) => ({ nombre: r.nombre, total: Number(r.total) })),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    // Recopilar IDs de solicitudes candidatas desde dos fuentes:
    // 1. Solicitudes que tienen registro en tabla dictamen
    // 2. Solicitudes cuyo estado es "Emitido"
    const [dictamenes, estadoEmitido] = await Promise.all([
      prisma.dictamen.findMany({ select: { solicitud_id: true } }),
      prisma.estado.findFirst({ where: { nombre: { equals: "Emitido", mode: "insensitive" } } }),
    ])

    const idsSet = new Set<number>(dictamenes.map((d) => d.solicitud_id))

    if (estadoEmitido) {
      const emitidas = await prisma.solicitud.findMany({
        where: { estado_id: estadoEmitido.id },
        select: { id: true },
      })
      emitidas.forEach((s) => idsSet.add(s.id))
    }

    if (idsSet.size === 0) {
      return NextResponse.json({ ok: true, insertados: 0, total: 0 })
    }

    const solicitudes = await prisma.solicitud.findMany({
      where: { id: { in: Array.from(idsSet) } },
    })

    let insertados = 0
    const errores: string[] = []

    for (const sol of solicitudes) {
      const existing = await prisma.catalogo_justificacion.findUnique({
        where: { solicitud_id: sol.id },
      })
      if (existing) continue

      try {
        const vigencia =
          sol.vigencia_inicio && sol.vigencia_fin
            ? `${sol.vigencia_inicio.toISOString().slice(0, 10)} / ${sol.vigencia_fin.toISOString().slice(0, 10)}`
            : null

        await prisma.catalogo_justificacion.create({
          data: {
            solicitud_id:              sol.id,
            regimen_contratacion:      (sol as any).regimen ?? "honorarios",
            programa_proyecto:         (sol as any).programa_proyecto ?? "",
            tipo_actividad:            (sol as any).tipo_actividades ?? null,
            denominacion_nombramiento: (sol as any).denominacion ?? null,
            puesto_jefe_inmediato:     (sol as any).puesto_jefe_inmediato ?? null,
            numero_personas:           (sol as any).numero_prestadores ?? null,
            tipo_pago:                 (sol as any).tipo_importe ?? null,
            importe_bruto:             (sol as any).importe_bruto ?? null,
            importe_neto:              null,
            vigencia,
            activo:                    true,
          },
        })
        insertados++
      } catch (e: any) {
        errores.push(`solicitud ${sol.id}: ${e?.message ?? "error"}`)
        console.error(`[sincronizar] Error al insertar solicitud ${sol.id}:`, e)
      }
    }

    return NextResponse.json({ ok: true, insertados, total: solicitudes.length, errores })
  } catch (e: any) {
    console.error("[POST /api/catalogo-justificaciones/sincronizar]", e)
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 })
  }
}
