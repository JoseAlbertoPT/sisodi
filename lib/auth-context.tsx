"use client"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface User {
  id: string
  nombre: string
  correo: string
  rfc: string
  rol: string
  area: string | null
  secretariaTexto: string | null
  secretariaId: string | null
  claveReportePlazas: string | null
  mustChangePassword: boolean
  tipoAdministracion: "centralizada" | "paraestatal"
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (rfc: string, password: string) => Promise<{ mustChangePassword: boolean } | null>
  logout: () => void
  changePassword: (rfc: string, nuevaPassword: string) => Promise<void>
}

const AUTH_KEY = "sdtf_user"
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  // Cargar sesión desde localStorage solo en el cliente
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      if (stored) setUser(JSON.parse(stored) as User)
    } catch {
      localStorage.removeItem(AUTH_KEY)
    }
  }, [])

  // Sincronizar localStorage cuando cambia el usuario
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
      setUser(data)
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

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout, changePassword }}
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