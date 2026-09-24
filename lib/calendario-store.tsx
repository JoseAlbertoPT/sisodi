"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import {
  fetchCalendario,
  type CalendarioResponse,
  type PeriodoCap3000,
  type PeriodoCap1000,
} from "@/lib/calendario-api"
import { parseDateDMY } from "@/lib/calendario-recepcion-mock"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/lib/auth-context"

export type RegimenPeriodo = "honorarios" | "asimilados" | "nombramiento"

export interface PeriodoVigenciaResult {
  vigente: boolean
  limiteDO: string | null
}

interface CalendarioContextType {
  ejercicio: number
  setEjercicio: (year: number) => void
  honorarios: PeriodoCap3000[]
  asimilados: PeriodoCap1000[]
  nombramiento: PeriodoCap1000[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  isPeriodoVigente: (
    regimen: RegimenPeriodo,
    periodoSeleccionado: string,
    fechaHoy?: Date,
  ) => PeriodoVigenciaResult
}

const CalendarioContext = createContext<CalendarioContextType | undefined>(undefined)

const DEFAULT_EJERCICIO = 2026

function emptyResponse(): CalendarioResponse {
  return { honorarios: [], asimilados: [], nombramiento: [] }
}

export function CalendarioProvider({ children }: { children: ReactNode }) {
  const [ejercicio, setEjercicioState] = useState(DEFAULT_EJERCICIO)
  const [data, setData] = useState<CalendarioResponse>(emptyResponse)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Recuerda para qué ejercicio ya se cargaron datos, para no volver a mostrar
  // el spinner de carga en refrescos silenciosos (tiempo real / polling) del
  // mismo año — solo al cambiar de ejercicio o en la carga inicial.
  const loadedEjercicioRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const isNuevoEjercicio = loadedEjercicioRef.current !== ejercicio
    if (isNuevoEjercicio) setLoading(true)
    setError(null)
    try {
      const res = await fetchCalendario(ejercicio)
      setData(res)
      loadedEjercicioRef.current = ejercicio
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar calendario")
      if (isNuevoEjercicio) setData(emptyResponse())
    } finally {
      if (isNuevoEjercicio) setLoading(false)
    }
  }, [ejercicio])

  // La API exige sesión: se carga al iniciar sesión (antes del login solo
  // devolvería 401).
  const { user } = useAuth()
  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return
    load()
  }, [load, userId])

  const refetch = useCallback(async () => {
    await load()
  }, [load])

  // Refleja en vivo un cambio guardado desde Calendario (por este u otro
  // usuario) sin que haga falta recargar la página.
  useRealtime(["calendario"], refetch)

  const setEjercicio = useCallback((year: number) => {
    setEjercicioState(year)
  }, [])

  const isPeriodoVigente = useCallback(
    (
      regimen: RegimenPeriodo,
      periodoSeleccionado: string,
      fechaHoy?: Date,
    ): PeriodoVigenciaResult => {
      const today = fechaHoy ?? new Date()
      today.setHours(0, 0, 0, 0)

      let row: { limiteDO: string } | undefined

      if (regimen === "honorarios") {
        row = data.honorarios.find((r) => r.mes === periodoSeleccionado)
      } else {
        const table = regimen === "asimilados" ? data.asimilados : data.nombramiento
        row = table.find((r) => r.quincena === periodoSeleccionado)
      }

      if (!row) return { vigente: false, limiteDO: null }

      const limiteDODate = parseDateDMY(row.limiteDO)
      return { vigente: today <= limiteDODate, limiteDO: row.limiteDO }
    },
    [data.honorarios, data.asimilados, data.nombramiento],
  )

  const value: CalendarioContextType = {
    ejercicio,
    setEjercicio,
    honorarios: data.honorarios,
    asimilados: data.asimilados,
    nombramiento: data.nombramiento,
    loading,
    error,
    refetch,
    isPeriodoVigente,
  }

  return (
    <CalendarioContext.Provider value={value}>
      {children}
    </CalendarioContext.Provider>
  )
}

export function useCalendario(): CalendarioContextType {
  const ctx = useContext(CalendarioContext)
  if (ctx === undefined) {
    throw new Error("useCalendario must be used within CalendarioProvider")
  }
  return ctx
}
