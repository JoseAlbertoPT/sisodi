"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// ── Per-user capture permission (1 use) ──
export interface PermisoCaptura {
  userId: string          // user name (matches auth user.name)
  regimen: "honorarios" | "asimilados" | "nombramiento"
  periodo: string         // e.g. "Enero", "1ra Enero", etc.
  active: boolean         // true = granted, not yet consumed
  used: boolean           // true = consumed by a submission
  grantedAt: string
  grantedBy: string
  consumedAt: string | null
}

// ── Context type ──
interface PermisosContextType {
  permisos: PermisoCaptura[]
  /** DO grants a single-use permission to a user */
  habilitarPermiso: (data: {
    userId: string
    regimen: "honorarios" | "asimilados" | "nombramiento"
    periodo: string
    grantedBy: string
  }) => void
  /** DO revokes a permission before it is used */
  revocarPermiso: (userId: string, regimen: string, periodo: string) => void
  /** Check if user has an active permission for exact regimen+periodo */
  getPermisoActivo: (userId: string, regimen: string, periodo: string) => PermisoCaptura | null
  /** Consume the permission (mark used) – called on submit to UEFA */
  consumirPermiso: (userId: string, regimen: string, periodo: string) => void
  /** Get all permissions for a user (for UI display in usuarios page) */
  getPermisosUsuario: (userId: string) => PermisoCaptura[]
}

const PermisosContext = createContext<PermisosContextType | undefined>(undefined)

// ── Seed: Maria Lopez has an active permission (for demo) ──
const SEED_PERMISOS: PermisoCaptura[] = [
  {
    userId: "Maria Lopez",
    regimen: "asimilados",
    periodo: "1ra Enero",
    active: true,
    used: false,
    grantedAt: "2026-02-19 10:00",
    grantedBy: "Director Operativo",
    consumedAt: null,
  },
]

// ── Provider ──
export function AutorizacionesProvider({ children }: { children: ReactNode }) {
  const [permisos, setPermisos] = useState<PermisoCaptura[]>(SEED_PERMISOS)

  const habilitarPermiso = useCallback((data: {
    userId: string
    regimen: "honorarios" | "asimilados" | "nombramiento"
    periodo: string
    grantedBy: string
  }) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    setPermisos((prev) => {
      // Remove any existing active permission for same user+regimen+periodo
      const filtered = prev.filter(
        (p) => !(p.userId === data.userId && p.regimen === data.regimen && p.periodo === data.periodo && p.active && !p.used)
      )
      return [
        ...filtered,
        {
          userId: data.userId,
          regimen: data.regimen,
          periodo: data.periodo,
          active: true,
          used: false,
          grantedAt: now,
          grantedBy: data.grantedBy,
          consumedAt: null,
        },
      ]
    })
  }, [])

  const revocarPermiso = useCallback((userId: string, regimen: string, periodo: string) => {
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.userId === userId && p.regimen === regimen && p.periodo === periodo && p.active && !p.used) {
          return { ...p, active: false }
        }
        return p
      })
    )
  }, [])

  const getPermisoActivo = useCallback((userId: string, regimen: string, periodo: string): PermisoCaptura | null => {
    return permisos.find(
      (p) => p.userId === userId && p.regimen === regimen && p.periodo === periodo && p.active && !p.used
    ) || null
  }, [permisos])

  const consumirPermiso = useCallback((userId: string, regimen: string, periodo: string) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.userId === userId && p.regimen === regimen && p.periodo === periodo && p.active && !p.used) {
          return { ...p, active: false, used: true, consumedAt: now }
        }
        return p
      })
    )
  }, [])

  const getPermisosUsuario = useCallback((userId: string): PermisoCaptura[] => {
    return permisos.filter((p) => p.userId === userId)
  }, [permisos])

  return (
    <PermisosContext.Provider
      value={{
        permisos,
        habilitarPermiso,
        revocarPermiso,
        getPermisoActivo,
        consumirPermiso,
        getPermisosUsuario,
      }}
    >
      {children}
    </PermisosContext.Provider>
  )
}

export function useAutorizaciones() {
  const ctx = useContext(PermisosContext)
  if (!ctx) throw new Error("useAutorizaciones must be inside AutorizacionesProvider")
  return ctx
}
