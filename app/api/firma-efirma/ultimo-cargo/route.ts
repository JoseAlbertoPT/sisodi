import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get("usuarioId")
    if (!usuarioId) {
      return NextResponse.json({ ok: false, error: "Falta usuarioId" }, { status: 400 })
    }

    const ultima = await prisma.firma_firmante.findFirst({
      where: {
        usuario_id: usuarioId,
        firmado: true,
        cargo_firmante: { not: null },
      },
      orderBy: { fecha_firma: "desc" },
      select: { cargo_firmante: true, fecha_firma: true },
    })

    return NextResponse.json({
      ok: true,
      cargo: ultima?.cargo_firmante ?? null,
      fecha: ultima?.fecha_firma ?? null,
    })
  } catch (error: any) {
    console.error("[GET /api/firma-efirma/ultimo-cargo]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 })
  }
}
