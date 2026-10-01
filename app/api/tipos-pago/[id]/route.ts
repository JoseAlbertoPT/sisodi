import { NextRequest, NextResponse } from "next/server"
import { requireSesion } from "@/lib/session"
import { requireMenu, CONFIGURACION_MENU_KEY } from "@/lib/api-guard"
import { prisma } from "@/lib/prisma"
import { broadcastUpdate } from "@/lib/sse-manager"
import { mapTipoPago, normalizarNombreTipoPago, NOMBRE_TIPO_PAGO_MAX } from "@/lib/tipos-pago"

/** Edita nombre y si usa tabulador. La clave no cambia: ya está guardada en solicitudes. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })

    const body = await req.json().catch(() => null)
    const nombre = normalizarNombreTipoPago(body?.nombre)
    const usaTabulador = body?.usaTabulador !== false

    if (!nombre) return NextResponse.json({ ok: false, error: "El nombre es requerido" }, { status: 400 })
    if (nombre.length > NOMBRE_TIPO_PAGO_MAX) {
      return NextResponse.json({ ok: false, error: `El nombre no puede exceder ${NOMBRE_TIPO_PAGO_MAX} caracteres` }, { status: 400 })
    }

    const actual = await prisma.tipo_pago.findUnique({ where: { id }, select: { id: true } })
    if (!actual) return NextResponse.json({ ok: false, error: "Tipo de pago no encontrado" }, { status: 404 })

    const otros = await prisma.tipo_pago.findMany({ where: { activo: true, NOT: { id } }, select: { nombre: true } })
    if (otros.some((t) => t.nombre.toLowerCase() === nombre.toLowerCase())) {
      return NextResponse.json({ ok: false, error: `Ya existe el tipo de pago "${nombre}"` }, { status: 409 })
    }

    const row = await prisma.tipo_pago.update({ where: { id }, data: { nombre, usa_tabulador: usaTabulador } })
    broadcastUpdate(["tipos-pago"])
    return NextResponse.json({ ok: true, tipo: mapTipoPago(row) })
  } catch (e) {
    console.error("[PUT /api/tipos-pago/[id]]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

/** Solo desactiva: las solicitudes que ya usan la clave la siguen mostrando. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  const sinPermiso = await requireMenu(sesion.id, CONFIGURACION_MENU_KEY)
  if (sinPermiso) return sinPermiso

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })

    const actual = await prisma.tipo_pago.findUnique({ where: { id }, select: { id: true } })
    if (!actual) return NextResponse.json({ ok: false, error: "Tipo de pago no encontrado" }, { status: 404 })

    const quedan = await prisma.tipo_pago.count({ where: { activo: true, NOT: { id } } })
    if (quedan === 0) {
      return NextResponse.json({ ok: false, error: "Debe quedar al menos un tipo de pago" }, { status: 400 })
    }

    await prisma.tipo_pago.update({ where: { id }, data: { activo: false } })
    broadcastUpdate(["tipos-pago"])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/tipos-pago/[id]]", e)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
