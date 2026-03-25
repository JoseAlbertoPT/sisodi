"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  Building2,
  Loader2,
} from "lucide-react"
import {
  fetchCentralizadaTree,
  createOrganoCentralizado,
  updateOrganoCentralizado,
  deleteOrganoCentralizado,
  type OrganoCentralizadoNode,
} from "@/lib/catalogo-api"

const DEPTH_COLORS = [
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-purple-500",
  "border-l-rose-500",
]

function matchesSearch(node: OrganoCentralizadoNode, term: string): boolean {
  if (node.nombre.toLowerCase().includes(term)) return true
  return node.children.some((c) => matchesSearch(c, term))
}

function TreeNode({
  node,
  depth,
  search,
  onAdd,
  onEdit,
  onDelete,
}: {
  node: OrganoCentralizadoNode
  depth: number
  search: string
  onAdd: (parentId: string) => void
  onEdit: (node: OrganoCentralizadoNode) => void
  onDelete: (node: OrganoCentralizadoNode) => void
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.children.length > 0
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length]

  useEffect(() => {
    if (search && matchesSearch(node, search)) setOpen(true)
  }, [search, node])

  const nameMatch =
    search && node.nombre.toLowerCase().includes(search.toLowerCase())

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 border-l-2 ${color}`}
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        <span
          className={`text-sm flex-1 truncate ${
            nameMatch ? "bg-yellow-200/60 dark:bg-yellow-800/40 rounded px-1" : ""
          }`}
        >
          {node.nombre}
        </span>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
          style={{ opacity: undefined }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            title="Agregar hijo"
            onClick={() => onAdd(node.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            title="Editar"
            onClick={() => onEdit(node)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            title="Eliminar"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && (
        <CollapsibleContent>
          {node.children
            .filter((c) => !search || matchesSearch(c, search.toLowerCase()))
            .map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                search={search}
                onAdd={onAdd}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export function CatalogoCentralizadaTab() {
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [dialogParentId, setDialogParentId] = useState<string | null>(null)
  const [dialogNode, setDialogNode] = useState<OrganoCentralizadoNode | null>(null)
  const [dialogNombre, setDialogNombre] = useState("")

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteNode, setDeleteNode] = useState<OrganoCentralizadoNode | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCentralizadaTree()
      setTree(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTree = useMemo(() => {
    if (!search) return tree
    const s = search.toLowerCase()
    return tree.filter((n) => matchesSearch(n, s))
  }, [tree, search])

  const handleAdd = (parentId: string | null) => {
    setDialogMode("add")
    setDialogParentId(parentId)
    setDialogNombre("")
    setDialogNode(null)
    setDialogOpen(true)
  }

  const handleEdit = (node: OrganoCentralizadoNode) => {
    setDialogMode("edit")
    setDialogNode(node)
    setDialogNombre(node.nombre)
    setDialogOpen(true)
  }

  const handleDeleteClick = (node: OrganoCentralizadoNode) => {
    setDeleteNode(node)
    setDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!dialogNombre.trim()) return
    setSaving(true)
    try {
      if (dialogMode === "add") {
        await createOrganoCentralizado({
          nombre: dialogNombre.trim(),
          parentId: dialogParentId,
        })
      } else if (dialogNode) {
        await updateOrganoCentralizado(dialogNode.id, {
          nombre: dialogNombre.trim(),
        })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteNode) return
    setSaving(true)
    try {
      await deleteOrganoCentralizado(deleteNode.id)
      setDeleteOpen(false)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Administracion Publica Centralizada
              </CardTitle>
              <CardDescription>
                Arbol jerarquico de secretarias y dependencias.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => handleAdd(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo raiz
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar secretaria o dependencia..."
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
          ) : filteredTree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Sin resultados" : "No hay organos registrados"}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  search={search}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Agregar organo" : "Editar organo"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input
                value={dialogNombre}
                onChange={(e) => setDialogNombre(e.target.value)}
                placeholder="Nombre del organo"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !dialogNombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {dialogMode === "add" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar organo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Se eliminara <strong>{deleteNode?.nombre}</strong> y todos sus hijos.
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
