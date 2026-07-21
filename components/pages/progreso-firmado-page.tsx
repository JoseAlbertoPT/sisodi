"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, RefreshCw, ClipboardCheck, Shield, CheckCircle2, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { PageLayout } from "@/components/page-layout"
import { FirmarInternoDialog } from "@/components/firmar-interno-dialog"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"

interface Firmante {
  id: number
  orden: number
  rol: string
  cargo: string
  tipo: "externo" | "interno"
  bandeja: string | null
  firmado: boolean
  fecha_firma: string | null
  nombre: string | null
  rfc: string | null
  cargo_firmante: string | null
}

interface Proceso {
  id: number
  solicitud_id: number
  folio_justificacion: string | null
  folio_recepcion: string | null
  tipo_solicitud: string | null
  modalidad_firma: string | null
  tipo: string
  estado: string
  firmados: number
  total_firmantes: number | null
  fecha_creacion: string
  fecha_completado: string | null
  externos_completos: boolean
  externos_total: number
  externos_firmados: number
  mi_firmante_pendiente: { id: number; rol: string; cargo: string; bandeja: string | null; bloqueado: boolean } | null
  firmantes: Firmante[]
}

export function ProgresoFirmadoPage() {
  const { user } = useAuth()
  const usuarioId = (user as any)?.id ?? ""
  const isAdmin = (user as any)?.rol === "Administrador"
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Proceso | null>(null)
  const [firmarTarget, setFirmarTarget] = useState<{ firmanteId: number; rol: string; cargo: string } | null>(null)
  const [page, setPage] = useState(1)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const url = usuarioId
        ? `/api/firma-efirma/progreso?usuarioId=${encodeURIComponent(usuarioId)}`
        : `/api/firma-efirma/progreso`
      const res = await fetch(url, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setProcesos(json.procesos ?? [])
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [usuarioId])

  useEffect(() => { cargar() }, [cargar])

  const pendientes = useMemo(() => {
    if (isAdmin) {
      // El administrador ve los pendientes de todos los apartados, no solo los suyos.
      return procesos.filter(p =>
        p.modalidad_firma === "electronica" &&
        p.externos_completos &&
        p.firmantes.some(f => f.tipo === "interno" && !f.firmado)
      )
    }
    return procesos.filter(p => p.modalidad_firma === "electronica" && p.mi_firmante_pendiente && !p.mi_firmante_pendiente.bloqueado)
  }, [procesos, isAdmin])

  const totalPages = Math.max(1, Math.ceil(procesos.length / ITEMS_PER_PAGE))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])
  const paginated = procesos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const faseDe = (p: Proceso) => {
    if (p.estado === "completado") return "Completado"
    if (!p.externos_completos) return `Esperando externos (${p.externos_firmados}/${p.externos_total})`
    const internosPend = p.firmantes.filter(f => f.tipo === "interno" && !f.firmado).length
    return internosPend > 0 ? `Firmas internas (${internosPend} pend.)` : "Finalizado"
  }

  return (
    <PageLayout
      title="Progreso de Firmado"
      description="Estado de los procesos de firma electrónica de justificaciones."
    >

      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[#EF4444] bg-[#FFF5F5] px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626] mt-0.5" />
          <span className="text-sm text-[#DC2626]">{error}</span>
        </div>
      )}

      <Card className="border-secondary/30 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-secondary" /> {isAdmin ? "Pendientes (todos los apartados)" : "Pendientes por mí"} ({pendientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay firmas pendientes.</p>
          ) : pendientes.map(p => {
            const miPendiente = p.mi_firmante_pendiente
            const siguiente = miPendiente
              ?? p.firmantes.filter(f => f.tipo === "interno" && !f.firmado).sort((a, b) => a.orden - b.orden)[0]
              ?? null
            return (
              <div key={p.id} className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`} · {p.tipo_solicitud ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {miPendiente ? "Firmar como" : "Pendiente:"} <span className="font-semibold">{siguiente?.rol}</span> — {siguiente?.cargo}
                  </p>
                </div>
                {miPendiente ? (
                  <Button size="sm" variant="vino"
                    onClick={() => setFirmarTarget({
                      firmanteId: miPendiente.id,
                      rol: miPendiente.rol,
                      cargo: miPendiente.cargo,
                    })}>
                    Firmar
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setDetalle(p)} className="gap-1.5">
                    <img src="/iconos2/visibility.svg" alt="ver" className="h-4 w-4" /> Ver
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Todos los procesos</CardTitle>
        </CardHeader>
        <CardContent>
          {procesos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay procesos de firma aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                    <th className="py-2.5 pr-4">Folio</th>
                    <th className="py-2.5 pr-4">Tipo</th>
                    <th className="py-2.5 pr-4">Modalidad</th>
                    <th className="py-2.5 pr-4">Estado</th>
                    <th className="py-2.5 pr-4">Progreso</th>
                    <th className="py-2.5 pr-4">Fase</th>
                    <th className="py-2.5 pr-4">Creado</th>
                    <th className="py-2.5 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(p => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2.5 pr-4 font-mono">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`}</td>
                      <td className="py-2.5 pr-4">{p.tipo_solicitud ?? "—"}</td>
                      <td className="py-2.5 pr-4">{p.modalidad_firma === "electronica" ? "Electrónica" : p.modalidad_firma === "autografa" ? "Autógrafa" : "—"}</td>
                      <td className="py-2.5 pr-4"><Badge variant="outline">{p.estado}</Badge></td>
                      <td className="py-2.5 pr-4 font-mono">{p.firmados}/{p.total_firmantes}</td>
                      <td className="py-2.5 pr-4">{faseDe(p)}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">{new Date(p.fecha_creacion).toLocaleDateString("es-MX")}</td>
                      <td className="py-2.5 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => setDetalle(p)} className="gap-1.5">
                          <img src="/iconos2/visibility.svg" alt="ver" className="h-4 w-4" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {detalle && (
        <Dialog open onOpenChange={v => { if (!v) setDetalle(null) }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">
                {detalle.folio_recepcion ?? detalle.folio_justificacion ?? `SOL-${detalle.solicitud_id}`} — {detalle.tipo_solicitud}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{detalle.estado}</Badge>
                <span>{detalle.firmados}/{detalle.total_firmantes} firmas</span>
                <span>·</span>
                <span>{faseDe(detalle)}</span>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {detalle.firmantes.map(f => (
                  <div key={f.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{f.orden}</span>
                      <span className="text-sm font-semibold">{f.rol}</span>
                      <Badge variant="outline" className="text-[11px]">{f.tipo}</Badge>
                      {f.firmado
                        ? <Badge className="bg-secondary/15 text-secondary border-0 text-[11px] gap-1"><CheckCircle2 className="h-3 w-3" />Firmado</Badge>
                        : <Badge variant="outline" className="text-[11px]">Pendiente</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{f.cargo}</p>
                    {(f.nombre || f.rfc) && (
                      <p className="text-xs mt-1.5">
                        {f.nombre ?? "—"}
                        {f.rfc && <span className="text-muted-foreground ml-1 font-mono">({f.rfc})</span>}
                        {f.fecha_firma && <span className="text-muted-foreground ml-2">{new Date(f.fecha_firma).toLocaleString("es-MX")}</span>}
                      </p>
                    )}
                    {f.cargo_firmante && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        Cargo capturado: <span className="text-card-foreground font-medium">{f.cargo_firmante}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {firmarTarget && (
        <FirmarInternoDialog
          open
          onClose={() => setFirmarTarget(null)}
          firmanteId={firmarTarget.firmanteId}
          usuarioId={usuarioId}
          titulo={`Firmar como ${firmarTarget.rol}`}
          subtitulo={firmarTarget.cargo}
          onFirmado={cargar}
        />
      )}
    </PageLayout>
  )
}
