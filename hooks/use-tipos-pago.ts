"use client"

import { useEffect, useState } from "react"
import { useRealtime } from "@/hooks/use-realtime"
import { TIPOS_PAGO_DEFAULT, type TipoPago } from "@/lib/tipos-pago"

/**
 * Catálogo de Configuración > Tipos de pago, para el combo "Tipo de Pago" de
 * Nueva Solicitud. Incluye los eliminados (`activo: false`) para poder mostrar
 * el nombre en solicitudes que ya los usan; el combo solo ofrece los activos.
 * Mientras carga (o si falla) usa los tipos que antes estaban fijos.
 */
export function useTiposPago(): { tipos: TipoPago[]; loading: boolean; error: string | null; recargar: () => void } {
  const [tipos, setTipos] = useState<TipoPago[]>(TIPOS_PAGO_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    fetch("/api/tipos-pago", { cache: "no-store" })
      .then((r) => r.json().catch(() => null))
      .then((json) => {
        if (!json?.ok || !Array.isArray(json.tipos)) throw new Error(json?.error || "No se pudieron cargar los tipos de pago")
        setError(null)
        if (json.tipos.length > 0) setTipos(json.tipos)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los tipos de pago"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])
  useRealtime(["tipos-pago"], cargar)

  return { tipos, loading, error, recargar: cargar }
}
