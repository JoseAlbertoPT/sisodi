"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Eye, EyeOff, Lock, CheckCircle2, KeyRound, User,
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
  const { changePassword, logout } = useAuth()

  const [passwordActual, setPasswordActual] = useState("")
  const [nuevaPassword, setNuevaPassword] = useState("")
  const [confirmarPassword, setConfirmarPassword] = useState("")
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const todasOk =
    nuevaPassword.length >= 8 && nuevaPassword === confirmarPassword
  const handleGuardar = async () => {
    setError("")
    if (!passwordActual) { setError("Ingrese su contraseña actual."); return }
    if (!todasOk) { setError("Por favor cumpla todos los requisitos."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: username, password: passwordActual }),
      })
      if (!res.ok) { setError("La contraseña actual es incorrecta."); setLoading(false); return }
      await changePassword(username, nuevaPassword)
      logout()
      onSuccess()
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

        <div className="flex flex-col gap-5 px-10 py-6">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-white/60 leading-relaxed">
                Por seguridad . Debe establecer una nueva contraseña personal.
              </p>
            </div>
            <div className="relative">
              <Input type={showActual ? "text" : "password"} placeholder="Contraseña actual" value={passwordActual}
                onChange={(e) => { setPasswordActual(e.target.value); setError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" autoFocus />
              <button type="button" onClick={() => setShowActual(!showActual)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showActual ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="relative">
              <Input type={showNueva ? "text" : "password"} placeholder="Nueva contraseña" value={nuevaPassword}
                onChange={(e) => { setNuevaPassword(e.target.value); setError("") }}
                className="h-14 rounded-full bg-white border-0 text-base px-6 pr-12" />
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
            {nuevaPassword.length > 0 && nuevaPassword.length < 8 && (
              <p className="text-xs text-white/50 text-center">Mínimo 8 caracteres</p>
            )}
            {error && <div className="rounded-full bg-red-500/20 px-5 py-2.5 text-sm text-white text-center border border-red-400/30">{error}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="flex-1 h-12 rounded-full border border-white/20 text-white/70 hover:text-white text-sm transition-colors">Cerrar sesión</button>
              <button type="button" onClick={handleGuardar} disabled={!passwordActual || !todasOk || loading}
                className="flex-1 h-12 rounded-full bg-[#4A5249] hover:bg-[#3d443c] text-white font-medium text-sm transition-colors disabled:opacity-50">
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </div>
          </div>
      </div>
    </div>
  )
}
export function ForzarCambioContrasena() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div
      className="relative flex min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/LOG-IN_SISODIJ-01.jpg')" }}
    >
      <ModalCambioContrasena
        username={user.rfc}
        onSuccess={() => {}}
        onCancel={() => logout()}
      />
    </div>
  )
}
export function LoginForm() {
  const { login, logout, changePassword } = useAuth()

  // Login
  const [rfc,          setRfc]          = useState("")
  const [password,     setPassword]     = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [mostrarModalRecuperar, setMostrarModalRecuperar] = useState(false)

  // Cambio de contraseña inline
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [nuevaPassword,      setNuevaPassword]      = useState("")
  const [confirmarPassword,  setConfirmarPassword]  = useState("")
  const [showNueva,          setShowNueva]          = useState(false)
  const [showConfirmar,      setShowConfirmar]      = useState(false)
  const [changeLoading,      setChangeLoading]      = useState(false)

  if (mostrarModalRecuperar) {
    return <ModalRecuperarContrasena onClose={() => setMostrarModalRecuperar(false)} />
  }

  const reglas = [
    { label: "Mínimo 8 caracteres",    ok: nuevaPassword.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(nuevaPassword) },
    { label: "Al menos un número",     ok: /[0-9]/.test(nuevaPassword) },
    { label: "Las contraseñas coinciden", ok: nuevaPassword.length > 0 && nuevaPassword === confirmarPassword },
  ]
  const todasOk = reglas.every((r) => r.ok)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (mustChangePassword) {
      if (!todasOk) { setError("Por favor cumpla todos los requisitos."); return }
      setChangeLoading(true)
      try {
        await changePassword(rfc.trim().toUpperCase(), nuevaPassword)
        logout()
        setMustChangePassword(false)
        setRfc(""); setPassword(""); setNuevaPassword(""); setConfirmarPassword("")
      } catch { setError("Error al cambiar la contraseña. Intente de nuevo.") }
      finally { setChangeLoading(false) }
      return
    }

    if (!rfc || !password) { setError("Por favor complete todos los campos"); return }
    setLoading(true)
    try {
      const result = await login(rfc.trim().toUpperCase(), password)
      if (!result) { setError("Credenciales incorrectas"); return }
      if (result.mustChangePassword) { setMustChangePassword(true) }
    } catch { setError("Error de conexión. Intente de nuevo.") }
    finally { setLoading(false) }
  }
  return (
    <>
      <div className="flex min-h-screen h-screen overflow-hidden relative">

        {/* Panel izquierdo */}
        <div
          className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
          style={{
            gap: 'clamp(16px, 4vh, 48px)',
            paddingTop: 'clamp(20px, 3vh, 60px)',
            paddingBottom: 'clamp(200px, 30vh, 360px)',
            paddingLeft: 'clamp(24px, 4vw, 64px)',
            paddingRight: 'clamp(24px, 4vw, 64px)',
          }}
        >
          <Image
            src="/fondo-login-verde.webp"
            alt=""
            fill
            priority
            sizes="50vw"
            style={{ objectFit: 'cover', objectPosition: '65% 35%', zIndex: 0 }}
          />
          <Image
            src="/FINANZAS COLOR VERTICAL 2.png"
            alt="Secretaría de Administración y Finanzas"
            width={0}
            height={0}
            sizes="(max-width: 1024px) 0px, 33vw"
            priority
            style={{
              height: 'clamp(120px, 22vh, 280px)',
              width: 'auto',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
            }}
          />
          <Image
            src="/log-name-sisodij (1).png"
            alt="SISODIJ"
            width={0}
            height={0}
            sizes="(max-width: 1024px) 0px, 33vw"
            priority
            style={{
              height: 'clamp(100px, 20vh, 240px)',
              width: 'auto',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              marginTop: '16px',
            }}
          />
        </div>

        {/* Panel derecho */}
        <div
          className="relative flex w-full lg:w-1/2 items-center justify-center overflow-hidden"
          style={{
            paddingTop: 'clamp(40px, 8vh, 120px)',
            paddingBottom: 'clamp(80px, 12vh, 180px)',
            paddingLeft: 'clamp(16px, 3vw, 48px)',
            paddingRight: 'clamp(16px, 3vw, 48px)',
          }}
        >
          <Image
            src="/fondo-login-blanco.png"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            style={{ objectFit: 'cover', objectPosition: 'center', zIndex: 0 }}
          />

          {/* Tarjeta de login */}
          <div
            className="relative z-10 w-full rounded-3xl flex flex-col items-center overflow-hidden"
            style={{
              backgroundColor: 'rgba(42, 59, 41, 0.72)',
              maxWidth: 'clamp(320px, 28vw, 480px)',
              gap: 'clamp(16px, 3vh, 32px)',
              paddingTop: 'clamp(24px, 5vh, 56px)',
              paddingBottom: 'clamp(24px, 5vh, 56px)',
              paddingLeft: 'clamp(24px, 3vw, 56px)',
              paddingRight: 'clamp(24px, 3vw, 56px)',
            }}
          >
            {/* Logo + título */}
            <div className="flex flex-col items-center" style={{ gap: 'clamp(8px, 1.5vh, 16px)' }}>
              <div className="flex items-center justify-center gap-3">
                <Image
                  src="/LOGO_MORELOS_V1.png"
                  alt="Gobierno del Estado de Morelos"
                  width={0}
                  height={0}
                  sizes="15vw"
                  priority
                  style={{
                    height: mustChangePassword ? '48px' : '64px',
                    width: 'auto',
                    objectFit: 'contain',
                    transition: 'height 0.3s',
                  }}
                />
                <Image
                  src="/logo-20finanzas.png"
                  alt="Secretaría de Finanzas"
                  width={0}
                  height={0}
                  sizes="15vw"
                  priority
                  style={{
                    height: mustChangePassword ? '48px' : '64px',
                    width: 'auto',
                    objectFit: 'contain',
                    transition: 'height 0.3s',
                  }}
                />
              </div>
              <p className="text-white font-light tracking-wide" style={{ fontSize: 'clamp(14px, 1.6vh, 20px)' }}>
                {mustChangePassword ? "Cambio de contraseña" : "Inicia sesión"}
              </p>
              {mustChangePassword && (
                <p className="text-white/55 text-xs text-center leading-relaxed px-2">
                  Debes establecer una nueva contraseña para continuar
                </p>
              )}
            </div>

            {error && (
              <div className="w-full rounded-full bg-red-500/20 px-5 py-3 text-sm text-white text-center border border-red-400/30">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
                {/* RFC — bloqueado al cambiar contraseña */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Usuario"
                    value={rfc}
                    onChange={(e) => { if (!mustChangePassword) { setRfc(e.target.value.toUpperCase()); setError("") } }}
                    readOnly={mustChangePassword}
                    maxLength={13}
                    autoComplete="username"
                    className={`w-full rounded-full px-5 py-3 pr-11 text-sm outline-none uppercase tracking-widest transition-opacity ${
                      mustChangePassword
                        ? "bg-white/20 text-white/50 placeholder:text-white/30 cursor-not-allowed"
                        : "bg-white text-gray-800 placeholder:text-gray-400"
                    }`}
                  />
                  {mustChangePassword
                    ? <Lock size={15} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
                    : <User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#2A3B29' }} />
                  }
                </div>

                {/* Contraseña actual — bloqueada al cambiar */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => { if (!mustChangePassword) setPassword(e.target.value) }}
                    readOnly={mustChangePassword}
                    autoComplete="current-password"
                    className={`w-full rounded-full px-5 py-3 pr-12 text-sm outline-none transition-opacity ${
                      mustChangePassword
                        ? "border border-white/20 bg-transparent text-white/40 placeholder:text-white/25 cursor-not-allowed"
                        : "border border-white/50 bg-transparent text-white placeholder:text-white/60"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => { if (!mustChangePassword) setShowPassword(!showPassword) }}
                    tabIndex={mustChangePassword ? -1 : 0}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-opacity ${mustChangePassword ? "opacity-30 pointer-events-none" : ""}`}
                    style={{ color: '#2A3B29' }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Campos nueva contraseña — solo cuando mustChangePassword */}
                {mustChangePassword && (
                  <>
                    <div className="flex items-center gap-3 my-1">
                      <div className="flex-1 h-px bg-white/20" />
                      <span className="text-[11px] text-white/45 uppercase tracking-wider">Nueva contraseña</span>
                      <div className="flex-1 h-px bg-white/20" />
                    </div>

                    <div className="relative">
                      <input
                        type={showNueva ? "text" : "password"}
                        placeholder="Nueva contraseña"
                        value={nuevaPassword}
                        onChange={(e) => { setNuevaPassword(e.target.value); setError("") }}
                        autoFocus
                        autoComplete="new-password"
                        className="w-full rounded-full border border-white/50 bg-transparent px-5 py-3 pr-12 text-sm text-white placeholder:text-white/60 outline-none"
                      />
                      <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        {showNueva ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showConfirmar ? "text" : "password"}
                        placeholder="Confirmar contraseña"
                        value={confirmarPassword}
                        onChange={(e) => { setConfirmarPassword(e.target.value); setError("") }}
                        autoComplete="new-password"
                        className="w-full rounded-full border border-white/50 bg-transparent px-5 py-3 pr-12 text-sm text-white placeholder:text-white/60 outline-none"
                      />
                      <button type="button" onClick={() => setShowConfirmar(!showConfirmar)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Reglas de contraseña */}
                    {(nuevaPassword.length > 0 || confirmarPassword.length > 0) && (
                      <div className="flex flex-col gap-1.5 px-1">
                        {reglas.map((r) => (
                          <div key={r.label} className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${r.ok ? "bg-green-400" : "bg-white/30"}`} />
                            <span className={`text-[11px] transition-colors ${r.ok ? "text-green-300" : "text-white/45"}`}>{r.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading || changeLoading || (mustChangePassword && !todasOk)}
                  className="w-full rounded-full py-3 text-sm font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-1"
                  style={{ backgroundColor: '#2A3B29' }}
                >
                  {changeLoading ? "ACTUALIZANDO..." : loading ? "INGRESANDO..." : mustChangePassword ? "ACTUALIZAR CONTRASEÑA" : "INICIAR SESIÓN"}
                </button>

                {mustChangePassword && (
                  <button
                    type="button"
                    onClick={() => { logout(); setMustChangePassword(false); setRfc(""); setPassword(""); setNuevaPassword(""); setConfirmarPassword(""); setError("") }}
                    className="text-white/40 hover:text-white/70 text-xs text-center transition-colors"
                  >
                    Cerrar sesión
                  </button>
                )}
              </form>
          </div>
        </div>

        {/* Pleca inferior */}
        <div
          className="hidden lg:block absolute z-20 pointer-events-none select-none overflow-hidden"
          style={{ bottom: '-24px', left: 0, right: 0 }}
        >
          <Image
            src="/down_login_pleca_Manuales.png"
            alt="Gobierno del Estado de Morelos"
            width={0}
            height={0}
            sizes="100vw"
            priority
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              margin: 0,
              padding: 0,
              verticalAlign: 'bottom',
            }}
          />
        </div>
      </div>

    </>
  )
}
