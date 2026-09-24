import { NextRequest, NextResponse } from "next/server"
import { requireSesion, verificarActor } from "@/lib/session"
import { puedeFirmarVerificacion } from "@/lib/api-guard"

// Chequeo en vivo (no depende del snapshot de login guardado en localStorage), para que un
// cambio de permiso hecho por un Administrador se refleje sin que el usuario afectado tenga
// que cerrar sesión y volver a entrar.
export async function GET(req: NextRequest) {
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion

  const userId = req.nextUrl.searchParams.get("userId")
  // El id que manda el cliente debe ser el de la sesión (lib/session.ts).
  const actorErr = verificarActor(sesion, userId)
  if (actorErr) return actorErr
  const puede = await puedeFirmarVerificacion(userId)
  return NextResponse.json({ puede })
}
