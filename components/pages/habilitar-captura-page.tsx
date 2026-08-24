"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Unlock, Trash2, CheckCircle2 } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import { useAutorizaciones, type PermisoCaptura } from "@/lib/autorizaciones-store"
import { useCalendario } from "@/lib/calendario-store"
import { useAuth } from "@/lib/auth-context"

type Usuario = { id: string; nombre: string; correo: string; rol: string }

async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await fetch("/api/usuarios")
  if (!res.ok) throw new Error("Error al cargar usuarios")
  return res.json()
}

export function HabilitarCapturaPage() {
  const { habilitarPermiso, revocarPermiso, getPermisosUsuario, permisos } = useAutorizaciones()
  const { honorarios, asimilados, nombramiento } = useCalendario()
  const { user: currentUser } = useAuth()

  const [usuarios,  setUsuarios]  = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState("")
  const [regimen,           setRegimen]           = useState<"honorarios" | "asimilados" | "nombramiento" | "">("")
  const [periodo,           setPeriodo]           = useState("")
  const [saved,             setSaved]             = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<PermisoCaptura | null>(null)
  const [pageActivos,      setPageActivos]      = useState(1)
  const [pageTodosActivos, setPageTodosActivos] = useState(1)

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .catch(() => {})
  }, [])

  const usuarioSeleccionado = usuarios.find((u) => u.id === usuarioId) ?? null

  const permisosUsuario: PermisoCaptura[] = usuarioSeleccionado
    ? getPermisosUsuario(usuarioSeleccionado.id)
    : []
  const activos = permisosUsuario.filter((p) => p.active && !p.used)
  const activosTotalPages = Math.ceil(activos.length / ITEMS_PER_PAGE)
  const activosPageItems  = activos.slice((pageActivos - 1) * ITEMS_PER_PAGE, pageActivos * ITEMS_PER_PAGE)

  const periodoOpciones = regimen === "honorarios"
    ? honorarios.map((r) => r.mes)
    : regimen === "asimilados"
    ? asimilados.map((r) => r.quincena)
    : regimen === "nombramiento"
    ? nombramiento.map((r) => r.quincena)
    : []

  const handleHabilitar = () => {
    if (!regimen || !periodo || !usuarioSeleccionado) return
    habilitarPermiso({
      userId:    usuarioSeleccionado.id,
      regimen,
      periodo,
      grantedBy: currentUser?.nombre ?? "Administrador",
    })
    setSaved(true)
    setPeriodo("")
    setRegimen("")
    setTimeout(() => setSaved(false), 2500)
  }


  const todosActivos = permisos.filter((p) => p.active && !p.used)
  const todosActivosTotalPages = Math.ceil(todosActivos.length / ITEMS_PER_PAGE)
  const todosActivosPageItems  = todosActivos.slice((pageTodosActivos - 1) * ITEMS_PER_PAGE, pageTodosActivos * ITEMS_PER_PAGE)

  useEffect(() => { setPageActivos(1) }, [usuarioSeleccionado?.id])
  useEffect(() => { if (pageActivos > activosTotalPages) setPageActivos(Math.max(1, activosTotalPages)) }, [activosTotalPages, pageActivos])
  useEffect(() => { if (pageTodosActivos > todosActivosTotalPages) setPageTodosActivos(Math.max(1, todosActivosTotalPages)) }, [todosActivosTotalPages, pageTodosActivos])

  return (
    <PageLayout title="Habilitar Captura" description="Otorga permisos de captura extemporánea a usuarios">

      <div className="grid gap-6 lg:grid-cols-2">

        {}
        <Card className="shadow-sm border-border">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Unlock className="h-4 w-4 text-primary" />
              Otorgar permiso
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 pb-5">

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Usuario</Label>
              <Select value={usuarioId} onValueChange={(v) => { setUsuarioId(v); setRegimen(""); setPeriodo("") }}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione usuario" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} — {u.rol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {usuarioId && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm">Régimen</Label>
                <Select value={regimen} onValueChange={(v) => { setRegimen(v as typeof regimen); setPeriodo("") }}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione régimen" /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="honorarios">Honorarios</SelectItem>
                    <SelectItem value="asimilados">Asimilados a Salarios</SelectItem>
                    <SelectItem value="nombramiento">Nombramiento TD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {regimen && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm">{regimen === "honorarios" ? "Mes" : "Quincena"} de aplicación</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={`Seleccione ${regimen === "honorarios" ? "mes" : "quincena"}`} />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {periodoOpciones.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-2 rounded-md bg-secondary/10 border border-secondary/30 px-3 py-2 text-sm text-secondary">
                <CheckCircle2 className="h-4 w-4" />
                Permiso otorgado correctamente
              </div>
            )}

            <Button onClick={handleHabilitar} disabled={!usuarioId || !regimen || !periodo} className="self-start">
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Habilitar
            </Button>
          </CardContent>
        </Card>

        {}
        <Card className="shadow-sm border-border">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              Permisos activos
              {usuarioSeleccionado && (
                <span className="font-normal text-muted-foreground">— {usuarioSeleccionado.nombre}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {!usuarioSeleccionado ? (
              <p className="text-sm text-muted-foreground">Seleccione un usuario para ver sus permisos.</p>
            ) : activos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin permisos activos.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {activosPageItems.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-card-foreground">{p.regimen} · {p.periodo}</span>
                        <span className="text-[10px] text-muted-foreground">Otorgado: {p.grantedAt} por {p.grantedBy}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmRevoke(p)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Revocar permiso"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <TablePagination currentPage={pageActivos} totalPages={activosTotalPages} onPageChange={setPageActivos} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {}
      {todosActivos.length > 0 && (
        <>
          <Separator />
          <Card className="shadow-sm border-border">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                Todos los permisos activos
                <Badge variant="secondary" className="font-mono">{todosActivos.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-col gap-2">
                {todosActivosPageItems.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-card-foreground">{p.userId} — {p.regimen} · {p.periodo}</span>
                      <span className="text-[10px] text-muted-foreground">Otorgado: {p.grantedAt} por {p.grantedBy}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(p)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Revocar permiso"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <TablePagination currentPage={pageTodosActivos} totalPages={todosActivosTotalPages} onPageChange={setPageTodosActivos} />
            </CardContent>
          </Card>
        </>
      )}
      <ConfirmDialog
        open={!!confirmRevoke}
        onClose={() => setConfirmRevoke(null)}
        onConfirm={() => { if (confirmRevoke) { revocarPermiso(confirmRevoke.id); setConfirmRevoke(null) } }}
        variant="eliminar"
        title="¿Revocar permiso?"
        description={confirmRevoke ? `Se revocará el permiso de captura para ${confirmRevoke.regimen} · ${confirmRevoke.periodo}.` : ""}
        confirmLabel="Sí, revocar"
      />
    </PageLayout>
  )
}
