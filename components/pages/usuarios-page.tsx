"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Search, UserPlus, KeyRound, Pencil, X, PowerOff, Power,
  ChevronRight, Building2, Check,
  Loader2, Shield, CheckCircle2, ToggleLeft, Eye,
} from "lucide-react"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageLayout } from "@/components/page-layout"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import {
  fetchMenusTree, fetchPermisosUser, updatePermisosUser,
  type MenuNode, type PermisosUser,
} from "@/lib/permisos-api"
import { MenuPermisoTree } from "@/components/menu-permiso-tree"
import {
  fetchCentralizadaTree,
  type OrganoCentralizadoNode,
} from "@/lib/catalogo-api"

const ROLES = ["Director Operativo", "Analista", "Revisor", "Capturista", "Administrador"]

type Usuario = {
  id: string
  nombre: string
  correo: string
  rfc: string | null
  rol: string
  secretaria: string
  secretariaId: string | null
  estatus: "Activo" | "Inactivo"
}

const API = "/api"

async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await fetch(`${API}/usuarios`)
  if (!res.ok) throw new Error("Error al cargar usuarios")
  return res.json()
}

async function crearUsuario(data: {
  nombre: string
  correo: string
  rfc: string
  password: string
  rolNombre: string
  areaNombre?: string
  secretariaId?: string | null
  secretariaTexto?: string | null
}): Promise<Usuario> {
  const res = await fetch(`${API}/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.message ?? "Error al crear usuario")
  }
  return res.json()
}

async function actualizarUsuario(
  id: string,
  data: {
    nombre?: string
    correo?: string
    rfc?: string | null
    password?: string
    rolNombre?: string
    areaNombre?: string
    activo?: boolean
    secretariaId?: string | null
    secretariaTexto?: string | null
  }
): Promise<Usuario> {
  const res = await fetch(`${API}/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.message ?? "Error al actualizar usuario")
  }
  return res.json()
}

function validarRFC(rfc: string): boolean {
  const rfcRegex = /^([A-ZÑ&]{3,4})(\d{6})([A-Z\d]{3})$/
  return rfcRegex.test(rfc.toUpperCase())
}

/* ═══════════════════════════════════════════════════════════════════
   Secretaría Step Selector – wizard paso a paso
   ═══════════════════════════════════════════════════════════════════ */

const STEP_LABELS = ["Secretaría", "Dirección", "Subdirección", "Departamento", "Unidad"]

