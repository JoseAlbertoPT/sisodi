"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"

export interface PermisoCaptura {
  id: number
  userId: string          
  regimen: "honorarios" | "asimilados" | "nombramiento"
  periodo: string
  active: boolean
  used: boolean
  grantedAt: string
  grantedBy: string
  consumedAt: string | null
}

interface PermisosContextType {
  permisos: PermisoCaptura[]
  habilitarPermiso: (data: {
    userId: string
    regimen: "honorarios" | "asimilados" | "nombramiento"
    periodo: string
    grantedBy: string
  }) => Promise<void>
  revocarPermiso: (id: number) => Promise<void>
  getPermisoActivo: (userId: string, regimen: string, periodo: string) => PermisoCaptura | null
  consumirPermiso: (userId: string, regimen: string, periodo: string) => Promise<void>
  getPermisosUsuario: (userId: string) => PermisoCaptura[]
  recargar: () => Promise<void>
}

const PermisosContext = createContext<PermisosContextType | undefined>(undefined)

export function AutorizacionesProvider({ children }: { children: ReactNode }) {
  const [permisos, setPermisos] = useState<PermisoCaptura[]>([])
  // La API exige sesión: se carga (y recarga) al iniciar sesión, no al montar
  // el layout — antes del login la petición solo devolvería 401.
  const { user } = useAuth()
  const userId = user?.id ?? null

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/permisos-captura")
      if (res.ok) setPermisos(await res.json())
    } catch {  }
  }, [])

  useEffect(() => {
    if (!userId) { setPermisos([]); return }
    void recargar()
  }, [recargar, userId])

  // Sincronización en tiempo real: cuando cualquier sesión otorga, revoca o consume
  // un permiso, el servidor emite "permisos-captura" por SSE y todos los clientes recargan.
  useEffect(() => {
    const es = new EventSource("/api/events")
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { apartados?: string[] }
        if (data.apartados?.includes("permisos-captura")) {
          void recargar()
        }
      } catch {}
    }
    return () => es.close()
  }, [recargar])

  const habilitarPermiso = useCallback(async (data: {
    userId: string
    regimen: "honorarios" | "asimilados" | "nombramiento"
    periodo: string
    grantedBy: string
  }) => {
    const res = await fetch("/api/permisos-captura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: data.userId, regimen: data.regimen, periodo: data.periodo, grantedBy: data.grantedBy }),
    })
    if (!res.ok) throw new Error("Error al otorgar permiso")
    const created: PermisoCaptura = await res.json()
    setPermisos((prev) => [
      
      ...prev.map((p) =>
        p.userId === data.userId && p.regimen === data.regimen && p.periodo === data.periodo && p.active && !p.used
          ? { ...p, active: false } : p
      ),
      created,
    ])
  }, [])

  const revocarPermiso = useCallback(async (id: number) => {
    const res = await fetch(`/api/permisos-captura/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    })
    if (!res.ok) throw new Error("Error al revocar permiso")
    setPermisos((prev) => prev.map((p) => p.id === id ? { ...p, active: false } : p))
  }, [])

  const consumirPermiso = useCallback(async (userId: string, regimen: string, periodo: string) => {
    const permiso = permisos.find(
      (p) => p.userId === userId && p.regimen === regimen && p.periodo === periodo && p.active && !p.used
    )
    if (!permiso) return
    const res = await fetch(`/api/permisos-captura/${permiso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "consume" }),
    })
    if (!res.ok) throw new Error("Error al consumir permiso")
    setPermisos((prev) => prev.map((p) => p.id === permiso.id ? { ...p, active: false, used: true } : p))
  }, [permisos])

  const getPermisoActivo = useCallback((userId: string, regimen: string, periodo: string): PermisoCaptura | null => {
    return permisos.find(
      (p) => p.userId === userId && p.regimen === regimen && p.periodo === periodo && p.active && !p.used
    ) ?? null
  }, [permisos])

  const getPermisosUsuario = useCallback((userId: string): PermisoCaptura[] => {
    return permisos.filter((p) => p.userId === userId)
  }, [permisos])

  return (
    <PermisosContext.Provider value={{
      permisos, habilitarPermiso, revocarPermiso, getPermisoActivo,
      consumirPermiso, getPermisosUsuario, recargar,
    }}>
      {children}
    </PermisosContext.Provider>
  )
}

export function useAutorizaciones() {
  const ctx = useContext(PermisosContext)
  if (!ctx) throw new Error("useAutorizaciones must be inside AutorizacionesProvider")
  return ctx
}
