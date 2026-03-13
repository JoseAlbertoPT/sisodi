"use client"

import { useState } from "react"
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

const ROLES = ["Admin", "Capturista / URG", "UEFA", "Revisión (F1)", "Validación (F2)", "Emisión (F3)", "Vista"]

type Usuario = {
  id: number
  nombre: string
  email: string
  rol: string
  secretaria: string
  estatus: "Activo" | "Inactivo"
}

const initialUsuarios: Usuario[] = [
  { id: 1, nombre: "Maria Garcia Lopez",  email: "maria.garcia@gobierno.gob.mx",    rol: "Director Operativo", secretaria: "Secretaría de Administración",    estatus: "Activo"   },
  { id: 2, nombre: "Carlos Martinez R.",  email: "carlos.martinez@gobierno.gob.mx", rol: "Analista",           secretaria: "Secretaría de Finanzas",          estatus: "Activo"   },
  { id: 3, nombre: "Ana Hernandez P.",    email: "ana.hernandez@gobierno.gob.mx",   rol: "Revisor",            secretaria: "Secretaría de Salud",             estatus: "Activo"   },
  { id: 4, nombre: "Roberto Diaz S.",     email: "roberto.diaz@gobierno.gob.mx",    rol: "Capturista",         secretaria: "Secretaría de Educación",         estatus: "Inactivo" },
  { id: 5, nombre: "Luisa Fernandez M.",  email: "luisa.fernandez@gobierno.gob.mx", rol: "Analista",           secretaria: "Secretaría de Obras Públicas",    estatus: "Activo"   },
  { id: 6, nombre: "Pedro Sanchez T.",    email: "pedro.sanchez@gobierno.gob.mx",   rol: "Administrador",      secretaria: "Contraloría General",             estatus: "Activo"   },
  { id: 7, nombre: "Maria Lopez",         email: "maria.lopez@gobierno.gob.mx",     rol: "Capturista",         secretaria: "Secretaría de Desarrollo Social",  estatus: "Activo"   },
  { id: 8, nombre: "Juan Perez",          email: "juan.perez@gobierno.gob.mx",      rol: "Capturista",         secretaria: "Secretaría de Economía",          estatus: "Activo"   },
]

//  Nuevo Usuario
type NuevoUsuarioFormProps = {
  onClose: () => void
  onSave: (u: Omit<Usuario, "id">) => void
}

function NuevoUsuarioModal({ onClose, onSave }: NuevoUsuarioFormProps) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    rol: "",
    secretaria: "",
    estatus: "Activo" as "Activo" | "Inactivo",
    password: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim())   e.nombre   = "El nombre es requerido"
    if (!form.email.trim())    e.email    = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Correo inválido"
    if (!form.rol)             e.rol      = "Seleccione un rol"
    if (!form.secretaria)      e.secretaria = "Seleccione una secretaría"
    if (!form.password.trim()) e.password = "La contraseña es requerida"
    else if (form.password.length < 6) e.password = "Mínimo 6 caracteres"
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ nombre: form.nombre, email: form.email, rol: form.rol, secretaria: form.secretaria, estatus: form.estatus })
    onClose()
  }

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`bg-background h-9 text-xs ${errors[key] ? "border-destructive" : ""}`}
      />
      {errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Registrar Nuevo Usuario</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completa los campos para concluir el registro</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("nombre",   "Nombre completo",    "text",     "Ej. Juan Pérez García")}
            {field("email",    "Correo electrónico",  "email",    "usuario@gobierno.gob.mx")}
            {field("password", "Contraseña",          "password", "Mínimo 6 caracteres")}

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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9" onClick={handleSubmit}>
            Guardar usuario
          </Button>
        </div>
      </div>
    </div>
  )
}

//  Modal: Editar Usuario
type EditarUsuarioModalProps = {
  usuario: Usuario
  onClose: () => void
  onSave: (updated: Usuario) => void
}

function EditarUsuarioModal({ usuario, onClose, onSave }: EditarUsuarioModalProps) {
  const [form, setForm] = useState({
    nombre:          usuario.nombre,
    email:           usuario.email,
    rol:             usuario.rol,
    secretaria:      usuario.secretaria,
    estatus:         usuario.estatus,
    password:        "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido"
    if (!form.email.trim())  e.email  = "El correo es requerido"
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Correo inválido"
    if (!form.rol)           e.rol    = "Seleccione un rol"
    if (!form.secretaria)    e.secretaria = "Seleccione una secretaría"
    if (form.password && form.password.length < 6) e.password = "Mínimo 6 caracteres"
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden"
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...usuario, nombre: form.nombre, email: form.email, rol: form.rol, secretaria: form.secretaria, estatus: form.estatus })
    onClose()
  }

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`bg-background h-9 text-xs ${errors[key] ? "border-destructive" : ""}`}
      />
      {errors[key] && <span className="text-[10px] text-destructive">{errors[key]}</span>}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Editar Usuario</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Modifica los datos del usuario seleccionado</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("nombre", "Nombre completo",   "text",  "Ej. Juan Pérez García")}
            {field("email",  "Correo electrónico", "email", "usuario@gobierno.gob.mx")}

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

            {/* ── Sección contraseña ── */}
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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
          <Button variant="outline" size="sm" className="text-xs h-9" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9" onClick={handleSubmit}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

