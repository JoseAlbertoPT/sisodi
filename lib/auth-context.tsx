"use client"
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"

const IDLE_MS = 60 * 60 * 1000

interface User {
  id: string
  nombre: string
  correo: string
  rfc: string
  rol: string
  area: string | null
  secretariaTexto: string | null
  secretariaId: string | null
  organoNombre: string | null
  claveReportePlazas: string | null
  mustChangePassword: boolean
  tipoAdministracion: "centralizada" | "paraestatal"
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (rfc: string, password: string) => Promise<{ mustChangePassword: boolean } | null>
  logout: () => void
  changePassword: (rfc: string, nuevaPassword: string) => Promise<void>
}

export const AUTH_KEY = "sdtf_user"
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      if (stored) setUser(JSON.parse(stored) as User)
    } catch {
      localStorage.removeItem(AUTH_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  
  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_KEY)
    }
  }, [user])

  const login = async (
    rfc: string,
    password: string
  ): Promise<{ mustChangePassword: boolean } | null> => {
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc, password }),
      })
      if (!res.ok) return null
      const data: User = await res.json()
      if (!data.mustChangePassword) {
        setUser(data)
        sessionStorage.setItem("sdtf_just_logged_in", "1")
      }
      return { mustChangePassword: data.mustChangePassword }
    } catch {
      return null
    }
  }

  const changePassword = async (rfc: string, nuevaPassword: string): Promise<void> => {
    const res = await fetch("/api/auth?action=change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc, nuevaPassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Error al cambiar contraseña")
    }
    if (user) setUser({ ...user, mustChangePassword: false })
  }

  const logout = useCallback(() => setUser(null), [])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, IDLE_MS)
    }

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, logout])

  useEffect(() => {
    if (!user) return
    const userId = user.id
    const es = new EventSource("/api/events")
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { forceLogout?: string[] }
        if (Array.isArray(data.forceLogout) && data.forceLogout.includes(userId)) {
          logout()
        }
      } catch {}
    }
    return () => es.close()
  }, [user?.id, logout])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}