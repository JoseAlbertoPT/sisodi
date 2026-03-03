"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Eye, EyeOff } from "lucide-react"

export function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!username || !password) {
      setError("Por favor complete todos los campos")
      return
    }
    const success = login(username, password)
    if (!success) {
      setError("Credenciales incorrectas")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card shadow-lg">
          {/* Header institucional */}
          <div className="flex flex-col items-center gap-4 border-b border-border bg-primary px-8 py-8 rounded-t-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Shield className="h-8 w-8 text-accent-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold text-primary-foreground">
                Sistema de Dictaminacion
              </h1>
              <p className="text-sm text-primary-foreground/70">
                Tecnica Funcional
              </p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-8 py-8">
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="username" className="text-sm font-medium text-card-foreground">
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background border-input"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-sm font-medium text-card-foreground">
                Contrasena
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5">
              Ingresar
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-secondary hover:text-accent hover:underline transition-colors"
              >
                Recuperar contrasena
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="border-t border-border px-8 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Sistema Institucional v1.0 - Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
