"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, UserPlus, Pencil, X } from "lucide-react"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { useAuth } from "@/lib/auth-context"
import { CAP_3000, CAP_1000, NOMBRAMIENTO_TD } from "@/lib/calendario-recepcion-mock"

const usuariosData = [
  { id: 1, nombre: "Maria Garcia Lopez", email: "maria.garcia@gobierno.gob.mx", rol: "Director Operativo", estatus: "Activo" },
  { id: 2, nombre: "Carlos Martinez R.", email: "carlos.martinez@gobierno.gob.mx", rol: "Analista", estatus: "Activo" },
  { id: 3, nombre: "Ana Hernandez P.", email: "ana.hernandez@gobierno.gob.mx", rol: "Revisor", estatus: "Activo" },
  { id: 4, nombre: "Roberto Diaz S.", email: "roberto.diaz@gobierno.gob.mx", rol: "Capturista", estatus: "Inactivo" },
  { id: 5, nombre: "Luisa Fernandez M.", email: "luisa.fernandez@gobierno.gob.mx", rol: "Analista", estatus: "Activo" },
  { id: 6, nombre: "Pedro Sanchez T.", email: "pedro.sanchez@gobierno.gob.mx", rol: "Administrador", estatus: "Activo" },
  { id: 7, nombre: "Maria Lopez", email: "maria.lopez@gobierno.gob.mx", rol: "Capturista", estatus: "Activo" },
  { id: 8, nombre: "Juan Perez", email: "juan.perez@gobierno.gob.mx", rol: "Capturista", estatus: "Activo" },
]

function PermisoManager({ usuario, onClose }: { usuario: typeof usuariosData[0]; onClose: () => void }) {
  const { habilitarPermiso, revocarPermiso, getPermisosUsuario } = useAutorizaciones()
  const { user } = useAuth()

  const [regimen, setRegimen] = useState<"" | "honorarios" | "asimilados" | "nombramiento">("")
  const [periodo, setPeriodo] = useState("")

  const permisos = getPermisosUsuario(usuario.nombre)
  const permisosActivos = permisos.filter((p) => p.active && !p.used)
  const permisosUsados = permisos.filter((p) => p.used)

  const periodoOptions = regimen === "honorarios"
    ? CAP_3000.map((r) => r.mes)
    : regimen === "asimilados"
      ? CAP_1000.map((r) => r.quincena)
      : regimen === "nombramiento"
        ? NOMBRAMIENTO_TD.map((r) => r.quincena)
        : []

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
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            Permisos de captura - {usuario.nombre}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Grant new permission */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <span className="text-xs font-medium text-card-foreground">Habilitar captura (1 uso)</span>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Regimen</Label>
              <Select
                value={regimen}
                onValueChange={(v) => {
                  setRegimen(v as "honorarios" | "asimilados" | "nombramiento")
                  setPeriodo("")
                }}
              >
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
              <Select
                value={periodo}
                onValueChange={setPeriodo}
                disabled={!regimen}
              >
                <SelectTrigger className="bg-background h-9 text-xs">
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {periodoOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
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

        {/* Active permissions */}
        {permisosActivos.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Permisos activos</span>
            {permisosActivos.map((p, i) => (
              <div
                key={`${p.regimen}-${p.periodo}-${i}`}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-secondary/40 text-secondary">
                    {p.regimen}
                  </Badge>
                  <span className="text-xs text-card-foreground">{p.periodo}</span>
                  <span className="text-[10px] text-muted-foreground">({p.grantedAt})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => revocarPermiso(p.userId, p.regimen, p.periodo)}
                >
                  Revocar
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Used permissions (history) */}
        {permisosUsados.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Permisos consumidos</span>
            {permisosUsados.map((p, i) => (
              <div
                key={`used-${p.regimen}-${p.periodo}-${i}`}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
              >
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {p.regimen}
                </Badge>
                <span className="text-xs text-muted-foreground">{p.periodo}</span>
                <span className="text-[10px] text-muted-foreground">Usado {p.consumedAt || ""}</span>
              </div>
            ))}
          </div>
        )}

        {permisosActivos.length === 0 && permisosUsados.length === 0 && (
          <p className="text-xs text-muted-foreground">Sin permisos registrados para este usuario.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function UsuariosPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const { permisos } = useAutorizaciones()

  const filtered = usuariosData.filter(
    (row) =>
      row.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.rol.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Check if a user has an active permission
  const hasActivePermiso = (nombre: string) =>
    permisos.some((p) => p.userId === nombre && p.active && !p.used)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Administracion de usuarios del sistema
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

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
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estatus</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Accion</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.rol}</td>
                    <td className="px-4 py-3">
                      {row.estatus === "Activo" ? (
                        <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/90">{row.estatus}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{row.estatus}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-secondary hover:text-primary gap-1.5"
                        onClick={() => setEditingUserId(editingUserId === row.id ? null : row.id)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Permission manager – shown below the table when editing a user */}
      {editingUserId && (() => {
        const usuario = usuariosData.find((u) => u.id === editingUserId)
        if (!usuario) return null
        return (
          <PermisoManager
            key={usuario.id}
            usuario={usuario}
            onClose={() => setEditingUserId(null)}
          />
        )
      })()}
    </div>
  )
}
