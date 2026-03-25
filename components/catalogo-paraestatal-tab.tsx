"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Search,
  Landmark,
  Loader2,
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

export function CatalogoParaestatalTab() {
  const [categorias, setCategorias] = useState<CategoriaParaestatalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [openCats, setOpenCats] = useState<Set<number>>(new Set())

  // Categoria dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [catDialogMode, setCatDialogMode] = useState<"add" | "edit">("add")
  const [catDialogItem, setCatDialogItem] = useState<CategoriaParaestatalItem | null>(null)
  const [catDialogNombre, setCatDialogNombre] = useState("")

  // Organo dialog
  const [orgDialogOpen, setOrgDialogOpen] = useState(false)
  const [orgDialogMode, setOrgDialogMode] = useState<"add" | "edit">("add")
  const [orgDialogItem, setOrgDialogItem] = useState<OrganoParaestatalItem | null>(null)
  const [orgDialogCatId, setOrgDialogCatId] = useState<number>(0)
  const [orgDialogNombre, setOrgDialogNombre] = useState("")

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteType, setDeleteType] = useState<"categoria" | "organo">("categoria")
  const [deleteId, setDeleteId] = useState<number>(0)
  const [deleteName, setDeleteName] = useState("")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCategoriasParaestatal()
      setCategorias(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleCat = (id: number) => {
    setOpenCats((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Categoria handlers
  const handleAddCat = () => {
    setCatDialogMode("add")
    setCatDialogItem(null)
    setCatDialogNombre("")
    setCatDialogOpen(true)
  }

  const handleEditCat = (cat: CategoriaParaestatalItem) => {
    setCatDialogMode("edit")
    setCatDialogItem(cat)
    setCatDialogNombre(cat.nombre)
    setCatDialogOpen(true)
  }

  const handleSaveCat = async () => {
    if (!catDialogNombre.trim()) return
    setSaving(true)
    try {
      if (catDialogMode === "add") {
        await createCategoriaParaestatal({ nombre: catDialogNombre.trim() })
      } else if (catDialogItem) {
        await updateCategoriaParaestatal(catDialogItem.id, { nombre: catDialogNombre.trim() })
      }
      setCatDialogOpen(false)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Organo handlers
  const handleAddOrg = (catId: number) => {
    setOrgDialogMode("add")
    setOrgDialogCatId(catId)
    setOrgDialogItem(null)
    setOrgDialogNombre("")
    setOrgDialogOpen(true)
  }

  const handleEditOrg = (org: OrganoParaestatalItem) => {
    setOrgDialogMode("edit")
    setOrgDialogItem(org)
    setOrgDialogNombre(org.nombre)
    setOrgDialogOpen(true)
  }

  const handleSaveOrg = async () => {
    if (!orgDialogNombre.trim()) return
    setSaving(true)
    try {
      if (orgDialogMode === "add") {
        await createOrganoParaestatal({
          nombre: orgDialogNombre.trim(),
          categoriaId: orgDialogCatId,
        })
      } else if (orgDialogItem) {
        await updateOrganoParaestatal(orgDialogItem.id, { nombre: orgDialogNombre.trim() })
      }
      setOrgDialogOpen(false)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDeleteClick = (type: "categoria" | "organo", id: number, name: string) => {
    setDeleteType(type)
    setDeleteId(id)
    setDeleteName(name)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      if (deleteType === "categoria") {
        await deleteCategoriaParaestatal(deleteId)
      } else {
        await deleteOrganoParaestatal(deleteId)
      }
      setDeleteOpen(false)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const filtered = search
    ? categorias
        .map((cat) => ({
          ...cat,
          organos: cat.organos.filter((o) =>
            o.nombre.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(
          (cat) =>
            cat.nombre.toLowerCase().includes(search.toLowerCase()) ||
            cat.organos.length > 0
        )
    : categorias

  return (
    <>
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-500" />
                Administracion Publica Paraestatal
              </CardTitle>
              <CardDescription>
                Categorias y organismos paraestatales.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddCat}>
              <Plus className="h-4 w-4 mr-1" />
              Nueva categoria
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria u organismo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Sin resultados" : "No hay categorias registradas"}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((cat) => (
                <Collapsible
                  key={cat.id}
                  open={openCats.has(cat.id) || !!search}
                  onOpenChange={() => toggleCat(cat.id)}
                >
                  <div className="flex items-center gap-1 py-2 px-2 rounded-md hover:bg-muted/50 border-l-2 border-l-emerald-500">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        {openCats.has(cat.id) || search ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <span className="text-sm font-medium flex-1 truncate">
                      {cat.nombre}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({cat.organos.length})
                      </span>
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        title="Agregar organismo"
                        onClick={(e) => { e.stopPropagation(); handleAddOrg(cat.id) }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        title="Editar categoria"
                        onClick={(e) => { e.stopPropagation(); handleEditCat(cat) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Eliminar categoria"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick("categoria", cat.id, cat.nombre)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    {cat.organos.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center gap-1 py-1.5 px-2 ml-6 rounded-md hover:bg-muted/50 border-l-2 border-l-amber-500"
                      >
                        <span className="text-sm flex-1 truncate">{org.nombre}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            title="Editar organismo"
                            onClick={() => handleEditOrg(org)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Eliminar organismo"
                            onClick={() => handleDeleteClick("organo", org.id, org.nombre)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {cat.organos.length === 0 && (
                      <p className="text-xs text-muted-foreground ml-8 py-2">
                        Sin organismos
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categoria dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {catDialogMode === "add" ? "Agregar categoria" : "Editar categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input
                value={catDialogNombre}
                onChange={(e) => setCatDialogNombre(e.target.value)}
                placeholder="Nombre de la categoria"
                onKeyDown={(e) => e.key === "Enter" && handleSaveCat()}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveCat} disabled={saving || !catDialogNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {catDialogMode === "add" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organo dialog */}
      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {orgDialogMode === "add" ? "Agregar organismo" : "Editar organismo"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input
                value={orgDialogNombre}
                onChange={(e) => setOrgDialogNombre(e.target.value)}
                placeholder="Nombre del organismo"
                onKeyDown={(e) => e.key === "Enter" && handleSaveOrg()}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveOrg} disabled={saving || !orgDialogNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {orgDialogMode === "add" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Eliminar {deleteType === "categoria" ? "categoria" : "organismo"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Se eliminara <strong>{deleteName}</strong>
            {deleteType === "categoria" && " y todos sus organismos"}.
            Esta accion no se puede deshacer.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
