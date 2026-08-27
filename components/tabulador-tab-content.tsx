"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { useRealtime } from "@/hooks/use-realtime"
import { fetchCentralizadaTree } from "@/lib/catalogo-api"
import { Loader2, Plus, Pencil, Trash2, AlertCircle, Rows3, ChevronDown, Info, Check } from "lucide-react"

interface TabuladorRow {
  id: number
  nivel: string
  categoria: string
  importeBrutoMin: number
  importeBrutoMax: number
  secretarias: string[]
}

interface DraftRow {
  key: number
  nivel: string
  categoria: string
  importeBrutoMin: string
  importeBrutoMax: string
  secretarias: string[]
}

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 })

function nuevoDraft(key: number): DraftRow {
  return { key, nivel: "", categoria: "", importeBrutoMin: "", importeBrutoMax: "", secretarias: [] }
}

function EditFormValues() {
  return { nivel: "", categoria: "", importeBrutoMin: "", importeBrutoMax: "", secretarias: [] as string[] }
}

function secretariasLabel(secretarias: string[]): string {
  if (secretarias.length === 0) return "Todas"
  if (secretarias.length === 1) return secretarias[0]
  return "Múltiples"
}

/** Input de importe: mientras se escribe muestra el número plano; al salir del
 * campo lo formatea como moneda ($ 1,300.00). `value`/`onChange` siguen
 * trabajando con el string numérico crudo (lo que se manda a la API). */
