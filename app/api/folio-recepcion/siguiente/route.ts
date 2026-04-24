import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mes  = parseInt(searchParams.get("mes")  ?? String(new Date().getMonth() + 1), 10)
    const anio = parseInt(searchParams.get("anio") ?? String(new Date().getFullYear()),  10)
    const ext  = searchParams.get("ext") === "true"

    const tipo = ext ? "FREC_EXT" : "FREC"
    const registro = await prisma.consecutivo_folio.findUnique({
      where: { tipo_mes_anio: { tipo, mes, anio } },
    })

    const ultimo    = registro?.consecutivo ?? 0
    const siguiente = ultimo + 1
    return NextResponse.json({ ok: true, siguiente, ultimo })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 })
  }
}
