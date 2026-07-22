"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ClipboardCheck, AlertCircle, Inbox } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { useAuth } from "@/lib/auth-context"
import { PageLayout } from "@/components/page-layout"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import { FirmaProgresoDialog, estadoProcesoBadge, faseDeProceso } from "@/components/firma-progreso-dialog"

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
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Proceso | null>(null)
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

  const totalPages = Math.max(1, Math.ceil(procesos.length / ITEMS_PER_PAGE))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])
  const paginated = procesos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <PageLayout
      title="Progreso de Firmado"
      description="Estado de los procesos de firma electrónica de justificaciones."
    >

      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[var(--sem-support-error)] bg-[#FFF5F5] px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sem-support-error)] mt-0.5" />
          <span className="text-sm text-[var(--sem-support-error)]">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Todos los procesos</CardTitle>
        </CardHeader>
        <CardContent>
          {procesos.length === 0 ? (
            <EmptyState icon={Inbox} title="Sin resultados" description="Ajusta los filtros para ver más resultados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-muted-foreground border-b">
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
                      <td className="py-2.5 pr-4">{estadoProcesoBadge(p.estado)}</td>
                      <td className="py-2.5 pr-4 font-mono">{p.firmados}/{p.total_firmantes}</td>
                      <td className="py-2.5 pr-4">{faseDeProceso(p)}</td>
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

      <FirmaProgresoDialog proceso={detalle} open={!!detalle} onClose={() => setDetalle(null)} />

    </PageLayout>
  )
}
