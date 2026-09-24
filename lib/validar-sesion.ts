import { NextResponse } from "next/server"
import { requireSesion, verificarActor } from "@/lib/session"

/**
 * Verifica que el usuario que ejecuta una acción exista en la base y que su
 * sesión no haya expirado por inactividad.
 *
 * Si no existe (caso típico: sesión vieja guardada en el navegador tras un
 * resembrado/migración de la base donde los ids de usuario cambiaron), o si
 * pasó más de 30 min desde su última actividad registrada (`ultima_actividad`,
 * que el cliente refresca en cada interacción real vía POST /api/auth?action=heartbeat),
 * devuelve una `NextResponse` 401 con `sessionInvalid: true` para que el
 * frontend fuerce el re-login, en vez de dejar que la operación reviente más
 * abajo con el error de llave foránea `historial_solicitud_usuario_id_fkey`.
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

  // La identidad sale de la cookie de sesión (lib/session.ts), no del
  // usuarioId que manda el cliente: ese id solo se acepta si coincide con el
  // de la sesión. Existencia, cuenta activa e inactividad ya las valida
  // requireSesion.
  const sesion = await requireSesion()
  if (sesion instanceof NextResponse) return sesion
  return verificarActor(sesion, usuarioId)
}
