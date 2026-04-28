"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Eye, EyeOff, Lock, CheckCircle2, AlertCircle, KeyRound,
  ArrowLeft, IdCard, Mail,
} from "lucide-react"
import Image from "next/image"

function ModalRecuperarContrasena({ onClose }: { onClose: () => void }) {
  type Paso = "rfc" | "codigo" | "nueva" | "exito"

  const [paso, setPaso] = useState<Paso>("rfc")
  const [rfc, setRfc] = useState("")
  const [rfcError, setRfcError] = useState("")
  const [rfcLoading, setRfcLoading] = useState(false)
  const [correoMascara, setCorreoMascara] = useState("****@****.***")

  const [codigo, setCodigo] = useState(["", "", "", "", "", ""])
  const [codigoError, setCodigoError] = useState("")
  const [codigoLoading, setCodigoLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)

  const [nuevaPassword, setNuevaPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)

  const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i
  const rfcValido = rfcRegex.test(rfc.trim())

  const reglas = [
    { label: "Mínimo 8 caracteres", ok: nuevaPassword.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(nuevaPassword) },
    { label: "Al menos un número", ok: /[0-9]/.test(nuevaPassword) },
    { label: "Las contraseñas coinciden", ok: nuevaPassword.length > 0 && nuevaPassword === confirmar },
  ]
  const todasOk = reglas.every((r) => r.ok)
  const codigoCompleto = codigo.every((d) => d !== "")

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

  const handleValidarRfc = async () => {
    setRfcError("")
    if (!rfcValido) { setRfcError("Ingrese un RFC válido (ej. ABCD850101XYZ)."); return }
    setRfcLoading(true)
    try {
      const res = await fetch("/api/auth?action=recuperar-rfc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: rfc.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setRfcError(data.error); return }
      setCorreoMascara(data.correoMascarado)
      iniciarTemporizador()
      setPaso("codigo")
    } catch { setRfcError("Error de conexión. Intente de nuevo.") }
    finally { setRfcLoading(false) }
  }

  const handleVerificarCodigo = async () => {
    setCodigoError("")
    if (!codigoCompleto) { setCodigoError("Ingrese el código de 6 dígitos completo."); return }
    setCodigoLoading(true)
    try {
      const res = await fetch("/api/auth?action=recuperar-codigo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: rfc.trim().toUpperCase(), codigo: codigo.join("") }),
      })
      const data = await res.json()
      if (!res.ok) { setCodigoError(data.error); return }
      setPaso("nueva")
    } catch { setCodigoError("Error de conexión. Intente de nuevo.") }
    finally { setCodigoLoading(false) }
  }

  const handleReenviar = async () => {
    if (timerActive) return
    const res = await fetch("/api/auth?action=recuperar-rfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc: rfc.trim().toUpperCase() }),
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

  const handleGuardar = async () => {
    setSaveError("")
    if (!todasOk) { setSaveError("Por favor cumpla todos los requisitos."); return }
    setSaveLoading(true)
    try {
      const res = await fetch("/api/auth?action=recuperar-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: rfc.trim().toUpperCase(), nuevaPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error); return }
      setPaso("exito")
    } catch { setSaveError("Error de conexión. Intente de nuevo.") }
    finally { setSaveLoading(false) }
  }

  const pasoNumero = { rfc: 1, codigo: 2, nueva: 3, exito: 3 }[paso]

  const StepIndicator = () => (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n, i) => (
        <div key={n} className="contents">
          {i > 0 && <div className={`h-px flex-1 ${n <= pasoNumero ? "bg-white/30" : "bg-white/10"}`} />}
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
            ${n < pasoNumero ? "bg-white/30 text-white" : n === pasoNumero ? "bg-white text-[#4A5249]" : "bg-white/10 text-white/50"}`}>
            {n < pasoNumero ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div
      className="relative flex min-h-screen items-center bg-cover bg-center bg-no-repeat px-6"
      style={{ backgroundImage: "url('/LOG-IN_SISODIJ-01.jpg')" }}
    >
      <div className="w-full max-w-md ml-auto mr-[5%] lg:mr-[8%]">
        <div className="rounded-3xl bg-[#808078]/80 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">

          {}
          <div className="flex flex-col items-center gap-3 px-10 pt-10 pb-6">
            <Image src="/LogoQuetzal.svg" alt="Logo" width={70} height={70} className="opacity-90" />
            <h1 className="text-lg font-medium text-white/90 tracking-wide">Recuperar contraseña</h1>
            <p className="text-xs text-white/50">
              {paso === "rfc" && "Verifique su identidad con su RFC"}
              {paso === "codigo" && "Código enviado a su correo"}
              {paso === "nueva" && "Establezca su nueva contraseña"}
              {paso === "exito" && "Contraseña actualizada exitosamente"}
            </p>
          </div>

          {}
          {paso === "rfc" && (
            <div className="px-10 pb-10 flex flex-col gap-5">
              <StepIndicator />
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/60 leading-relaxed">
                  Ingrese su RFC para verificar su identidad. Le enviaremos un código al correo registrado.
                </p>
              </div>
              <Input type="text" placeholder="RFC (ej. ABCD850101XYZ)" value={rfc}
                onChange={(e) => { setRfc(e.target.value.toUpperCase()); setRfcError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 uppercase tracking-widest" maxLength={13} autoFocus />
              {rfcError && <div className="rounded-full bg-red-500/20 px-5 py-2.5 text-sm text-white text-center border border-red-400/30">{rfcError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full border border-white/20 text-white/70 hover:text-white text-sm transition-colors">Cancelar</button>
                <button type="button" onClick={handleValidarRfc} disabled={!rfcValido || rfcLoading}
                  className="flex-1 h-12 rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors disabled:opacity-50">
                  {rfcLoading ? "Verificando..." : "Verificar RFC"}
                </button>
              </div>
            </div>
          )}

          {}
          {paso === "codigo" && (
            <div className="px-10 pb-10 flex flex-col gap-5">
              <StepIndicator />
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/60 leading-relaxed">
                  Se envió un código de 6 dígitos a <span className="font-semibold text-white/80">{correoMascara}</span>.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                {codigo.map((digit, i) => (
                  <input key={i} id={`code-${i}`} type="text" inputMode="numeric" maxLength={1}
                    value={digit} onChange={(e) => handleCodigoChange(i, e.target.value)} onKeyDown={(e) => handleCodigoKeyDown(i, e)}
                    className="w-11 h-14 text-center text-xl font-semibold rounded-xl bg-white text-[#283C2A] focus:outline-none focus:ring-2 focus:ring-white/50" />
                ))}
              </div>
              <div className="text-center">
                {timerActive
                  ? <span className="text-xs text-white/50">Reenviar en <span className="font-semibold text-white/80">{resendTimer}s</span></span>
                  : <button type="button" onClick={handleReenviar} className="text-xs text-white/60 hover:text-white underline">Reenviar código</button>}
              </div>
              {codigoError && <div className="rounded-full bg-red-500/20 px-5 py-2.5 text-sm text-white text-center border border-red-400/30">{codigoError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPaso("rfc")} className="flex-1 h-12 rounded-full border border-white/20 text-white/70 hover:text-white text-sm transition-colors">Atrás</button>
                <button type="button" onClick={handleVerificarCodigo} disabled={!codigoCompleto || codigoLoading}
                  className="flex-1 h-12 rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors disabled:opacity-50">
                  {codigoLoading ? "Verificando..." : "Verificar código"}
                </button>
              </div>
            </div>
          )}

          {}
          {paso === "nueva" && (
            <div className="px-10 pb-10 flex flex-col gap-5">
              <StepIndicator />
              <div className="rounded-2xl bg-white/10 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <span className="text-xs text-white/70">Identidad verificada — <span className="font-semibold tracking-widest text-white/90">{rfc}</span></span>
              </div>
              <div className="relative">
                <Input type={showNueva ? "text" : "password"} placeholder="Nueva contraseña" value={nuevaPassword}
                  onChange={(e) => { setNuevaPassword(e.target.value); setSaveError("") }}
                  className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" autoFocus />
                <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNueva ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="relative">
                <Input type={showConfirmar ? "text" : "password"} placeholder="Confirmar contraseña" value={confirmar}
                  onChange={(e) => { setConfirmar(e.target.value); setSaveError("") }}
                  className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" />
                <button type="button" onClick={() => setShowConfirmar(!showConfirmar)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirmar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {nuevaPassword.length > 0 && (
                <div className="rounded-2xl bg-white/10 px-4 py-3 flex flex-col gap-1.5">
                  {reglas.map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-green-400" : "bg-white/20"}`} />
                      <span className={`text-xs ${r.ok ? "text-green-300" : "text-white/40"}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {saveError && <div className="rounded-full bg-red-500/20 px-5 py-2.5 text-sm text-white text-center border border-red-400/30">{saveError}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPaso("codigo")} className="flex-1 h-12 rounded-full border border-white/20 text-white/70 hover:text-white text-sm transition-colors">Atrás</button>
                <button type="button" onClick={handleGuardar} disabled={!todasOk || saveLoading}
                  className="flex-1 h-12 rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors disabled:opacity-50">
                  {saveLoading ? "Guardando..." : "Guardar contraseña"}
                </button>
              </div>
            </div>
          )}

          {}
          {paso === "exito" && (
            <div className="px-10 pb-10 flex flex-col items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-9 w-9 text-green-400" />
              </div>
              <span className="text-base font-semibold text-white">¡Contraseña actualizada!</span>
              <span className="text-sm text-white/60 text-center">Ya puede iniciar sesión con sus nuevas credenciales.</span>
              <button type="button" onClick={onClose}
                className="h-12 w-full rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors">
                Ir al inicio de sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalCambioContrasena({
  username, onSuccess, onCancel,
}: { username: string; onSuccess: () => void; onCancel: () => void }) {
  const { changePassword } = useAuth()

  const [nuevaPassword, setNuevaPassword] = useState("")
  const [confirmarPassword, setConfirmarPassword] = useState("")
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)

  const reglas = [
    { label: "Mínimo 8 caracteres", ok: nuevaPassword.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(nuevaPassword) },
    { label: "Al menos un número", ok: /[0-9]/.test(nuevaPassword) },
    { label: "Las contraseñas coinciden", ok: nuevaPassword.length > 0 && nuevaPassword === confirmarPassword },
  ]
  const todasOk = reglas.every((r) => r.ok)

  const handleGuardar = async () => {
    setError("")
    if (!todasOk) { setError("Por favor cumpla todos los requisitos."); return }
    setLoading(true)
    try {
      await changePassword(username, nuevaPassword)
      setExito(true)
      setTimeout(() => onSuccess(), 1800)
    } catch { setError("Error al cambiar la contraseña. Intente de nuevo.") }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#808078]/90 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
        <div className="flex flex-col items-center gap-2 px-10 pt-10 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg font-medium text-white/90">Cambio de contraseña</h2>
          <p className="text-xs text-white/50 text-center">Debe establecer una nueva contraseña para continuar</p>
        </div>

        {exito ? (
          <div className="flex flex-col items-center gap-3 px-10 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <span className="text-base font-semibold text-white">¡Contraseña actualizada!</span>
            <span className="text-sm text-white/60 text-center">Ingresando al sistema...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-10 py-6">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-white/60 leading-relaxed">
                Su cuenta fue creada con una contraseña temporal. Por seguridad, debe establecer una nueva contraseña personal.
              </p>
            </div>
            <div className="relative">
              <Input type={showNueva ? "text" : "password"} placeholder="Nueva contraseña" value={nuevaPassword}
                onChange={(e) => { setNuevaPassword(e.target.value); setError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" autoFocus />
              <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNueva ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="relative">
              <Input type={showConfirmar ? "text" : "password"} placeholder="Confirmar contraseña" value={confirmarPassword}
                onChange={(e) => { setConfirmarPassword(e.target.value); setError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" />
              <button type="button" onClick={() => setShowConfirmar(!showConfirmar)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {nuevaPassword.length > 0 && (
              <div className="rounded-2xl bg-white/10 px-4 py-3 flex flex-col gap-1.5">
                {reglas.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-green-400" : "bg-white/20"}`} />
                    <span className={`text-xs ${r.ok ? "text-green-300" : "text-white/40"}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="rounded-full bg-red-500/20 px-5 py-2.5 text-sm text-white text-center border border-red-400/30">{error}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="flex-1 h-12 rounded-full border border-white/20 text-white/70 hover:text-white text-sm transition-colors">Cerrar sesión</button>
              <button type="button" onClick={handleGuardar} disabled={!todasOk || loading}
                className="flex-1 h-12 rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors disabled:opacity-50">
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function LoginForm() {
  const { login, logout } = useAuth()

  const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i

  const [rfc, setRfc] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mostrarModalCambio, setMostrarModalCambio] = useState(false)
  const [mostrarModalRecuperar, setMostrarModalRecuperar] = useState(false)

  if (mostrarModalRecuperar) {
    return <ModalRecuperarContrasena onClose={() => setMostrarModalRecuperar(false)} />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!rfc || !password) {
      setError("Por favor complete todos los campos")
      return
    }
    setLoading(true)
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
      <div
        className="relative flex min-h-screen items-center bg-cover bg-center bg-no-repeat px-6"
        style={{ backgroundImage: "url('/LOG-IN_SISODIJ-01.jpg')" }}
      >
        <div className="w-full max-w-xl ml-auto mr-[5%] lg:mr-[8%] mb-[8%]">
          <div className="rounded-3xl bg-[#808078]/75 backdrop-blur-md shadow-2xl px-16 py-20 flex flex-col items-center gap-12">
            {}
            <div className="flex flex-col items-center gap-4">
              <Image src="/LogoQuetzal.svg" alt="Logo Quetzal" width={110} height={110} className="opacity-90" />
              <h1 className="text-2xl font-medium text-white/90 tracking-wide">Inicia sesión</h1>
            </div>

            {}
            {error && (
              <div className="w-full rounded-full bg-red-500/20 px-5 py-3 text-base text-white text-center border border-red-400/30">
                {error}
              </div>
            )}

            {}
            <form onSubmit={handleSubmit} className="flex flex-col gap-7 w-full">
              <Input
                id="rfc"
                type="text"
                placeholder="RFC"
                value={rfc}
                onChange={(e) => { setRfc(e.target.value.toUpperCase()); setError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 text-foreground placeholder:text-muted-foreground shadow-sm uppercase tracking-widest"
                maxLength={13}
              />
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12 text-foreground placeholder:text-muted-foreground shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-lg tracking-wider uppercase mt-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "INGRESANDO..." : "LOGIN"}
              </button>
            </form>

            {}
          </div>
        </div>
      </div>

      {}
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
    </>
  )
}
