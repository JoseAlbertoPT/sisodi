"use client"

import { normalizeText } from "@/lib/utils"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, C_VERDE_ESTADO, C_VERDE_ESTADO_BG, C_ROSA_VINO, C_ROSA_VINO_BG } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/ui/search-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {

  Search, KeyRound, MoreVertical, Pencil, X, PowerOff, Power,
  ChevronRight, Building2, Check,
  Loader2, Shield, ShieldCheck, CheckCircle2, Eye, EyeOff, Trash2, Lock, User,
  Landmark, Factory,
} from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageLayout } from "@/components/page-layout"
import { useAutorizaciones, type PermisoCaptura } from "@/lib/autorizaciones-store"
import { useCalendario } from "@/lib/calendario-store"
import { useAuth } from "@/lib/auth-context"
import {
  fetchMenusTree, fetchMyMenus, fetchPermisosUser, updatePermisosUser,
  type MenuNode, type PermisosUser,
} from "@/lib/permisos-api"
import { MenuPermisoTree } from "@/components/menu-permiso-tree"
import {

  fetchCentralizadaTree,
  fetchCategoriasParaestatal,
  type OrganoCentralizadoNode,
  type CategoriaParaestatalItem,
} from "@/lib/catalogo-api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"

const ROLES = ["Emisor", "Validador", "Revisor", "Capturista", "UEFA", "Administrador"]

type Usuario = {
  id: string
  nombre: string
  correo: string
  rfc: string | null
  rol: string
  secretaria: string
  secretariaId: string | null
  estatus: "Activo" | "Inactivo"
  tipoAdministracion: "centralizada" | "paraestatal"
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

function flattenTree(
  nodes: OrganoCentralizadoNode[],
  path: OrganoCentralizadoNode[] = []
): { node: OrganoCentralizadoNode; path: OrganoCentralizadoNode[] }[] {
  const result: { node: OrganoCentralizadoNode; path: OrganoCentralizadoNode[] }[] = []
  for (const node of nodes) {
    const currentPath = [...path, node]
    result.push({ node, path: currentPath })
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, currentPath))
    }
  }
  return result
}

