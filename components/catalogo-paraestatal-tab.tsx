"use client"

import { useState, useEffect, useCallback } from "react"
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
  Landmark, Loader2, GripVertical, AlertCircle,
} from "lucide-react"
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

function reorder<T>(list: T[], from: number, to: number): T[] {
  const result = [...list]
  const [removed] = result.splice(from, 1)
  result.splice(to, 0, removed)
  return result
}

function normNombre(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

  useEffect(() => { setAreas(node.organos) }, [node.organos])

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
          className={`flex items-center gap-2 py-3 px-4 rounded-xl border transition-all
            ${isDragging ? "opacity-40 border-dashed border-[#832B56] bg-[#832B56]/5" : "border-border bg-card hover:border-[#832B56]/40 hover:shadow-sm"}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0" />
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold truncate block">{node.nombre}</span>
            <span className="text-xs text-muted-foreground">{areas.length} area{areas.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-[#832B56] hover:bg-[#832B56]/10 gap-1"
              onClick={(e) => { e.stopPropagation(); setAreaNombre(""); setFormError(""); setAddAreaOpen(true) }}>
              <Plus className="h-3.5 w-3.5" /> Agregar area
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); setOrgNombre(node.nombre); setFormError(""); setEditOrgOpen(true) }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setFormError(""); setDeleteOrgOpen(true) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-1 mb-2 ml-4 space-y-0.5">
            {areas.map((area, i) => (
              <div
                key={area.id}
                draggable
                onDragStart={() => setAreaDragging(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleAreaDrop(i)}
                className={`group flex items-center gap-2 py-2 px-3 rounded-lg border transition-all
                  ${areaDragging === i ? "opacity-40 border-dashed border-[#832B56]" : "border-transparent hover:border-border hover:bg-muted/40"}`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab shrink-0" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#832B56]/50 shrink-0" />
                <span className="text-sm flex-1 truncate">{area.nombre}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => { setTargetArea(area); setAreaNombre(area.nombre); setFormError(""); setEditAreaOpen(true) }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => { setTargetArea(area); setFormError(""); setDeleteAreaOpen(true) }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {areas.length === 0 && <p className="text-xs text-muted-foreground ml-6 py-2 italic">Sin areas internas</p>}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={addAreaOpen} onOpenChange={setAddAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Area</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Organismo: <strong>{node.nombre}</strong></p>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre del area <span className="text-destructive">*</span></Label>
              <Input value={areaNombre} onChange={(e) => setAreaNombre(e.target.value)} placeholder="Ej. Subdirección de Finanzas" onKeyDown={(e) => e.key === "Enter" && handleAddArea()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddArea} disabled={saving || !areaNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOrgOpen} onOpenChange={setEditOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Organismo</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={orgNombre} onChange={(e) => setOrgNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditOrg()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEditOrg} disabled={saving || !orgNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOrgOpen} onOpenChange={setDeleteOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Organismo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Se eliminará <strong>{node.nombre}</strong> y sus <strong>{areas.length}</strong> areas. Esta acción no se puede deshacer.</p>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteOrg} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editAreaOpen} onOpenChange={setEditAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Area</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={areaNombre} onChange={(e) => setAreaNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditArea()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEditArea} disabled={saving || !areaNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAreaOpen} onOpenChange={setDeleteAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Area</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Se eliminará <strong>{targetArea?.nombre}</strong>. Esta acción no se puede deshacer.</p>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteArea} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CatalogoParaestatalTab() {
  const [organismos, setOrganismos] = useState<CategoriaParaestatalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [addOrgOpen, setAddOrgOpen] = useState(false)
  const [newOrgNombre, setNewOrgNombre] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try { setOrganismos(await fetchCategoriasParaestatal()) }
    catch (e) { console.error(e) }
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
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[#832B56]" />
                Administracion Publica Paraestatal
              </CardTitle>
              <CardDescription>{!loading && `${organismos.length} organismos · ${totalAreas} areas`}</CardDescription>
            </div>
            <Button size="sm" className="bg-[#832B56] hover:bg-[#6B2347] text-white" onClick={() => { setNewOrgNombre(""); setFormError(""); setAddOrgOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Agregar organismo
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar organismo o area..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {search ? "Sin resultados" : "No hay organismos. Agrega uno con el botón de arriba."}
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

      <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Organismo Paraestatal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={newOrgNombre} onChange={(e) => setNewOrgNombre(e.target.value)} placeholder="Ej. Instituto Morelense de la Vivienda" onKeyDown={(e) => e.key === "Enter" && handleAddOrg()} autoFocus />
            </div>
            {formError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button className="bg-[#832B56] hover:bg-[#6B2347]" onClick={handleAddOrg} disabled={saving || !newOrgNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}