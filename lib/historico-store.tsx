"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { HistoricoRow } from "./parse-excel-historico"
import * as historicoApi from "./historico-api"
import { useAuth } from "@/lib/auth-context"

export interface HistoricoRecord {
  id: string
  nombreArchivo: string
  subidoEn: string
  sheetNames: string[]
  sheets: Record<string, HistoricoRow[]>
  
  nombreArchivo2: string | null
  sheetNames2: string[] | null
  sheets2: Record<string, HistoricoRow[]> | null
}

interface HistoricoStoreValue {
  historicos: HistoricoRecord[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  uploadHistorico: (file: File, file2?: File | null) => Promise<HistoricoRecord>
  getHistoricoById: (id: string) => HistoricoRecord | undefined
  removeHistorico: (id: string) => Promise<void>
}

const HistoricoStoreContext = createContext<HistoricoStoreValue | null>(null)

export function HistoricoStoreProvider({ children }: { children: ReactNode }) {
  const [historicos, setHistoricos] = useState<HistoricoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await historicoApi.fetchHistoricos()
      setHistoricos(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar historicos")
      setHistoricos([])
    } finally {
      setLoading(false)
    }
  }, [])

  // La API exige sesión: se carga al iniciar sesión (antes del login solo
  // devolvería 401).
  const { user } = useAuth()
  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) { setHistoricos([]); return }
    refetch()
  }, [refetch, userId])

  const uploadHistorico = useCallback(
    async (file: File, file2?: File | null): Promise<HistoricoRecord> => {
      const record = await historicoApi.uploadHistorico(file, file2)
      await refetch()
      return record
    },
    [refetch]
  )

  const getHistoricoById = useCallback(
    (id: string) => historicos.find((h) => h.id === id),
    [historicos]
  )

  const removeHistorico = useCallback(
    async (id: string) => {
      await historicoApi.deleteHistorico(id)
      await refetch()
    },
    [refetch]
  )

  const value = useMemo<HistoricoStoreValue>(
    () => ({ historicos, loading, error, refetch, uploadHistorico, getHistoricoById, removeHistorico }),
    [historicos, loading, error, refetch, uploadHistorico, getHistoricoById, removeHistorico]
  )

  return (
    <HistoricoStoreContext.Provider value={value}>
      {children}
    </HistoricoStoreContext.Provider>
  )
}

export function useHistoricoStore(): HistoricoStoreValue {
  const ctx = useContext(HistoricoStoreContext)
  if (!ctx) throw new Error("useHistoricoStore must be used within HistoricoStoreProvider")
  return ctx
}