import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { s3Download } from "@/lib/s3"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const solicitudIdRaw = searchParams.get("solicitudId")
    const solicitudId = Number(solicitudIdRaw)
    if (!solicitudIdRaw || isNaN(solicitudId)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }

    const firma = await prisma.firma_proceso.findUnique({ where: { solicitud_id: solicitudId } })
    if (!firma?.archivo_firmado) {
      return NextResponse.json({ ok: false, error: "No hay archivo firmado" }, { status: 404 })
    }

    const buffer = await s3Download(firma.archivo_firmado)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, private",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/firma-efirma/autografa/descargar]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error al descargar" }, { status: 500 })
  }
}
