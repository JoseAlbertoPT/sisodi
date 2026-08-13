"use client"

import { useEffect } from "react"
import { esSesionInvalida, forzarReLogin } from "@/lib/sesion-invalida"

/**
 * Intercepta globalmente las respuestas `fetch` de la app. Si alguna acción del
 * backend responde con `sessionInvalid: true` (usuario de la sesión ya no existe,
 * ver `lib/validar-sesion.ts`), limpia la sesión y manda al login — sin importar
 * desde qué página se haya llamado.
 *
 * Guarda tightly: solo actúa en respuestas 401 con cuerpo JSON, así no interfiere
 * con navegación RSC de Next ni con descargas/streams. Clona la respuesta para no
 * consumir el cuerpo que espera quien hizo el `fetch`.
 */
export function SessionInvalidWatcher() {
  useEffect(() => {
    const original = window.fetch
    // Evita doble parcheo si el componente se remonta.
    if ((window.fetch as { __sdtfPatched?: boolean }).__sdtfPatched) return

    const patched: typeof window.fetch = async (...args) => {
      const res = await original(...args)
      try {
        if (res.status === 401) {
          const ct = res.headers.get("content-type") ?? ""
          if (ct.includes("application/json")) {
            const data = await res.clone().json().catch(() => null)
            if (esSesionInvalida(data)) {
              forzarReLogin((data as { error?: string })?.error)
            }
          }
        }
      } catch { /* noop: nunca romper la petición original */ }
      return res
    }
    ;(patched as { __sdtfPatched?: boolean }).__sdtfPatched = true
    window.fetch = patched

    return () => { window.fetch = original }
  }, [])

  return null
}
