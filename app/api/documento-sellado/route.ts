import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { s3Upload, s3Delete } from "@/lib/s3"

const ALL_APARTADOS = ["solicitudes", "filtro", "dashboard", "revision", "dictamenes", "validacion"]

const ETAPAS_VALIDAS = ["uefa", "emision"] as const
type Etapa = (typeof ETAPAS_VALIDAS)[number]

function parseEtapa(value: string | null): Etapa | null {
  if (!value) return null
  return ETAPAS_VALIDAS.includes(value as Etapa) ? (value as Etapa) : null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const solicitudIdRaw = searchParams.get("solicitudId")
    const etapaRaw = searchParams.get("etapa")
    const solicitudId = Number(solicitudIdRaw)
    if (!solicitudIdRaw || isNaN(solicitudId)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }

    if (etapaRaw) {
      const etapa = parseEtapa(etapaRaw)
      if (!etapa) {
        return NextResponse.json({ ok: false, error: "etapa inválida" }, { status: 400 })
      }
      const sellado = await prisma.documento_sellado.findUnique({
        where: { solicitud_id_etapa: { solicitud_id: solicitudId, etapa } },
        include: { uploader: { select: { id: true, nombre: true } } },
      })
      return NextResponse.json({ ok: true, sellado })
    }

    const sellados = await prisma.documento_sellado.findMany({
      where: { solicitud_id: solicitudId },
      include: { uploader: { select: { id: true, nombre: true } } },
      orderBy: { uploaded_at: "desc" },
    })
    return NextResponse.json({ ok: true, sellados })
  } catch (error: any) {
    console.error("[GET /api/documento-sellado]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const solicitudIdRaw = form.get("solicitudId") as string | null
    const etapaRaw = form.get("etapa") as string | null
    const usuarioId = (form.get("usuarioId") as string | null) || null

    if (!file || !solicitudIdRaw || !etapaRaw) {
      return NextResponse.json({ ok: false, error: "Faltan file, solicitudId o etapa" }, { status: 400 })
    }
    const solicitudId = Number(solicitudIdRaw)
    if (isNaN(solicitudId)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }
    const etapa = parseEtapa(etapaRaw)
    if (!etapa) {
      return NextResponse.json({ ok: false, error: "etapa inválida" }, { status: 400 })
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ ok: false, error: "El archivo debe ser PDF" }, { status: 400 })
    }

    const previo = await prisma.documento_sellado.findUnique({
      where: { solicitud_id_etapa: { solicitud_id: solicitudId, etapa } },
    })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = `sellado_${etapa}_${solicitudId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const key = `sellados/${safeName}`

    await s3Upload(key, buffer, "application/pdf")

    const data = await prisma.documento_sellado.upsert({
      where: { solicitud_id_etapa: { solicitud_id: solicitudId, etapa } },
      create: {
        solicitud_id: solicitudId,
        etapa,
        archivo: key,
        nombre_original: file.name,
        uploaded_by: usuarioId || null,
      },
      update: {
        archivo: key,
        nombre_original: file.name,
        uploaded_by: usuarioId || null,
        uploaded_at: new Date(),
      },
      include: { uploader: { select: { id: true, nombre: true } } },
    })

    if (previo?.archivo && previo.archivo !== key) {
      await s3Delete(previo.archivo)
    }

    broadcastUpdate(ALL_APARTADOS)
    return NextResponse.json({ ok: true, sellado: data })
  } catch (error: any) {
    console.error("[POST /api/documento-sellado]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error al subir" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const solicitudIdRaw = searchParams.get("solicitudId")
    const etapaRaw = searchParams.get("etapa")
    const solicitudId = Number(solicitudIdRaw)
    if (!solicitudIdRaw || isNaN(solicitudId)) {
      return NextResponse.json({ ok: false, error: "solicitudId inválido" }, { status: 400 })
    }
    const etapa = parseEtapa(etapaRaw)
    if (!etapa) {
      return NextResponse.json({ ok: false, error: "etapa inválida" }, { status: 400 })
    }

    const existente = await prisma.documento_sellado.findUnique({
      where: { solicitud_id_etapa: { solicitud_id: solicitudId, etapa } },
    })
    if (!existente) {
      return NextResponse.json({ ok: true })
    }

    await prisma.documento_sellado.delete({
      where: { solicitud_id_etapa: { solicitud_id: solicitudId, etapa } },
    })
    await s3Delete(existente.archivo)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[DELETE /api/documento-sellado]", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 })
  }
}
