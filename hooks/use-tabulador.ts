"use client"

import { useEffect, useState } from "react"
import type { RangoTabulador } from "@/lib/tabulador"
import { useRealtime } from "@/hooks/use-realtime"

interface TabuladorRow {
  id: number
  nivel: string
  categoria: string
  importeBrutoMin: number
  importeBrutoMax: number
  secretarias: string[]
}

/**
 * Trae el tabulador (nivel/categoría/importe mínimo/máximo) registrado en
 * Configuración > Tabulador para el AÑO EN CURSO (igual que el Calendario), para
 * "Equivalencia al Tabulador" en Nueva Solicitud y la reutilización de
 * Catálogo. Solo muestra spinner/loading en la carga inicial — refrescos en
 * segundo plano (tiempo real) no ocultan los rangos ya cargados (mismo
 * criterio que lib/calendario-store.tsx, para no parpadear mientras alguien
 * llena el formulario).
 */
export function useTabulador(): { rangos: RangoTabulador[]; loading: boolean } {
  const [rangos, setRangos] = useState<RangoTabulador[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = useState(false)

  const cargar = () => {
    fetch(`/api/tabulador?ejercicio=${new Date().getFullYear()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.ok) return
        const rows: TabuladorRow[] = json.tabulador ?? []
        setRangos(rows.map((r) => ({ nivel: r.nivel, categoria: r.categoria, min: r.importeBrutoMin, max: r.importeBrutoMax, secretarias: r.secretarias ?? [] })))
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setLoadedOnce(true) })
  }

  useEffect(() => { cargar() }, [])
  useRealtime(["tabulador"], () => { if (loadedOnce) cargar() })

  return { rangos, loading }
}
