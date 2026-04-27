"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Search,
  Building2, Loader2, GripVertical, AlertCircle,
} from "lucide-react"
import {
  fetchCentralizadaTree,
  createOrganoCentralizado,
  updateOrganoCentralizado,
  deleteOrganoCentralizado,
  type OrganoCentralizadoNode,
} from "@/lib/catalogo-api"

function reorder<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}
function normNombre(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normClave(s: string) {
  return s.replace(/\D/g, "")
}

function displayClave(c: string): string {
  return c.replace(/\./g, " ").trim()
}

function rawToClaveStr(raw: string): string {
  if (!raw || raw.includes(".")) return raw
  const d = raw.replace(/\D/g, "")
  const g0 = d.slice(0, 2).replace(/^0/, "") || d.slice(0, 1)
  const parts = [g0, d.slice(2,4), d.slice(4,6), d.slice(6,7), d.slice(7,8), d.slice(8,9), d.slice(9,10)]
  return parts.filter(Boolean).join(".")
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
    if (e.key === "Backspace" && !segs[i] && i > 0) {
      refs.current[i - 1]?.focus()
      refs.current[i - 1]?.select()
    }
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

  useEffect(() => { setUas(node.children) }, [node.children])

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
          className={`flex items-center gap-2 py-3 px-4 rounded-xl border transition-all
            ${isDragging ? "opacity-40 border-dashed border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30 hover:shadow-sm"}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0" />
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold truncate block">{node.nombre}</span>
            <span className="text-xs text-muted-foreground">{uas.length} Unidad{uas.length !== 1 ? "es" : ""} Administrativa{uas.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
              onClick={(e) => { e.stopPropagation(); setUaNombre(""); setUaClave(""); setFormError(""); setAddUaOpen(true) }}>
              <Plus className="h-3.5 w-3.5" /> Agregar UA
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); setSecNombre(node.nombre); setFormError(""); setEditSecOpen(true) }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setFormError(""); setDeleteSecOpen(true) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-1 mb-2 ml-4 space-y-0.5">
            {uas.map((ua, i) => {
              const clave = ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? ""
              return (
                <div
                  key={ua.id}
                  draggable
                  onDragStart={() => setUaDragging(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleUaDrop(i)}
                  className={`group flex items-center gap-2 py-2 px-3 rounded-lg border transition-all
                      ${uaDragging === i ? "opacity-40 border-dashed border-primary" : "border-transparent hover:border-border hover:bg-muted/40"}`}
                   >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab shrink-0" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm truncate">{ua.nombre}</span>
                    {clave && (
                       <span
                        className="text-xs text-muted-foreground font-mono shrink-0 ml-auto pr-2"
                        title="Clave Reporte Plazas"
                        >
                        {displayClave(clave)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setTargetUa(ua)
                        setUaNombre(ua.nombre)
                        setUaClave(rawToClaveStr(ua.ua_clave_administrativa ?? ua.clave_reporte_plazas ?? ""))
                        setFormError("")
                        setEditUaOpen(true)
                        }}>
                        <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                         onClick={() => { setTargetUa(ua); setFormError(""); setDeleteUaOpen(true) }}>
                         <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {uas.length === 0 && <p className="text-xs text-muted-foreground ml-6 py-2 italic">Sin unidades administrativas</p>}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {}
      <Dialog open={addUaOpen} onOpenChange={setAddUaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Unidad Administrativa</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Secretaría: <strong>{node.nombre}</strong></p>
          <div className="flex flex-col gap-3 py-1">
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
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddUa} disabled={saving || !uaNombre.trim() || uaClave.replace(/\D/g, "").length < 7}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={editSecOpen} onOpenChange={setEditSecOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Secretaría</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={secNombre} onChange={(e) => setSecNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditSec()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEditSec} disabled={saving || !secNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={deleteSecOpen} onOpenChange={setDeleteSecOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Secretaría</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Se eliminará <strong>{node.nombre}</strong> y sus <strong>{uas.length}</strong> unidades. Esta acción no se puede deshacer.</p>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteSec} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={editUaOpen} onOpenChange={setEditUaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Unidad Administrativa</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
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
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEditUa} disabled={saving || !uaNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={deleteUaOpen} onOpenChange={setDeleteUaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Unidad Administrativa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Se eliminará <strong>{targetUa?.nombre}</strong>. Esta acción no se puede deshacer.</p>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteUa} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CatalogoCentralizadaTab() {
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [addSecOpen, setAddSecOpen] = useState(false)
  const [newSecNombre, setNewSecNombre] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const load = useCallback(async () => {
    setLoading(true)
    try { setTree(await fetchCentralizadaTree()) }
    catch (e) { console.error(e) }
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
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Administración Pública Centralizada
          </CardTitle>
          <CardDescription>{!loading && `${tree.length} secretarías · ${totalUas} unidades administrativas`}</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setNewSecNombre(""); setFormError(""); setAddSecOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Agregar Secretaría
          </Button>
          </div>
          <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar secretaría o unidad..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {search ? "Sin resultados" : "No hay secretarías. Agrega una con el botón de arriba."}
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

      {}
      <Dialog open={addSecOpen} onOpenChange={setAddSecOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Secretaría</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={newSecNombre} onChange={(e) => setNewSecNombre(e.target.value)} placeholder="Ej. Secretaría de Educación" onKeyDown={(e) => e.key === "Enter" && handleAddSec()} autoFocus />
          </div>
          {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddSec} disabled={saving || !newSecNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
