import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { solicitudId } = await req.json()
    if (!solicitudId) return NextResponse.json({ ok: false, error: "Falta solicitudId" }, { status: 400 })

    await prisma.firma_proceso.updateMany({
      where: { solicitud_id: Number(solicitudId) },
      data: {
        archivo_firmado: null,
        estado: "pendiente",
        firmados: 0,
        fecha_completado: null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[firma-efirma/autografa/clear]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
