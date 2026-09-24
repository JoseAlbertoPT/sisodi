import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { firmanteId } = await req.json()
    if (!firmanteId) {
      return NextResponse.json({ ok: false, error: "Falta firmanteId" }, { status: 400 })
    }
    const idNum = Number(firmanteId)
    if (isNaN(idNum)) return NextResponse.json({ ok: false, error: "firmanteId inválido" }, { status: 400 })

    const firmante = await prisma.firma_firmante.findUnique({ where: { id: idNum } })
    if (!firmante)            return NextResponse.json({ ok: false, error: "Firmante no encontrado" }, { status: 404 })
    if (firmante.tipo !== "externo") return NextResponse.json({ ok: false, error: "Solo se pueden regenerar links de firmantes externos" }, { status: 400 })
    if (firmante.firmado)     return NextResponse.json({ ok: false, error: "El firmante ya firmó, no se puede regenerar" }, { status: 409 })

    const nuevoToken = randomBytes(32).toString("hex")
    await prisma.firma_firmante.update({
      where: { id: firmante.id },
      data: { acceso_token: nuevoToken, accedido_en: null, expira_en: null, session_id: null },
    })

    return NextResponse.json({ ok: true, acceso_token: nuevoToken })
  } catch (err: any) {
    console.error("[firma-efirma/regenerar-token]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
