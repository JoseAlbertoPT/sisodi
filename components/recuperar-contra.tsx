"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, ArrowLeft, Mail, CheckCircle2, KeyRound } from "lucide-react"
type Step = "email" | "code" | "newPassword" | "success"
interface RecuperarContraProps {
  onBack?: () => void
}
export function RecuperarContra({ onBack }: RecuperarContraProps) {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const VALID_CODE = "123456"

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !email.includes("@")) {
      setError("Por favor ingrese un correo electrónico válido")
      return
    }
    setLoading(true)
    // Simular envío de correo
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setStep("code")
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!code || code.length < 6) {
      setError("Por favor ingrese el código de 6 dígitos")
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    if (code !== VALID_CODE) {
      setError("Código incorrecto. Verifique e intente de nuevo")
      return
    }
    setStep("newPassword")
  }
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!newPassword || newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    setStep("success")
  }
  const stepConfig = {
    email: { num: 1, label: "Verificando Correo" },
    code: { num: 2, label: "Código de Verificación" },
    newPassword: { num: 3, label: "Nueva Contraseña" },
    success: { num: 4, label: "Completado" },
  }
  const steps = ["email", "code", "newPassword", "success"] as Step[]
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
                Recuperar Contraseña
              </h1>
              <p className="text-sm text-primary-foreground/70">
                Sistema de Dictaminación Técnica Funcional
              </p>
            </div>
          </div>
          {/* Stepper */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-2 px-8 pt-6">
              {steps.slice(0, 3).map((s, i) => {
                const currentIndex = steps.indexOf(step)
                const isDone = i < currentIndex
                const isActive = i === currentIndex
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : isActive
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < 2 && (
                      <div
                        className={`h-0.5 w-10 transition-colors ${
                          isDone ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Contenido por paso */}
          <div className="px-8 py-6">

            {/* PASO 1 - Email */}
            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-card-foreground">Verificar identidad</h2>
                  <p className="text-sm text-muted-foreground">
                    Ingrese su correo institucional y le enviaremos un código de verificación.
                  </p>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-sm font-medium text-card-foreground">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@institucion.gob.mx"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background border-input pl-9"/>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
                >
                  {loading ? "Enviando..." : "Enviar código"}
                </Button>
              </form>
            )}

            {/* PASO 2 - Código */}
            {step === "code" && (
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-card-foreground">Código de verificación</h2>
                  <p className="text-sm text-muted-foreground">
                    Se envió un código de 6 dígitos a <span className="font-medium text-card-foreground">{email}</span>.
                    Ingréselo a continuación. <span className="text-xs text-muted-foreground">(Demo: 123456)</span>
                  </p>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="code" className="text-sm font-medium text-card-foreground">
                    Código
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="bg-background border-input text-center tracking-widest text-lg font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
                >
                  {loading ? "Verificando..." : "Verificar código"}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setError("") }}
                  className="text-sm text-secondary hover:text-accent hover:underline transition-colors text-center"
                >
                  Cambiar correo electrónico
                </button>
              </form>
            )}

            {/* PASO 3 - Nueva contraseña */}
            {step === "newPassword" && (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-card-foreground">Nueva contraseña</h2>
                  <p className="text-sm text-muted-foreground">
                    Cree una nueva contraseña segura para su cuenta.
                  </p>
                </div>
                {error && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-card-foreground">
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-background border-input pl-9"
                    />
                  </div>
                  {newPassword && (
                    <div className="flex gap-1 mt-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            newPassword.length === 0 ? "bg-muted" :
                            newPassword.length < 6 ? (i < 1 ? "bg-destructive" : "bg-muted") :
                            newPassword.length < 8 ? (i < 2 ? "bg-yellow-500" : "bg-muted") :
                            newPassword.length < 12 ? (i < 3 ? "bg-green-400" : "bg-muted") :
                            "bg-green-500"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-card-foreground">
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita su contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-background border-input pl-9"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
                >
                  {loading ? "Guardando..." : "Guardar contraseña"}
                </Button>
              </form>
            )}
            {/* ÉXITO */}
            {step === "success" && (
              <div className="flex flex-col items-center gap-5 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-card-foreground">Contraseña actualizada</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Su contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión con sus nuevas credenciales.
                  </p>
                </div>
                <Button
                  onClick={onBack}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
                >
                  Ir al inicio de sesión
                </Button>
              </div>
            )}
          </div>

          {/* Back link */}
          {step !== "success" && (
            <div className="border-t border-border px-8 py-4 flex justify-between items-center">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </button>
              <p className="text-xs text-muted-foreground">Paso {stepConfig[step].num} de 3</p>
            </div>
          )}

          {step === "success" && (
            <div className="border-t border-border px-8 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Sistema Institucional — Todos los derechos reservados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}