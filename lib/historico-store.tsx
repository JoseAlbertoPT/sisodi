"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { HistoricoRow } from "./parse-excel-historico"
import * as historicoApi from "./historico-api"

export interface HistoricoRecord {
  id: string
  nombreArchivo: string
  subidoEn: string
  sheetNames: string[]
  sheets: Record<string, HistoricoRow[]>
}

interface HistoricoStoreValue {
  historicos: HistoricoRecord[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  uploadHistorico: (file: File) => Promise<HistoricoRecord>
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

  useEffect(() => {
    refetch()
  }, [refetch])

  const uploadHistorico = useCallback(
    async (file: File): Promise<HistoricoRecord> => {
      const record = await historicoApi.uploadHistorico(file)
      await refetch()
      return record
    },
    [refetch]
  )

  const getHistoricoById = useCallback(
    (id: string): HistoricoRecord | undefined => historicos.find((h) => h.id === id),
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
    () => ({
      historicos,
      loading,
      error,
      refetch,
      uploadHistorico,
      getHistoricoById,
      removeHistorico,
    }),
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
