"use client"

import { useEffect, useState } from "react"

/**
 * Consulta "Programa o Proyecto" contra SIGeF filtrado por Secretaría. Mientras
 * la Secretaría no tenga un idDependencia de SIGeF configurado (`configured:
 * false`), quien consuma este hook decide el fallback (catálogo local,
 * mensaje de "sin programas disponibles", etc.) — no es un error en sí mismo.
 */
export function useProgramasSigef(secretaria: string): {
  proyectos: { value: string; label: string }[]
  cargando: boolean
  configured: boolean
  error: string | null
} {
  const [proyectos, setProyectos] = useState<{ value: string; label: string }[]>([])
  const [cargando, setCargando] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!secretaria) { setProyectos([]); setConfigured(false); setError(null); return }
    const controller = new AbortController()
    setCargando(true)
    setError(null)
    fetch(`/api/sigef/proyectos?secretaria=${encodeURIComponent(secretaria)}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => null)
        if (!r.ok) throw new Error(data?.error ?? `SIGeF respondió HTTP ${r.status}`)
        return data
      })
      .then((d) => {
        if (controller.signal.aborted) return
        setConfigured(!!d?.configured)
        setProyectos(d?.proyectos ?? [])
      })
      .catch((e) => {
        if (e?.name === "AbortError") return
        setConfigured(false)
        setProyectos([])
        setError(e instanceof Error ? e.message : "No se pudo consultar SIGeF")
      })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [secretaria])

  return { proyectos, cargando, configured, error }
}
