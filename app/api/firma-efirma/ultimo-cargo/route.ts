import { NextRequest, NextResponse } from "next/server"
import { mensajePublico } from "@/lib/error-publico"
import { requireSesion, verificarActor } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  try {
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get("usuarioId")
    // El id que manda el cliente debe ser el de la sesión (lib/session.ts).
    const actorErr = verificarActor(sesion, usuarioId)
    if (actorErr) return actorErr
    if (!usuarioId) {
      return NextResponse.json({ ok: false, error: "Falta usuarioId" }, { status: 400 })
    }

    // El cargo capturado en el perfil del usuario (ver Usuarios > Cargo) es la
    // fuente preferida: es el que un administrador dio de alta a propósito para
    // que se precargue al firmar. Solo si el usuario no tiene cargo en su
    // perfil caemos al último cargo que usó en una firma anterior.
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { cargo: true },
    })
    if (usuario?.cargo) {
      return NextResponse.json({ ok: true, cargo: usuario.cargo, fecha: null })
    }

    const ultima = await prisma.firma_firmante.findFirst({
      where: {
        usuario_id: usuarioId,
        firmado: true,
        cargo_firmante: { not: null },
      },
      orderBy: { fecha_firma: "desc" },
      select: { cargo_firmante: true, fecha_firma: true },
    })

    return NextResponse.json({
      ok: true,
      cargo: ultima?.cargo_firmante ?? null,
      fecha: ultima?.fecha_firma ?? null,
    })
  } catch (error: any) {
    console.error("[GET /api/firma-efirma/ultimo-cargo]", error)
    return NextResponse.json({ ok: false, error: mensajePublico(error, "Error") }, { status: 500 })
  }
}
