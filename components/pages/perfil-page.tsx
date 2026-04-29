"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserCircle, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
function deduplicarSecretaria(valor: string | null | undefined): string {
  if (!valor) return "—"
  const partes = valor.split(">").map((p) => p.trim()).filter(Boolean)
  const unicas = partes.filter((v, i, arr) => arr.indexOf(v) === i)
  return unicas[unicas.length - 1] ?? "—"
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
  const [exito,            setExito]            = useState(false)

  const abrirModal = () => {
    setPasswordActual(""); setPasswordNueva(""); setPasswordConfirma("")
    setShowActual(false); setShowNueva(false); setShowConfirma(false)
    setError(null); setExito(false)
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
      setExito(true)
      setTimeout(() => logout(), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar la contraseña.")
    } finally {
      setCargando(false)
    }
  }
  return (
    <PageLayout title="Mi Perfil" description="Informacion de su   usuario">
      <Card className="shadow-sm border-border max-w-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <UserCircle className="h-5 w-5 text-secondary" />
            Datos del Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {user?.nombre?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-lg font-semibold text-card-foreground">{user?.nombre}</p>
                <p className="text-sm text-muted-foreground">{user?.rol}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-card-foreground">Nombre</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-card-foreground">
                  {user?.nombre || "—"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-card-foreground">Usuario</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-card-foreground font-mono uppercase">
                  {user?.rfc || "—"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-card-foreground">Secretaría</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-card-foreground">
                  {deduplicarSecretaria(user?.secretariaTexto)}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-card-foreground">Rol</Label>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-card-foreground">
                  {user?.rol || "—"}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={abrirModal} className="gap-2">
                <KeyRound className="h-4 w-4" />Cambiar Contraseña
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={modalAbierto} onOpenChange={(open) => { if (!exito) setModalAbierto(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-secondary" />
              Cambiar Contraseña
            </DialogTitle>
          </DialogHeader>
          {exito ? (
            <div className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-4">
              <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-card-foreground">Contraseña actualizada correctamente</p>
                <p className="text-xs text-muted-foreground">La sesión se cerrará en un momento. Inicie sesión con su nueva contraseña.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Contraseña Actual</Label>
                <div className="relative">
                  <Input
                    type={showActual ? "text" : "password"}
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    placeholder="Ingrese su contraseña actual"
                    className="bg-background pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowActual((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showNueva ? "text" : "password"}
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="bg-background pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNueva((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                     >
                    {showNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-card-foreground">Confirmar la Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showConfirma ? "text" : "password"}
                    value={passwordConfirma}
                    onChange={(e) => setPasswordConfirma(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    className="bg-background pr-10"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleCambiarPassword() }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirma((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirma ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={cargando}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleCambiarPassword()}
                  disabled={cargando}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {cargando ? "Guardando..." : "Cambiar Contraseña"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
