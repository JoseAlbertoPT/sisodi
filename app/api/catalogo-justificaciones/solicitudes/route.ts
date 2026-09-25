import { NextRequest, NextResponse } from "next/server"
import { requireSesion, verificarActor } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { puedeVerSolicitudesCatalogo } from "@/lib/api-guard"
import { alcanceSolicitudesCatalogo, dentroDeAlcance } from "@/lib/catalogo-solicitud-acceso"

/**
 * Pestaña "Solicitud" del Catálogo: reutilizaciones firmadas por UEFA, en una
 * sola lista — pendientes del Vo.Bo. del Emisor y ya firmadas (con su Dictamen
 * final), cada una con su estatus.
 * Alcance por usuario: ver lib/catalogo-solicitud-acceso.ts.
 */
export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const actorErr = verificarActor(sesion, userId)
    if (actorErr) return actorErr
    if (!(await puedeVerSolicitudesCatalogo(userId))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const alcance = await alcanceSolicitudesCatalogo(userId!)
    if (!alcance.verTodas && !alcance.secretaria) {
      return NextResponse.json({ records: [], puedeFirmar: false })
    }

    const rows = await prisma.catalogo_solicitud.findMany({
      where:   { estado: { in: ["pendiente_firma", "firmando", "firmado"] } },
      orderBy: { creado_en: "desc" },
      include: {
        catalogo_justificacion: {
          select: {
            programa_proyecto:   true,
            importe_bruto:       true,
            numero_personas:     true,
            folio_dictamen:      true,
            folio_recepcion:     true,
            secretaria:          true,
            tipo_administracion: true,
            solicitud:           { select: { folio_dictamen: true, folio_recepcion: true, secretaria: true } },
          },
        },
      },
    })

    const records = rows
      .filter((r) => dentroDeAlcance(alcance, r.catalogo_justificacion))
      .map((r) => {
        const cj = r.catalogo_justificacion
        const [vigenciaInicio, vigenciaFin] = r.nueva_vigencia.split("/").map((s) => s.trim())
        const importe = r.nuevo_importe_bruto ?? cj.importe_bruto
        return {
          id:                 r.id,
          folio:              cj.folio_dictamen ?? cj.solicitud?.folio_dictamen ?? cj.folio_recepcion ?? cj.solicitud?.folio_recepcion ?? null,
          programaProyecto:   r.nuevo_programa_proyecto ?? cj.programa_proyecto,
          vigenciaInicio:     vigenciaInicio ?? null,
          vigenciaFin:        vigenciaFin ?? null,
          importeBruto:       importe != null ? String(importe) : null,
          numeroPrestadores:  r.nuevos_numero_prestadores ?? r.nuevo_numero_personas ?? cj.numero_personas ?? null,
          estado:             r.estado,
          creadoEn:           r.creado_en,
          firmadoEn:          r.firmado_en,
        }
      })

    // Firmar (Vo.Bo.) solo Emisor/Administrador — los mismos que ven todas.
    return NextResponse.json({ records, puedeFirmar: alcance.verTodas })
  } catch (e) {
    console.error("[GET /api/catalogo-justificaciones/solicitudes]", e)
    return NextResponse.json({ error: "Error al obtener solicitudes" }, { status: 500 })
  }
}