function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const n = Number(value)
  const display = focused || value === "" || !Number.isFinite(n)
    ? value
    : `$ ${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      className={className}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "")
        const [entero, ...resto] = raw.split(".")
        onChange(resto.length > 0 ? `${entero}.${resto.join("")}` : entero)
      }}
    />
  )
}

/** Alterna entre "Todas" (arreglo vacío) y "Específicas" (elegidas de `catalogo` vía un popover con checkboxes). */
function SecretariaScopeField({
  value,
  onChange,
  catalogo,
}: {
  value: string[]
  onChange: (v: string[]) => void
  catalogo: string[]
}) {
  const [open, setOpen] = useState(false)
  // "especificas" también se activa con el popover abierto (aunque todavía
  // no haya nada marcado) — así al hacer clic en "Específicas" la lista
  // aparece de inmediato en vez de requerir marcar algo primero. Si se cierra
  // sin marcar nada, vuelve a "Todas" solo (value sigue siendo []).
  const modo: "todas" | "especificas" = value.length > 0 || open ? "especificas" : "todas"

  return (
    <div className="flex items-center gap-1.5">
      <div className="inline-flex rounded-lg border border-input p-0.5 text-xs shrink-0">
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${modo === "todas" ? "bg-accent-primary text-accent-on-primary" : "text-muted-foreground hover:text-card-foreground"}`}
          onClick={() => { onChange([]); setOpen(false) }}
        >
          Todas
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${modo === "especificas" ? "bg-accent-primary text-accent-on-primary" : "text-muted-foreground hover:text-card-foreground"}`}
          onClick={() => setOpen(true)}
        >
          Específicas
        </button>
      </div>
      {modo === "especificas" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-lg border border-input bg-bg-base text-xs text-content-high hover:bg-bg-surface-md transition-colors min-w-0"
            >
              <span className="truncate max-w-[10rem]">
                {value.length > 0 ? `${value.length} Secretaría${value.length !== 1 ? "s" : ""}` : "Elegir Secretarías"}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-2 max-h-80 overflow-y-auto overscroll-contain rounded-xl bg-bg-base"
            align="start"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {catalogo.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No se pudo cargar el catálogo de Secretarías.</p>
            ) : (
              <div className="flex flex-col">
                {catalogo.map((nombre) => {
                  const elegida = value.includes(nombre)
                  return (
                    <button
                      key={nombre}
                      type="button"
                      onClick={() => onChange(elegida ? value.filter((s) => s !== nombre) : [...value, nombre])}
                      className="flex items-center gap-2.5 text-left px-3 py-2 text-sm font-light text-content-high rounded-md transition-colors hover:bg-bg-surface-md"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors ${
                          elegida ? "bg-[var(--color-core-mora-30)] border-[var(--color-core-mora-30)] text-white" : "border-[#ccc] bg-white"
                        }`}
                      >
                        {elegida && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span>{nombre}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export function TabuladorTabContent() {
  const { toast } = useToast()
  const [rows, setRows] = useState<TabuladorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogoSecretarias, setCatalogoSecretarias] = useState<string[]>([])

  // Alta: tabla de filas nuevas, se pueden agregar varias antes de guardar.
  const draftKeyRef = useRef(0)
  const [agregando, setAgregando] = useState(false)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [draftsSaving, setDraftsSaving] = useState(false)

  // Edición: un registro existente a la vez, en un diálogo.
  const [editTarget, setEditTarget] = useState<TabuladorRow | null>(null)
  const [editForm, setEditForm] = useState(EditFormValues())
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TabuladorRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const cargar = () => {
    setError(null)
    fetch("/api/tabulador", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) { setError(json?.error ?? "Error al cargar el tabulador"); return }
        setRows(json.tabulador ?? [])
      })
      .catch(() => setError("Error al cargar el tabulador"))
      .finally(() => { setLoading(false); setLoadedOnce(true) })
  }

  useEffect(() => { cargar() }, [])
  // Refresco silencioso: no vuelve a mostrar el spinner ni oculta la tabla
  // (mismo criterio que lib/calendario-store.tsx para evitar parpadeo).
  useRealtime(["tabulador"], () => { if (loadedOnce) cargar() })

  useEffect(() => {
    fetchCentralizadaTree()
      .then((tree) => setCatalogoSecretarias(tree.map((n) => n.nombre)))
      .catch(() => {})
  }, [])

  const nuevaKey = () => { draftKeyRef.current += 1; return draftKeyRef.current }

  const iniciarAgregar = () => {
    setDrafts([nuevoDraft(nuevaKey())])
    setDraftsError(null)
    setAgregando(true)
  }
  const cancelarAgregar = () => {
    setAgregando(false)
    setDrafts([])
    setDraftsError(null)
  }
  const agregarFila = () => setDrafts((prev) => [...prev, nuevoDraft(nuevaKey())])
  const quitarFila = (key: number) => setDrafts((prev) => prev.length <= 1 ? prev : prev.filter((d) => d.key !== key))
  const updateDraft = (key: number, field: keyof Omit<DraftRow, "key" | "secretarias">, value: string) => {
    setDrafts((prev) => prev.map((d) => d.key === key ? { ...d, [field]: value } : d))
  }

  const guardarDrafts = async () => {
    const tocadas = drafts.filter((d) => d.nivel.trim() || d.categoria.trim() || d.importeBrutoMin.trim() || d.importeBrutoMax.trim() || d.secretarias.length > 0)
    if (tocadas.length === 0) { setDraftsError("Agregue al menos un registro"); return }

    const payloads: { nivel: string; categoria: string; importeBrutoMin: number; importeBrutoMax: number; secretarias: string[] }[] = []
    for (let i = 0; i < tocadas.length; i++) {
      const d = tocadas[i]
      const nivel = d.nivel.trim()
      const categoria = d.categoria.trim()
      const importeBrutoMin = Number(d.importeBrutoMin)
      const importeBrutoMax = Number(d.importeBrutoMax)
      const etiqueta = `Fila ${i + 1}`
      if (!nivel || !categoria) { setDraftsError(`${etiqueta}: nivel y categoría son requeridos`); return }
      if (!Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
        setDraftsError(`${etiqueta}: importe bruto mínimo y máximo deben ser numéricos`); return
      }
      if (importeBrutoMin > importeBrutoMax) { setDraftsError(`${etiqueta}: el importe mínimo no puede ser mayor al máximo`); return }
      payloads.push({ nivel, categoria, importeBrutoMin, importeBrutoMax, secretarias: d.secretarias })
    }
    const vistos = new Set<string>()
    for (const p of payloads) {
      const k = `${p.nivel}__${p.categoria}__${[...p.secretarias].sort().join(",")}`
      if (vistos.has(k)) { setDraftsError(`Nivel ${p.nivel} / categoría ${p.categoria} está repetido entre las filas nuevas (mismo alcance de Secretaría)`); return }
      vistos.add(k)
    }

    setDraftsSaving(true)
    setDraftsError(null)
    try {
      for (let i = 0; i < payloads.length; i++) {
        const res = await fetch("/api/tabulador", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloads[i]),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(`Fila ${i + 1}: ${json.error || "Error al guardar el registro"}`)
      }
      toast({ title: payloads.length > 1 ? `${payloads.length} registros creados` : "Registro creado" })
      setAgregando(false)
      setDrafts([])
      cargar()
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : "Error al guardar los registros")
    } finally {
      setDraftsSaving(false)
    }
  }

  const abrirEditar = (row: TabuladorRow) => {
    setEditTarget(row)
    setEditForm({
      nivel: row.nivel,
      categoria: row.categoria,
      importeBrutoMin: String(row.importeBrutoMin),
      importeBrutoMax: String(row.importeBrutoMax),
      secretarias: row.secretarias,
    })
    setEditError(null)
  }

  const guardarEdicion = async () => {
    if (!editTarget) return
    const nivel = editForm.nivel.trim()
    const categoria = editForm.categoria.trim()
    const importeBrutoMin = Number(editForm.importeBrutoMin)
    const importeBrutoMax = Number(editForm.importeBrutoMax)

    if (!nivel || !categoria) { setEditError("Nivel y categoría son requeridos"); return }
    if (!Number.isFinite(importeBrutoMin) || !Number.isFinite(importeBrutoMax)) {
      setEditError("Importe bruto mínimo y máximo deben ser numéricos")
      return
    }
    if (importeBrutoMin > importeBrutoMax) {
      setEditError("El importe mínimo no puede ser mayor al máximo")
      return
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/tabulador/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nivel, categoria, importeBrutoMin, importeBrutoMax, secretarias: editForm.secretarias }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al guardar el registro")
      toast({ title: "Registro actualizado", description: `Nivel ${nivel} — ${categoria}` })
      setEditTarget(null)
      cargar()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Error al guardar el registro")
    } finally {
      setEditSaving(false)
    }
  }

  const eliminar = async () => {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      const res = await fetch(`/api/tabulador/${deleteTarget.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al eliminar el registro")
      toast({ title: "Registro eliminado" })
      setDeleteTarget(null)
      cargar()
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
          <Button size="sm" variant="vino" className="gap-1.5 text-xs h-9" onClick={iniciarAgregar}>
            <Plus className="h-3.5 w-3.5" />Agregar Nivel
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            <span className="text-sm text-muted-foreground">Cargando tabulador...</span>
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-5 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10">
                <Rows3 className="h-7 w-7 text-secondary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold text-card-foreground">Sin registros en el tabulador</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Agregue el primer nivel para que esté disponible en "Equivalencia al Tabulador" dentro de Nueva Solicitud.
                </p>
              </div>
              <Button variant="vino" className="gap-2" onClick={iniciarAgregar}>
                <Plus className="h-4 w-4" />Agregar Nivel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
            <table className="w-full min-w-[760px] text-sm table-fixed">
              <thead>
                <tr className="bg-bg-base text-content-high">
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[12%]">Nivel</th>
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[16%]">Categoría</th>
                  <th className="px-5 py-3 text-right font-semibold align-middle w-[15%]">Importe bruto mínimo</th>
                  <th className="px-5 py-3 text-right font-semibold align-middle w-[15%]">Importe bruto máximo</th>
                  <th className="px-5 py-3 text-left font-semibold align-middle w-[27%]">Secretaria /Dependencia</th>
                  <th className="px-5 py-3 text-right font-semibold align-middle w-[15%]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className={`border-t border-border/60 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-muted/40`}>
                    <td className="px-5 py-3 align-middle"><span className="font-semibold text-card-foreground">{row.nivel}</span></td>
                    <td className="px-5 py-3 align-middle text-card-foreground">{row.categoria}</td>
                    <td className="px-5 py-3 text-right align-middle tabular-nums">{fmt(row.importeBrutoMin)}</td>
                    <td className="px-5 py-3 text-right align-middle tabular-nums">{fmt(row.importeBrutoMax)}</td>
                    <td className="px-5 py-3 align-middle text-card-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{secretariasLabel(row.secretarias)}</span>
                        {row.secretarias.length > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Ver Secretarías seleccionadas"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-content-high transition-colors shrink-0"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px]">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {row.secretarias.map((s) => <li key={s}>{s}</li>)}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={agregando} onOpenChange={(v) => { if (!v) cancelarAgregar() }}>
        <DialogContent className="sm:max-w-5xl bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">Agregar Nivel</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Puede agregar uno o varios niveles a la vez.</p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-border-low">
              <table className="w-full min-w-[680px] text-sm table-fixed">
                <thead>
                  <tr className="bg-bg-base text-content-high">
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[13%]">Nivel</th>
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[17%]">Categoría</th>
                    <th className="px-3 py-2 text-right font-semibold align-middle w-[15%]">Importe mínimo</th>
                    <th className="px-3 py-2 text-right font-semibold align-middle w-[15%]">Importe máximo</th>
                    <th className="px-3 py-2 text-left font-semibold align-middle w-[30%]">Secretaria /Dependencia</th>
                    <th className="px-3 py-2 align-middle w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, idx) => (
                    <tr key={d.key} className={`border-t border-border/60 ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                      <td className="px-2 py-1.5 align-middle">
                        <Input value={d.nivel} onChange={(e) => updateDraft(d.key, "nivel", e.target.value)} placeholder="Ej. 106" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <Input value={d.categoria} onChange={(e) => updateDraft(d.key, "categoria", e.target.value)} placeholder="Ej. A a C" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <MoneyInput value={d.importeBrutoMin} onChange={(v) => updateDraft(d.key, "importeBrutoMin", v)} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <MoneyInput value={d.importeBrutoMax} onChange={(v) => updateDraft(d.key, "importeBrutoMax", v)} placeholder="$ 0.00" className="h-8 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <SecretariaScopeField
                          value={d.secretarias}
                          onChange={(v) => setDrafts((prev) => prev.map((x) => x.key === d.key ? { ...x, secretarias: v } : x))}
                          catalogo={catalogoSecretarias}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => quitarFila(d.key)} disabled={drafts.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 self-start text-secondary" onClick={agregarFila}>
              <Plus className="h-3.5 w-3.5" />Agregar otra fila
            </Button>
            {draftsError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{draftsError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={cancelarAgregar}
              disabled={draftsSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm gap-1.5"
              onClick={guardarDrafts}
              disabled={draftsSaving}
            >
              {draftsSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {draftsSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null) }}>
        <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sem-border-md)]">
            <DialogTitle className="ds-title-md text-content-high">Editar Nivel</DialogTitle>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Nivel</Label>
                <Input
                  value={editForm.nivel}
                  onChange={(e) => setEditForm((p) => ({ ...p, nivel: e.target.value }))}
                  placeholder="Ej. 106"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Categoría</Label>
                <Input
                  value={editForm.categoria}
                  onChange={(e) => setEditForm((p) => ({ ...p, categoria: e.target.value }))}
                  placeholder="Ej. A a C"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Importe bruto mínimo</Label>
                <MoneyInput
                  value={editForm.importeBrutoMin}
                  onChange={(v) => setEditForm((p) => ({ ...p, importeBrutoMin: v }))}
                  placeholder="$ 0.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">Importe bruto máximo</Label>
                <MoneyInput
                  value={editForm.importeBrutoMax}
                  onChange={(v) => setEditForm((p) => ({ ...p, importeBrutoMax: v }))}
                  placeholder="$ 0.00"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Secretaria /Dependencia</Label>
              <SecretariaScopeField
                value={editForm.secretarias}
                onChange={(v) => setEditForm((p) => ({ ...p, secretarias: v }))}
                catalogo={catalogoSecretarias}
              />
            </div>
            {editError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{editError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--sem-border-md)]">
            <Button
              variant="default"
              className="rounded-full h-10 px-6 font-normal border border-[var(--sem-bg-surface-high)] bg-[#f5f4f2] text-content-high hover:bg-[#eae9e2]"
              onClick={() => setEditTarget(null)}
              disabled={editSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="vino"
              className="rounded-full h-10 px-6 font-normal shadow-sm gap-1.5"
              onClick={guardarEdicion}
              disabled={editSaving}
            >
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        variant="eliminar"
        title="Eliminar registro"
        description={<>Se eliminará el nivel <strong>{deleteTarget?.nivel}</strong> — <strong>{deleteTarget?.categoria}</strong> del tabulador. Esta acción no se puede deshacer.</>}
        confirmLabel="Sí, eliminar"
        loading={deleteSaving}
      />
    </>
  )
}
