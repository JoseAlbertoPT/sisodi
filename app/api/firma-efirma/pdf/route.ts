import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { readFile } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"
import { s3Download } from "@/lib/s3"

const BYPASS = process.env.EFIRMA_BYPASS === "true"
const BYPASS_DIR = join(process.cwd(), ".firma-bypass")
const FIRMA_S3_PREFIX = "firma-efirma"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const uuid = url.searchParams.get("uuid")
    const token = url.searchParams.get("t")
    if (!uuid || !token) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 })
    }
    const descargar = url.searchParams.get("download") === "1"
    const contentDisposition = descargar ? "attachment; filename=\"justificacion.pdf\"" : "inline"

    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: { firma_proceso: true },
    })
    if (!firmante)                                    return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.uuid !== String(uuid))  return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.estado === "completado") return NextResponse.json({ ok: false, error: "Proceso completado" }, { status: 409 })
    if (firmante.expira_en && firmante.expira_en < new Date()) {
      return NextResponse.json({ ok: false, error: "Link expirado" }, { status: 410 })
    }

    if (BYPASS) {
      try {
        const buf = await readFile(join(BYPASS_DIR, `${String(uuid)}.pdf`))
        return new NextResponse(new Uint8Array(buf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": contentDisposition,
            "Cache-Control": "no-store, private",
          },
        })
      } catch {
        return NextResponse.json({ ok: false, error: "PDF bypass no encontrado" }, { status: 404 })
      }
    }

    try {
      const buf = await s3Download(`${FIRMA_S3_PREFIX}/${String(uuid)}.pdf`)
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDisposition,
          "Cache-Control": "no-store, private",
        },
      })
    } catch (e) {
      console.error("[firma-efirma/pdf] error leyendo PDF de S3", e)
      return NextResponse.json({ ok: false, error: "No se pudo obtener el PDF" }, { status: 502 })
    }
  } catch (err: any) {
    console.error("[firma-efirma/pdf]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
