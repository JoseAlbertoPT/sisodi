import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"

const MESES_ORDEN = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function parseDMY(s: string): Date | null {
  if (!s) return null
  const parts = s.split("/")
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  return new Date(Date.UTC(y, m - 1, d))
}

function mapRow(r: any) {
  return {
    limiteDO:    r.limite_do,
    limiteDGRH:  r.limite_dgrh,
    fechaInicio: r.fecha_inicio ?? undefined,
    fechaFin:    r.fecha_fin    ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  try {
    const ejercicio = Number(req.nextUrl.searchParams.get("ejercicio") ?? new Date().getFullYear())
    const rows = await prisma.calendario.findMany({ where: { ejercicio }, orderBy: { id: "asc" } })

    return NextResponse.json({
      honorarios:   rows.filter((r) => r.regimen === "honorarios")  .map((r) => ({ mes:      r.periodo, ...mapRow(r) })),
      asimilados:   rows.filter((r) => r.regimen === "asimilados")  .map((r) => ({ quincena: r.periodo, ...mapRow(r) })),
      nombramiento: rows.filter((r) => r.regimen === "nombramiento").map((r) => ({ quincena: r.periodo, ...mapRow(r) })),
    })
  } catch (e) {
    console.error("[GET /api/calendario]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ejercicio = Number(req.nextUrl.searchParams.get("ejercicio") ?? new Date().getFullYear())
    const { honorarios, asimilados, nombramiento } = await req.json()

    await prisma.calendario.deleteMany({ where: { ejercicio } })

    type CalRow = { ejercicio: number; regimen: string; periodo: string; limite_do: string; limite_dgrh: string; fecha_inicio: string | null; fecha_fin: string | null }
    const rows: CalRow[] = []

    for (const r of honorarios ?? []) {
      rows.push({ ejercicio, regimen: "honorarios", periodo: r.mes, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH, fecha_inicio: r.fechaInicio || null, fecha_fin: r.fechaFin || null })
    }
    for (const r of asimilados ?? []) {
      rows.push({ ejercicio, regimen: "asimilados", periodo: r.quincena, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH, fecha_inicio: r.fechaInicio || null, fecha_fin: r.fechaFin || null })
    }
    for (const r of nombramiento ?? []) {
      rows.push({ ejercicio, regimen: "nombramiento", periodo: r.quincena, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH, fecha_inicio: r.fechaInicio || null, fecha_fin: r.fechaFin || null })
    }

    if (rows.length > 0) await prisma.calendario.createMany({ data: rows })

    const mesDates = new Map<number, { inicio: Date; fin: Date }>()

    for (const r of honorarios ?? []) {
      const mesIdx = MESES_ORDEN.indexOf(r.mes)
      if (mesIdx < 0) continue
      const fechaFinStr = r.fechaFin || r.limiteDO
      if (!fechaFinStr) continue
      const inicio = r.fechaInicio ? parseDMY(r.fechaInicio) : new Date(Date.UTC(ejercicio, mesIdx, 1))
      const fin    = parseDMY(fechaFinStr)
      if (inicio && fin) mesDates.set(mesIdx + 1, { inicio, fin })
    }

    for (const r of [...(asimilados ?? []), ...(nombramiento ?? [])]) {
      if (!r.quincena.startsWith("2da ") || !r.fechaFin) continue
      const mesName = r.quincena.replace("2da ", "")
      const mesIdx  = MESES_ORDEN.indexOf(mesName)
      if (mesIdx < 0 || mesDates.has(mesIdx + 1)) continue
      const inicio = r.fechaInicio ? parseDMY(r.fechaInicio) : new Date(Date.UTC(ejercicio, mesIdx, 16))
      const fin    = parseDMY(r.fechaFin)
      if (inicio && fin) mesDates.set(mesIdx + 1, { inicio, fin })
    }

    for (const [mes, { inicio, fin }] of mesDates) {
      await prisma.periodo.upsert({
        where:  { mes_anio: { mes, anio: ejercicio } },
        update: { fecha_inicio: inicio, fecha_fin: fin },
        create: { mes, anio: ejercicio, fecha_inicio: inicio, fecha_fin: fin },
      })
    }

    const saved = await prisma.calendario.findMany({ where: { ejercicio }, orderBy: { id: "asc" } })
    broadcastUpdate(["calendario"])
    return NextResponse.json({
      honorarios:   saved.filter((r) => r.regimen === "honorarios")  .map((r) => ({ mes:      r.periodo, ...mapRow(r) })),
      asimilados:   saved.filter((r) => r.regimen === "asimilados")  .map((r) => ({ quincena: r.periodo, ...mapRow(r) })),
      nombramiento: saved.filter((r) => r.regimen === "nombramiento").map((r) => ({ quincena: r.periodo, ...mapRow(r) })),
    })
  } catch (e) {
    console.error("[PUT /api/calendario]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
