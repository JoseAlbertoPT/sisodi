"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
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
  Plus, Pencil, Trash2, MoreHorizontal,
  Landmark, Loader2, GripVertical, AlertCircle, ChevronRight, ChevronLeft, Search, X,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  fetchCategoriasParaestatal,
  createCategoriaParaestatal,
  updateCategoriaParaestatal,
  deleteCategoriaParaestatal,
  createOrganoParaestatal,
  updateOrganoParaestatal,
  deleteOrganoParaestatal,
  type CategoriaParaestatalItem,
  type OrganoParaestatalItem,
} from "@/lib/catalogo-api"

const VINO = "#773357"
const VINO_HOVER = "#773357"
const AREA_PAGE_SIZE = 10
const BTN_CANCEL: React.CSSProperties = {}
const BTN_CANCEL_CLASS =
  "rounded-full h-10 px-6 font-medium border-[1.5px] border-[#d1d5db] shadow-sm bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb] hover:text-[#4b5563] active:bg-[#f3f4f6] active:text-[#4b5563] focus:bg-[#f3f4f6] focus:text-[#4b5563]"
const BTN_CONFIRM_CLASS = "rounded-full h-10 px-6 font-medium shadow-sm"
const DIALOG_FOOTER_CLASS = "gap-3 pt-6 pb-1 mt-2 border-t border-[#e4e3dc]"

function reorder<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}

