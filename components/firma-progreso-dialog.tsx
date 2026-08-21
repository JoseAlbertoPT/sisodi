"use client"

import { Badge } from "@/components/ui/badge"
import { StatusBadge, T_INFO, T_INFO_BG, T_SUCCESS, T_SUCCESS_BG } from "@/components/ui/status-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2 } from "lucide-react"

export interface FirmaProgresoFirmante {
  id: number
  orden: number
  rol: string
  cargo: string
  tipo: string
  firmado: boolean
  fecha_firma: string | null
  nombre: string | null
  rfc: string | null
  cargo_firmante?: string | null
}

export interface FirmaProgresoProceso {
  id: number
  solicitud_id: number
  folio_justificacion: string | null
  folio_recepcion: string | null
  tipo_solicitud: string | null
  estado: string
  firmados: number
  total_firmantes: number | null
  externos_completos: boolean
  externos_total: number
  externos_firmados: number
  firmantes: FirmaProgresoFirmante[]
}

export function estadoProcesoBadge(estado: string) {
  const completado = estado === "completado"
  return (
    <StatusBadge
      label={completado ? "Completado" : "Iniciado"}
      color={completado ? T_SUCCESS : T_INFO}
      bgColor={completado ? T_SUCCESS_BG : T_INFO_BG}
    />
  )
}

export function faseDeProceso(p: FirmaProgresoProceso): string {
  if (p.estado === "completado") return "Completado"
  if (!p.externos_completos) return `Esperando externos (${p.externos_firmados}/${p.externos_total})`
  const internosPend = p.firmantes.filter(f => f.tipo === "interno" && !f.firmado).length
  return internosPend > 0 ? `Firmas internas (${internosPend} pend.)` : "Finalizado"
}

/** Modal de detalle del proceso de firma electrónica: estado, progreso y lista de firmantes con su turno. */
export function FirmaProgresoDialog({
  proceso, open, onClose,
}: {
  proceso: FirmaProgresoProceso | null
  open: boolean
  onClose: () => void
}) {
  if (!proceso) return null
  // Solo se muestran los firmantes hasta el primer pendiente (turno actual);
  // los que vienen después de ese aún no deben revelarse.
  const primerPendienteIdx = proceso.firmantes.findIndex(f => !f.firmado)
  const firmantesVisibles = primerPendienteIdx === -1
    ? proceso.firmantes
    : proceso.firmantes.slice(0, primerPendienteIdx + 1)
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {proceso.folio_recepcion ?? proceso.folio_justificacion ?? `SOL-${proceso.solicitud_id}`} — {proceso.tipo_solicitud}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm px-6 pb-6">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {estadoProcesoBadge(proceso.estado)}
            <span>{proceso.firmados}/{proceso.total_firmantes} firmas</span>
            <span>·</span>
            <span>{faseDeProceso(proceso)}</span>
          </div>
          <div className="flex flex-col gap-4">
            {firmantesVisibles.map(f => (
              <div key={f.id} className="rounded-md border p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">#{f.orden}</span>
                  <span className="text-sm font-semibold">{f.rol}</span>
                  <Badge variant="outline" className="text-[11px]">{f.tipo}</Badge>
                  {f.firmado
                    ? <Badge variant="success" className="text-[11px] gap-1"><CheckCircle2 className="h-3 w-3" />Firmado</Badge>
                    : <Badge variant="warning" className="text-[11px]">Pendiente</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.cargo}</p>
                {f.nombre && (
                  <p className="text-xs mt-3 leading-relaxed">{f.nombre}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
