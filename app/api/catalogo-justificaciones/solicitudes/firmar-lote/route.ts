import { NextRequest, NextResponse } from "next/server"
import { requireSesion, verificarActor } from "@/lib/session"
import { puedeVerSolicitudesCatalogo } from "@/lib/api-guard"
import { alcanceSolicitudesCatalogo } from "@/lib/catalogo-solicitud-acceso"
import { credencialesDelBody, firmarSolicitudCatalogoEmisor } from "@/lib/catalogo-firma-emisor"
import { broadcastUpdate } from "@/lib/sse-manager"

export const runtime = "nodejs"

const MAX_POR_LOTE = 50

/**
 * Vo.Bo. del Emisor de varias solicitudes con una sola captura de e.firma.
 * Se firman una por una (en serie, para no saturar el servicio de firma del
 * gobierno); una que falle no detiene las demás. Devuelve el resultado de cada
 * una para que la pantalla indique cuáles quedaron pendientes.
 */
export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const body = await req.json().catch(() => ({}))
  const usuarioId = body?.usuario_id ? String(body.usuario_id) : null
  const actorErr = verificarActor(sesion, usuarioId)
  if (actorErr) return actorErr
  if (!(await puedeVerSolicitudesCatalogo(usuarioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const alcance = await alcanceSolicitudesCatalogo(usuarioId!)
  if (!alcance.verTodas) {
    return NextResponse.json({ error: "Solo un usuario con rol Emisor o Administrador puede dar el Vo.Bo." }, { status: 403 })
  }
  const cred = credencialesDelBody(body)
  if (!cred.cargo) {
    return NextResponse.json({ error: "Falta el cargo/puesto de quien firma." }, { status: 400 })
  }

  const ids: number[] = Array.isArray(body?.ids)
    ? [...new Set<number>(body.ids.map(Number).filter((n: number) => Number.isInteger(n)))]
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos una solicitud." }, { status: 400 })
  }
  if (ids.length > MAX_POR_LOTE) {
    return NextResponse.json({ error: `Se pueden firmar máximo ${MAX_POR_LOTE} solicitudes a la vez.` }, { status: 400 })
  }

  const resultados: { id: number; ok: boolean; error?: string }[] = []
  for (const id of ids) {
    const r = await firmarSolicitudCatalogoEmisor(id, usuarioId!, alcance, cred)
    resultados.push(r.ok ? { id, ok: true } : { id, ok: false, error: r.error })
  }

  if (resultados.some((r) => r.ok)) broadcastUpdate(["catalogo"])
  return NextResponse.json({
    ok: true,
    firmadas: resultados.filter((r) => r.ok).length,
    fallidas: resultados.filter((r) => !r.ok).length,
    resultados,
  })
}