function normNombre(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
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

function OrganoRow({
  node, allOrganismos, onRefresh, onDragStart, onDragOver, onDrop, draggingIndex, index,
}: {
  node: CategoriaParaestatalItem
  allOrganismos: CategoriaParaestatalItem[]
  onRefresh: () => void
  onDragStart: (i: number) => void
  onDragOver: (e: React.DragEvent, i: number) => void
  onDrop: (i: number) => void
  draggingIndex: number | null
  index: number
}) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<OrganoParaestatalItem[]>(node.organos)
  const [areaDragging, setAreaDragging] = useState<number | null>(null)
  const [addAreaOpen, setAddAreaOpen] = useState(false)
  const [editOrgOpen, setEditOrgOpen] = useState(false)
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false)
  const [editAreaOpen, setEditAreaOpen] = useState(false)
  const [deleteAreaOpen, setDeleteAreaOpen] = useState(false)
  const [targetArea, setTargetArea] = useState<OrganoParaestatalItem | null>(null)
  const [areaNombre, setAreaNombre] = useState("")
  const [orgNombre, setOrgNombre] = useState(node.nombre)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Search + pagination inside the expanded panel
  const [areaSearch, setAreaSearch] = useState("")
  const [areaPage, setAreaPage] = useState(0)

  useEffect(() => { setAreas(node.organos) }, [node.organos])
  useEffect(() => { setAreaPage(0) }, [areaSearch])
  useEffect(() => { if (!open) { setAreaSearch(""); setAreaPage(0) } }, [open])

  const areasFiltered = useMemo(() => {
    const q = areaSearch.trim().toLowerCase()
    if (!q) return areas
    return areas.filter(a => a.nombre.toLowerCase().includes(q))
  }, [areas, areaSearch])

  const areaTotalPages = Math.max(1, Math.ceil(areasFiltered.length / AREA_PAGE_SIZE))
  const safePage = Math.min(areaPage, areaTotalPages - 1)
  const areasPageItems = areasFiltered.slice(safePage * AREA_PAGE_SIZE, (safePage + 1) * AREA_PAGE_SIZE)

  const handleAddArea = async () => {
    setFormError("")
    if (!areaNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (areas.some((a) => normNombre(a.nombre) === normNombre(areaNombre))) {
      setFormError("Ya existe un área con ese nombre en este organismo"); return
    }
    setSaving(true)
    try {
      await createOrganoParaestatal({ nombre: areaNombre.trim(), categoriaId: node.id, orden: areas.length })
      setAddAreaOpen(false); setAreaNombre(""); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleEditOrg = async () => {
    setFormError("")
    if (!orgNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (allOrganismos.some((o) => normNombre(o.nombre) === normNombre(orgNombre) && o.id !== node.id)) {
      setFormError("Ya existe un organismo con ese nombre"); return
    }
    setSaving(true)
    try {
      await updateCategoriaParaestatal(node.id, { nombre: orgNombre.trim() })
      setEditOrgOpen(false); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleDeleteOrg = async () => {
    setSaving(true)
    try { await deleteCategoriaParaestatal(node.id); setDeleteOrgOpen(false); onRefresh() }
    catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleEditArea = async () => {
    if (!targetArea) return
    setFormError("")
    if (!areaNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (areas.some((a) => normNombre(a.nombre) === normNombre(areaNombre) && a.id !== targetArea.id)) {
      setFormError("Ya existe un área con ese nombre en este organismo"); return
    }
    setSaving(true)
    try {
      await updateOrganoParaestatal(targetArea.id, { nombre: areaNombre.trim() })
      setEditAreaOpen(false); onRefresh()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleDeleteArea = async () => {
    if (!targetArea) return
    setSaving(true)
    try { await deleteOrganoParaestatal(targetArea.id); setDeleteAreaOpen(false); onRefresh() }
    catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const handleAreaDrop = async (toIndex: number) => {
    if (areaDragging === null || areaDragging === toIndex) { setAreaDragging(null); return }
    const reordered = reorder(areas, areaDragging, toIndex)
    setAreas(reordered); setAreaDragging(null)
    await Promise.all(reordered.map((a, idx) => updateOrganoParaestatal(a.id, { orden: idx }))).catch(console.error)
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
              {areas.length} área{areas.length !== 1 ? "s" : ""}
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
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setOrgNombre(node.nombre); setFormError(""); setEditOrgOpen(true) }}>
                  <Pencil className="h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setFormError(""); setDeleteOrgOpen(true) }}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAreaNombre(""); setFormError(""); setAddAreaOpen(true) }}>
                  <Plus className="h-4 w-4" /> Agregar Área
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Áreas ── */}
        <CollapsibleContent>
          <div className="mt-2 mb-2 ml-6 border-l-2 border-[#773357]/15 pl-3">

            {/* Search bar */}
            {areas.length > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar área..."
                    value={areaSearch}
                    onChange={(e) => setAreaSearch(e.target.value)}
                    className="w-full h-8 rounded-lg border border-[#e4e3dc] bg-white pl-8 pr-8 text-xs outline-none transition-colors focus:border-[#773357]/50 placeholder:text-muted-foreground/40"
                  />
                  {areaSearch && (
                    <button
                      type="button"
                      onClick={() => setAreaSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {areaSearch && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {areasFiltered.length} resultado{areasFiltered.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {/* Area items */}
            <div className="space-y-0.5">
              {areasPageItems.map((area, pageIdx) => {
                const globalIdx = !areaSearch ? safePage * AREA_PAGE_SIZE + pageIdx : pageIdx
                return (
                  <div
                    key={area.id}
                    draggable={!areaSearch}
                    onDragStart={() => { if (!areaSearch) setAreaDragging(globalIdx) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (!areaSearch) handleAreaDrop(globalIdx) }}
                    className={[
                      "group flex items-center gap-2 py-2 px-3 rounded-lg border transition-all",
                      !areaSearch && areaDragging === globalIdx
                        ? "opacity-40 border-dashed border-[#e4e3dc]"
                        : "border-transparent hover:border-[#e4e3dc] hover:bg-[#f9f8f5]",
                    ].join(" ")}
                  >
                    <GripVertical className={`h-3.5 w-3.5 shrink-0 ${areaSearch ? "invisible" : "text-muted-foreground/25 cursor-grab"}`} />
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: VINO, opacity: 0.5 }} />
                    <span className="text-sm flex-1 truncate text-foreground">{area.nombre}</span>
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
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setTargetArea(area); setAreaNombre(area.nombre); setFormError(""); setEditAreaOpen(true) }}>
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setTargetArea(area); setFormError(""); setDeleteAreaOpen(true) }}>
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}

              {areasFiltered.length === 0 && areaSearch && (
                <p className="text-xs text-muted-foreground ml-4 py-2 italic">Sin resultados para &quot;{areaSearch}&quot;</p>
              )}
              {areas.length === 0 && (
                <p className="text-xs text-muted-foreground ml-4 py-2 italic">Sin áreas internas</p>
              )}
            </div>

            {/* Pagination */}
            {areaTotalPages > 1 && (
              <div className="mt-2 pt-2 border-t border-[#e4e3dc]/60">
                <div className="flex justify-center items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage === 0}
                    onClick={() => setAreaPage(p => Math.max(0, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {paginationPages(areaTotalPages, safePage).map((p, idx) =>
                    p === "..." ? (
                      <span key={`el-${idx}`} className="flex h-8 w-8 items-center justify-center text-xs text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAreaPage(p as number)}
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
                    disabled={safePage === areaTotalPages - 1}
                    onClick={() => setAreaPage(p => Math.min(areaTotalPages - 1, p + 1))}
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
      <Dialog open={addAreaOpen} onOpenChange={setAddAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Área</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground px-6 pt-1">Organismo: <strong>{node.nombre}</strong></p>
          <div className="flex flex-col gap-3 px-6 pt-2 pb-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre del área <span className="text-destructive">*</span></Label>
              <Input value={areaNombre} onChange={(e) => setAreaNombre(e.target.value)} placeholder="Ej. Subdirección de Finanzas" onKeyDown={(e) => e.key === "Enter" && handleAddArea()} autoFocus className="h-9 text-sm" />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <DialogClose asChild>
              <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
            </DialogClose>
            <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleAddArea} disabled={saving || !areaNombre.trim()}>
              {saving ? "Agregando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOrgOpen} onOpenChange={setEditOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Organismo</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={orgNombre} onChange={(e) => setOrgNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditOrg()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <DialogClose asChild>
              <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
            </DialogClose>
            <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleEditOrg} disabled={saving || !orgNombre.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOrgOpen}
        onClose={() => { setDeleteOrgOpen(false); setFormError("") }}
        onConfirm={handleDeleteOrg}
        variant="eliminar"
        title="Eliminar Organismo"
        description={<>Se eliminará <strong>{node.nombre}</strong> y sus <strong>{areas.length}</strong> áreas. Esta acción no se puede deshacer.</>}
        confirmLabel="Sí, Eliminar"
        loading={saving}
        error={formError || undefined}
      />

      <Dialog open={editAreaOpen} onOpenChange={setEditAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Área</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={areaNombre} onChange={(e) => setAreaNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditArea()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <DialogClose asChild>
              <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
            </DialogClose>
            <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleEditArea} disabled={saving || !areaNombre.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteAreaOpen}
        onClose={() => { setDeleteAreaOpen(false); setFormError("") }}
        onConfirm={handleDeleteArea}
        variant="eliminar"
        title="Eliminar Área"
        description={<>Se eliminará <strong>{targetArea?.nombre}</strong>. Esta acción no se puede deshacer.</>}
        confirmLabel="Sí, Eliminar"
        loading={saving}
        error={formError || undefined}
      />
    </>
  )
}

export function CatalogoParaestatalTab() {
  const [organismos, setOrganismos] = useState<CategoriaParaestatalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [addOrgOpen, setAddOrgOpen] = useState(false)
  const [newOrgNombre, setNewOrgNombre] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try { setOrganismos(await fetchCategoriasParaestatal()) }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Error al cargar el catálogo") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = search
    ? organismos.filter((n) => n.nombre.toLowerCase().includes(search.toLowerCase()) || n.organos.some((a) => a.nombre.toLowerCase().includes(search.toLowerCase())))
    : organismos

  const handleDrop = async (toIndex: number) => {
    if (draggingIndex === null || draggingIndex === toIndex) { setDraggingIndex(null); return }
    const reordered = reorder(organismos, draggingIndex, toIndex)
    setOrganismos(reordered); setDraggingIndex(null)
    await Promise.all(reordered.map((n, idx) => updateCategoriaParaestatal(n.id, { orden: idx }))).catch(console.error)
  }

  const handleAddOrg = async () => {
    setFormError("")
    if (!newOrgNombre.trim()) { setFormError("El nombre es requerido"); return }
    if (organismos.some((o) => normNombre(o.nombre) === normNombre(newOrgNombre))) {
      setFormError("Ya existe un organismo con ese nombre"); return
    }
    setSaving(true)
    try {
      await createCategoriaParaestatal({ nombre: newOrgNombre.trim(), orden: organismos.length })
      setAddOrgOpen(false); setNewOrgNombre(""); await load()
    } catch (e) { setFormError(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  const totalAreas = organismos.reduce((s, n) => s + n.organos.length, 0)

  return (
    <>
      <Card className="shadow-sm border-[#e4e3dc] overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#e4e3dc] bg-[#f9f8f5]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#773357]/10 shrink-0">
              <Landmark className="h-5 w-5" style={{ color: VINO }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">Administración Pública Paraestatal</h3>
              {!loading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {organismos.length} organismo{organismos.length !== 1 ? "s" : ""} · {totalAreas} área{totalAreas !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-full text-white font-medium gap-1.5 bg-[#773357] hover:bg-[#773357] active:bg-[#773357] active:text-white border-0"
            onClick={() => { setNewOrgNombre(""); setFormError(""); setAddOrgOpen(true) }}
          >
            Agregar Organismo
          </Button>
        </div>

        {/* ── Búsqueda ── */}
        <div className="px-6 py-3 border-b border-[#e4e3dc]">
          <SearchInput placeholder="Buscar organismo o área..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* ── Lista ── */}
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
              {search ? "Sin resultados para esa búsqueda." : "No hay organismos. Agrega uno con el botón de arriba."}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((org, i) => (
                <OrganoRow
                  key={org.id} node={org} index={i} allOrganismos={organismos} onRefresh={load}
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

      {/* Dialog nuevo organismo */}
      <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Organismo Paraestatal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={newOrgNombre} onChange={(e) => setNewOrgNombre(e.target.value)} placeholder="Ej. Instituto Morelense de la Vivienda" onKeyDown={(e) => e.key === "Enter" && handleAddOrg()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter className={DIALOG_FOOTER_CLASS}>
            <DialogClose asChild>
              <Button type="button" className={BTN_CANCEL_CLASS}>Cancelar</Button>
            </DialogClose>
            <Button variant="vino" className={BTN_CONFIRM_CLASS} onClick={handleAddOrg} disabled={saving || !newOrgNombre.trim()}>
              {saving ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
