import { NextRequest, NextResponse } from "next/server"
import { puedeAdministrarCatalogo, puedeConsultarCatalogo } from "@/lib/api-guard"

// Chequeo en vivo (no depende del snapshot de login guardado en localStorage), para que un
// cambio de permiso hecho por un Administrador se refleje sin que el usuario afectado tenga
// que cerrar sesión y volver a entrar.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  const [puede, puedeConsultar] = await Promise.all([
    puedeAdministrarCatalogo(userId),
    puedeConsultarCatalogo(userId),
  ])
  return NextResponse.json({ puede, puedeConsultar })
}