// Modal: Permisos
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
      userId: usuario.nombre,
      regimen: regimen as "honorarios" | "asimilados" | "nombramiento",
      periodo,
      grantedBy: user?.name || "Director Operativo",
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
          {/* Habilitar nuevo permiso */}
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

          {/* Permisos activos */}
          {permisosActivos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Permisos activos</span>
              {permisosActivos.map((p, i) => (
                <div
                  key={`${p.regimen}-${p.periodo}-${i}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-secondary/40 text-secondary">{p.regimen}</Badge>
                    <span className="text-xs text-card-foreground">{p.periodo}</span>
                    <span className="text-[10px] text-muted-foreground">({p.grantedAt})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive/80"
                    onClick={() => revocarPermiso(p.userId, p.regimen, p.periodo)}
                  >
                    Revocar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Permisos consumidos */}
          {permisosUsados.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Permisos consumidos</span>
              {permisosUsados.map((p, i) => (
                <div
                  key={`used-${p.regimen}-${p.periodo}-${i}`}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
                >
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
  const [usuarios, setUsuarios]           = useState<Usuario[]>(initialUsuarios)
  const [searchTerm, setSearchTerm]       = useState("")
  const [permisoUserId, setPermisoUserId] = useState<number | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [showNewForm, setShowNewForm]     = useState(false)
  const { permisos } = useAutorizaciones()

  const filtered = usuarios.filter(
    (row) =>
      row.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.rol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.secretaria.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hasActivePermiso = (nombre: string) =>
    permisos.some((p) => p.userId === nombre && p.active && !p.used)

  const toggleEstatus = (id: number) => {
    setUsuarios((prev) =>
      prev.map((u) => u.id === id ? { ...u, estatus: u.estatus === "Activo" ? "Inactivo" : "Activo" } : u)
    )
  }

  const handleSaveNuevo = (data: Omit<Usuario, "id">) => {
    const newId = Math.max(...usuarios.map((u) => u.id)) + 1
    setUsuarios((prev) => [...prev, { id: newId, ...data }])
  }

  const handleSaveEditar = (updated: Usuario) => {
    setUsuarios((prev) => prev.map((u) => u.id === updated.id ? updated : u))
  }

  const usuarioEditando = editingUserId ? usuarios.find((u) => u.id === editingUserId) ?? null : null
  const usuarioPermiso  = permisoUserId  ? usuarios.find((u) => u.id === permisoUserId)  ?? null : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Usuarios</h2>
          <p className="text-sm text-muted-foreground">Administración de usuarios del sistema</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          onClick={() => setShowNewForm(true)}
        >
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Modal: Nuevo usuario */}
      {showNewForm && (
        <NuevoUsuarioModal
          onClose={() => setShowNewForm(false)}
          onSave={handleSaveNuevo}
        />
      )}

      {/* Modal: Editar usuario */}
      {usuarioEditando && (
        <EditarUsuarioModal
          usuario={usuarioEditando}
          onClose={() => setEditingUserId(null)}
          onSave={handleSaveEditar}
        />
      )}

      {/* Modal: Permisos */}
      {usuarioPermiso && (
        <PermisoModal
          key={usuarioPermiso.id}
          usuario={usuarioPermiso}
          onClose={() => setPermisoUserId(null)}
        />
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {filtered.length} usuarios registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Correo</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Secretaría</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estatus</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">

                    {/* Nombre */}
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      <div className="flex items-center gap-2">
                        {row.nombre}
                        {hasActivePermiso(row.nombre) && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-secondary shrink-0"
                            title="Permiso activo"
                          />
                        )}
                      </div>
                    </td>

                    {/* Correo */}
                    <td className="px-4 py-3 text-muted-foreground">{row.email}</td>

                    {/* Rol */}
                    <td className="px-4 py-3 text-muted-foreground">{row.rol}</td>

                    {/* Secretaría */}
                    <td className="px-4 py-3 text-muted-foreground text-xs leading-tight max-w-[180px]">
                      {row.secretaria}
                    </td>

                    {/* Estatus */}
                    <td className="px-4 py-3">
                      {row.estatus === "Activo" ? (
                        <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">

                        {/* Permiso — KeyRound */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-secondary hover:text-primary gap-1.5 text-xs"
                          onClick={() => setPermisoUserId(row.id)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Permiso
                        </Button>

                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80 gap-1.5 text-xs"
                          onClick={() => setEditingUserId(row.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>

                        {/* Habilitar / Deshabilitar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title={row.estatus === "Activo" ? "Deshabilitar usuario" : "Habilitar usuario"}
                          className={`gap-1.5 text-xs ${
                            row.estatus === "Activo"
                              ? "text-destructive hover:text-destructive/80"
                              : "text-secondary hover:text-secondary/80"
                          }`}
                          onClick={() => toggleEstatus(row.id)}
                        >
                          {row.estatus === "Activo" ? (
                            <><PowerOff className="h-3.5 w-3.5" />Deshabilitar</>
                          ) : (
                            <><Power className="h-3.5 w-3.5" />Habilitar</>
                          )}
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