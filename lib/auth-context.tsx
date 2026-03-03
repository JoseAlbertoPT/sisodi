"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface User {
  name: string
  role: string
  email: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = (username: string, _password: string) => {
    // Prototipo: cualquier credencial funciona
    setUser({
      name: username || "Admin Usuario",
      role: "Director Operativo",
      email: `${username.toLowerCase().replace(/\s/g, ".")}@gobierno.gob.mx`,
    })
    return true
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
