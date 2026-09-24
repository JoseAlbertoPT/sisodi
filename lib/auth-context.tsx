"use client"
import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"

const IDLE_MS = 30 * 60 * 1000

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
  catalogoAdministracion: boolean
  catalogoConsulta: boolean
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (rfc: string, password: string) => Promise<{ mustChangePassword: boolean } | { error: string; retryAfterMs?: number }>
  logout: () => void
  changePassword: (rfc: string, passwordActual: string, nuevaPassword: string) => Promise<void>
}

export const AUTH_KEY = "sdtf_user"
const LAST_ACTIVITY_KEY = "sdtf_last_activity"
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
  ): Promise<{ mustChangePassword: boolean } | { error: string; retryAfterMs?: number }> => {
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) return { error: data?.error ?? "Credenciales incorrectas", retryAfterMs: data?.retryAfterMs }
      if (!(data as User).mustChangePassword) {
        setUser(data as User)
        sessionStorage.setItem("sdtf_just_logged_in", "1")
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      }
      return { mustChangePassword: (data as User).mustChangePassword }
    } catch {
      return { error: "Error de conexión. Intente de nuevo." }
    }
  }

  const changePassword = async (rfc: string, passwordActual: string, nuevaPassword: string): Promise<void> => {
    // El servidor exige la contraseña actual (antes bastaba el RFC).
    const res = await fetch("/api/auth?action=change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc, passwordActual, nuevaPassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Error al cambiar contraseña")
    }
    if (user) setUser({ ...user, mustChangePassword: false })
  }

  const logout = useCallback(() => {
    setUser(null)
    try { localStorage.removeItem(LAST_ACTIVITY_KEY) } catch { /* noop */ }
    // Borra la sesión del servidor (cookie HttpOnly, ver lib/session.ts).
    fetch("/api/auth?action=logout", { method: "POST" }).catch(() => { /* noop */ })
  }, [])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    const schedule = (remainingMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, Math.max(remainingMs, 0))
    }

    // No basta con reprogramar setTimeout: se pausa cuando el equipo se
    // suspende o la pestaña queda mucho tiempo en segundo plano, así que al
    // "despertar" seguía teniendo el hueco completo de 1h por delante sin
    // importar cuántos días reales hubieran pasado. Por eso se compara contra
    // una marca de tiempo real guardada en localStorage (compartida entre
    // pestañas) cada vez que la pestaña vuelve a estar activa.
    const verificarInactividad = () => {
      const ultima = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
      const transcurrido = Date.now() - ultima
      if (transcurrido >= IDLE_MS) { logout(); return }
      schedule(IDLE_MS - transcurrido)
    }

    // Respaldo en servidor (ver lib/validar-sesion.ts): el navegador puede
    // fallar en detectar la inactividad (pestaña congelada, equipo
    // suspendido), así que cada actividad real también refresca
    // `usuario.ultima_actividad` en la BD — con throttle para no mandar un
    // heartbeat en cada mousemove.
    let ultimoHeartbeat = 0
    const enviarHeartbeat = () => {
      const ahora = Date.now()
      if (ahora - ultimoHeartbeat < 60_000) return
      ultimoHeartbeat = ahora
      fetch("/api/auth?action=heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id }),
      }).catch(() => { /* noop: si falla, el próximo evento reintenta */ })
    }

    const marcarActividad = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      schedule(IDLE_MS)
      enviarHeartbeat()
    }

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const
    events.forEach((e) => window.addEventListener(e, marcarActividad, { passive: true }))
    document.addEventListener("visibilitychange", verificarInactividad)
    window.addEventListener("focus", verificarInactividad)

    verificarInactividad()

    return () => {
      events.forEach((e) => window.removeEventListener(e, marcarActividad))
      document.removeEventListener("visibilitychange", verificarInactividad)
      window.removeEventListener("focus", verificarInactividad)
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