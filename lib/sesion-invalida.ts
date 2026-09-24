"use client"

import { AUTH_KEY } from "@/lib/auth-context"

/**
 * `true` si la respuesta del backend indica que la sesión ya no es válida
 * (el usuario guardado en el navegador no existe en la base). El backend lo
 * marca con `sessionInvalid: true` (ver `lib/validar-sesion.ts`).
 */
export function esSesionInvalida(json: unknown): boolean {
  return !!(
    json &&
    typeof json === "object" &&
    (json as { sessionInvalid?: unknown }).sessionInvalid === true
  )
}

let yaRedirigiendo = false

/**
 * Limpia la sesión guardada y recarga la página para volver al login.
 * Funciona fuera de React (no necesita el hook `useAuth`), así se puede invocar
 * desde cualquier manejador de respuesta o desde el interceptor global. Al
 * recargar, `app/page.tsx` ve que ya no hay sesión y muestra `<LoginForm />`.
 *
 * Es idempotente: si ya se disparó (p. ej. desde el interceptor global y desde el
 * manejador de una acción a la vez), las llamadas siguientes se ignoran para no
 * mostrar el aviso ni recargar dos veces.
 */
export function forzarReLogin(mensaje?: string): void {
  if (yaRedirigiendo) return
  // Sin sesión guardada ya se está en el login: las cargas globales que corren
  // antes de iniciar sesión (calendario, permisos de captura...) reciben 401 y
  // no deben disparar el aviso ni recargar en bucle.
  try { if (!localStorage.getItem(AUTH_KEY)) return } catch { /* noop */ }
  yaRedirigiendo = true
  try { localStorage.removeItem(AUTH_KEY) } catch { /* noop */ }
  try { sessionStorage.removeItem("sdtf_just_logged_in") } catch { /* noop */ }
  if (mensaje) { try { alert(mensaje) } catch { /* noop */ } }
  window.location.reload()
}
