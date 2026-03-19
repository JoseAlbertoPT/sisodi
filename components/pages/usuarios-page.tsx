"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, UserPlus, KeyRound, Pencil, X, PowerOff, Power } from "lucide-react"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { useAuth } from "@/lib/auth-context"
import { CAP_3000, CAP_1000, NOMBRAMIENTO_TD } from "@/lib/calendario-recepcion-mock"

const SECRETARIAS = [
  "Secretaría de Administración",
  "Secretaría de Finanzas",
  "Secretaría de Salud",
  "Secretaría de Educación",
  "Secretaría de Obras Públicas",
  "Secretaría de Seguridad Pública",
  "Secretaría de Desarrollo Social",
  "Secretaría de Medio Ambiente",
  "Secretaría de Turismo",
  "Secretaría de Economía",
  "Oficialía Mayor",
  "Contraloría General",
]

const ROLES = ["Director Operativo", "Analista", "Revisor", "Capturista", "Administrador"]

type Usuario = {
  id: string
  nombre: string
  correo: string
  rfc: string | null
  rol: string
  secretaria: string
  estatus: "Activo" | "Inactivo"
}

const API = "/api"

// ── Funciones de API (sin Authorization header) ───────────────────────────────

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
  areaNombre: string
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


type NuevoUsuarioFormProps = {
  onClose: () => void
  onSaved: (u: Usuario) => void
}

