import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const mes  = parseInt(searchParams.get("mes")  ?? String(new Date().getMonth() + 1), 10)
    const anio = parseInt(searchParams.get("anio") ?? String(new Date().getFullYear()),  10)

    const registro = await prisma.consecutivo_folio.findUnique({
      where: { tipo_mes_anio: { tipo: "FDICT", mes, anio } },
    })

    const siguiente = (registro?.consecutivo ?? 0) + 1
    return NextResponse.json({ ok: true, siguiente })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: mensajePublico(error, "Error interno") }, { status: 500 })
  }
}
