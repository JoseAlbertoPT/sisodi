import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Debe coincidir con IDLE_MS en lib/auth-context.tsx — este es el respaldo
// del lado del servidor: el navegador cierra sesión por su cuenta a los 30
// minutos de inactividad, pero si por lo que sea esa lógica no corre (equipo
// suspendido, pestaña congelada, etc.), esta validación igual rechaza la
// petición en cuanto `ultima_actividad` quedó demasiado vieja.
const IDLE_MS = 30 * 60 * 1000

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

  const existe = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { id: true, ultima_actividad: true },
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

  // Si no hay marca (fila antigua sin pasar por login, o mock de prueba que
  // no la incluye) se asume recién activa en vez de expirada — evita falsos
  // rechazos; en uso real siempre queda seteada desde el login.
  const ultima = existe.ultima_actividad?.getTime() ?? Date.now()
  if (Date.now() - ultima >= IDLE_MS) {
    return NextResponse.json(
      {
        ok: false,
        sessionInvalid: true,
        error: "Tu sesión expiró por inactividad. Vuelve a iniciar sesión.",
      },
      { status: 401 },
    )
  }

  return null
}
