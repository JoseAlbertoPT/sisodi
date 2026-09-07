import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { s3Upload, s3Delete } from "@/lib/s3"

export async function POST(req: NextRequest) {

  try {
    const form = await req.formData()
    const file        = form.get("file") as File | null
    const solicitudId = form.get("solicitudId") as string | null
    if (!file || !solicitudId) {
      return NextResponse.json({ ok: false, error: "Faltan file o solicitudId" }, { status: 400 })
    }
    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }
    const bytes    = await file.arrayBuffer()
    const buffer   = Buffer.from(bytes)
    const safeName = `${idNum}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const key      = `adjuntos/${safeName}`
    await s3Upload(key, buffer, file.type || undefined)
    const adjunto = await prisma.adjunto.create({
      data: {
        solicitud_id:   idNum,
        nombre_archivo: file.name,
        ruta:           key,
        tipo:           file.type || file.name.split(".").pop()?.toUpperCase() || "DOC",
      },
    })

    return NextResponse.json({ ok: true, data: adjunto })
  } catch (error: any) {
    console.error("[POST /api/adjunto]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al subir archivo" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idRaw = searchParams.get("id")
    const idNum = Number(idRaw)
    if (!idRaw || isNaN(idNum)) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })
    }

    const adjunto = await prisma.adjunto.findUnique({ where: { id: idNum } })
    if (!adjunto) {
      return NextResponse.json({ ok: true })
    }

    await prisma.adjunto.delete({ where: { id: idNum } })
    await s3Delete(adjunto.ruta)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[DELETE /api/adjunto]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al eliminar archivo" }, { status: 500 })
  }
}
