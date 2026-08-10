import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    // Acota el seguimiento al ámbito del usuario que consulta: centralizado
    // (registros sin tipo se tratan como centralizada) o paraestatal.
    const viewerId = req.nextUrl.searchParams.get("viewerId")
    let tipoAdminFilter: Record<string, unknown> = {}
    if (viewerId) {
      const viewer = await prisma.usuario.findUnique({
        where:  { id: viewerId },
        select: { organo_centralizado: { select: { id: true } } },
      })
      if (viewer) {
        tipoAdminFilter = viewer.organo_centralizado
          ? { tipo_administracion: { not: "paraestatal" } }
          : { tipo_administracion: "paraestatal" }
      }
    }

    const solicitudes = await prisma.solicitud.findMany({
      where: tipoAdminFilter,
      orderBy: { fecha_creacion: "desc" },
      include: {
        estado: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
        revisor_asignado: { select: { id: true, nombre: true } },
      },
    })

    const data = solicitudes.map(s => {
      const estadoNombre = s.estado?.nombre ?? ""
      const etapa = mapEtapa(estadoNombre)
      const responsable = resolverResponsable(s, estadoNombre)
      return {
        id: s.id,
        folio_recepcion: s.folio_recepcion,
        folio_justificacion: s.folio_justificacion,
        folio_dictamen: s.folio_dictamen,
        tipo_solicitud: s.tipo_solicitud,
        denominacion: s.denominacion,
        secretaria: s.secretaria,
        regimen: s.regimen,
        fecha_creacion: s.fecha_creacion,
        fecha_envio: s.fecha_envio,
        fecha_emision: s.fecha_emision,
        estado: estadoNombre,
        etapa,
        responsable,
        es_emitida: etapa === "emitido",
      }
    })

    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    console.error("[solicitudes-seguimiento]", err)
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

function mapEtapa(estado: string): string {
  const n = estado.toLowerCase()
  if (n.includes("captura") || n === "borrador") return "captura"
  if (n.includes("validacion justificaciones") || n.includes("observado por validacion") && !n.includes("final")) return "uefa"
  if (n.includes("pendiente do") || n.includes("en revision revisor") || n.includes("observado por revisor") ||
      n.includes("aceptado por revisor") || n.includes("aprobado por revisor")) return "revisor"
  if (n.includes("en validacion final") || n.includes("observado por validacion final")) return "validador"
  if (n.includes("en revision emisor") || n.includes("observado por emisor")) return "emisor"
  if (n.includes("pendiente firma dictamen") || n.includes("pendiente firma justificacion")) return "firmado"
  if (n.includes("emitido")) return "emitido"
  if (n.includes("rechazado")) return "rechazado"
  return "captura"
}

function resolverResponsable(s: any, estado: string): { nombre: string; detalle: string } {
  const n = estado.toLowerCase()
  const etapa = mapEtapa(estado)

  if (s.revisor_asignado?.nombre) {
    return { nombre: s.revisor_asignado.nombre, detalle: etapaLabel(etapa) }
  }
  if (n.includes("captura") || n === "borrador") {
    return { nombre: s.usuario?.nombre ?? "—", detalle: "URG (captura)" }
  }
  return { nombre: "Sin asignar", detalle: etapaLabel(etapa) }
}

function etapaLabel(etapa: string): string {
  switch (etapa) {
    case "captura":   return "Captura"
    case "uefa":      return "Validación UEFA"
    case "revisor":   return "Revisor (Filtro 1)"
    case "validador": return "Validador (Filtro 2)"
    case "emisor":    return "Emisor (Filtro 3)"
    case "firmado":   return "Proceso de firma"
    case "emitido":   return "Dictamen emitido"
    case "rechazado": return "Rechazado"
    default:          return ""
  }
}
