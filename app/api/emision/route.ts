import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const INICIALES_MES: Record<number, string> = {
  1: "EN", 2: "FE", 3: "MR", 4: "AB",
  5: "MY", 6: "JN", 7: "JL", 8: "AG",
  9: "SE", 10: "OC", 11: "NO", 12: "DI",
}

function generarFolioTemporal(id: number, fecha: Date | null | undefined): string {
  const f   = fecha ?? new Date()
  const mes = f.getMonth() + 1
  const ini = INICIALES_MES[mes] ?? "XX"
  const num = String(id).padStart(3, "0")
  return `${ini}-${num}`
}

// Resolver folio dictamen desde TODAS las fuentes posibles,
// incluyendo folio_anterior para renovaciones
function resolverFolioDictamen(sol: any): string | null {
  return (
    sol.dictamen?.folio       ??
    sol.folio_dictamen        ??
    sol.folio_anterior        ??
    null
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const vista = searchParams.get("vista")

    if (vista !== "emitidos") {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'vista' requerido. Use 'emitidos'" },
        { status: 400 }
      )
    }

    // Buscar estado Emitido con mode insensitive para consistencia
    const estadoEmitido = await prisma.estado.findFirst({
      where: { nombre: { equals: "Emitido", mode: "insensitive" } },
    })

    if (!estadoEmitido) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const solicitudes = await prisma.solicitud.findMany({
      where: { estado_id: estadoEmitido.id },
      include: {
        estado:   true,
        periodo:  true,
        dictamen: true, // CLAVE: siempre incluir
        usuario: {
          select: {
            id:     true,
            nombre: true,
            correo: true,
            area:   { select: { id: true, nombre: true } },
            rol:    { select: { id: true, nombre: true } },
          },
        },
        historial_solicitud: {
          orderBy: { fecha: "asc" },
          include: {
            estado_historial_solicitud_estado_nuevo_idToestado:    true,
            estado_historial_solicitud_estado_anterior_idToestado: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha_emision: "desc" },
    })

    const data = solicitudes.map((sol) => {
      const historial = sol.historial_solicitud

      const revisor = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("filtro 2")
      })
      const validador = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return (
          nombre.toLowerCase().includes("filtro 3") ||
          nombre.toLowerCase().includes("aprobado")
        )
      })
      const emisor = historial.find((h) => {
        const nombre =
          h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        return nombre.toLowerCase().includes("emitido")
      })

      let destinatarios: string[] = []
      if (emisor?.comentario) {
        const match = emisor.comentario.match(/Destinatarios:\s*(.+)/i)
        if (match) {
          destinatarios = match[1]
            .split("|")
            .map((d) => d.trim())
            .filter(Boolean)
        }
      }

      const fechaParaFolio = sol.fecha_envio ?? sol.fecha_creacion
      const folioRecepcion =
        sol.folio_recepcion ??
        generarFolioTemporal(
          sol.id,
          fechaParaFolio ? new Date(fechaParaFolio) : null
        )

      // Resolver folio dictamen desde todas las fuentes
      const folioDictamen = resolverFolioDictamen(sol) ?? "—"

      // Secretaria: buscar en campo directo primero, luego en usuario.area
      const secretaria =
        (sol as any).secretaria ??
        sol.usuario?.area?.nombre ??
        "—"

      return {
        id:             String(sol.id),
        folioDictamen,
        folioRecepcion,
        fechaEmision:
          sol.dictamen?.fecha_emision?.toISOString() ??
          (sol as any).fecha_emision?.toISOString() ??
          null,
        tipoFirma:      sol.dictamen?.tipo_firma ?? null,
        archivoPdf:     sol.dictamen?.archivo_pdf ?? null,
        secretaria,
        tipoSolicitud:  sol.tipo_solicitud ?? "—",
        denominacion:   (sol as any).denominacion ?? sol.tipo_solicitud ?? null,
        importeBruto:
          sol.importe_bruto != null
            ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`
            : null,
        vigenciaInicio:
          sol.vigencia_inicio?.toISOString().slice(0, 10) ?? null,
        vigenciaFin:
          sol.vigencia_fin?.toISOString().slice(0, 10) ?? null,
        esExtemporanea: (sol as any).es_extemporanea ?? null,
        estado:         sol.estado.nombre,
        periodo:
          sol.periodo ? `${sol.periodo.mes}/${sol.periodo.anio}` : null,
        destinatarios,
        firmadoPor: {
          reviso: revisor?.usuario?.nombre   ?? "—",
          valido: validador?.usuario?.nombre ?? "—",
          emitio: emisor?.usuario?.nombre    ?? "—",
        },
        tipoSolicitudRaw: sol.tipo_solicitud,
      }
    })

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error("[GET /api/emision]", error)
    return NextResponse.json(
      {
        ok:    false,
        error: error?.message ?? "Error al obtener dictámenes emitidos",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { solicitudId, tipoFirma, archivoPdf, destinatarios, usuarioId } = body

    if (!solicitudId || !usuarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos requeridos: solicitudId, usuarioId" },
        { status: 400 }
      )
    }

    const idNum = Number(solicitudId)
    if (isNaN(idNum)) {
      return NextResponse.json(
        { ok: false, error: "solicitudId debe ser un número válido" },
        { status: 400 }
      )
    }

    const dictamen = await prisma.dictamen.findUnique({
      where: { solicitud_id: idNum },
    })

    if (!dictamen) {
      return NextResponse.json(
        { ok: false, error: "Dictamen no encontrado para esta solicitud" },
        { status: 404 }
      )
    }

    const updated = await prisma.dictamen.update({
      where: { solicitud_id: idNum },
      data: {
        ...(tipoFirma  ? { tipo_firma:  tipoFirma }  : {}),
        ...(archivoPdf ? { archivo_pdf: archivoPdf } : {}),
      },
    })

    if (
      destinatarios &&
      Array.isArray(destinatarios) &&
      destinatarios.length > 0
    ) {
      const estadoEmitido = await prisma.estado.findFirst({
        where: { nombre: { equals: "Emitido", mode: "insensitive" } },
      })
      if (estadoEmitido) {
        await prisma.historial_solicitud.create({
          data: {
            solicitud_id:       idNum,
            usuario_id:         usuarioId,
            estado_anterior_id: estadoEmitido.id,
            estado_nuevo_id:    estadoEmitido.id,
            comentario: `Destinatarios: ${destinatarios.join(" | ")}`,
          },
        })
      }
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/emision]", error)
    return NextResponse.json(
      {
        ok:    false,
        error: error?.message ?? "Error al actualizar el dictamen",
      },
      { status: 500 }
    )
  }
}