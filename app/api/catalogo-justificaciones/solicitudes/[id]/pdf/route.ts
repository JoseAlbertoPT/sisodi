import { NextRequest, NextResponse } from "next/server"
import { requireSesion, verificarActor } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { puedeVerSolicitudesCatalogo } from "@/lib/api-guard"
import { alcanceSolicitudesCatalogo, dentroDeAlcance } from "@/lib/catalogo-solicitud-acceso"
import { isS3NotFound, s3Download } from "@/lib/s3"

export const runtime = "nodejs"

/**
 * Dictamen final de una reutilización de Catálogo. Solo existe cuando ya
 * tiene las dos firmas (estado "firmado"); mientras está pendiente, UEFA solo
 * ve el estatus. `?modo=ver` lo abre en el navegador; por defecto se descarga.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 })

  const userId = req.nextUrl.searchParams.get("userId")
  const actorErr = verificarActor(sesion, userId)
  if (actorErr) return actorErr
  if (!(await puedeVerSolicitudesCatalogo(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const catSol = await prisma.catalogo_solicitud.findUnique({
    where: { id },
    select: {
      estado: true,
      archivo_pdf_generado: true,
      catalogo_justificacion: {
        select: {
          folio_dictamen: true, secretaria: true, tipo_administracion: true,
          solicitud: { select: { secretaria: true, folio_dictamen: true } },
        },
      },
    },
  })
  const alcance = await alcanceSolicitudesCatalogo(userId!)
  if (!catSol || !dentroDeAlcance(alcance, catSol.catalogo_justificacion)) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 })
  }
  if (catSol.estado !== "firmado" || !catSol.archivo_pdf_generado) {
    return NextResponse.json({ error: "El Dictamen estará disponible cuando el Emisor lo firme." }, { status: 409 })
  }

  let pdf: Buffer
  try {
    pdf = await s3Download(catSol.archivo_pdf_generado)
  } catch (e) {
    if (isS3NotFound(e)) return NextResponse.json({ error: "El documento no está disponible." }, { status: 404 })
    throw e
  }

  const cj = catSol.catalogo_justificacion
  const folio = (cj.folio_dictamen ?? cj.solicitud?.folio_dictamen ?? String(id)).replace(/[\\/]/g, "-")
  const modo = req.nextUrl.searchParams.get("modo") === "ver" ? "inline" : "attachment"
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${modo}; filename="Dictamen_${folio}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
