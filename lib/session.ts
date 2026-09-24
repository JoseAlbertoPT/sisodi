import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

/**
 * Sesión del lado del servidor.
 *
 * Antes la identidad la declaraba el navegador (el `usuarioId` guardado en
 * localStorage viajaba en cada petición y el backend lo aceptaba tal cual), así
 * que cualquiera podía hacerse pasar por otro usuario cambiando ese valor. Ahora
 * el login emite una cookie HttpOnly con un token aleatorio y la identidad sale
 * SOLO de esa cookie; en la BD se guarda únicamente el hash del token.
 *
 * El frontend no necesita cambios para mandarla: `fetch`, `EventSource`,
 * `window.open` y los `<a href>` a /api la envían solos por ser mismo origen.
 */

export const SESSION_COOKIE = "sisodij_sid"

// Igual que IDLE_MS de lib/auth-context.tsx: inactividad máxima medida con
// usuario.ultima_actividad (la refresca el heartbeat del cliente).
const IDLE_MS = 30 * 60 * 1000
// Tope absoluto de una sesión aunque haya actividad continua.
const SESSION_MAX_MS = 12 * 60 * 60 * 1000

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export interface UsuarioSesion {
  id: string
  nombre: string
  rol: string
}

/** Detecta HTTPS también detrás del proxy (dev corre tras uno con TLS). */
function esHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (proto) return proto === "https"
  return req.nextUrl.protocol === "https:"
}

/** Crea la sesión en BD y pone la cookie en la respuesta. */
export async function iniciarSesion(res: NextResponse, req: NextRequest, usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex")
  const expiraEn = new Date(Date.now() + SESSION_MAX_MS)
  await prisma.sesion.create({ data: { usuario_id: usuarioId, token_hash: hashToken(token), expira_en: expiraEn } })
  // Limpieza oportunista de sesiones vencidas de este usuario.
  await prisma.sesion.deleteMany({ where: { usuario_id: usuarioId, expira_en: { lt: new Date() } } }).catch(() => {})
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Prod aún corre por HTTP plano: una cookie Secure no se guardaría ahí y
    // nadie podría iniciar sesión. Se marca Secure en cuanto la petición llega
    // por HTTPS (dev hoy; prod cuando infraestructura le ponga certificado).
    secure: esHttps(req),
    expires: expiraEn,
  })
}

/** Borra la sesión actual (logout). */
export async function cerrarSesion(res: NextResponse): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) await prisma.sesion.deleteMany({ where: { token_hash: hashToken(token) } }).catch(() => {})
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
}

/** Invalida todas las sesiones de un usuario (cambio de contraseña, rol, baja...). */
export async function cerrarSesionesDeUsuario(usuarioId: string): Promise<void> {
  await prisma.sesion.deleteMany({ where: { usuario_id: usuarioId } }).catch(() => {})
}

type ResultadoSesion =
  | { ok: true; usuario: UsuarioSesion }
  | { ok: false; motivo: "sin_sesion" | "inactividad" }

async function leerSesion(): Promise<ResultadoSesion> {
  let token: string | undefined
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value
  } catch {
    return { ok: false, motivo: "sin_sesion" }
  }
  if (!token) return { ok: false, motivo: "sin_sesion" }

  const sesion = await prisma.sesion.findUnique({
    where: { token_hash: hashToken(token) },
    select: {
      expira_en: true,
      usuario: {
        select: { id: true, nombre: true, activo: true, ultima_actividad: true, rol: { select: { nombre: true } } },
      },
    },
  })
  if (!sesion || sesion.expira_en < new Date() || sesion.usuario.activo === false) {
    return { ok: false, motivo: "sin_sesion" }
  }
  const ultima = sesion.usuario.ultima_actividad?.getTime() ?? Date.now()
  if (Date.now() - ultima >= IDLE_MS) return { ok: false, motivo: "inactividad" }

  return { ok: true, usuario: { id: sesion.usuario.id, nombre: sesion.usuario.nombre, rol: sesion.usuario.rol.nombre } }
}

export function respuestaSesionInvalida(error?: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      // Lo detecta components/session-invalid-watcher.tsx para mandar al login.
      sessionInvalid: true,
      error: error ?? "Por seguridad, vuelve a iniciar sesión.",
    },
    { status: 401 },
  )
}

/** Usuario de la sesión actual o `null` (sin respuesta de error). */
export async function usuarioDeSesion(): Promise<UsuarioSesion | null> {
  const r = await leerSesion()
  return r.ok ? r.usuario : null
}

/**
 * Exige una sesión válida. Devuelve el usuario o una respuesta 401 lista para
 * regresar desde el handler:
 *
 *   const sesion = await requireSesion()
 *   if (sesion instanceof NextResponse) return sesion
 */
export async function requireSesion(): Promise<UsuarioSesion | NextResponse> {
  const r = await leerSesion()
  if (r.ok) return r.usuario
  return respuestaSesionInvalida(
    r.motivo === "inactividad" ? "Tu sesión expiró por inactividad. Vuelve a iniciar sesión." : undefined,
  )
}

/**
 * Para ids que el cliente sigue mandando como "quién hace la acción"
 * (usuarioId, userId...): deben coincidir con el usuario de la sesión. El
 * frontend siempre manda el suyo, así que solo falla si alguien lo alteró o si
 * otra pestaña cambió de cuenta — en ambos casos se fuerza re-login.
 */
export function verificarActor(sesion: UsuarioSesion, idCliente: string | null | undefined): NextResponse | null {
  if (idCliente && String(idCliente) !== sesion.id) {
    return respuestaSesionInvalida("La sesión no corresponde al usuario. Vuelve a iniciar sesión.")
  }
  return null
}
