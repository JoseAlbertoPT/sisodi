"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useTiposPago } from "@/hooks/use-tipos-pago"
import { NOMBRE_TIPO_PAGO_MAX, type TipoPago } from "@/lib/tipos-pago"
import { Loader2, Plus, Trash2, Pencil, AlertCircle, Wallet, MoreHorizontal } from "lucide-react"

type Form = { id: number | null; nombre: string; usaTabulador: boolean }

/**
 * Configuración > Tipos de pago: alimenta el combo "Tipo de Pago" de Nueva
 * Solicitud. "Aplica equivalencia al tabulador" en No bloquea ese campo en el
 * formulario y deja de exigirlo (ej. pagos por hora, día o taller).
 */
export function TiposPagoTabContent() {
  const { toast } = useToast()
  const { tipos: todos, loading, error, recargar } = useTiposPago()
  const tipos = todos.filter((t) => t.activo && t.id > 0)

  const [form, setForm] = useState<Form | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TipoPago | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const abrirNuevo = () => { setFormError(null); setForm({ id: null, nombre: "", usaTabulador: true }) }
  const abrirEditar = (t: TipoPago) => { setFormError(null); setForm({ id: t.id, nombre: t.nombre, usaTabulador: t.usaTabulador }) }

  const guardar = async () => {
    if (!form) return
    const nombre = form.nombre.trim()
    if (!nombre) { setFormError("El nombre es requerido"); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(form.id ? `/api/tipos-pago/${form.id}` : "/api/tipos-pago", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, usaTabulador: form.usaTabulador }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "No se pudo guardar el tipo de pago")
      toast({ title: form.id ? "Tipo de pago actualizado" : "Tipo de pago agregado" })
      setForm(null)
      recargar()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar el tipo de pago")
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async () => {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      const res = await fetch(`/api/tipos-pago/${deleteTarget.id}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "No se pudo eliminar el tipo de pago")
      toast({ title: "Tipo de pago eliminado" })
      setDeleteTarget(null)
      recargar()
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar", description: e instanceof Error ? e.message : undefined })
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="vino" className="gap-1.5 text-xs h-9" onClick={abrirNuevo}>
            <Plus className="h-3.5 w-3.5" />Agregar tipo de pago
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            <span className="text-sm text-muted-foreground">Cargando tipos de pago...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
            <Button variant="default" size="sm" className="ml-auto text-xs h-8" onClick={recargar}>Reintentar</Button>
          </div>
        ) : tipos.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-5 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10">
                <Wallet className="h-7 w-7 text-secondary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold text-card-foreground">Sin tipos de pago</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Agregue el primero para que esté disponible en "Tipo de Pago" dentro de Nueva Solicitud.
                </p>
              </div>
              <Button variant="vino" className="gap-2" onClick={abrirNuevo}>
                <Plus className="h-4 w-4" />Agregar tipo de pago
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
            <table className="w-full min-w-[520px] text-sm table-fixed">
              <thead>
                <tr className="bg-bg-base text-content-high">
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[45%]">Tipo de pago</th>
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[35%]">Aplica equivalencia al tabulador</th>
                  <th className="px-5 py-3 text-right font-semibold align-middle w-[20%]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t, idx) => (
                  <tr key={t.id} className={`border-t border-border/60 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-muted/40`}>
                    <td className="px-5 py-3 align-middle"><span className="font-semibold text-card-foreground">{t.nombre}</span></td>
                    <td className="px-5 py-3 align-middle text-card-foreground">{t.usaTabulador ? "Sí" : "No"}</td>
                    <td className="px-5 py-2 align-middle">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-low border border-border-low transition-colors hover:bg-bg-surface-md"
                              aria-label={`Más opciones de ${t.nombre}`}
                            >
                              <MoreHorizontal className="h-4 w-4 text-content-low" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => abrirEditar(t)}>
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(t)}>
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(v) => { if (!v && !saving) setForm(null) }}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">
              {form?.id ? "Editar tipo de pago" : "Agregar tipo de pago"}
            </DialogTitle>
          </div>
          {form && (
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo-pago-nombre" className="text-sm font-medium">Nombre</Label>
                <Input
                  id="tipo-pago-nombre"
                  value={form.nombre}
                  maxLength={NOMBRE_TIPO_PAGO_MAX}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") void guardar() }}
                  placeholder="Ej. Por Evento"
                  disabled={saving}
                  autoFocus
                />
                <span className="text-[11px] text-muted-foreground">Máximo {NOMBRE_TIPO_PAGO_MAX} caracteres.</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="tipo-pago-tabulador" className="text-sm font-medium">Aplica equivalencia al tabulador</Label>
                  <span className="text-xs text-muted-foreground">
                    Si se desactiva, en Nueva Solicitud el campo "Equivalencia al Tabulador" se bloquea y no se exige.
                  </span>
                </div>
                <Switch
                  id="tipo-pago-tabulador"
                  checked={form.usaTabulador}
                  onCheckedChange={(c) => setForm({ ...form, usaTabulador: c })}
                  disabled={saving}
                  className="shrink-0 mt-0.5"
                />
              </div>
              {formError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{formError}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setForm(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="vino" className="rounded-full h-10 px-6 font-normal shadow-sm gap-1.5" onClick={() => void guardar()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        variant="eliminar"
        title="Eliminar tipo de pago"
        description={<>Ya no aparecerá <strong>{deleteTarget?.nombre}</strong> en Nueva Solicitud. Las solicitudes que ya lo usan no cambian.</>}
        confirmLabel="Sí, eliminar"
        loading={deleteSaving}
      />
    </>
  )
}