function findNodePath(
  nodes: OrganoCentralizadoNode[],
  targetId: string,
  path: OrganoCentralizadoNode[] = []
): OrganoCentralizadoNode[] | null {
  for (const node of nodes) {
    const currentPath = [...path, node]
    if (node.id === targetId) return currentPath
    if (node.children) {
      const found = findNodePath(node.children, targetId, currentPath)
      if (found) return found
    }
  }
  return null
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function SecretariaTreeSelector({
  tree,
  treeLoading,
  selectedId,
  onSelect,
  error,
}: {
  tree: OrganoCentralizadoNode[]
  treeLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null, nombre: string, path: string[]) => void
  error?: string
}) {
  const [steps, setSteps] = useState<OrganoCentralizadoNode[]>([])
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!selectedId || tree.length === 0) return
    const path = findNodePath(tree, selectedId)
    if (path) setSteps(path)
  }, [tree, selectedId])

  const handlePickAtLevel = (level: number, node: OrganoCentralizadoNode) => {
    const newSteps = [...steps.slice(0, level), node]
    setSteps(newSteps)
    setSearchQueries((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (Number(key) > level) delete next[Number(key)]
      }
      return next
    })
    const pathNames = newSteps.map((n) => n.nombre)
    onSelect(node.id, node.nombre, pathNames)
  }

  const handleClearFromLevel = (level: number) => {
    const newSteps = steps.slice(0, level)
    setSteps(newSteps)
    setSearchQueries((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (Number(key) >= level) delete next[Number(key)]
      }
      return next
    })
    if (newSteps.length > 0) {
      const last = newSteps[newSteps.length - 1]
      onSelect(last.id, last.nombre, newSteps.map((n) => n.nombre))
    } else {
      onSelect(null, "", [])
    }
  }

  const handleReset = () => {
    setSteps([])
    setSearchQueries({})
    onSelect(null, "", [])
  }

  const setSearchAtLevel = (level: number, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [level]: query }))
  }

  if (treeLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center border border-border rounded-lg bg-muted/20">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando estructura organizacional...
      </div>
    )
  }

  const levels: { label: string; options: OrganoCentralizadoNode[]; selected: OrganoCentralizadoNode | null }[] = []

  levels.push({
    label: STEP_LABELS[0],
    options: tree,
    selected: steps[0] ?? null,
  })

  for (let i = 0; i < steps.length; i++) {
    const children = steps[i].children ?? []
    if (children.length > 0) {
      levels.push({
        label: STEP_LABELS[Math.min(i + 1, STEP_LABELS.length - 1)],
        options: children,
        selected: steps[i + 1] ?? null,
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {levels.map((level, idx) => {
        const query = searchQueries[idx] ?? ""
        const filtered = query
          ? level.options.filter((n) => n.nombre.toLowerCase().includes(query.toLowerCase()))
          : level.options

        return (
          <div key={idx} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className={`
                flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0
                ${level.selected
                  ? "bg-primary text-primary-foreground"
                  : idx === levels.length - 1 && !level.selected
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground"
                }
              `}>
                {level.selected ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              <span className="text-xs font-medium text-muted-foreground">{level.label}</span>
              {level.selected && (
                <>
                  <span className="text-xs font-semibold text-foreground">
                    {level.selected.nombre}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => handleClearFromLevel(idx)}
                  >
                    Cambiar
                  </button>
                </>
              )}
            </div>

            {idx < levels.length - 1 && level.selected && (
              <div className="ml-2.5 h-2 border-l-2 border-primary/20" />
            )}

            {!level.selected && (
              <div className="ml-7">
                {level.options.length > 5 && (
                  <div className="relative mb-1.5">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={`Buscar ${level.label.toLowerCase()}...`}
                      value={query}
                      onChange={(e) => setSearchAtLevel(idx, e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                      autoFocus
                    />
                  </div>
                )}

                <div className={`rounded-lg border bg-card max-h-44 overflow-y-auto ${error && idx === 0 ? "border-destructive" : "border-border"}`}>
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center">
                      <Search className="h-4 w-4 text-muted-foreground/30 mb-1" />
                      <p className="text-[11px] text-muted-foreground">Sin resultados para &ldquo;{query}&rdquo;</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {filtered.map((node) => {
                        const hasChildren = node.children && node.children.length > 0
                        return (
                          <button
                            key={node.id}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/[0.05] transition-colors group"
                            onClick={() => handlePickAtLevel(idx, node)}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary shrink-0 transition-colors" />
                            <span className="text-xs font-medium text-foreground flex-1 truncate">
                              {query ? <HighlightText text={node.nombre} query={query} /> : node.nombre}
                            </span>
                            {hasChildren && (
                              <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                                {node.children!.length} sub
                                <ChevronRight className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {error && idx === 0 && <span className="text-[10px] text-destructive mt-0.5">{error}</span>}
              </div>
            )}
          </div>
        )
      })}

      {steps.length > 0 && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-destructive self-start ml-7 flex items-center gap-1"
          onClick={handleReset}
        >
          <X className="h-3 w-3" />
          Limpiar seleccion
        </button>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Nuevo Usuario Modal
   ═══════════════════════════════════════════════════════════════════ */

type NuevoUsuarioFormProps = {
  onClose: () => void
  onSaved: (u: Usuario) => void
}

function NuevoUsuarioModal({ onClose, onSaved }: NuevoUsuarioFormProps) {
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    rfc: "",
    password: "",
    rol: "",
    secretaria: "",
    secretariaId: null as string | null,
    secretariaPath: [] as string[],
    estatus: "Activo" as "Activo" | "Inactivo",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)

  useEffect(() => {
    fetchCentralizadaTree()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false))
  }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim())   e.nombre   = "El nombre es requerido"
    if (!form.correo.trim())   e.correo   = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido"
    if (form.rfc.trim() && !validarRFC(form.rfc)) e.rfc = "RFC inválido (ej. ABCD850101XYZ)"
    if (!form.password.trim()) e.password = "La contraseña es requerida"
    else if (form.password.length < 6) e.password = "Mínimo 6 caracteres"
    if (!form.rol)             e.rol      = "Seleccione un rol"
    if (!form.secretaria)      e.secretaria = "Seleccione una secretaría"
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    setApiError("")
    try {
      const secretariaTexto = form.secretariaPath.length > 0
        ? form.secretariaPath.join(" > ")
        : form.secretaria
      const nuevo = await crearUsuario({
        nombre:          form.nombre,
        correo:          form.correo,
        rfc:             form.rfc.toUpperCase(),
        password:        form.password,
        rolNombre:       form.rol,
        secretariaId:    form.secretariaId,
        secretariaTexto,
      })
      onSaved(nuevo)
      onClose()
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    type = "text",
    placeholder = "",
    hint?: string
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`bg-background h-9 text-xs ${errors[key] ? "border-destructive" : ""}`}
      />
      {hint && !errors[key] && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      {errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Registrar Nuevo Usuario
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completa los campos para concluir el registro</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
          {apiError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              {apiError}
            </div>
          )}

          {/* Datos generales */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Datos generales</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field("nombre", "Nombre completo", "text", "Ej. Juan Pérez García")}
              </div>
              {field("correo",   "Correo electrónico", "email",    "usuario@gobierno.gob.mx")}
              {field("rfc",      "RFC",                "text",     "ABCD850101XYZ", "Opcional — 13 caracteres")}
              {field("password", "Contraseña",         "password", "Mínimo 6 caracteres")}

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm((f) => ({ ...f, rol: v }))}>
                  <SelectTrigger className={`bg-background h-9 text-xs ${errors.rol ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Seleccione un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.rol && <span className="text-[10px] text-destructive">{errors.rol}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Estatus inicial</Label>
                <Select value={form.estatus} onValueChange={(v) => setForm((f) => ({ ...f, estatus: v as "Activo" | "Inactivo" }))}>
                  <SelectTrigger className="bg-background h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Secretaría selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Secretaría / Unidad perteneciente</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <SecretariaTreeSelector
              tree={tree}
              treeLoading={treeLoading}
              selectedId={form.secretariaId}
              error={errors.secretaria}
              onSelect={(id, nombre, path) =>
                setForm((f) => ({
                  ...f,
                  secretariaId: id,
                  secretaria: nombre,
                  secretariaPath: path,
                }))
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar usuario"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Editar Usuario Modal
   ═══════════════════════════════════════════════════════════════════ */

type EditarUsuarioModalProps = {
  usuario: Usuario
  onClose: () => void
  onSaved: (updated: Usuario) => void
}

function EditarUsuarioModal({ usuario, onClose, onSaved }: EditarUsuarioModalProps) {
  const [form, setForm] = useState({
    nombre:          usuario.nombre,
    correo:          usuario.correo,
    rfc:             usuario.rfc ?? "",
    rol:             usuario.rol,
    secretaria:      usuario.secretaria,
    secretariaId:    usuario.secretariaId,
    secretariaPath:  [] as string[],
    estatus:         usuario.estatus,
    password:        "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)

  useEffect(() => {
    fetchCentralizadaTree()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false))
  }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido"
    if (!form.correo.trim()) e.correo = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido"
    if (form.rfc.trim() && !validarRFC(form.rfc)) e.rfc = "RFC inválido (ej. ABCD850101XYZ)"
    if (!form.rol)        e.rol        = "Seleccione un rol"
    if (!form.secretaria) e.secretaria = "Seleccione una secretaría"
    if (form.password && form.password.length < 6) e.password = "Mínimo 6 caracteres"
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden"
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    setApiError("")
    try {
      const secretariaTexto = form.secretariaPath.length > 0
        ? form.secretariaPath.join(" > ")
        : form.secretaria
      const payload: Record<string, unknown> = {
        nombre:          form.nombre,
        correo:          form.correo,
        rfc:             form.rfc ? form.rfc.toUpperCase() : null,
        rolNombre:       form.rol,
        activo:          form.estatus === "Activo",
        secretariaId:    form.secretariaId,
        secretariaTexto,
      }
      if (form.password) payload.password = form.password
      const actualizado = await actualizarUsuario(usuario.id, payload as any)
      onSaved(actualizado)
      onClose()
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    type = "text",
    placeholder = "",
    hint?: string
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`bg-background h-9 text-xs ${errors[key] ? "border-destructive" : ""}`}
      />
      {hint && !errors[key] && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      {errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Usuario
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Modifica los datos del usuario seleccionado</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
          {apiError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              {apiError}
            </div>
          )}

          {/* Datos generales */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Datos generales</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field("nombre", "Nombre completo", "text", "Ej. Juan Pérez García")}
              </div>
              {field("correo", "Correo electrónico", "email", "usuario@gobierno.gob.mx")}
              {field("rfc",    "RFC",                "text",  "ABCD850101XYZ", "Opcional — 13 caracteres")}

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm((f) => ({ ...f, rol: v }))}>
                  <SelectTrigger className={`bg-background h-9 text-xs ${errors.rol ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Seleccione un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.rol && <span className="text-[10px] text-destructive">{errors.rol}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Estatus</Label>
                <Select value={form.estatus} onValueChange={(v) => setForm((f) => ({ ...f, estatus: v as "Activo" | "Inactivo" }))}>
                  <SelectTrigger className="bg-background h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Secretaría selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Secretaría / Unidad perteneciente</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <SecretariaTreeSelector
              tree={tree}
              treeLoading={treeLoading}
              selectedId={form.secretariaId}
              error={errors.secretaria}
              onSelect={(id, nombre, path) =>
                setForm((f) => ({
                  ...f,
                  secretariaId: id,
                  secretaria: nombre,
                  secretariaPath: path,
                }))
              }
            />
          </div>

          {/* Cambiar contraseña */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cambiar contraseña (opcional)</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {field("password",        "Nueva contraseña",     "password", "Dejar en blanco para no cambiar")}
              {field("confirmPassword", "Confirmar contraseña", "password", "Repite la nueva contraseña")}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Modal: Permisos de menús
   ═══════════════════════════════════════════════════════════════════ */

function samePermisos(a: PermisosUser, b: PermisosUser): boolean {
  if (a.menuIds.length !== b.menuIds.length) return false
  const setA = new Set(a.menuIds)
  for (const id of b.menuIds) if (!setA.has(id)) return false
  const keysA = Object.keys(a.menuActions).sort()
  const keysB = Object.keys(b.menuActions).sort()
  if (keysA.length !== keysB.length) return false
  for (let i = 0; i < keysA.length; i++) if (keysA[i] !== keysB[i]) return false
  for (const k of keysA) {
    const arrA = a.menuActions[k] ?? []
    const arrB = b.menuActions[k] ?? []
    if (arrA.length !== arrB.length) return false
    const setAc = new Set(arrA)
    for (const c of arrB) if (!setAc.has(c)) return false
  }
  return true
}

type PermisoModalProps = {
  usuario: Usuario
  onClose: () => void
}

function PermisoModal({ usuario, onClose }: PermisoModalProps) {
  const [tree, setTree] = useState<MenuNode[] | null>(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [permisos, setPermisos] = useState<PermisosUser | null>(null)
  const [initialPermisos, setInitialPermisos] = useState<PermisosUser | null>(null)
  const [permisosLoading, setPermisosLoading] = useState(true)
  const [permisosSaveLoading, setPermisosSaveLoading] = useState(false)
  const [permisosSaveError, setPermisosSaveError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const isDirty = useMemo(() => {
    if (permisos == null || initialPermisos == null) return false
    return !samePermisos(permisos, initialPermisos)
  }, [permisos, initialPermisos])

  useEffect(() => {
    let cancelled = false
    setTreeLoading(true)
    fetchMenusTree()
      .then((data) => { if (!cancelled) setTree(data) })
      .catch(() => { if (!cancelled) setTree([]) })
      .finally(() => { if (!cancelled) setTreeLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPermisosLoading(true)
    fetchPermisosUser(usuario.id)
      .then((data) => {
        if (!cancelled) {
          setPermisos(data)
          setInitialPermisos(data)
        }
      })
      .catch(() => { if (!cancelled) { setPermisos(null); setInitialPermisos(null) } })
      .finally(() => { if (!cancelled) setPermisosLoading(false) })
    return () => { cancelled = true }
  }, [usuario.id])

  const handleMenuToggle = useCallback((menuId: string, checked: boolean) => {
    setPermisos((prev) => {
      if (!prev) return prev
      const set = new Set(prev.menuIds)
      if (checked) set.add(menuId)
      else set.delete(menuId)
      return { ...prev, menuIds: Array.from(set) }
    })
  }, [])

  const handleActionToggle = useCallback((menuId: string, code: string, checked: boolean) => {
    setPermisos((prev) => {
      if (!prev) return prev
      const next = { ...prev, menuActions: { ...prev.menuActions } }
      const arr = next.menuActions[menuId] ?? []
      if (checked) next.menuActions[menuId] = [...arr, code]
      else next.menuActions[menuId] = arr.filter((c) => c !== code)
      return next
    })
  }, [])

  const handleSavePermisos = useCallback(async () => {
    if (permisos == null) return
    setPermisosSaveError(null)
    setPermisosSaveLoading(true)
    try {
      const updated = await updatePermisosUser(usuario.id, permisos)
      setPermisos(updated)
      setInitialPermisos(updated)
      onClose()
    } catch (e) {
      setPermisosSaveError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setPermisosSaveLoading(false)
    }
  }, [usuario.id, permisos, onClose])

  const requestClose = useCallback(() => {
    if (isDirty) setShowCloseConfirm(true)
    else onClose()
  }, [isDirty, onClose])

  const handleCloseWithoutSave = useCallback(() => {
    setShowCloseConfirm(false)
    onClose()
  }, [onClose])

  const handleSaveAndClose = useCallback(async () => {
    if (permisos == null) return
    setPermisosSaveError(null)
    setPermisosSaveLoading(true)
    try {
      const updated = await updatePermisosUser(usuario.id, permisos)
      setPermisos(updated)
      setInitialPermisos(updated)
      setShowCloseConfirm(false)
      onClose()
    } catch (e) {
      setPermisosSaveError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setPermisosSaveLoading(false)
    }
  }, [usuario.id, permisos, onClose])

  return (
    <>
    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
          <AlertDialogDescription>
            Hay cambios en los permisos que no se han guardado. ¿Deseas guardar antes de cerrar o cerrar sin guardar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={handleCloseWithoutSave}>
            Cerrar sin guardar
          </Button>
          <Button onClick={() => void handleSaveAndClose()} disabled={permisosSaveLoading}>
            {permisosSaveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar y cerrar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-card-foreground">
                Permisos de menús
              </h2>
              <p className="text-xs text-muted-foreground">{usuario.nombre}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={requestClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {permisosLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando permisos del usuario...
            </div>
          )}
          {!permisosLoading && permisos != null && tree != null && tree.length > 0 && (
            <>
              <div className="flex items-center gap-4 rounded-lg bg-muted/40 border border-border px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Menús activos:</span>
                  <Badge variant="secondary" className="font-mono">
                    {permisos.menuIds.length}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-2 text-sm">
                  <ToggleLeft className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Acciones activas:</span>
                  <Badge variant="secondary" className="font-mono">
                    {Object.values(permisos.menuActions).reduce((sum, arr) => sum + arr.length, 0)}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 border border-blue-200/50 rounded-md px-3 py-2.5">
                <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span>
                  Active o desactive secciones completas con el switch principal. Las acciones (Crear, Editar, Ver, etc.) aparecen como etiquetas que puede activar o desactivar con un clic.
                </span>
              </div>

              {treeLoading ? (
                <p className="text-sm text-muted-foreground">Cargando árbol de menús...</p>
              ) : (
                <div className="space-y-3">
                  <MenuPermisoTree
                    nodes={tree}
                    menuIds={permisos.menuIds}
                    menuActions={permisos.menuActions}
                    onMenuToggle={handleMenuToggle}
                    onActionToggle={handleActionToggle}
                    level={0}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-border shrink-0">
                <Button
                  onClick={() => void handleSavePermisos()}
                  disabled={permisosSaveLoading}
                  className="min-w-[140px]"
                >
                  {permisosSaveLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Guardar permisos
                </Button>
                {permisosSaveError && (
                  <span className="text-sm text-destructive">{permisosSaveError}</span>
                )}
              </div>
            </>
          )}
          {!permisosLoading && permisos != null && (!tree || tree.length === 0) && !treeLoading && (
            <p className="text-sm text-muted-foreground py-4">No hay menús configurados.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={requestClose}>Cerrar</Button>
        </div>
      </div>
    </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Página principal de Usuarios
   ═══════════════════════════════════════════════════════════════════ */

export function UsuariosPage() {
  const [usuarios,      setUsuarios]      = useState<Usuario[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState("")
  const [searchTerm,    setSearchTerm]    = useState("")
  const [permisoUserId, setPermisoUserId] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [showNewForm,   setShowNewForm]   = useState(false)
  const { permisos } = useAutorizaciones()

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = usuarios.filter(
    (row) =>
      row.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.rfc ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.rol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.secretaria.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hasActivePermiso = (nombre: string) =>
    permisos.some((p) => p.userId === nombre && p.active && !p.used)

  const toggleEstatus = async (u: Usuario) => {
    try {
      const actualizado = await actualizarUsuario(u.id, { activo: u.estatus !== "Activo" })
      setUsuarios((prev) => prev.map((x) => x.id === actualizado.id ? actualizado : x))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error")
    }
  }

  const usuarioEditando = editingUserId ? usuarios.find((u) => u.id === editingUserId) ?? null : null
  const usuarioPermiso  = permisoUserId ? usuarios.find((u) => u.id === permisoUserId)  ?? null : null

  return (
    <PageLayout
      title="Usuarios"
      description="Administración de usuarios del sistema"
    >
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={() => setShowNewForm(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Modales */}
      {showNewForm && (
        <NuevoUsuarioModal
          onClose={() => setShowNewForm(false)}
          onSaved={(u) => setUsuarios((prev) => [...prev, u])}
        />
      )}
      {usuarioEditando && (
        <EditarUsuarioModal
          usuario={usuarioEditando}
          onClose={() => setEditingUserId(null)}
          onSaved={(u) => setUsuarios((prev) => prev.map((x) => x.id === u.id ? u : x))}
        />
      )}
      {usuarioPermiso && (
        <PermisoModal
          key={usuarioPermiso.id}
          usuario={usuarioPermiso}
          onClose={() => setPermisoUserId(null)}
        />
      )}

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo, RFC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Tabla */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {loading ? "Cargando..." : `${filtered.length} usuarios registrados`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive mb-4">
              {loadError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Correo</th>
                  <th className="px-4 py-3 text-left font-semibold">RFC</th>
                  <th className="px-4 py-3 text-left font-semibold">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold">Secretaría</th>
                  <th className="px-4 py-3 text-left font-semibold">Estatus</th>
                  <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      <div className="flex items-center gap-2">
                        {row.nombre}
                        {hasActivePermiso(row.nombre) && (
                          <span className="inline-block h-2 w-2 rounded-full bg-secondary shrink-0" title="Permiso activo" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.correo}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {row.rfc ?? <span className="text-muted-foreground/50 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.rol}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs leading-tight max-w-[180px]">{row.secretaria}</td>
                    <td className="px-4 py-3">
                      {row.estatus === "Activo" ? (
                        <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-secondary hover:text-primary gap-1.5 text-xs" onClick={() => setPermisoUserId(row.id)}>
                          <KeyRound className="h-3.5 w-3.5" />Permiso
                        </Button>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1.5 text-xs" onClick={() => setEditingUserId(row.id)}>
                          <Pencil className="h-3.5 w-3.5" />Editar
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className={`gap-1.5 text-xs ${row.estatus === "Activo" ? "text-destructive hover:text-destructive/80" : "text-secondary hover:text-secondary/80"}`}
                          onClick={() => toggleEstatus(row)}
                        >
                          {row.estatus === "Activo"
                            ? <><PowerOff className="h-3.5 w-3.5" />Deshabilitar</>
                            : <><Power    className="h-3.5 w-3.5" />Habilitar</>}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
