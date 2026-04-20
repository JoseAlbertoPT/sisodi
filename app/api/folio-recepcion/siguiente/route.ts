import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mes  = parseInt(searchParams.get("mes")  ?? String(new Date().getMonth() + 1), 10)
    const anio = parseInt(searchParams.get("anio") ?? String(new Date().getFullYear()),  10)

    const registro = await prisma.consecutivo_folio.findUnique({
      where: { tipo_mes_anio: { tipo: "FREC", mes, anio } },
    })

    const siguiente = (registro?.consecutivo ?? 0) + 1
    return NextResponse.json({ ok: true, siguiente })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 })
  }
}
