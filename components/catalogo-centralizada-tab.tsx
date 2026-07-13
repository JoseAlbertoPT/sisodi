"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Plus, Pencil, Trash2, MoreVertical,
  Building2, Loader2, GripVertical, AlertCircle, ChevronRight, ChevronLeft, Search, X,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  fetchCentralizadaTree,
  createOrganoCentralizado,
  updateOrganoCentralizado,
  deleteOrganoCentralizado,
  type OrganoCentralizadoNode,
} from "@/lib/catalogo-api"

const VINO = "#773357"
const VINO_HOVER = "#773357"
const UA_PAGE_SIZE = 10

// ---- Estilo estándar de botones de modal (usado en toda la app) ----
// Cancelar: gris
const BTN_CANCEL: React.CSSProperties = {}
const BTN_CANCEL_CLASS =
    "rounded-full h-10 px-6 font-medium border-[1.5px] border-[#d1d5db] shadow-sm bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb] hover:text-[#4b5563] active:bg-[#f3f4f6] active:text-[#4b5563] focus:bg-[#f3f4f6] focus:text-[#4b5563]"

// Crear / Guardar / Agregar: fondo vino sólido, texto blanco
const BTN_CONFIRM_CLASS = "rounded-full h-10 px-6 font-medium shadow-sm"

// Footer del modal: más aire respecto al contenido y separación clara entre botones
const DIALOG_FOOTER_CLASS = "gap-3 pt-6 pb-1 mt-2 border-t border-[#e4e3dc]"

function reorder<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}
function normNombre(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[?-?]/g, "")
}
function normClave(s: string) { return s.replace(/\D/g, "") }
function displayClave(c: string): string { return c.replace(/\./g, " ").trim() }
function rawToClaveStr(raw: string): string {
  if (!raw || raw.includes(".")) return raw
  const d = raw.replace(/\D/g, "")
  const g0 = d.slice(0, 2).replace(/^0/, "") || d.slice(0, 1)
  const parts = [g0, d.slice(2,4), d.slice(4,6), d.slice(6,7), d.slice(7,8), d.slice(8,9), d.slice(9,10)]
  return parts.filter(Boolean).join(".")
}

function paginationPages(total: number, current: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const show = new Set([0, total - 1, current, current - 1, current + 1].filter(p => p >= 0 && p < total))
  const sorted = Array.from(show).sort((a, b) => a - b)
  const pages: (number | "...")[] = []
  let prev = -1
  for (const p of sorted) {
    if (prev !== -1 && p - prev > 1) pages.push("...")
    pages.push(p)
    prev = p
  }
  return pages
}

const CLAVE_SEG = [2, 2, 2, 1, 1, 1, 1]
function ClaveInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const rawSegs = value.split(".")
  const segs = Array.from({ length: 7 }, (_, i) => rawSegs[i] ?? "")
  const commit = (i: number, digits: string) => {
    const clean = i === 0 && digits.length === 2 && digits[0] === "0" ? digits[1] : digits
    const next = segs.map((s, j) => (j === i ? clean : s))
    const last = next.reduce((acc, v, idx) => (v ? idx : acc), -1)
    onChange(next.slice(0, last + 1).join("."))
    if (clean.length === CLAVE_SEG[i] && i < CLAVE_SEG.length - 1) {
      refs.current[i + 1]?.focus()
      refs.current[i + 1]?.select()
    }
  }
  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !segs[i] && i > 0) { refs.current[i - 1]?.focus(); refs.current[i - 1]?.select() }
    if (e.key === "ArrowLeft"  && i > 0)                    refs.current[i - 1]?.focus()
    if (e.key === "ArrowRight" && i < CLAVE_SEG.length - 1) refs.current[i + 1]?.focus()
  }
  return (
      <div className="flex items-center gap-1.5">
        {CLAVE_SEG.map((size, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground/50 text-sm select-none">·</span>}
              <input
                  ref={(el) => { refs.current[i] = el }}
                  value={segs[i]}
                  onChange={(e) => commit(i, e.target.value.replace(/\D/g, "").slice(0, size))}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  inputMode="numeric"
                  maxLength={size}
                  placeholder={"0".repeat(size)}
                  className={[
                    "h-9 rounded-md border border-input bg-background",
                    "text-center font-mono text-sm shadow-sm transition-all outline-none",
                    "focus:border-ring focus:ring-2 focus:ring-ring/30",
                    "placeholder:text-muted-foreground/30",
                    size === 2 ? "w-10" : "w-8",
                  ].join(" ")}
              />
            </React.Fragment>
        ))}
      </div>
  )
}


