import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

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
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
