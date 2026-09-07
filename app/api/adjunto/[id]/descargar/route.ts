import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { s3Download } from "@/lib/s3"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const idNum = Number(id)
    if (isNaN(idNum)) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })
    }

    const adjunto = await prisma.adjunto.findUnique({ where: { id: idNum } })
    if (!adjunto) {
      return NextResponse.json({ ok: false, error: "Adjunto no encontrado" }, { status: 404 })
    }

    const buffer = await s3Download(adjunto.ruta)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": adjunto.tipo || "application/octet-stream",
        "Content-Disposition": `inline; filename="${adjunto.nombre_archivo}"`,
        "Cache-Control": "no-store, private",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/adjunto/[id]/descargar]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error al descargar" }, { status: 500 })
  }
}
