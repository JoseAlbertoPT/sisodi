import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { s3Upload } from "@/lib/s3"

const MAX_SIZE = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const solicitudIdRaw = formData.get("solicitudId")
    const creadoPorId = formData.get("creadoPorId") as string | null

    if (!file) {
      return NextResponse.json({ ok: false, error: "Falta el archivo" }, { status: 400 })
    }
    if (!solicitudIdRaw || !creadoPorId) {
      return NextResponse.json({ ok: false, error: "Faltan solicitudId o creadoPorId" }, { status: 400 })
    }

    const solicitudId = Number(solicitudIdRaw)
    if (isNaN(solicitudId)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Solo se acepta PDF" }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "Archivo demasiado grande (máx 15 MB)" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${solicitudId}_${Date.now()}.pdf`
    const key = `firmas-autografas/${filename}`
    await s3Upload(key, buffer, "application/pdf")

    const firma = await prisma.firma_proceso.upsert({
      where: { solicitud_id: solicitudId },
      update: {
        tipo: "autografa",
        archivo_firmado: key,
        estado: "completado",
        firmados: 1,
        fecha_completado: new Date(),
      },
      create: {
        solicitud_id: solicitudId,
        tipo: "autografa",
        archivo_firmado: key,
        estado: "completado",
        firmados: 1,
        total_firmantes: 1,
        creado_por_id: creadoPorId,
        fecha_completado: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      firma: {
        id: firma.id,
        solicitud_id: firma.solicitud_id,
        archivo_firmado: firma.archivo_firmado,
        estado: firma.estado,
      },
    })
  } catch (err: any) {
    console.error("[firma-efirma/autografa/upload]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
