"use client"

import { createContext, useContext, useState, ReactNode } from "react"

// Tipos
  username: string
  role: string
  mustChangePassword: boolean
}

interface UpdatePasswordResult {
  success: boolean
  message?: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => boolean
  logout: () => void
  updatePassword: (currentPassword: string, newPassword: string) => UpdatePasswordResult
}

// Simulacion de BD
interface MockUser {
  username: string
  password: string
  role: string
  mustChangePassword: boolean
}

const MOCK_USERS: MockUser[] = [
  {
    username: "admin",
    password: "admin123",
    role: "Administrador",
    mustChangePassword: false,
  },
  {
    username: "dictaminador01",
    password: "Temp2024!",
    role: "Dictaminador",
    mustChangePassword: true,
  },
  {
    username: "supervisor",
    password: "Sup3rvisor#",
    role: "Supervisor",
    mustChangePassword: false,
  },
]

// CONST
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [usersState, setUsersState] = useState<MockUser[]>(MOCK_USERS)

  const login = (username: string, password: string): boolean => {
    const found = usersState.find(
      (u) => u.username === username && u.password === password
    )
    if (!found) return false

    setUser({
      username: found.username,
      role: found.role,
      mustChangePassword: found.mustChangePassword,
    })
    return true
  }

  const logout = () => {
    setUser(null)
  }

  const updatePassword = (
    currentPassword: string,
    newPassword: string
  ): UpdatePasswordResult => {
    if (!user) return { success: false, message: "No hay sesión activa" }

    const found = usersState.find((u) => u.username === user.username)
    if (!found) return { success: false, message: "Usuario no encontrado" }

    if (found.password !== currentPassword) {
      return { success: false, message: "La contraseña temporal es incorrecta" }
    }

    if (newPassword === currentPassword) {
      return {
        success: false,
        message: "La nueva contraseña no puede ser igual a la temporal",
      }
    }
    setUsersState((prev) =>
      prev.map((u) =>
        u.username === user.username
          ? { ...u, password: newPassword, mustChangePassword: false }
          : u
      )
    )
    // Actualizar el usuario en sesión
    setUser((prev) =>
      prev ? { ...prev, mustChangePassword: false } : null
    )
    return { success: true }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  }
  return context
}