"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  KeyRound, Eye, EyeOff, AlertCircle,
  User, Mail, Shield, Building2, Landmark, Factory,
} from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { C_VERDE_ESTADO, C_VERDE_ESTADO_BG, C_ROSA_VINO, C_ROSA_VINO_BG } from "@/components/ui/status-badge"

function nombreSecretaria(valor: string | null | undefined): string {
  if (!valor) return "—"
  const primera = valor.split(">")[0]?.trim()
  return primera || "—"
}

function InfoField({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`text-sm font-medium text-card-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</span>
      </div>
    </div>
  )
}

export function PerfilPage() {
  const { user, changePassword, logout } = useAuth()
  const [modalAbierto,     setModalAbierto]     = useState(false)
  const [passwordActual,   setPasswordActual]   = useState("")
  const [passwordNueva,    setPasswordNueva]    = useState("")
  const [passwordConfirma, setPasswordConfirma] = useState("")
  const [showActual,       setShowActual]       = useState(false)
  const [showNueva,        setShowNueva]        = useState(false)
  const [showConfirma,     setShowConfirma]     = useState(false)
  const [cargando,         setCargando]         = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  const abrirModal = () => {
    setPasswordActual(""); setPasswordNueva(""); setPasswordConfirma("")
    setShowActual(false); setShowNueva(false); setShowConfirma(false)
    setError(null)
    setModalAbierto(true)
  }

  const handleCambiarPassword = async () => {
    setError(null)
    if (!passwordActual) { setError("Ingrese su contraseña actual."); return }
    if (!passwordNueva)  { setError("Ingrese la nueva contraseña."); return }
    if (passwordNueva.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return }
    if (passwordNueva !== passwordConfirma) { setError("La confirmación no coincide con la nueva contraseña."); return }
    if (!user?.rfc) { setError("No se pudo identificar al usuario."); return }
    setCargando(true)
    try {
      const res = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: user.rfc, password: passwordActual }),
      })
      if (!res.ok) { setError("La contraseña actual es incorrecta."); setCargando(false); return }
      await changePassword(user.rfc, passwordNueva)
      logout()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar la contraseña.")
    } finally {
      setCargando(false)
    }
  }

  const initials = user?.nombre
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  const esCentralizada = user?.tipoAdministracion === "centralizada"

  return (
    <PageLayout title="Mi Perfil" description="Información de su cuenta">
      <div className="max-w-2xl space-y-4">

        {/* Header card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary to-primary/70" />
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-primary text-primary-foreground text-2xl font-bold shadow-md">
                {initials}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={abrirModal}
                className="gap-2 mb-1 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Cambiar Contraseña
              </Button>
            </div>
            <p className="text-xl font-bold text-card-foreground leading-tight">{user?.nombre || "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Shield className="h-3 w-3" />
                {user?.rol || "—"}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={esCentralizada
                  ? { backgroundColor: C_VERDE_ESTADO_BG, color: C_VERDE_ESTADO }
                  : { backgroundColor: C_ROSA_VINO_BG, color: C_ROSA_VINO }}
              >
                {esCentralizada
                  ? <Landmark className="h-3 w-3" />
                  : <Factory className="h-3 w-3" />}
                {esCentralizada ? "Centralizada" : "Paraestatal"}
              </span>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField icon={User}     label="Nombre completo" value={user?.nombre || "—"} />
          <InfoField icon={Mail}     label="Correo electrónico" value={user?.correo || "—"} />
          <InfoField icon={KeyRound} label="RFC / Usuario" value={user?.rfc || "—"} mono />
          <InfoField icon={Shield}   label="Rol" value={user?.rol || "—"} />
          <div className="sm:col-span-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Secretaría / Dependencia</span>
                <span className="text-sm font-medium text-card-foreground">{nombreSecretaria(user?.secretariaTexto)}</span>
                {user?.organoNombre && (
                  <span className="text-xs text-muted-foreground">{user.organoNombre}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal cambiar contraseña */}
      <Dialog open={modalAbierto} onOpenChange={(open) => { if (!cargando) setModalAbierto(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Cambiar Contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {[
              { label: "Contraseña Actual",          val: passwordActual,   setVal: setPasswordActual,   show: showActual,   setShow: setShowActual },
              { label: "Nueva Contraseña",           val: passwordNueva,    setVal: setPasswordNueva,    show: showNueva,    setShow: setShowNueva },
              { label: "Confirmar Nueva Contraseña", val: passwordConfirma, setVal: setPasswordConfirma, show: showConfirma, setShow: setShowConfirma },
            ].map(({ label, val, setVal, show, setShow }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-card-foreground">{label}</Label>
                <div className="relative">
                  <Input
                    type={show ? "text" : "password"}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder={label === "Nueva Contraseña" ? "Mínimo 8 caracteres" : ""}
                    className="bg-background pr-10"
                    onKeyDown={label === "Confirmar Nueva Contraseña"
                      ? (e) => { if (e.key === "Enter") void handleCambiarPassword() }
                      : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
            {error && (
              <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[var(--sem-support-error)] bg-[#FFF5F5] px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sem-support-error)] mt-0.5" />
                <p className="text-sm text-[var(--sem-support-error)]">{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={cargando}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleCambiarPassword()}
                disabled={cargando}
               
              >
                {cargando ? "Guardando..." : "Cambiar Contraseña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
