"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Shield, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, KeyRound,
  ArrowLeft, IdCard, Mail,
} from "lucide-react"

// rfc + correo + codigo
function ModalRecuperarContrasena({ onClose }: { onClose: () => void }) {
  type Paso = "rfc" | "codigo" | "nueva" | "exito"

  const [paso,           setPaso]           = useState<Paso>("rfc")
  const [rfc,            setRfc]            = useState("")
  const [rfcError,       setRfcError]       = useState("")
  const [rfcLoading,     setRfcLoading]     = useState(false)
  const [correoMascara,  setCorreoMascara]  = useState("****@****.***")

  const [codigo,         setCodigo]         = useState(["", "", "", "", "", ""])
  const [codigoError,    setCodigoError]    = useState("")
  const [codigoLoading,  setCodigoLoading]  = useState(false)
  const [resendTimer,    setResendTimer]    = useState(0)
  const [timerActive,    setTimerActive]    = useState(false)

  const [nuevaPassword,  setNuevaPassword]  = useState("")
  const [confirmar,      setConfirmar]      = useState("")
  const [showNueva,      setShowNueva]      = useState(false)
  const [showConfirmar,  setShowConfirmar]  = useState(false)
  const [saveError,      setSaveError]      = useState("")
  const [saveLoading,    setSaveLoading]    = useState(false)

  const rfcRegex   = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i
  const rfcValido  = rfcRegex.test(rfc.trim())

  const reglas = [
    { label: "Mínimo 8 caracteres",       ok: nuevaPassword.length >= 8 },
    { label: "Al menos una mayúscula",    ok: /[A-Z]/.test(nuevaPassword) },
    { label: "Al menos un número",        ok: /[0-9]/.test(nuevaPassword) },
    { label: "Las contraseñas coinciden", ok: nuevaPassword.length > 0 && nuevaPassword === confirmar },
  ]
  const todasOk        = reglas.every((r) => r.ok)
  const codigoCompleto = codigo.every((d) => d !== "")

  // Temporizador reenvío
  const iniciarTemporizador = () => {
    setResendTimer(60)
    setTimerActive(true)
    const iv = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(iv); setTimerActive(false); return 0 }
        return t - 1
      })
    }, 1000)
  }

  // ── Paso 1: verificar efc
  const handleValidarRfc = async () => {
    setRfcError("")
    if (!rfcValido) { setRfcError("Ingrese un RFC válido (ej. ABCD850101XYZ)."); return }
    setRfcLoading(true)
    try {
      const res  = await fetch("/api/auth?action=recuperar-rfc", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rfc: rfc.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setRfcError(data.error); return }
      setCorreoMascara(data.correoMascarado)
      iniciarTemporizador()
      setPaso("codigo")
    } catch {
      setRfcError("Error de conexión. Intente de nuevo.")
    } finally {
      setRfcLoading(false)
    }
  }

  // ── Paso 2: verificar codigo
  const handleVerificarCodigo = async () => {
    setCodigoError("")
    if (!codigoCompleto) { setCodigoError("Ingrese el código de 6 dígitos completo."); return }
    setCodigoLoading(true)
    try {
      const res  = await fetch("/api/auth?action=recuperar-codigo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rfc: rfc.trim().toUpperCase(), codigo: codigo.join("") }),
      })
      const data = await res.json()
      if (!res.ok) { setCodigoError(data.error); return }
      setPaso("nueva")
    } catch {
      setCodigoError("Error de conexión. Intente de nuevo.")
    } finally {
      setCodigoLoading(false)
    }
  }

  const handleReenviar = async () => {
    if (timerActive) return
    const res  = await fetch("/api/auth?action=recuperar-rfc", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rfc: rfc.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (res.ok) setCorreoMascara(data.correoMascarado)
    setCodigo(["", "", "", "", "", ""])
    iniciarTemporizador()
  }

  const handleCodigoChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...codigo]
    next[index] = value
    setCodigo(next)
    setCodigoError("")
    if (value && index < 5) document.getElementById(`code-${index + 1}`)?.focus()
  }

  const handleCodigoKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codigo[index] && index > 0)
      document.getElementById(`code-${index - 1}`)?.focus()
  }

  // ── Paso 3: guardar nueva contraseña
  const handleGuardar = async () => {
    setSaveError("")
    if (!todasOk) { setSaveError("Por favor cumpla todos los requisitos."); return }
    setSaveLoading(true)
    try {
      const res  = await fetch("/api/auth?action=recuperar-reset", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rfc: rfc.trim().toUpperCase(), nuevaPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error); return }
      setPaso("exito")
    } catch {
      setSaveError("Error de conexión. Intente de nuevo.")
    } finally {
      setSaveLoading(false)
    }
  }

  //  Indicador de pasos
  const pasoNumero = { rfc: 1, codigo: 2, nueva: 3, exito: 3 }[paso]

  const StepIndicator = () => (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n, i) => (
        <div key={n} className="contents">
          {i > 0 && (
            <div className={`h-px flex-1 ${n <= pasoNumero ? "bg-secondary/50" : "bg-border"}`} />
          )}
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
            ${n < pasoNumero
              ? "bg-secondary text-secondary-foreground"
              : n === pasoNumero
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {n < pasoNumero ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={paso === "exito" ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

        {/* Cabecera */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-primary">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            {paso === "rfc"    && <IdCard      className="h-5 w-5 text-primary-foreground" />}
            {paso === "codigo" && <Mail        className="h-5 w-5 text-primary-foreground" />}
            {paso === "nueva"  && <Lock        className="h-5 w-5 text-primary-foreground" />}
            {paso === "exito"  && <CheckCircle2 className="h-5 w-5 text-primary-foreground" />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-primary-foreground">Recuperar contraseña</span>
            <span className="text-xs text-primary-foreground/70">
              {paso === "rfc"    && "Verifique su identidad con su RFC"}
              {paso === "codigo" && "Código enviado a su correo"}
              {paso === "nueva"  && "Establezca su nueva contraseña"}
              {paso === "exito"  && "Contraseña actualizada exitosamente"}
            </span>
          </div>
        </div>

        {/* ── PASO 1 · RFC ── */}
        {paso === "rfc" && (
          <>
            <div className="flex flex-col gap-5 px-6 py-6">
              <StepIndicator />
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ingrese su RFC para verificar su identidad. Le enviaremos un código de
                  verificación al correo registrado en el sistema.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">RFC</Label>
                <Input
                  type="text"
                  placeholder="Ejemplo. ABCD850101XYZ"
                  value={rfc}
                  onChange={(e) => { setRfc(e.target.value.toUpperCase()); setRfcError("") }}
                  className="bg-background uppercase tracking-widest"
                  maxLength={13}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Formato: 4 letras + 6 dígitos + 3 caracteres (persona física) ·{" "}
                  3 letras + 6 dígitos + 3 caracteres (moral)
                </p>
              </div>
              {rfcError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-xs text-destructive">{rfcError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={onClose} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />Cancelar
              </Button>
              <Button
                onClick={handleValidarRfc}
                disabled={!rfcValido || rfcLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {rfcLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Verificando…
                  </span>
                ) : "Verificar RFC"}
              </Button>
            </div>
          </>
        )}

        {/* ── PASO 2 · CÓDIGO ── */}
        {paso === "codigo" && (
          <>
            <div className="flex flex-col gap-5 px-6 py-6">
              <StepIndicator />
              <div className="flex items-start gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3">
                <Mail className="h-4 w-4 shrink-0 text-secondary mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Se envió un código de 6 dígitos a{" "}
                  <span className="font-semibold text-card-foreground">{correoMascara}</span>.
                  Revise su bandeja de entrada o spam.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Código de verificación</Label>
                <div className="flex gap-2 justify-center">
                  {codigo.map((digit, i) => (
                    <input
                      key={i}
                      id={`code-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodigoChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodigoKeyDown(i, e)}
                      className="w-11 h-14 text-center text-xl font-semibold border border-border rounded-lg bg-background text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                  ))}
                </div>
              </div>
              <div className="text-center">
                {timerActive ? (
                  <span className="text-xs text-muted-foreground">
                    Reenviar código en{" "}
                    <span className="font-semibold text-card-foreground">{resendTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleReenviar}
                    className="text-xs text-secondary hover:text-accent hover:underline transition-colors"
                  >
                    Reenviar código
                  </button>
                )}
              </div>
              {codigoError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-xs text-destructive">{codigoError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setPaso("rfc")} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />Atrás
              </Button>
              <Button
                onClick={handleVerificarCodigo}
                disabled={!codigoCompleto || codigoLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {codigoLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Verificando…
                  </span>
                ) : "Verificar código"}
              </Button>
            </div>
          </>
        )}

        {/* ── PASO 3 · NUEVA CONTRASEÑA ── */}
        {paso === "nueva" && (
          <>
            <div className="flex flex-col gap-5 px-6 py-6">
              <StepIndicator />
              <div className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Identidad verificada</span>
                  <span className="text-sm font-medium text-card-foreground tracking-widest">{rfc}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    type={showNueva ? "text" : "password"}
                    placeholder="Ingrese su nueva contraseña"
                    value={nuevaPassword}
                    onChange={(e) => { setNuevaPassword(e.target.value); setSaveError("") }}
                    className="bg-background pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNueva(!showNueva)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    type={showConfirmar ? "text" : "password"}
                    placeholder="Repita su nueva contraseña"
                    value={confirmar}
                    onChange={(e) => { setConfirmar(e.target.value); setSaveError("") }}
                    className="bg-background pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirmar(!showConfirmar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {nuevaPassword.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex flex-col gap-2">
                  {reglas.map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${r.ok ? "bg-secondary" : "bg-muted-foreground/40"}`} />
                      <span className={`text-xs ${r.ok ? "text-secondary font-medium" : "text-muted-foreground"}`}>{r.label}</span>
                      {r.ok && <CheckCircle2 className="h-3 w-3 text-secondary ml-auto shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-xs text-destructive">{saveError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setPaso("codigo")} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />Atrás
              </Button>
              <Button
                onClick={handleGuardar}
                disabled={!todasOk || saveLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saveLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Guardando…
                  </span>
                ) : <><CheckCircle2 className="mr-1.5 h-4 w-4" />Guardar contraseña</>}
              </Button>
            </div>
          </>
        )}

        {/* ── PASO 4 · ÉXITO ── */}
        {paso === "exito" && (
          <>
            <div className="flex flex-col items-center gap-4 px-6 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15">
                <CheckCircle2 className="h-9 w-9 text-secondary" />
              </div>
              <span className="text-base font-semibold text-card-foreground">¡Contraseña actualizada!</span>
              <span className="text-sm text-muted-foreground text-center max-w-xs">
                Su contraseña fue restablecida exitosamente. Ya puede iniciar sesión con sus nuevas credenciales.
              </span>
            </div>
            <div className="flex justify-center px-6 py-4 border-t border-border bg-muted/20">
              <Button onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
                Ir al inicio de sesión
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Modal cambio de contraseña (primer ingreso)
function ModalCambioContrasena({
  username,
  onSuccess,
  onCancel,
}: {
  username: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const { changePassword } = useAuth()

  const [nuevaPassword,     setNuevaPassword]     = useState("")
  const [confirmarPassword, setConfirmarPassword] = useState("")
  const [showNueva,         setShowNueva]         = useState(false)
  const [showConfirmar,     setShowConfirmar]     = useState(false)
  const [error,             setError]             = useState("")
  const [loading,           setLoading]           = useState(false)
  const [exito,             setExito]             = useState(false)

  const reglas = [
    { label: "Mínimo 8 caracteres",       ok: nuevaPassword.length >= 8 },
    { label: "Al menos una mayúscula",    ok: /[A-Z]/.test(nuevaPassword) },
    { label: "Al menos un número",        ok: /[0-9]/.test(nuevaPassword) },
    { label: "Las contraseñas coinciden", ok: nuevaPassword.length > 0 && nuevaPassword === confirmarPassword },
  ]
  const todasOk = reglas.every((r) => r.ok)

  const handleGuardar = async () => {
    setError("")
    if (!todasOk) { setError("Por favor cumpla todos los requisitos antes de continuar."); return }
    setLoading(true)
    try {
      await changePassword(username, nuevaPassword)
      setExito(true)
      setTimeout(() => onSuccess(), 1800)
    } catch {
      setError("Ocurrió un error al cambiar la contraseña. Intente de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-primary">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <KeyRound className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-primary-foreground">Cambio de contraseña requerido</span>
            <span className="text-xs text-primary-foreground/70">Debe establecer una nueva contraseña para continuar</span>
          </div>
        </div>

        {exito ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
              <CheckCircle2 className="h-8 w-8 text-secondary" />
            </div>
            <span className="text-base font-semibold text-card-foreground">¡Contraseña actualizada!</span>
            <span className="text-sm text-muted-foreground text-center">Su contraseña fue cambiada exitosamente. Ingresando al sistema…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-6 py-6">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Su cuenta fue creada con una contraseña temporal. Por seguridad, debe
                establecer una nueva contraseña personal antes de acceder al sistema.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-card-foreground">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showNueva ? "text" : "password"}
                  placeholder="Ingrese su nueva contraseña"
                  value={nuevaPassword}
                  onChange={(e) => { setNuevaPassword(e.target.value); setError("") }}
                  className="bg-background pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowNueva(!showNueva)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-card-foreground">Confirmar nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showConfirmar ? "text" : "password"}
                  placeholder="Repita su nueva contraseña"
                  value={confirmarPassword}
                  onChange={(e) => { setConfirmarPassword(e.target.value); setError("") }}
                  className="bg-background pr-10"
                />
                <button type="button" onClick={() => setShowConfirmar(!showConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {nuevaPassword.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex flex-col gap-2">
                {reglas.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${r.ok ? "bg-secondary" : "bg-muted-foreground/40"}`} />
                    <span className={`text-xs ${r.ok ? "text-secondary font-medium" : "text-muted-foreground"}`}>{r.label}</span>
                    {r.ok && <CheckCircle2 className="h-3 w-3 text-secondary ml-auto shrink-0" />}
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <span className="text-xs text-destructive">{error}</span>
              </div>
            )}
          </div>
        )}

        {!exito && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <Button variant="outline" onClick={onCancel} disabled={loading}>Cerrar sesión</Button>
            <Button onClick={handleGuardar} disabled={!todasOk || loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Guardando…
                </span>
              ) : <><CheckCircle2 className="mr-1.5 h-4 w-4" />Guardar contraseña</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function LoginForm() {
  const { login, logout } = useAuth()

  const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i

  const [rfc,          setRfc]          = useState("")
  const [password,     setPassword]     = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)

  const [mostrarModalCambio,    setMostrarModalCambio]    = useState(false)
  const [mostrarModalRecuperar, setMostrarModalRecuperar] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!rfc || !password) {
      setError("Por favor complete todos los campos")
      setLoading(false)
      return
    }
    if (!rfcRegex.test(rfc.trim())) {
      setError("Ingrese un RFC válido (ej. ABCD850101XYZ).")
      setLoading(false)
      return
    }

    try {
      const result = await login(rfc.trim().toUpperCase(), password)
      if (!result) {
        setError("Credenciales incorrectas")
        return
      }
      if (result.mustChangePassword) {
        setMostrarModalCambio(true)
      }
    } catch {
      setError("Error de conexión. Intente de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-card shadow-lg">

            <div className="flex flex-col items-center gap-4 border-b border-border bg-primary px-8 py-8 rounded-t-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <Shield className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-semibold text-primary-foreground">Sistema de Dictaminacion</h1>
                <p className="text-sm text-primary-foreground/70">Tecnica Funcional</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-8 py-8">
              {error && (
                <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="rfc" className="text-sm font-medium text-card-foreground">RFC</Label>
                <Input
                  id="rfc"
                  type="text"
                  placeholder="Ej. ABCD850101XYZ"
                  value={rfc}
                  onChange={(e) => { setRfc(e.target.value.toUpperCase()); setError("") }}
                  className="bg-background border-input uppercase tracking-widest"
                  maxLength={13}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-sm font-medium text-card-foreground">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError("") }}
                    className="bg-background border-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Verificando…
                  </span>
                ) : "Ingresar"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMostrarModalRecuperar(true)}
                  className="text-sm text-secondary hover:text-accent hover:underline transition-colors"
                >
                  Recuperar contraseña
                </button>
              </div>
            </form>

            <div className="border-t border-border px-8 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Sistema Institucional v1.0 — Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </div>

      {mostrarModalCambio && (
        <ModalCambioContrasena
          username={rfc.trim().toUpperCase()}
          onSuccess={() => setMostrarModalCambio(false)}
          onCancel={() => {
            logout()
            setMostrarModalCambio(false)
            setRfc("")
            setPassword("")
          }}
        />
      )}

      {mostrarModalRecuperar && (
        <ModalRecuperarContrasena onClose={() => setMostrarModalRecuperar(false)} />
      )}
    </>
  )
}