function SecretariaRow({
                         node, allTree, onRefresh, onDragStart, onDragOver, onDrop, draggingIndex, index,
                       }: {
  node: OrganoCentralizadoNode
  allTree: OrganoCentralizadoNode[]
  onRefresh: () => void
  onDragStart: (i: number) => void
  onDragOver: (e: React.DragEvent, i: number) => void
  onDrop: (i: number) => void
  draggingIndex: number | null
  index: number
}) {
  const [open, setOpen] = useState(false)
  const [uas, setUas] = useState<OrganoCentralizadoNode[]>(node.children)
  const [uaDragging, setUaDragging] = useState<number | null>(null)
  const [addUaOpen, setAddUaOpen] = useState(false)
  const [editSecOpen, setEditSecOpen] = useState(false)
  const [deleteSecOpen, setDeleteSecOpen] = useState(false)
  const [editUaOpen, setEditUaOpen] = useState(false)
  const [deleteUaOpen, setDeleteUaOpen] = useState(false)
  const [targetUa, setTargetUa] = useState<OrganoCentralizadoNode | null>(null)
  const [uaNombre, setUaNombre] = useState("")
  const [uaClave, setUaClave] = useState("")
  const [secNombre, setSecNombre] = useState(node.nombre)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Search + pagination inside the expanded panel
  const [uaSearch, setUaSearch] = useState("")
  const [uaPage, setUaPage] = useState(0)

  useEffect(() => { setUas(node.children) }, [node.children])
  useEffect(() => { setUaPage(0) }, [uaSearch])
  useEffect(() => { if (!open) { setUaSearch(""); setUaPage(0) } }, [open])

  const uasFiltered = useMemo(() => {
    const q = uaSearch.trim().toLowerCase()
    if (!q) return uas
    return uas.filter(ua =>
        ua.nombre.toLowerCase().includes(q) ||
        (ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? "").toLowerCase().includes(q)
    )
  }, [uas, uaSearch])

  const uaTotalPages = Math.max(1, Math.ceil(uasFiltered.length / UA_PAGE_SIZE))
  const safePage = Math.min(uaPage, uaTotalPages - 1)
  const uasPageItems = uasFiltered.slice(safePage * UA_PAGE_SIZE, (safePage + 1) * UA_PAGE_SIZE)

  const handleAddUa = async () => {
    setFormError("")
    if (!uaNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (!uaClave.trim()) { setFormError("La clave es requerida"); return }
    if (uaClave.replace(/\D/g, "").length < 7) { setFormError("La clave debe tener al menos 7 dígitos"); return }
    if (uas.some((u) => normNombre(u.nombre) === normNombre(uaNombre))) {
      setFormError("Ya existe una UA con ese nombre en esta secretaría"); return
    }
    if (uaClave.trim()) {
      const todasUas = allTree.flatMap((n) => n.children)
      if (todasUas.some((u) => normClave(u.ua_clave_administrativa ?? u.clave_reporte_plazas ?? "") === normClave(uaClave) && normClave(u.ua_clave_administrativa ?? u.clave_reporte_plazas ?? "") !== "")) {
        setFormError("Esa clave ya está asignada a otra unidad administrativa"); return
      }
    }
    setSaving(true)
    try {
      await createOrganoCentralizado({ nombre: uaNombre.trim(), parentId: node.id, ua_clave_administrativa: uaClave.trim() || null, orden: uas.length })
      setAddUaOpen(false); setUaNombre(""); setUaClave(""); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleEditSec = async () => {
    setFormError("")
    if (!secNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (allTree.some((n) => normNombre(n.nombre) === normNombre(secNombre) && n.id !== node.id)) {
      setFormError("Ya existe una secretaría con ese nombre"); return
    }
    setSaving(true)
    try {
      await updateOrganoCentralizado(node.id, { nombre: secNombre.trim() })
      setEditSecOpen(false); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleDeleteSec = async () => {
    if (uas.length > 0) {
      setFormError(`No se puede eliminar: tiene ${uas.length} unidad${uas.length !== 1 ? "es" : ""} administrativa${uas.length !== 1 ? "s" : ""} asignada${uas.length !== 1 ? "s" : ""}. Elimina o reasigna las unidades primero.`)
      return
    }
    setSaving(true)
    try { await deleteOrganoCentralizado(node.id); setDeleteSecOpen(false); onRefresh() }
    catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleEditUa = async () => {
    if (!targetUa) return
    setFormError("")
    if (!uaNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (uas.some((u) => normNombre(u.nombre) === normNombre(uaNombre) && u.id !== targetUa.id)) {
      setFormError("Ya existe una UA con ese nombre en esta secretaría"); return
    }
    if (uaClave.trim()) {
      const todasUas = allTree.flatMap((n) => n.children)
      if (todasUas.some((u) => normClave(u.ua_clave_administrativa ?? u.clave_reporte_plazas ?? "") === normClave(uaClave) && normClave(u.ua_clave_administrativa ?? u.clave_reporte_plazas ?? "") !== "" && u.id !== targetUa.id)) {
        setFormError("Esa clave ya está asignada a otra unidad administrativa"); return
      }
    }
    setSaving(true)
    try {
      await updateOrganoCentralizado(targetUa.id, { nombre: uaNombre.trim(), ua_clave_administrativa: uaClave.trim() || null })
      setEditUaOpen(false); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleDeleteUa = async () => {
    if (!targetUa) return
    setSaving(true)
    try { await deleteOrganoCentralizado(targetUa.id); setDeleteUaOpen(false); onRefresh() }
    catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleUaDrop = async (toIndex: number) => {
    if (uaDragging === null || uaDragging === toIndex) { setUaDragging(null); return }
    const reordered = reorder(uas, uaDragging, toIndex)
    setUas(reordered); setUaDragging(null)
    await Promise.all(reordered.map((u, idx) => updateOrganoCentralizado(u.id, { orden: idx }))).catch(console.error)
  }

  const isDragging = draggingIndex === index
  return (
      <>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={() => onDrop(index)}
              className={[
                "flex items-center gap-2 py-3 px-4 rounded-xl border bg-white transition-all border-[#e4e3dc] shadow-sm",
                isDragging ? "opacity-40 border-dashed" : "",
              ].join(" ")}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0 hover:text-muted-foreground/60" />
            <CollapsibleTrigger asChild>
              <button
                  type="button"
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
              >
                <img src="/iconos2/addPlus.svg" alt="" width={16} height={16} className={`transition-transform duration-200${open ? " rotate-45" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block leading-tight">{node.nombre}</span>
              <span className="text-xs text-muted-foreground">
              {uas.length} Unidad{uas.length !== 1 ? "es" : ""} Administrativa{uas.length !== 1 ? "s" : ""}
            </span>
            </div>
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                      style={{ color: VINO }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${VINO}15`)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Más opciones"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSecNombre(node.nombre); setFormError(""); setEditSecOpen(true) }}>
                    <Pencil className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setFormError(""); setDeleteSecOpen(true) }}>
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setUaNombre(""); setUaClave(""); setFormError(""); setAddUaOpen(true) }}>
                    <Plus className="h-4 w-4" /> Agregar UA
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Unidades Administrativas */}
          <CollapsibleContent>
            <div className="mt-2 mb-2 ml-6 border-l-2 border-[#773357]/15 pl-3">

              {/* Search bar */}
              {uas.length > 0 && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                      <input
                          type="text"
                          placeholder="Buscar unidad..."
                          value={uaSearch}
                          onChange={(e) => setUaSearch(e.target.value)}
                          className="w-full h-8 rounded-lg border border-[#e4e3dc] bg-white pl-8 pr-8 text-xs outline-none transition-colors focus:border-[#773357]/50 placeholder:text-muted-foreground/40"
                      />
                      {uaSearch && (
                          <button
                              type="button"
                              onClick={() => setUaSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                      )}
                    </div>
                    {uaSearch && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                    {uasFiltered.length} resultado{uasFiltered.length !== 1 ? "s" : ""}
                  </span>
                    )}
                  </div>
              )}

              {/* UA items */}
              <div className="space-y-0.5">
                {uasPageItems.map((ua, pageIdx) => {
                  const globalIdx = !uaSearch ? safePage * UA_PAGE_SIZE + pageIdx : pageIdx
                  const clave = ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? ""
                  return (
                      <div
                          key={ua.id}
                          draggable={!uaSearch}
                          onDragStart={() => { if (!uaSearch) setUaDragging(globalIdx) }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (!uaSearch) handleUaDrop(globalIdx) }}
                          className={[
                            "group flex items-center gap-2 py-2 px-3 rounded-lg border transition-all",
                            !uaSearch && uaDragging === globalIdx
                                ? "opacity-40 border-dashed border-[#e4e3dc]"
                                : "border-transparent hover:border-[#e4e3dc] hover:bg-[#f9f8f5]",
                          ].join(" ")}
                      >
                        <GripVertical className={`h-3.5 w-3.5 shrink-0 ${uaSearch ? "invisible" : "text-muted-foreground/25 cursor-grab"}`} />
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: VINO, opacity: 0.5 }} />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm truncate text-foreground">{ua.nombre}</span>
                          {clave && (
                              <span className="text-xs text-muted-foreground font-mono shrink-0 ml-auto pr-2" title="Clave Reporte Plazas">
                          {displayClave(clave)}
                        </span>
                          )}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                  type="button"
                                  className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                                  style={{ color: VINO }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${VINO}15`)}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  aria-label="Más opciones"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setTargetUa(ua); setUaNombre(ua.nombre); setUaClave(rawToClaveStr(ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? "")); setFormError(""); setEditUaOpen(true) }}>
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setTargetUa(ua); setFormError(""); setDeleteUaOpen(true) }}>
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                  )
                })}

                {uasFiltered.length === 0 && uaSearch && (
                    <p className="text-xs text-muted-foreground ml-4 py-2 italic">Sin resultados para &quot;{uaSearch}&quot;</p>
                )}
                {uas.length === 0 && (
                    <p className="text-xs text-muted-foreground ml-4 py-2 italic">Sin unidades administrativas</p>
                )}
              </div>

              {/* Pagination */}
              {uaTotalPages > 1 && (
                  <div className="mt-2 pt-2 border-t border-[#e4e3dc]/60">
                    <div className="flex justify-center items-center gap-1">
                      <button
                          type="button"
                          disabled={safePage === 0}
                          onClick={() => setUaPage(p => Math.max(0, p - 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      {paginationPages(uaTotalPages, safePage).map((p, idx) =>
                          p === "..." ? (
                              <span key={`el-${idx}`} className="flex h-8 w-8 items-center justify-center text-xs text-gray-400">…</span>
                          ) : (
                              <button
                                  key={p}
                                  type="button"
                                  onClick={() => setUaPage(p as number)}
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                                    p === safePage
                                        ? "border border-gray-300 bg-white text-gray-700 font-semibold"
                                        : "text-gray-500 hover:bg-gray-50",
                                  ].join(" ")}
                              >
                                {(p as number) + 1}
                              </button>
                          )
                      )}
                      <button
                          type="button"
                          disabled={safePage === uaTotalPages - 1}
                          onClick={() => setUaPage(p => Math.min(uaTotalPages - 1, p + 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Dialogs */}
        <Dialog open={addUaOpen} onOpenChange={setAddUaOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Agregar Unidad Administrativa</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground px-6 pt-3">Secretaría: <strong>{node.nombre}</strong></p>
            <div className="flex flex-col gap-3 px-6 pt-2 pb-1">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={uaNombre} onChange={(e) => setUaNombre(e.target.value)} placeholder="Ej. Dirección General de..." onKeyDown={(e) => e.key === "Enter" && handleAddUa()} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Clave Reporte Plazas <span className="text-destructive">*</span></Label>
                <ClaveInput value={uaClave} onChange={setUaClave} />
              </div>
              {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
            </div>
            <DialogFooter className={DIALOG_FOOTER_CLASS}>
              <DialogClose asChild>
                <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
              </DialogClose>
              <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleAddUa} disabled={saving || !uaNombre.trim() || uaClave.replace(/\D/g, "").length < 7}>
                {saving ? "Agregando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editSecOpen} onOpenChange={setEditSecOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Secretaría</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={secNombre} onChange={(e) => setSecNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditSec()} autoFocus />
              </div>
              {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
            </div>
            <DialogFooter className={DIALOG_FOOTER_CLASS}>
              <DialogClose asChild>
                <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
              </DialogClose>
              <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleEditSec} disabled={saving || !secNombre.trim()}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
            open={deleteSecOpen}
            onClose={() => { setDeleteSecOpen(false); setFormError("") }}
            onConfirm={handleDeleteSec}
            variant="eliminar"
            title="Eliminar Secretaría"
            description={
              uas.length > 0
                  ? <>No se puede eliminar <strong>{node.nombre}</strong> mientras tenga <strong>{uas.length}</strong> unidad{uas.length !== 1 ? "es" : ""} administrativa{uas.length !== 1 ? "s" : ""} asignada{uas.length !== 1 ? "s" : ""}. Elimina o reasigna las unidades primero.</>
                  : <>Se eliminará <strong>{node.nombre}</strong>. Esta acción no se puede deshacer.</>
            }
            confirmLabel="Sí, Eliminar"
            loading={saving}
            error={formError || undefined}
        />

        <Dialog open={editUaOpen} onOpenChange={setEditUaOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Unidad Administrativa</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={uaNombre} onChange={(e) => setUaNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditUa()} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Clave Reporte Plazas</Label>
                <ClaveInput value={uaClave} onChange={setUaClave} />
              </div>
              {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
            </div>
            <DialogFooter className={DIALOG_FOOTER_CLASS}>
              <DialogClose asChild>
                <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
              </DialogClose>
              <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleEditUa} disabled={saving || !uaNombre.trim()}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
            open={deleteUaOpen}
            onClose={() => { setDeleteUaOpen(false); setFormError("") }}
            onConfirm={handleDeleteUa}
            variant="eliminar"
            title="Eliminar Unidad Administrativa"
            description={<>Se eliminará <strong>{targetUa?.nombre}</strong>. Esta acción no se puede deshacer.</>}
            confirmLabel="Sí, Eliminar"
            loading={saving}
            error={formError || undefined}
        />
      </>
  )
}

export function CatalogoCentralizadaTab() {
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [addSecOpen, setAddSecOpen] = useState(false)
  const [newSecNombre, setNewSecNombre] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try { setTree(await fetchCentralizadaTree()) }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Error al cargar el catálogo") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = search
      ? tree.filter((n) => n.nombre.toLowerCase().includes(search.toLowerCase()) || n.children.some((c) => c.nombre.toLowerCase().includes(search.toLowerCase())))
      : tree

  const handleDrop = async (toIndex: number) => {
    if (draggingIndex === null || draggingIndex === toIndex) { setDraggingIndex(null); return }
    const reordered = reorder(tree, draggingIndex, toIndex)
    setTree(reordered); setDraggingIndex(null)
    await Promise.all(reordered.map((n, idx) => updateOrganoCentralizado(n.id, { orden: idx }))).catch(console.error)
  }

  const handleAddSec = async () => {
    setFormError("")
    if (!newSecNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (tree.some((n) => normNombre(n.nombre) === normNombre(newSecNombre))) {
      setFormError("Ya existe una secretaría con ese nombre"); return
    }
    setSaving(true)
    try {
      await createOrganoCentralizado({ nombre: newSecNombre.trim(), parentId: null, orden: tree.length, tipo: "SECRETARIA" })
      setAddSecOpen(false); setNewSecNombre(""); await load()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const totalUas = tree.reduce((s, n) => s + n.children.length, 0)

  return (
      <>
        <Card className="shadow-sm border-[#e4e3dc] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#e4e3dc] bg-[#f9f8f5]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#773357]/10 shrink-0">
                <Building2 className="h-5 w-5" style={{ color: VINO }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground leading-tight">Administración Pública Centralizada</h3>
                {!loading && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tree.length} secretaría{tree.length !== 1 ? "s" : ""} · {totalUas} unidad{totalUas !== 1 ? "es" : ""} administrativa{totalUas !== 1 ? "s" : ""}
                    </p>
                )}
              </div>
            </div>
            <Button
                size="sm"
                className="shrink-0 rounded-full text-white font-medium gap-1.5 bg-[#773357] hover:bg-[#773357] active:bg-[#773357] active:text-white border-0"
                onClick={() => { setNewSecNombre(""); setFormError(""); setAddSecOpen(true) }}
            >
              Agregar Secretaría
            </Button>
          </div>

          {/* Búsqueda */}
          <div className="px-6 py-3 border-b border-[#e4e3dc]">
            <SearchInput placeholder="Buscar secretaría o unidad..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Lista */}
          <CardContent className="p-4">
            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                </div>
            ) : loadError ? (
                <div className="flex items-center gap-3 rounded-lg border-l-4 border-l-red-500 bg-red-50 px-4 py-3 my-4">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-red-700">Error al cargar el catálogo</span>
                    <span className="text-xs text-red-600">{loadError}</span>
                  </div>
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  {search ? "Sin resultados para esa búsqueda." : "No hay secretarías. Agrega una con el botón de arriba."}
                </p>
            ) : (
                <div className="space-y-2">
                  {filtered.map((node, i) => (
                      <SecretariaRow
                          key={node.id} node={node} index={i} allTree={tree} onRefresh={load}
                          onDragStart={(idx) => setDraggingIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                          draggingIndex={draggingIndex}
                      />
                  ))}
                </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog nueva secretaría */}
        <Dialog open={addSecOpen} onOpenChange={setAddSecOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Secretaría</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input className="h-9 w-4/5 self-center text-sm" value={newSecNombre} onChange={(e) => setNewSecNombre(e.target.value)} placeholder="Ej. Secretaría de Educación" onKeyDown={(e) => e.key === "Enter" && handleAddSec()} autoFocus />
              </div>
              {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
            </div>
            <DialogFooter className={DIALOG_FOOTER_CLASS}>
              <DialogClose asChild>
                <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
              </DialogClose>
              <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleAddSec} disabled={saving || !newSecNombre.trim()}>
                {saving ? "Creando..." : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
  )
}