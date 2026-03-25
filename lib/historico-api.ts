"use client"

import type { HistoricoRow } from "./parse-excel-historico"

export interface HistoricoRecord {
  id: string
  nombreArchivo: string
  subidoEn: string
  sheetNames: string[]
  sheets: Record<string, HistoricoRow[]>
}

export async function uploadHistorico(file: File): Promise<HistoricoRecord> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/historico", {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Error al guardar historico")
  }
  return res.json()
}

export async function fetchHistoricos(): Promise<HistoricoRecord[]> {
  const res = await fetch("/api/historico")
  if (!res.ok) throw new Error("Error al cargar historicos")
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchHistoricoById(id: string): Promise<HistoricoRecord | null> {
  const res = await fetch(`/api/historico/${id}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error("Error al cargar historico")
  }
  return res.json()
}

export async function deleteHistorico(id: string): Promise<void> {
  const res = await fetch(`/api/historico/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Error al eliminar historico")
}
