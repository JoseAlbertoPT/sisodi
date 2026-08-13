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

/**
 * Limpia la sesión guardada y recarga la página para volver al login.
 * Funciona fuera de React (no necesita el hook `useAuth`), así se puede invocar
 * desde cualquier manejador de respuesta. Al recargar, `app/page.tsx` ve que ya
 * no hay sesión y muestra `<LoginForm />`.
 */
export function forzarReLogin(mensaje?: string): void {
  try { localStorage.removeItem(AUTH_KEY) } catch { /* noop */ }
  try { sessionStorage.removeItem("sdtf_just_logged_in") } catch { /* noop */ }
  if (mensaje) { try { alert(mensaje) } catch { /* noop */ } }
  window.location.reload()
}
