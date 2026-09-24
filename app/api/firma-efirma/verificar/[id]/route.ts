import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Marca la firma de un externo (Elaboró / Vo. Bo. Jurídico) como verificada
// por el primer revisor interno (UEFA). Mientras un externo firmado no esté
// verificado, ningún firmante interno puede continuar (ver el chequeo de
// "anterioresPendientes" en /api/firma-efirma/firmar-interno).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { id } = await params
    const idNum = Number(id)
    if (!Number.isInteger(idNum)) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 })
    }

    const firmante = await prisma.firma_firmante.findUnique({ where: { id: idNum } })
    if (!firmante) return NextResponse.json({ ok: false, error: "Firmante no encontrado" }, { status: 404 })
    if (firmante.tipo !== "externo") {
      return NextResponse.json({ ok: false, error: "Solo se verifican firmas de externos" }, { status: 400 })
    }
    if (!firmante.firmado) {
      return NextResponse.json({ ok: false, error: "Este firmante todavía no ha firmado" }, { status: 400 })
    }

    const actualizado = await prisma.firma_firmante.update({
      where: { id: idNum },
      data: { verificado: true },
    })

    return NextResponse.json({ ok: true, firmante: { id: actualizado.id, verificado: actualizado.verificado } })
  } catch (err: any) {
    console.error("[PATCH /api/firma-efirma/verificar/:id]", err)
    return NextResponse.json({ ok: false, error: mensajePublico(err, "Error interno") }, { status: 500 })
  }
}
