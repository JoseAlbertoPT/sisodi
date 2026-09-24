import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { s3Download } from "@/lib/s3"

// Tipos que se pueden mostrar en el navegador sin riesgo. Cualquier otro
// (p. ej. un .html subido con Content-Type text/html) se fuerza a descarga
// como binario: servido "inline" desde el mismo origen podía ejecutar scripts
// con la sesión de quien lo abría.
const INLINE_SEGURO: Record<string, string> = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

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
    // Latin-1 (0-255) exige el fallback ASCII para el header; el nombre real
    // se conserva vía filename* (RFC 5987) para que el navegador lo use.
    const asciiName = adjunto.nombre_archivo.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'")
    const encodedName = encodeURIComponent(adjunto.nombre_archivo)
    const ext = adjunto.nombre_archivo.split(".").pop()?.toLowerCase() ?? ""
    const tipoInline = INLINE_SEGURO[ext]
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": tipoInline ?? "application/octet-stream",
        "Content-Disposition": `${tipoInline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/adjunto/[id]/descargar]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error al descargar") }, { status: 500 })
  }
}
