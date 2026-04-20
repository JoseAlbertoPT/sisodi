import { NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"

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
    const filePath = path.join(process.cwd(), "public", "uploads", safeName)

    await writeFile(filePath, buffer)

    const adjunto = await prisma.adjunto.create({
      data: {
        solicitud_id:   idNum,
        nombre_archivo: file.name,
        ruta:           `/uploads/${safeName}`,
        tipo:           file.type || file.name.split(".").pop()?.toUpperCase() || "DOC",
      },
    })

    return NextResponse.json({ ok: true, data: adjunto })
  } catch (error: any) {
    console.error("[POST /api/adjunto]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al subir archivo" }, { status: 500 })
  }
}
