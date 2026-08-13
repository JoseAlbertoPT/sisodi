import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Verifica que el usuario que ejecuta una acción exista en la base.
 *
 * Si no existe (caso típico: sesión vieja guardada en el navegador tras un
 * resembrado/migración de la base donde los ids de usuario cambiaron), devuelve una
 * `NextResponse` 401 con `sessionInvalid: true` para que el frontend fuerce el
 * re-login, en vez de dejar que la operación reviente más abajo con el error de
 * llave foránea `historial_solicitud_usuario_id_fkey`.
 *
 * Devuelve `null` si el usuario es válido (la acción puede continuar).
 *
 * Uso en un handler:
 *   const sesionErr = await checkSesionUsuario(usuarioId)
 *   if (sesionErr) return sesionErr
 */
export async function checkSesionUsuario(
  usuarioId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!usuarioId) {
    return NextResponse.json(
      {
        ok: false,
        sessionInvalid: true,
        error: "Tu sesión ya no es válida. Cierra sesión y vuelve a iniciar sesión.",
      },
      { status: 401 },
    )
  }

  const existe = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { id: true },
  })

  if (!existe) {
    return NextResponse.json(
      {
        ok: false,
        sessionInvalid: true,
        error: "Tu sesión ya no es válida: el usuario no existe en el sistema. Cierra sesión y vuelve a iniciar sesión.",
      },
      { status: 401 },
    )
  }

  return null
}