function getClaveError(secretariaId: string | null, tree: OrganoCentralizadoNode[]): string | null {
  if (!secretariaId) return null
  const nodePath = findNodePath(tree, secretariaId)
  if (!nodePath) return null
  if (nodePath.length === 1) {
    const children = nodePath[0].children ?? []
    if (children.length === 0) {
      return "Esta secretaría no tiene Unidades Administrativas Registradas. Configúrelas en el catálogo antes de continuar."
    }
    if (!children.some((c) => c.ua_clave_administrativa)) {
      return "Ninguna unidad de esta secretaría tiene clave administrativa. Configúrelas en el catálogo antes de continuar."
    }
  } else {
    if (!nodePath[1].ua_clave_administrativa) {
      return "La unidad seleccionada no tiene clave administrativa. Configúrela en el catálogo antes de continuar."
    }
  }
  return null
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = normalizeText(text).indexOf(normalizeText(query))
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
  levelOffset = 0,
}: {
  tree: OrganoCentralizadoNode[]
  treeLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null, nombre: string, path: string[]) => void
  error?: string
  levelOffset?: number
}) {
  const [steps, setSteps] = useState<OrganoCentralizadoNode[]>([])
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})
  const [autocompleteQuery, setAutocompleteQuery] = useState("")
  const [justClearedAt, setJustClearedAt] = useState<number | null>(null)
  const allNodes = useMemo(() => flattenTree(tree), [tree])
  const filteredNodes = useMemo(() => {
    const q = autocompleteQuery.trim()
    if (!q) return []
    return allNodes
      .filter(({ node }) => normalizeText(node.nombre).includes(normalizeText(q)))
      .slice(0, 12)
  }, [allNodes, autocompleteQuery])

  useEffect(() => {
    if (!selectedId) {
      setSteps([])
      setSearchQueries({})
      setAutocompleteQuery("")
      setJustClearedAt(null)
      return
    }
    if (tree.length === 0) return
    const path = findNodePath(tree, selectedId)
    if (path) {
      setSteps(path)
      setAutocompleteQuery(path.map((n) => n.nombre).join(" › "))
    }
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
    setJustClearedAt(null)
    const pathNames = newSteps.map((n) => n.nombre)
    setAutocompleteQuery(pathNames.join(" › "))
    onSelect(node.id, node.nombre, pathNames)
  }

  const handleClearFromLevel = (level: number) => {
    const hadDeeperSelection = steps.length > level + 1
    const newSteps = steps.slice(0, level)
    setSteps(newSteps)
    setSearchQueries((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (Number(key) >= level) delete next[Number(key)]
      }
      return next
    })
    setJustClearedAt(hadDeeperSelection ? level : null)
    if (newSteps.length > 0) {
      const last = newSteps[newSteps.length - 1]
      const pathNames = newSteps.map((n) => n.nombre)
      setAutocompleteQuery(pathNames.join(" › "))
      onSelect(last.id, last.nombre, pathNames)
    } else {
      setAutocompleteQuery("")
      onSelect(null, "", [])
    }
  }
  const handleReset = () => {
    setSteps([])
    setSearchQueries({})
    setAutocompleteQuery("")
    setJustClearedAt(null)
    onSelect(null, "", [])
  }

  const setSearchAtLevel = (level: number, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [level]: query }))
  }
  if (treeLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center border border-border rounded-lg bg-muted/20">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando Estructura Organizacional...
      </div>
    )
  }

  const levels: { label: string; options: OrganoCentralizadoNode[]; selected: OrganoCentralizadoNode | null }[] = []
  levels.push({
    label: STEP_LABELS[Math.min(levelOffset, STEP_LABELS.length - 1)],
    options: tree,
    selected: steps[0] ?? null,
  })

  for (let i = 0; i < steps.length; i++) {
    const children = steps[i].children ?? []
    if (children.length > 0) {
      levels.push({
        label: STEP_LABELS[Math.min(levelOffset + i + 1, STEP_LABELS.length - 1)],
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
          ? level.options.filter((n) => normalizeText(n.nombre).includes(normalizeText(query)))
          : level.options
        const treeMatches = query && filtered.length === 0 ? filteredNodes : []
        return (
          <div key={idx} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className={`
                flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0
                ${level.selected
                  ? "bg-[#7A1E3A] text-white"
                  : idx === levels.length - 1 && !level.selected
                    ? "bg-[#7A1E3A]/15 text-[#7A1E3A] border border-[#7A1E3A]/30"
                    : "bg-muted text-muted-foreground"
                }
              `}>
                {level.selected ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{level.label}</span>
              {level.selected && (
                  <>
                  <span className="text-sm font-light text-[var(--color-core-piedra-20)]">
                    {level.selected.nombre}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline ml-auto"
                    onClick={() => handleClearFromLevel(idx)}
                     >
                    Cambiar
                  </button>
                </>
              )}
            </div>
            {level.selected && idx > 0 && levels[idx - 1].selected?.nombre === level.selected.nombre && (
              <span className="ml-7 text-[10px] text-muted-foreground">
                {steps.slice(0, idx + 1).map((n) => n.nombre).join(" › ")}
              </span>
            )}
            {idx < levels.length - 1 && level.selected && (
              <div className="ml-2.5 h-3 border-l-2 border-dashed border-[#7A1E3A]/40" />
            )}
            {!level.selected && (
              <div className="ml-7">
                {idx === justClearedAt && (
                  <p className="text-[10px] text-muted-foreground mb-1">
                    Se reinició la selección de {STEP_LABELS[Math.min(levelOffset + idx + 1, STEP_LABELS.length - 1)]} — elige de nuevo.
                  </p>
                )}
                {(level.options.length > 5 || idx === 0) && (
                  <div className="relative mb-1.5">
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={idx === 0 ? "Escribir para buscar Secretaría o Unidad..." : `Buscar ${level.label.toLowerCase()}...`}
                      value={query}
                      onChange={(e) => {
                        setSearchAtLevel(idx, e.target.value)
                        setAutocompleteQuery(e.target.value)
                      }}
                      className={`pl-8 h-7 rounded-full px-4 text-xs bg-background ${error && idx === 0 ? "border-destructive" : ""}`}
                      autoFocus={idx !== 0}
                    />
                  </div>
                )}
                <div className="rounded-lg border border-border bg-card max-h-36 overflow-y-auto">
                  {filtered.length === 0 && treeMatches.length === 0 && (
                    <div className="flex flex-col items-center py-4 text-center">
                      <Search className="h-4 w-4 text-muted-foreground/30 mb-1" />
                      <p className="text-[11px] text-muted-foreground">Sin resultados para &ldquo;{query}&rdquo;</p>
                    </div>
                  )}
                  {filtered.length > 0 && (
                    <div className="divide-y divide-border/60">
                      {filtered.map((node) => {
                        const hasChildren = node.children && node.children.length > 0
                        return (
                          <button
                            key={node.id}
                            type="button"
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-primary/10 transition-colors group"
                            onClick={() => handlePickAtLevel(idx, node)}
                            >
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary shrink-0 transition-colors" />
                            <span className="text-xs font-light text-[var(--color-core-piedra-20)] group-hover:text-primary flex-1 truncate min-w-0 transition-colors">
                              {query ? <HighlightText text={node.nombre} query={query} /> : node.nombre}
                            </span>
                            {hasChildren && (
                              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {treeMatches.length > 0 && (
                    <div className="divide-y divide-border/60">
                      {treeMatches.map(({ node, path }) => (
                        <button
                          key={node.id}
                          type="button"
                          className="w-full flex flex-col px-2.5 py-2 text-left hover:bg-primary/10 transition-colors group"
                          onClick={() => {
                            setSteps(path)
                            const pathNames = path.map((n) => n.nombre)
                            setAutocompleteQuery(pathNames.join(" › "))
                            setSearchQueries({})
                            setJustClearedAt(null)
                            onSelect(node.id, node.nombre, pathNames)
                          }}
                          >
                          <span className="text-xs font-light text-[var(--color-core-piedra-20)] group-hover:text-primary truncate transition-colors">
                            <HighlightText text={node.nombre} query={query} />
                          </span>
                          {path.length > 1 && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {path.slice(0, -1).map((n) => n.nombre).join(" › ")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {error && idx === 0 && <span className="text-[10px] text-destructive mt-0.5 block">{error}</span>}
              </div>
            )}
          </div>
        )
      })}
      {steps.length > 0 && (
        <button
          type="button"
          className="self-start ml-7 flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          onClick={handleReset}
           >
          <X className="h-3 w-3" />
          Limpiar selección
        </button>
      )}
    </div>
  )
}

function paraestatalToTree(cats: CategoriaParaestatalItem[]): OrganoCentralizadoNode[] {
  return cats.map((cat) => ({
    id: `cat-${cat.id}`,
    nombre: cat.nombre,
    orden: cat.orden,
    tipo: "categoria",
    parent_id: null,
    ua_clave_administrativa: null,
    clave_reporte_plazas: null,
    children: cat.organos.map((org) => ({
      id: `org-${org.id}`,
      nombre: org.nombre,
      orden: org.orden,
      tipo: "organo",
      parent_id: `cat-${cat.id}`,
      ua_clave_administrativa: org.ua_clave_administrativa,
      clave_reporte_plazas: org.clave_reporte_plazas,
      children: [],
    })),
  }))
}
type NuevoUsuarioFormProps = {
  onClose: () => void
  onSaved: (u: Usuario) => void
}
const NUEVO_STEPS = ["Datos Personales", "Acceso y Permisos", "Tipo de Administración", "Permisos de Menú"]
function NuevoUsuarioModal({ onClose, onSaved }: NuevoUsuarioFormProps) {
  const { user: currentUser } = useAuth()
  const tipoAdminFijo = currentUser?.tipoAdministracion ?? "centralizada"
  const esAdministrador = currentUser?.rol === "Administrador"
  const [step, setStep] = useState(1)
  const [showConfirm, setShowConfirm] = useState(false)
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    rfc: "",
    password: "",
    rol: "",
    secretaria: "",
    secretariaId: null as string | null,
    secretariaPath: [] as string[],
    unidad: "",
    unidadId: null as string | null,
    unidadPath: [] as string[],
    estatus: "Activo" as "Activo" | "Inactivo",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [asyncErrors, setAsyncErrors] = useState<Record<string, string>>({})
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState("")
  const [claveAlert, setClaveAlert] = useState("")
  const [permTree, setPermTree] = useState<MenuNode[] | null>(null)
  const [permTreeLoading, setPermTreeLoading] = useState(false)
  const [selectedPermisos, setSelectedPermisos] = useState<PermisosUser>({ menuIds: [], menuActions: {} })
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [tipoAdmin, setTipoAdmin] = useState<"centralizada" | "paraestatal">(tipoAdminFijo)
  const [showPassword, setShowPassword] = useState(false)

  const checkUnico = async (campo: "correo" | "rfc", valor: string) => {
    if (!valor.trim()) return
    setChecking((c) => ({ ...c, [campo]: true }))
    try {
      const param = campo === "correo" ? `checkCorreo=${encodeURIComponent(valor.trim())}` : `checkRfc=${encodeURIComponent(valor.trim().toUpperCase())}`
      const res  = await fetch(`/api/usuarios?${param}`)
      const json = await res.json()
      if (json.existe) {
        const msg = campo === "correo"
          ? "Ya existe un usuario con ese correo."
          : "Ya existe un usuario con ese RFC."
        setAsyncErrors((e) => ({ ...e, [campo]: msg }))
      } else {
        setAsyncErrors((e) => { const n = { ...e }; delete n[campo]; return n })
      }
    } catch { /* silencioso */ }
    finally { setChecking((c) => ({ ...c, [campo]: false })) }
  }

  useEffect(() => {
    setTreeLoading(true)
    setTree([])
    const promise = tipoAdmin === "centralizada"
      ? fetchCentralizadaTree()
      : fetchCategoriasParaestatal().then(paraestatalToTree)
    promise
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false))
  }, [tipoAdmin])
  const validateStep = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.nombre.trim()) e.nombre = "El Nombre es requerido"
      if (!form.correo.trim()) e.correo = "El Correo es requerido"
      else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido"
      if (form.rfc.trim() && !validarRFC(form.rfc)) e.rfc = "RFC Inválido (ej. ABCD850101XYZ)"
    }
    if (s === 2) {
      if (!form.password.trim()) e.password = "La Contraseña es requerida"
      else if (form.password.length < 8) e.password = "Mínimo 8 caracteres"
      if (!form.rol) e.rol = "Seleccione un rol"
    }
    if (s === 3) {
      if (!form.secretaria) e.secretaria = "Seleccione una secretaría"
    }
    return e
  }

  const handleNext = () => {
    const e = validateStep(step)
    if (Object.keys(e).length) { setErrors(e); return }
    if (step === 1 && Object.keys(asyncErrors).length) return
    setErrors({})
    if (step < 3) {
      setStep((s) => s + 1)
    } else if (step === 3) {
      if (tipoAdmin === "centralizada") {
        const claveErr = getClaveError(form.secretariaId, tree)
        if (claveErr) { setClaveAlert(claveErr); return }
      }
      setPermTreeLoading(true)
      setStep(4);
      (async () => {
        try {
          const collectIds = (nodes: MenuNode[]): string[] =>
            nodes.flatMap((n) => [n.id, ...(n.children ? collectIds(n.children) : [])])
          const [fullTree, roleMenus] = await Promise.allSettled([
            fetchMenusTree(),
            fetchMyMenus(form.rol),
          ])
          const treeData = fullTree.status === "fulfilled" ? fullTree.value : []
          setPermTree(treeData)
          if (roleMenus.status === "fulfilled" && roleMenus.value.length > 0) {
            setSelectedPermisos({ menuIds: collectIds(roleMenus.value), menuActions: {} })
          }
        } finally {
          setPermTreeLoading(false)
        }
      })()
    } else {
      setShowConfirm(true)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setApiError("")
    try {
      const nodePath = form.secretariaId ? findNodePath(tree, form.secretariaId) : null
      const rootNombre = nodePath?.[0]?.nombre ?? form.secretariaPath[0] ?? form.secretaria
      const uaNombre = nodePath && nodePath.length > 1
        ? (nodePath[1].ua_clave_administrativa ?? nodePath[1].nombre)
        : null
      const secretariaTexto = uaNombre ? `${rootNombre} > ${uaNombre}` : rootNombre
      const rawSecretariaId =
        form.secretariaId?.startsWith("org-") || form.secretariaId?.startsWith("cat-")
          ? null
          : form.secretariaId
      const nuevo = await crearUsuario({
        nombre:       form.nombre,
        correo:       form.correo,
        rfc:          form.rfc.toUpperCase(),
        password:     form.password,
        rolNombre:    form.rol,
        secretariaId: rawSecretariaId,
        secretariaTexto,
      })
      if (selectedPermisos.menuIds.length > 0) {
        await updatePermisosUser(nuevo.id, selectedPermisos)
      }
      onSaved(nuevo)
      onClose()
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Error")
      setShowConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    type = "text",
    placeholder = "",
    hint?: string,
    autoComplete = "off"
  ) => {
    const hasError = errors[key] || asyncErrors[key as string]
    const isChecking = checking[key as string]
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <Input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={form[key] as string}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: e.target.value }))
            if (asyncErrors[key as string]) setAsyncErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n })
          }}
          onBlur={() => {
            if (key === "correo" && form.correo.trim() && /\S+@\S+\.\S+/.test(form.correo))
              checkUnico("correo", form.correo)
          }}
          className={`bg-background rounded-full h-9 px-4 text-xs font-light text-[var(--color-core-piedra-20)] ${hasError ? "border-destructive" : ""}`}
        />
        {isChecking && <span className="text-[10px] text-muted-foreground">Verificando...</span>}
        {!isChecking && hint && !hasError && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        {!isChecking && errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
        {!isChecking && asyncErrors[key as string] && <span className="text-[10px] text-destructive">{asyncErrors[key as string]}</span>}
      </div>
    )
  }
  const secretariaDisplay = form.secretariaPath.length > 0
    ? form.secretariaPath.join(" › ")
    : form.secretaria || "—"
  return (
    <>
    <ConfirmDialog
      open={!!claveAlert}
      onClose={() => setClaveAlert("")}
      onConfirm={() => setClaveAlert("")}
      variant="default"
      title="Secretaría sin configuración"
      description={claveAlert}
      confirmLabel="Entendido"
      hideCancel
    />
    {showConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-card-foreground">Confirmar Registro</h3>
                <p className="text-[11px] text-muted-foreground">Revisa los datos antes de guardar</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowConfirm(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="px-6 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            {apiError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                <X className="h-3 w-3 shrink-0" />{apiError}
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <User className="h-3 w-3 text-primary/70" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Datos personales</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-light text-[var(--color-core-piedra-20)]">{form.nombre}</span>
                <span className="text-muted-foreground">Correo:</span>
                <span className="font-light text-[var(--color-core-piedra-20)] break-all">{form.correo}</span>
                <span className="text-muted-foreground">RFC:</span>
                <span className="font-mono font-light text-[var(--color-core-piedra-20)]">{form.rfc || "—"}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Acceso y permisos</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Contraseña:</span>
                <span className="font-mono font-light text-[var(--color-core-piedra-20)]">{"•".repeat(form.password.length)}</span>
                <span className="text-muted-foreground">Rol:</span>
                <span className="font-light text-[var(--color-core-piedra-20)]">{form.rol}</span>
                <span className="text-muted-foreground">Estatus:</span>
                <span className="font-light text-[var(--color-core-piedra-20)]">{form.estatus}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <Building2 className="h-3 w-3 text-blue-600/70" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de Administración</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-light text-[var(--color-core-piedra-20)] capitalize">{tipoAdmin}</span>
                <span className="text-muted-foreground">Secretaría:</span>
                <span className="font-light text-[var(--color-core-piedra-20)] leading-snug">{secretariaDisplay}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
            <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setShowConfirm(false)} disabled={loading}>
              Regresar
            </Button>
            <Button
              size="sm"
              className="text-xs h-9 rounded-full shadow-sm gap-1.5 bg-[#72243E] hover:bg-[#72243E] active:bg-[#72243E] active:text-white text-white border-0"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" />Guardar usuario</>
              )}
            </Button>
          </div>
        </div>
      </div>
    )}
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
      <div className="w-full max-w-[720px] mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[96vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <div className="flex items-start w-full">
          {NUEVO_STEPS.map((label, idx) => {
            const n = idx + 1
            const done = step > n
            const active = step === n
            const circleStyle = done
              ? { width: 32, height: 32, flexShrink: 0, position: 'relative' as const, zIndex: 1 }
              : active
              ? { width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ffffff', border: '2px solid #773357', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' as const, zIndex: 1 }
              : { width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ffffff', border: '2px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' as const, zIndex: 1 }

            const labelStyle = active
              ? { fontSize: 12, fontWeight: 600, color: '#773357', textAlign: 'center' as const, maxWidth: 120, lineHeight: 1.3 }
              : done
              ? { fontSize: 12, fontWeight: 400, color: '#6B7280', textAlign: 'center' as const, maxWidth: 120, lineHeight: 1.3 }
              : { fontSize: 12, fontWeight: 400, color: '#9CA3AF', textAlign: 'center' as const, maxWidth: 120, lineHeight: 1.3 }
            return (
              <div key={n} className="flex flex-1 flex-col items-center" style={{ position: 'relative' }}>
                {idx > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 16,
                    left: '-50%',
                    width: '100%',
                    height: 2,
                    backgroundColor: done ? '#2A3B29' : '#D1D5DB',
                    zIndex: 0,
                  }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={circleStyle}>
                    {done ? (
                      <img src="/Iconos1/step-check.svg" width={32} height={32} alt="paso completado" />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#773357' : '#9CA3AF', lineHeight: 1 }}>
                        {n}
                      </span>
                    )}
                  </div>
                  <span style={labelStyle}>{label}</span>
                </div>
              </div>
            )
          })}
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {apiError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-xs text-destructive flex items-center gap-2">
              <X className="h-3.5 w-3.5 shrink-0" />{apiError}
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <div>
                  {field("nombre", "Nombre Completo", "text", "Ej. Juan Pérez García")}
                </div>
                <div>
                  {field("correo", "Correo electrónico", "email", "usuario@gobierno.gob.mx", undefined, "email")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">RFC / Usuario</Label>
                  <Input
                    placeholder="ABCD850101XYZ"
                    value={form.rfc}
                    autoComplete="off"
                    onChange={(e) => {
                      setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase().replace(/\s/g, "") }))
                      if (asyncErrors.rfc) setAsyncErrors((prev) => { const n = { ...prev }; delete n.rfc; return n })
                    }}
                    onBlur={() => {
                      if (form.rfc.trim()) checkUnico("rfc", form.rfc)
                    }}
                    className={`bg-background h-9 py-2 rounded-full px-4 pr-9 text-xs font-mono font-light text-[var(--color-core-piedra-20)] tracking-widest ${errors.rfc || asyncErrors.rfc ? "border-destructive" : ""}`}
                    maxLength={13}
                  />
                  {checking.rfc && <span className="text-[10px] text-muted-foreground">Verificando...</span>}
                  {!checking.rfc && !errors.rfc && !asyncErrors.rfc && <span className="text-[10px] text-muted-foreground">Opcional — 13 caracteres</span>}
                  {!checking.rfc && errors.rfc && <span className="text-[10px] text-destructive">{errors.rfc}</span>}
                  {!checking.rfc && asyncErrors.rfc && <span className="text-[10px] text-destructive">{asyncErrors.rfc}</span>}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className={`bg-background h-9 py-2 text-xs pr-9 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                       >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {errors.password && <span className="text-[10px] text-destructive">{errors.password}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Rol</Label>
                  <Select value={form.rol} onValueChange={(v) => setForm((f) => ({ ...f, rol: v }))}>
                    <SelectTrigger className={`bg-background h-9 py-2 text-xs ${errors.rol ? "border-destructive" : ""}`}>
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
                    <SelectTrigger className="bg-background h-9 py-2 text-xs">
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
          )}
          {step === 3 && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo de Administración</Label>
                <div className="flex items-center gap-6">
                  {(esAdministrador || tipoAdminFijo === "centralizada") && (
                    <label className={`flex items-center gap-2.5 ${esAdministrador ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                      <Checkbox
                        className="size-5"
                        checked={tipoAdmin === "centralizada"}
                        disabled={!esAdministrador}
                        onCheckedChange={() => {
                          setTipoAdmin("centralizada")
                          setForm((f) => ({ ...f, secretaria: "", secretariaId: null, secretariaPath: [], unidad: "", unidadId: null, unidadPath: [] }))
                        }}
                      />
                      <span className="text-sm font-light text-[var(--color-core-piedra-20)]">Centralizada</span>
                    </label>
                  )}
                  {(esAdministrador || tipoAdminFijo === "paraestatal") && (
                    <label className={`flex items-center gap-2.5 ${esAdministrador ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                      <Checkbox
                        className="size-5"
                        checked={tipoAdmin === "paraestatal"}
                        disabled={!esAdministrador}
                        onCheckedChange={() => {
                          setTipoAdmin("paraestatal")
                          setForm((f) => ({ ...f, secretaria: "", secretariaId: null, secretariaPath: [], unidad: "", unidadId: null, unidadPath: [] }))
                        }}
                      />
                      <span className="text-sm font-light text-[var(--color-core-piedra-20)]">Paraestatal</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-blue-600/70" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Secretaría / Unidad perteneciente</span>
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
                      unidad: "",
                      unidadId: null,
                      unidadPath: [],
                    }))
                  }
                />
              </div>
            </>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Acceso al menú para <span className="text-primary normal-case">{form.nombre || "el usuario"}</span>
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Selecciona las secciones del menú a las que tendrá acceso. Los permisos pre-seleccionados corresponden al rol <span className="font-medium">{form.rol}</span>.
              </p>
              {permTreeLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Cargando menús...
                </div>
              ) : permTree && permTree.length > 0 ? (
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  <MenuPermisoTree
                    nodes={permTree}
                    menuIds={selectedPermisos.menuIds}
                    onMenuToggle={(menuId, checked) =>
                      setSelectedPermisos((prev) => {
                        const set = new Set(prev.menuIds)
                        if (checked) set.add(menuId); else set.delete(menuId)
                        return { ...prev, menuIds: Array.from(set) }
                      })
                    }
                    level={0}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">No hay menús disponibles.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl shrink-0">
          <div>
            {step > 1 && (
              <Button
                variant="default"
                size="sm"
                className="text-xs h-9"
                onClick={() => { setErrors({}); setStep((s) => s - 1) }}
              >
                Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="text-xs h-9"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="text-xs h-9 rounded-full shadow-sm gap-1.5 bg-[#773357] hover:bg-[#773357] active:bg-[#773357] active:text-white text-white border-0"
              onClick={handleNext}
              disabled={step === 4 && permTreeLoading}
            >
              {step < 4 ? "Siguiente" : "Confirmar y Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

type EditarUsuarioModalProps = {
  usuario: Usuario
  onClose: () => void
  onSaved: (updated: Usuario) => void
}

function EditarUsuarioModal({ usuario, onClose, onSaved }: EditarUsuarioModalProps) {
  const { user: currentUser } = useAuth()
  const tipoAdminFijo = usuario.tipoAdministracion   // tipo del usuario editado, no del logueado
  const esAdministrador = currentUser?.rol === "Administrador"
  const rfcLimpio = usuario.rfc?.trim().toUpperCase() ?? ""
  const [form, setForm] = useState({
    nombre:          usuario.nombre.trim(),
    correo:          /\S+@\S+\.\S+/.test(usuario.correo) ? usuario.correo : "",
    rfc:             validarRFC(rfcLimpio) ? rfcLimpio : "",
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
  const [claveAlert, setClaveAlert] = useState("")
  const [tree, setTree] = useState<OrganoCentralizadoNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [tipoAdmin, setTipoAdmin] = useState<"centralizada" | "paraestatal">(tipoAdminFijo)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    setTreeLoading(true)
    fetchCentralizadaTree()
      .then((central) => {
        if (usuario.secretariaId) {
          const found = findNodePath(central, usuario.secretariaId)
          if (!found) {
            fetchCategoriasParaestatal()
              .then((cats) => {
                const paraTree = paraestatalToTree(cats)
                const paraFound = findNodePath(paraTree, `org-${usuario.secretariaId}`)
                if (paraFound) {
                  setTipoAdmin("paraestatal")
                  setTree(paraTree)
                  setForm((f) => ({ ...f, secretariaId: `org-${usuario.secretariaId}` }))
                } else {
                  setTree(central)
                }
              })
              .catch(() => setTree(central))
              .finally(() => setTreeLoading(false))
            return
          }
        }
        setTree(central)
        setTreeLoading(false)
      })
      .catch(() => setTreeLoading(false))
  }, [])

  const handleTipoAdminChange = (v: string) => {
    const newTipo = v as "centralizada" | "paraestatal"
    setTipoAdmin(newTipo)
    setForm((f) => ({ ...f, secretaria: "", secretariaId: null, secretariaPath: [] }))
    setTreeLoading(true)
    setTree([])
    const promise = newTipo === "centralizada"
      ? fetchCentralizadaTree()
      : fetchCategoriasParaestatal().then(paraestatalToTree)
    promise
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido"
    if (!form.correo.trim()) e.correo = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido"
    if (form.rfc.trim() && !validarRFC(form.rfc)) e.rfc = "RFC inválido (ej. ABCD850101XYZ)"
    if (!form.rol)        e.rol        = "Seleccione un rol"
    if (!form.secretaria) e.secretaria = "Seleccione una secretaría"
    if (form.password && form.password.length < 8) e.password = "Mínimo 8 caracteres"
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden"
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (tipoAdmin === "centralizada") {
      const claveErr = getClaveError(form.secretariaId, tree)
      if (claveErr) { setClaveAlert(claveErr); return }
    }
    setLoading(true)
    setApiError("")
    try {
      let secretariaTexto: string
      if (form.secretariaPath.length > 0) {
        const nodePath = form.secretariaId ? findNodePath(tree, form.secretariaId) : null
        const rootNombre = nodePath?.[0]?.nombre ?? form.secretariaPath[0]
        const uaNombre = nodePath && nodePath.length > 1
          ? (nodePath[1].ua_clave_administrativa ?? nodePath[1].nombre)
          : null
        secretariaTexto = uaNombre ? `${rootNombre} > ${uaNombre}` : rootNombre
      } else {
        secretariaTexto = form.secretaria
      }
      const rawSecretariaId =
        form.secretariaId?.startsWith("org-") || form.secretariaId?.startsWith("cat-")
          ? null
          : form.secretariaId
      const payload: Record<string, unknown> = {
        nombre:          form.nombre,
        correo:          form.correo,
        rfc:             form.rfc ? form.rfc.toUpperCase() : null,
        rolNombre:       form.rol,
        activo:          form.estatus === "Activo",
        secretariaId:    rawSecretariaId,
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
    hint?: string,
    autoComplete = "off"
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`bg-background rounded-full h-9 px-4 text-xs font-light text-[var(--color-core-piedra-20)] ${errors[key] ? "border-destructive" : ""}`}
      />
      {hint && !errors[key] && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      {errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
    </div>
  )

  const initials = usuario.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase()

  return (
    <>
    <ConfirmDialog
      open={!!claveAlert}
      onClose={() => setClaveAlert("")}
      onConfirm={() => setClaveAlert("")}
      variant="default"
      title="Secretaría sin Unidades Administrativas"
      description={claveAlert}
      confirmLabel="Entendido"
      hideCancel
    />
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xl mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-card-foreground">Editar Usuario</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Modifica los datos del usuario seleccionado</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 bg-muted/40 border-b border-border/50 shrink-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-primary">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-light text-[var(--color-core-piedra-20)] truncate">{usuario.nombre}</p>
            <p className="text-[11px] text-muted-foreground truncate">{usuario.correo} · {usuario.rol}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {usuario.estatus === "Activo" ? (
              <StatusBadge label="Activo" color={C_VERDE_ESTADO} bgColor={C_VERDE_ESTADO_BG} className="text-[11px]" />
            ) : (
              <StatusBadge label="Inactivo" color={C_ROSA_VINO} bgColor={C_ROSA_VINO_BG} className="text-[11px]" />
            )}
            {usuario.tipoAdministracion === "centralizada" ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[9px] font-light" style={{ backgroundColor: C_VERDE_ESTADO_BG, color: C_VERDE_ESTADO }}>
                Centralizada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[9px] font-light" style={{ backgroundColor: C_ROSA_VINO_BG, color: C_ROSA_VINO }}>
                Paraestatal
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {apiError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-xs text-destructive flex items-center gap-2">
              <X className="h-3.5 w-3.5 shrink-0" />
              {apiError}
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Datos personales</span>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field("nombre", "Nombre completo", "text", "Ej. Juan Pérez García")}
              </div>
              {field("correo", "Correo electrónico", "email", "usuario@gobierno.gob.mx")}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">RFC / Usuario</Label>
                <Input
                  placeholder="ABCD850101XYZ"
                  value={form.rfc}
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                  className={`bg-background rounded-full h-9 text-xs font-mono font-light text-[var(--color-core-piedra-20)] tracking-widest ${errors.rfc ? "border-destructive" : ""}`}
                  maxLength={13}
                />
                {!errors.rfc && <span className="text-[10px] text-muted-foreground"></span>}
                {errors.rfc && <span className="text-[10px] text-destructive">{errors.rfc}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm((f) => ({ ...f, rol: v }))}>
                  <SelectTrigger className={`bg-background h-9 py-2 text-xs ${errors.rol ? "border-destructive" : ""}`}>
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
                  <SelectTrigger className="bg-background h-9 py-2 text-xs">
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de Administración</Label>
            <div className="grid grid-cols-2 gap-2">
              {(esAdministrador || tipoAdminFijo === "centralizada") && (
                <button
                  type="button"
                  disabled={!esAdministrador}
                  onClick={() => handleTipoAdminChange("centralizada")}
                  className={`flex items-start gap-2.5 rounded-lg border-2 p-3 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipoAdmin === "centralizada"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <Landmark className={`h-4 w-4 mt-0.5 shrink-0 ${tipoAdmin === "centralizada" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-light leading-tight ${tipoAdmin === "centralizada" ? "text-primary" : "text-[var(--color-core-piedra-20)]"}`}>Centralizada</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Dependencias del gobierno federal</span>
                  </div>
                </button>
              )}
              {(esAdministrador || tipoAdminFijo === "paraestatal") && (
                <button
                  type="button"
                  disabled={!esAdministrador}
                  onClick={() => handleTipoAdminChange("paraestatal")}
                  className={`flex items-start gap-2.5 rounded-lg border-2 p-3 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipoAdmin === "paraestatal"
                      ? "border-secondary bg-secondary/5"
                      : "border-border bg-background hover:border-secondary/40 hover:bg-muted/40"
                  }`}
                >
                  <Factory className={`h-4 w-4 mt-0.5 shrink-0 ${tipoAdmin === "paraestatal" ? "text-secondary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-light leading-tight ${tipoAdmin === "paraestatal" ? "text-secondary" : "text-[var(--color-core-piedra-20)]"}`}>Paraestatal</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Organismos y entidades paraestatales</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-blue-600/70 shrink-0" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Secretaría / Unidad perteneciente</span>
              {form.secretaria && (
                <span className="ml-auto min-w-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {form.secretariaPath.length > 0 ? form.secretariaPath.join(" › ") : form.secretaria}
                  </span>
                </span>
              )}
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

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-amber-600/70" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cambiar contraseña</span>
              <span className="ml-auto text-[10px] text-muted-foreground italic">opcional</span>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={`bg-background rounded-full px-4 h-9 text-xs pr-9 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {errors.password && <span className="text-[10px] text-destructive">{errors.password}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    className={`bg-background h-9 rounded-full px-4 text-xs pr-9 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="text-[10px] text-destructive">{errors.confirmPassword}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl shrink-0">
          <span className="text-[11px] text-muted-foreground hidden sm:block">Los campos requeridos están marcados en rojo</span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="default"
              size="sm"
              className="text-xs h-9"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="text-xs h-9 rounded-full shadow-sm gap-1.5 bg-[#773357] hover:bg-[#773357] active:bg-[#773357] active:text-white text-white border-0"
              onClick={handleSubmit}
              disabled={loading}
              >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando...</>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function samePermisos(a: PermisosUser, b: PermisosUser): boolean {
  if (a.menuIds.length !== b.menuIds.length) return false
  const setA = new Set(a.menuIds)
  for (const id of b.menuIds) if (!setA.has(id)) return false
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
  const { habilitarPermiso, revocarPermiso, getPermisosUsuario } = useAutorizaciones()
  const { honorarios: calHon, asimilados: calAs, nombramiento: calNom } = useCalendario()
  const { user: currentUser } = useAuth()
  const [capturaHabilitada, setCapturaHabilitada] = useState(false)
  const [regimenCap, setRegimenCap] = useState<"honorarios" | "asimilados" | "nombramiento" | "">("")
  const [periodoCap, setPeriodoCap]  = useState("")
  const permisosCaptura = getPermisosUsuario(usuario.id)
  const activosCaptura  = permisosCaptura.filter((p) => p.active && !p.used)
  const periodoOpcionesCap = regimenCap === "honorarios"
    ? calHon.map((r) => r.mes)
    : regimenCap === "asimilados"
    ? calAs.map((r) => r.quincena)
    : regimenCap === "nombramiento"
    ? calNom.map((r) => r.quincena)
    : []

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

  const handleSavePermisos = useCallback(async () => {
    if (permisos == null) return
    setPermisosSaveError(null)
    setPermisosSaveLoading(true)
    try {
      if (capturaHabilitada && regimenCap && periodoCap) {
        await habilitarPermiso({ userId: usuario.id, regimen: regimenCap, periodo: periodoCap, grantedBy: currentUser?.nombre ?? "Administrador" })
        setCapturaHabilitada(false)
        setRegimenCap("")
        setPeriodoCap("")
      }
      const updated = await updatePermisosUser(usuario.id, permisos)
      setPermisos(updated)
      setInitialPermisos(updated)
      onClose()
    } catch (e) {
      setPermisosSaveError(e instanceof Error ? e.message : "Error al Guardar ")
    } finally {
      setPermisosSaveLoading(false)
    }
  }, [usuario.id, permisos, capturaHabilitada, regimenCap, periodoCap, habilitarPermiso, currentUser, onClose])
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
      if (capturaHabilitada && regimenCap && periodoCap) {
        await habilitarPermiso({ userId: usuario.id, regimen: regimenCap, periodo: periodoCap, grantedBy: currentUser?.nombre ?? "Administrador" })
        setCapturaHabilitada(false)
        setRegimenCap("")
        setPeriodoCap("")
      }
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
  }, [usuario.id, permisos, capturaHabilitada, regimenCap, periodoCap, habilitarPermiso, currentUser, onClose])

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
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 " onClick={requestClose}>
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
                  <span className="text-muted-foreground">Menús Activos:</span>
                  <Badge variant="secondary" className="font-mono">
                    {permisos.menuIds.length}
                  </Badge>
                </div>

              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 border border-blue-200/50 rounded-md px-3 py-2.5">
                <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span>
                  Active o desactive el acceso a cada sección con el switch. Switch activado = el usuario puede ver y usar esa sección completa.
                </span>
              </div>
              {treeLoading ? (
                <p className="text-sm text-muted-foreground">Cargando árbol de menús...</p>
              ) : (
                <div className="space-y-3">
                  <MenuPermisoTree
                    nodes={tree}
                    menuIds={permisos.menuIds}
                    onMenuToggle={handleMenuToggle}
                    level={0}
                  />
                </div>
              )}
            </>
          )}
          {!permisosLoading && permisos != null && (!tree || tree.length === 0) && !treeLoading && (
            <p className="text-sm text-muted-foreground py-4">No hay menús configurados.</p>
          )}
          {!permisosLoading && permisos != null && (
            <>
              <div
                className={`rounded-lg transition-all ${
                  capturaHabilitada
                    ? "bg-primary/[0.03] border border-primary/10"
                    : "bg-transparent border border-transparent hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Switch
                    id="habilitar-captura-switch"
                    checked={capturaHabilitada}
                    onCheckedChange={(v) => {
                      setCapturaHabilitada(v)
                      if (!v) { setRegimenCap(""); setPeriodoCap(""); setCaptSaved(false) }
                    }}
                    className="shrink-0"
                  />
                  <label
                    htmlFor="habilitar-captura-switch"
                    className={`text-sm font-medium cursor-pointer flex-1 ${capturaHabilitada ? "text-card-foreground" : "text-muted-foreground"}`}
                  >
                    Habilitar captura
                  </label>
                  {activosCaptura.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {activosCaptura.length}
                    </Badge>
                  )}
                </div>

                {capturaHabilitada && (
                  <div className="flex flex-col gap-3 px-3 pb-3 ml-11">
                    {activosCaptura.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {activosCaptura.map((p, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-card-foreground">{p.regimen} · {p.periodo}</span>
                              <span className="text-[10px] text-muted-foreground">Otorgado: {p.grantedAt} por {p.grantedBy}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void revocarPermiso(p.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Revocar permiso"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm">Régimen</Label>
                      <Select value={regimenCap} onValueChange={(v) => { setRegimenCap(v as typeof regimenCap); setPeriodoCap("") }}>
                        <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione régimen" /></SelectTrigger>
                        <SelectContent className="z-[200]">
                          <SelectItem value="honorarios">Honorarios</SelectItem>
                          <SelectItem value="asimilados">Asimilados a Salarios</SelectItem>
                          <SelectItem value="nombramiento">Nombramiento TD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {regimenCap && (
                      <div className="flex flex-col gap-2">
                        <Label className="text-sm">{regimenCap === "honorarios" ? "Mes" : "Quincena"} de aplicación</Label>
                        <Select value={periodoCap} onValueChange={setPeriodoCap}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={`Seleccione ${regimenCap === "honorarios" ? "mes" : "quincena"}`} />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            {periodoOpcionesCap.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {capturaHabilitada && regimenCap && !periodoCap && (
                      <p className="text-[11px] text-muted-foreground">
                        Selecciona {regimenCap === "honorarios" ? "el mes" : "la quincena"} y luego da clic en "Guardar permisos".
                      </p>
                    )}
                    {capturaHabilitada && !regimenCap && (
                      <p className="text-[11px] text-muted-foreground">
                        Selecciona el régimen y luego da clic en "Guardar permisos".
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl shrink-0">
          <Button
            variant="default"
            size="sm"
            className="text-xs h-9"
            onClick={requestClose}
          >
            Cerrar
          </Button>
          <div className="flex items-center gap-3">
            {!permisosLoading && permisos != null && (
              <>
                <Button variant="primary"
                  onClick={() => void handleSavePermisos()}
                  disabled={permisosSaveLoading}
                  className="min-w-[140px]"
                  >
                  {permisosSaveLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Guardar permisos
                </Button>
                {permisosSaveError && (
                  <span className="text-sm text-destructive">{permisosSaveError}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

type FiltroTipoAdmin = "todos" | "centralizada" | "paraestatal"
const FILTRO_TIPO_ADMIN_LABEL: Record<FiltroTipoAdmin, string> = {
  todos: "Todos",
  centralizada: "Centralizada",
  paraestatal: "Paraestatal",
}

function TipoAdminSelect({
  value,
  onChange,
}: {
  value: FiltroTipoAdmin
  onChange: (next: FiltroTipoAdmin) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FiltroTipoAdmin)}>
      <SelectTrigger className="w-44 bg-card">
        <SelectValue>{FILTRO_TIPO_ADMIN_LABEL[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        <SelectItem value="centralizada">Centralizada</SelectItem>
        <SelectItem value="paraestatal">Paraestatal</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function UsuariosPage() {
  const [usuarios,      setUsuarios]      = useState<Usuario[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState("")
  const [searchTerm,    setSearchTerm]    = useState("")
  const [filtroAdmin,   setFiltroAdmin]   = useState<FiltroTipoAdmin>("todos")
  const [tabEstatus,    setTabEstatus]    = useState<"activos" | "deshabilitados">("activos")
  const [currentPage,   setCurrentPage]   = useState(1)
  const [permisoUserId,         setPermisoUserId]         = useState<string | null>(null)
  const [editingUserId,         setEditingUserId]         = useState<string | null>(null)
  const [showNewForm,           setShowNewForm]           = useState(false)
  const [newFormKey,            setNewFormKey]            = useState(0)
  const { permisos } = useAutorizaciones()

  const recargarUsuarios = useCallback(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch((err) => setLoadError(err.message))
  }, [])

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const activos       = usuarios.filter((u) => u.estatus === "Activo")
  const deshabilitados = usuarios.filter((u) => u.estatus === "Inactivo")
  const pool = tabEstatus === "activos" ? activos : deshabilitados

  const filtered = pool.filter((row) => {
    if (filtroAdmin !== "todos" && row.tipoAdministracion !== filtroAdmin) return false
    const q = normalizeText(searchTerm)
    return !q ||
      normalizeText(row.nombre).includes(q) ||
      normalizeText(row.correo).includes(q) ||
      normalizeText(row.rfc ?? "").includes(q) ||
      normalizeText(row.rol).includes(q) ||
      normalizeText(row.secretaria).includes(q)
  })

  useEffect(() => { setCurrentPage(1) }, [tabEstatus, filtroAdmin, searchTerm])
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const hasActivePermiso = (id: string) =>
    permisos.some((p) => p.userId === id && p.active && !p.used)

  const toggleEstatus = async (u: Usuario) => {
    try {
      await actualizarUsuario(u.id, { activo: u.estatus !== "Activo" })
      recargarUsuarios()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error")
    }
  }
  const usuarioEditando       = editingUserId         ? usuarios.find((u) => u.id === editingUserId)         ?? null : null
  const usuarioPermiso        = permisoUserId         ? usuarios.find((u) => u.id === permisoUserId)         ?? null : null
  return (
    <PageLayout
      title="Usuarios"
      description="Administración de usuarios del sistema"
    >
      {}
      <div className="flex items-center justify-end">
        <Button className="bg-[#773357] hover:bg-[#773357]/90 text-white gap-2" onClick={() => setShowNewForm(true)}>
          Nuevo Usuario
        </Button>
      </div>

      {}
      {showNewForm && (
        <NuevoUsuarioModal
          key={newFormKey}
          onClose={() => { setShowNewForm(false); setNewFormKey((k) => k + 1) }}
          onSaved={() => { recargarUsuarios(); setShowNewForm(false); setNewFormKey((k) => k + 1) }}
        />
      )}
      {usuarioEditando && (
        <EditarUsuarioModal
          usuario={usuarioEditando}
          onClose={() => setEditingUserId(null)}
          onSaved={() => { recargarUsuarios(); setEditingUserId(null) }}
        />
      )}
      {usuarioPermiso && (
        <PermisoModal
          key={usuarioPermiso.id}
          usuario={usuarioPermiso}
          onClose={() => setPermisoUserId(null)}
        />
      )}

      <div className="flex w-full justify-center">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          <button
            onClick={() => setTabEstatus("activos")}
            className={`rounded-md px-5 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border ${
              tabEstatus === "activos" ? "bg-[#e4e3d6] border-[#c2d4a8] text-[#3a4a2a]" : "border-transparent text-muted-foreground hover:text-card-foreground"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            Activos
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${tabEstatus === "activos" ? "bg-[#f3f4f6] text-[#1f1f1f]" : "bg-muted"}`}>
              {activos.length}
            </span>
          </button>
          <button
            onClick={() => setTabEstatus("deshabilitados")}
            className={`rounded-md px-5 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 border ${
              tabEstatus === "deshabilitados" ? "bg-[#e4e3d6] border-[#c2d4a8] text-[#3a4a2a]" : "border-transparent text-muted-foreground hover:text-card-foreground"
            }`}
          >
            <PowerOff className="h-3.5 w-3.5" />
            Deshabilitados
            {deshabilitados.length > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${tabEstatus === "deshabilitados" ? "bg-[#f3f4f6] text-[#1f1f1f]" : "bg-muted"}`}>
                {deshabilitados.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Buscar por nombre, correo, RFC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          containerClassName="flex-1 max-w-sm"
        />
        <TipoAdminSelect value={filtroAdmin} onChange={setFiltroAdmin} />
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {loading ? "Cargando..." : `${filtered.length} ${tabEstatus === "activos" ? "usuarios activos" : "usuarios deshabilitados"}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive mb-4">
              {loadError}
            </div>
          )}
          <div className="overflow-x-auto rounded-[8px] border border-[#E5E7EB] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>RFC</th>
                  <th>Rol</th>
                  <th>Administracion</th>
                  <th>Secretaría</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-card-foreground">
                      <div className="flex items-center gap-2">
                        {row.nombre}
                        {hasActivePermiso(row.id) && (
                          <span className="inline-block h-2 w-2 rounded-full bg-secondary shrink-0" title="Permiso activo" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.correo}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {row.rfc ?? <span className="text-muted-foreground/50 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.rol}</td>
                    <td className="px-4 py-3">
                      {row.tipoAdministracion === "centralizada" ? (
                        <StatusBadge label="Centralizada" color={C_VERDE_ESTADO} bgColor={C_VERDE_ESTADO_BG} />
                      ) : (
                        <StatusBadge label="Paraestatal" color={C_ROSA_VINO} bgColor={C_ROSA_VINO_BG} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs leading-tight max-w-[180px]">
                      {row.secretaria?.split(" > ")[0] ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.estatus === "Activo" ? (
                        <StatusBadge label="Activo" color={C_VERDE_ESTADO} bgColor={C_VERDE_ESTADO_BG} />
                      ) : (
                        <StatusBadge label="Inactivo" color={C_ROSA_VINO} bgColor={C_ROSA_VINO_BG} />
                      )}
                    </td>
                    <td className="px-4 py-3">
  <div className="flex items-center justify-end">
    <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover:bg-stone-200 hover:text-foreground" aria-label="Acciones">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Acciones</TooltipContent>
                        </Tooltip>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setPermisoUserId(row.id)}>
          <KeyRound className="mr-2 h-4 w-4" />
          Permisos
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setEditingUserId(row.id)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => toggleEstatus(row)}>
          {row.estatus === "Activo" ? (
            <>
              <PowerOff className="mr-2 h-4 w-4" />
              Deshabilitar
            </>
          ) : (
            <>
              <Power className="mr-2 h-4 w-4" />
              Habilitar
            </>
          )}
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
        </CardContent>
      </Card>
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </PageLayout>
  )
}
