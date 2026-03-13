"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react"

export function CambiarContrasena() {
  const { user, updatePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const getStrength = (pwd: string) => {
    if (!pwd) return 0
    if (pwd.length < 6) return 1
    if (pwd.length < 8) return 2
    if (pwd.length < 12) return 3
    return 4
  }

  const strengthLabels = ["", "Muy débil", "Débil", "Buena", "Fuerte"]
  const strengthColors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-400", "bg-green-500"]
  const strength = getStrength(newPassword)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!currentPassword) {
      setError("Ingrese su contraseña temporal actual")
      return
    }
    if (!newPassword || newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres")
      return
    }
    if (newPassword === currentPassword) {
      setError("La nueva contraseña no puede ser igual a la contraseña temporal")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))

    // Llamar al método del contexto de auth
    const result = updatePassword(currentPassword, newPassword)
    setLoading(false)

    if (!result.success) {
      setError(result.message || "Error al actualizar la contraseña")
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-card shadow-lg">
            <div className="flex flex-col items-center gap-4 border-b border-border bg-primary px-8 py-8 rounded-t-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <Shield className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-semibold text-primary-foreground">
                  Sistema de Dictaminación
                </h1>
                <p className="text-sm text-primary-foreground/70">Técnica Funcional</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5 px-8 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <h2 className="text-base font-semibold text-card-foreground">Contraseña actualizada</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Su contraseña ha sido configurada exitosamente. Bienvenido al sistema.
                </p>
              </div>
              <Button
                onClick={() => {
                  // El contexto de auth debería redirigir automáticamente al marcar mustChangePassword = false
                  // Si no, refrescar la página o redirigir manualmente
                  window.location.reload()
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
              >
                Continuar al sistema
              </Button>
            </div>
            <div className="border-t border-border px-8 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Sistema Institucional — Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card shadow-lg">

          {/* Header */}
          <div className="flex flex-col items-center gap-4 border-b border-border bg-primary px-8 py-8 rounded-t-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Shield className="h-8 w-8 text-accent-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold text-primary-foreground">
                Actualizar Contraseña
              </h1>
              <p className="text-sm text-primary-foreground/70">
                Sistema de Dictaminación Técnica Funcional
              </p>
            </div>
          </div>

          {/* Aviso */}
          <div className="mx-8 mt-6 flex items-start gap-3 rounded-md border border-yellow-300/50 bg-yellow-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Primer acceso al sistema</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Por seguridad, debe cambiar su contraseña temporal antes de continuar.
                {user?.username && (
                  <span className="font-medium"> Usuario: {user.username}</span>
                )}
              </p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-8 py-6">
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            {/* Contraseña temporal actual */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-card-foreground">
                Contraseña temporal actual
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Ingrese su contraseña temporal"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-background border-input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCurrent ? "Ocultar" : "Mostrar"}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-dashed border-border" />

            {/* Nueva contraseña */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-card-foreground">
                Nueva contraseña
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-background border-input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Indicador de fortaleza */}
              {newPassword && (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength ? strengthColors[strength] : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fortaleza: <span className="font-medium">{strengthLabels[strength]}</span>
                  </p>
                </div>
              )}

              {/* Requisitos */}
              <ul className="mt-1 space-y-1">
                {[
                  { ok: newPassword.length >= 8, label: "Mínimo 8 caracteres" },
                  { ok: /[A-Z]/.test(newPassword), label: "Una mayúscula" },
                  { ok: /[0-9]/.test(newPassword), label: "Un número" },
                ].map(({ ok, label }) => (
                  <li key={label} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 transition-colors ${
                        ok ? "text-green-500" : "text-muted-foreground/40"
                      }`}
                    />
                    <span className={ok ? "text-green-700" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmar contraseña */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-card-foreground">
                Confirmar nueva contraseña
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repita la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Las contraseñas coinciden
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
            >
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </form>

          {/* Footer */}
          <div className="border-t border-border px-8 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Sistema Institucional — Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}