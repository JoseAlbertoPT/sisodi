import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const ejercicio = Number(req.nextUrl.searchParams.get("ejercicio") ?? new Date().getFullYear())

    const rows = await prisma.calendario.findMany({
      where: { ejercicio },
      orderBy: { id: "asc" },
    })

    const honorarios = rows
      .filter((r) => r.regimen === "honorarios")
      .map((r) => ({ mes: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh }))

    const asimilados = rows
      .filter((r) => r.regimen === "asimilados")
      .map((r) => ({ quincena: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh }))

    const nombramiento = rows
      .filter((r) => r.regimen === "nombramiento")
      .map((r) => ({ quincena: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh }))

    return NextResponse.json({ honorarios, asimilados, nombramiento })
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

    const rows: { ejercicio: number; regimen: string; periodo: string; limite_do: string; limite_dgrh: string }[] = []

    for (const r of honorarios ?? []) {
      rows.push({ ejercicio, regimen: "honorarios", periodo: r.mes, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH })
    }
    for (const r of asimilados ?? []) {
      rows.push({ ejercicio, regimen: "asimilados", periodo: r.quincena, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH })
    }
    for (const r of nombramiento ?? []) {
      rows.push({ ejercicio, regimen: "nombramiento", periodo: r.quincena, limite_do: r.limiteDO, limite_dgrh: r.limiteDGRH })
    }

    if (rows.length > 0) {
      await prisma.calendario.createMany({ data: rows })
    }

    
    const saved = await prisma.calendario.findMany({
      where: { ejercicio },
      orderBy: { id: "asc" },
    })

    return NextResponse.json({
      honorarios: saved.filter((r) => r.regimen === "honorarios").map((r) => ({ mes: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh })),
      asimilados: saved.filter((r) => r.regimen === "asimilados").map((r) => ({ quincena: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh })),
      nombramiento: saved.filter((r) => r.regimen === "nombramiento").map((r) => ({ quincena: r.periodo, limiteDO: r.limite_do, limiteDGRH: r.limite_dgrh })),
    })
  } catch (e) {
    console.error("[PUT /api/calendario]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