function NuevoUsuarioModal({ onClose, onSaved }: NuevoUsuarioFormProps) {
  const [form, setForm] = useState({
    nombre:     "",
    correo:     "",
    rfc:        "",
    password:   "",
    rol:        "",
    secretaria: "",
    estatus:    "Activo" as "Activo" | "Inactivo",
  })
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState("")

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim())   e.nombre   = "El nombre es requerido"
    if (!form.correo.trim())   e.correo   = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.correo)) e.correo = "Correo inválido"
    if (form.rfc.trim() && !validarRFC(form.rfc)) e.rfc   = "RFC inválido (ej. ABCD850101XYZ)"
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
      const nuevo = await crearUsuario({
        nombre:     form.nombre,
        correo:     form.correo,
        rfc:        form.rfc.toUpperCase(),
        password:   form.password,
        rolNombre:  form.rol,
        areaNombre: form.secretaria,
      })
      onSaved(nuevo)
      onClose()
    } catch (err: any) {
      setApiError(err.message)
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
        value={form[key]}
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
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Registrar Nuevo Usuario</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completa los campos para concluir el registro</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {apiError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              {apiError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("nombre",   "Nombre completo",    "text",     "Ej. Juan Pérez García")}
            {field("correo",   "Correo electrónico",  "email",    "usuario@gobierno.gob.mx")}
            {field("rfc",      "RFC",                 "text",     "ABCD850101XYZ", "Opcional — 13 caracteres")}
            {field("password", "Contraseña",          "password", "Mínimo 6 caracteres")}

            {/* Rol */}
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

            {/* Secretaría */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Secretaría Perteneciente</Label>
              <Select value={form.secretaria} onValueChange={(v) => setForm((f) => ({ ...f, secretaria: v }))}>
                <SelectTrigger className={`bg-background h-9 text-xs ${errors.secretaria ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Seleccione secretaría" />
                </SelectTrigger>
                <SelectContent>
                  {SECRETARIAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.secretaria && <span className="text-[10px] text-destructive">{errors.secretaria}</span>}
            </div>

            {/* Estatus */}
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

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
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

// ── Modal: Editar Usuario ─────────────────────────────────────────────────────

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
    estatus:         usuario.estatus,
    password:        "",
    confirmPassword: "",
  })
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState("")

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
      const payload: any = {
        nombre:     form.nombre,
        correo:     form.correo,
        rfc:        form.rfc ? form.rfc.toUpperCase() : null,
        rolNombre:  form.rol,
        areaNombre: form.secretaria,
        activo:     form.estatus === "Activo",
      }
      if (form.password) payload.password = form.password
      const actualizado = await actualizarUsuario(usuario.id, payload)
      onSaved(actualizado)
      onClose()
    } catch (err: any) {
      setApiError(err.message)
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
        value={form[key]}
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
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Editar Usuario</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Modifica los datos del usuario seleccionado</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {apiError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              {apiError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("nombre", "Nombre completo",   "text",  "Ej. Juan Pérez García")}
            {field("correo", "Correo electrónico", "email", "usuario@gobierno.gob.mx")}
            {field("rfc",    "RFC",                "text",  "ABCD850101XYZ", "Opcional — 13 caracteres")}

            {/* Rol */}
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

            {/* Estatus */}
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

            {/* Secretaría */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Secretaría Perteneciente</Label>
              <Select value={form.secretaria} onValueChange={(v) => setForm((f) => ({ ...f, secretaria: v }))}>
                <SelectTrigger className={`bg-background h-9 text-xs ${errors.secretaria ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Seleccione secretaría" />
                </SelectTrigger>
                <SelectContent>
                  {SECRETARIAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.secretaria && <span className="text-[10px] text-destructive">{errors.secretaria}</span>}
            </div>

            {/* Cambiar contraseña */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">
                  Cambiar contraseña (opcional)
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("password",        "Nueva contraseña",     "password", "Dejar en blanco para no cambiar")}
                {field("confirmPassword", "Confirmar contraseña", "password", "Repite la nueva contraseña")}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
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

// ── Modal: Permisos ───────────────────────────────────────────────────────────

type PermisoModalProps = {
  usuario: Usuario
  onClose: () => void
}

function PermisoModal({ usuario, onClose }: PermisoModalProps) {
  const { habilitarPermiso, revocarPermiso, getPermisosUsuario } = useAutorizaciones()
  const { user } = useAuth()
  const [regimen, setRegimen] = useState<"" | "honorarios" | "asimilados" | "nombramiento">("")
  const [periodo, setPeriodo] = useState("")

  const permisos        = getPermisosUsuario(usuario.nombre)
  const permisosActivos = permisos.filter((p) => p.active && !p.used)
  const permisosUsados  = permisos.filter((p) => p.used)

  const periodoOptions =
    regimen === "honorarios"   ? CAP_3000.map((r) => r.mes) :
    regimen === "asimilados"   ? CAP_1000.map((r) => r.quincena) :
    regimen === "nombramiento" ? NOMBRAMIENTO_TD.map((r) => r.quincena) : []

  const handleHabilitar = () => {
    if (!regimen || !periodo) return
    habilitarPermiso({
      userId:    usuario.nombre,
      regimen:   regimen as "honorarios" | "asimilados" | "nombramiento",
      periodo,
      grantedBy: user?.nombre || "Director Operativo",
    })
    setRegimen("")
    setPeriodo("")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Permisos de captura</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{usuario.nombre}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <span className="text-xs font-medium text-card-foreground">Habilitar captura (1 uso)</span>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Régimen</Label>
                <Select value={regimen} onValueChange={(v) => { setRegimen(v as typeof regimen); setPeriodo("") }}>
                  <SelectTrigger className="bg-background h-9 text-xs">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="honorarios">Honorarios</SelectItem>
                    <SelectItem value="asimilados">Asimilados</SelectItem>
                    <SelectItem value="nombramiento">Nombramiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Periodo</Label>
                <Select value={periodo} onValueChange={setPeriodo} disabled={!regimen}>
                  <SelectTrigger className="bg-background h-9 text-xs">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodoOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  disabled={!regimen || !periodo}
                  onClick={handleHabilitar}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 w-full"
                >
                  Habilitar
                </Button>
              </div>
            </div>
          </div>

          {permisosActivos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Permisos activos</span>
              {permisosActivos.map((p, i) => (
                <div key={`${p.regimen}-${p.periodo}-${i}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-secondary/40 text-secondary">{p.regimen}</Badge>
                    <span className="text-xs text-card-foreground">{p.periodo}</span>
                    <span className="text-[10px] text-muted-foreground">({p.grantedAt})</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive/80" onClick={() => revocarPermiso(p.userId, p.regimen, p.periodo)}>
                    Revocar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {permisosUsados.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Permisos consumidos</span>
              {permisosUsados.map((p, i) => (
                <div key={`used-${p.regimen}-${p.periodo}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{p.regimen}</Badge>
                  <span className="text-xs text-muted-foreground">{p.periodo}</span>
                  <span className="text-[10px] text-muted-foreground">Usado {p.consumedAt || ""}</span>
                </div>
              ))}
            </div>
          )}

          {permisosActivos.length === 0 && permisosUsados.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin permisos registrados para este usuario.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}


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
      const actualizado = await actualizarUsuario(u.id, { activo: u.estatus === "Activo" ? false : true })
      setUsuarios((prev) => prev.map((x) => x.id === actualizado.id ? actualizado : x))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const usuarioEditando = editingUserId ? usuarios.find((u) => u.id === editingUserId) ?? null : null
  const usuarioPermiso  = permisoUserId ? usuarios.find((u) => u.id === permisoUserId)  ?? null : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Usuarios</h2>
          <p className="text-sm text-muted-foreground">Administración de usuarios del sistema</p>
        </div>
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
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Correo</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">RFC</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Secretaría</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estatus</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Acciones</th>
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
    </div>
  )
}