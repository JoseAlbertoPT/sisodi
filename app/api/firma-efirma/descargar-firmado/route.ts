import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildJustificacionBuffer } from "@/app/api/pdf/justificacion/route"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const uuid = url.searchParams.get("uuid")
    const token = url.searchParams.get("t")
    if (!uuid || !token) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({
      where: { acceso_token: String(token) },
      include: { firma_proceso: { include: { solicitud: true } } },
    })
    if (!firmante)                                    return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })
    if (firmante.firma_proceso.uuid !== String(uuid))  return NextResponse.json({ ok: false, error: "Link inválido" }, { status: 404 })

    const solicitudId = firmante.firma_proceso.solicitud_id
    const folio = firmante.firma_proceso.solicitud?.folio_recepcion
      ?? firmante.firma_proceso.solicitud?.folio_justificacion
      ?? `SOL-${solicitudId}`
    const filename = `${folio}-firmado.pdf`

    // Este es el archivo que se descarga desde el portal público de Firma de
    // Justificación — igual que la vista previa, no debe llevar el folio de
    // dictamen (soloSiglas) ni la hoja de Constancia de Firma Electrónica
    // (incluirConstancia): esa hoja y el folio completo solo se ven en
    // Dictámenes/Catálogo.
    const result = await buildJustificacionBuffer(
      String(solicitudId),
      { formato: "en_linea" },
      firmante.id,
      {},
      false,
      null,
      true,
      false,
    )
    if (!result) {
      return NextResponse.json({ ok: false, error: "No se pudo generar el PDF" }, { status: 502 })
    }

    return new NextResponse(new Uint8Array(result.buffer as Buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
      },
    })
  } catch (err: any) {
    console.error("[firma-efirma/descargar-firmado]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
