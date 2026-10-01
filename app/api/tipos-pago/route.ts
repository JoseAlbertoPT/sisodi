import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, CONFIGURACION_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { claveDesdeNombre, mapTipoPago, normalizarNombreTipoPago, NOMBRE_TIPO_PAGO_MAX } from "@/lib/tipos-pago"

/** Todos los tipos, incluidos los eliminados (`activo: false`): el formulario
 *  los necesita para mostrar el nombre en solicitudes que ya los usan. */
export async function GET() {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const rows = await prisma.tipo_pago.findMany({ orderBy: [{ orden: "asc" }, { id: "asc" }] })
    return NextResponse.json({ ok: true, tipos: rows.map(mapTipoPago) })
  } catch (e) {
    console.error("[GET /api/tipos-pago]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const body = await req.json().catch(() => null)
    const nombre = normalizarNombreTipoPago(body?.nombre)
    const usaTabulador = body?.usaTabulador !== false

    if (!nombre) return NextResponse.json({ ok: false, error: "El nombre es requerido" }, { status: 400 })
    if (nombre.length > NOMBRE_TIPO_PAGO_MAX) {
      return NextResponse.json({ ok: false, error: `El nombre no puede exceder ${NOMBRE_TIPO_PAGO_MAX} caracteres` }, { status: 400 })
    }

    const clave = claveDesdeNombre(nombre)
    const activos = await prisma.tipo_pago.findMany({ where: { activo: true }, select: { nombre: true, clave: true } })
    if (activos.some((t) => t.clave.toLowerCase() === clave.toLowerCase() || t.nombre.toLowerCase() === nombre.toLowerCase())) {
      return NextResponse.json({ ok: false, error: `Ya existe el tipo de pago "${nombre}"` }, { status: 409 })
    }

    const { _max } = await prisma.tipo_pago.aggregate({ _max: { orden: true } })
    const orden = (_max.orden ?? 0) + 1
    // Un tipo eliminado con la misma clave se reactiva en lugar de duplicarse
    // (la clave es única y puede seguir usada en solicitudes).
    const row = await prisma.tipo_pago.upsert({
      where: { clave },
      create: { clave, nombre, usa_tabulador: usaTabulador, orden },
      update: { nombre, usa_tabulador: usaTabulador, orden, activo: true },
    })
    broadcastUpdate(["tipos-pago"])
    return NextResponse.json({ ok: true, tipo: mapTipoPago(row) }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/tipos-pago]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
