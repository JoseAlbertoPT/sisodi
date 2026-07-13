"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Shield, AlertCircle, Stamp } from "lucide-react"
import { FirmarInternoDialog } from "@/components/firmar-interno-dialog"

interface FirmanteInfo {
  id: number
  orden: number
  rol: string
  cargo: string
  tipo: string
  bandeja: string | null
  firmado: boolean
  nombre: string | null
  rfc: string | null
  cargo_firmante?: string | null
}

interface ProcesoItem {
  id: number
  solicitud_id: number
  folio_justificacion: string | null
  folio_recepcion: string | null
  folio_dictamen: string | null
  tipo_solicitud: string | null
  modalidad_firma: string | null
  estado: string
  estado_solicitud: string | null
  firmados: number
  total_firmantes: number | null
  externos_completos: boolean
  externos_total: number
  externos_firmados: number
  mi_firmante_pendiente: { id: number; rol: string; cargo: string; bandeja: string | null; bloqueado: boolean } | null
  pendiente_emision_por_mi: boolean
  mi_firmante_emisor_id: number | null
  sellado_emision_subido: boolean
  firmantes: FirmanteInfo[]
}

interface Props {
  filtro: 1 | 2 | 3
  currentUserId: string
  onCountChange?: (count: number) => void
}

function bandejaParaFiltro(filtro: 1 | 2 | 3): "revision" | "validacion" | "emision" {
  return filtro === 1 ? "revision" : filtro === 2 ? "validacion" : "emision"
}

export function PendientesFirmaPanel({ filtro, currentUserId, onCountChange }: Props) {
  const [items, setItems] = useState<ProcesoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firmanteDialogId, setFirmanteDialogId] = useState<number | null>(null)

  const bandejaActual = bandejaParaFiltro(filtro)

  const cargar = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/firma-efirma/progreso?usuarioId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      const procesos: ProcesoItem[] = json.procesos ?? []
      const filtrados = procesos.filter(p => {
        if (bandejaActual === "emision" && p.pendiente_emision_por_mi) return true
        if (!p.mi_firmante_pendiente || p.mi_firmante_pendiente.bandeja !== bandejaActual) return false
        const miFirmante = p.firmantes.find(f => f.id === p.mi_firmante_pendiente!.id)
        if (!miFirmante) return false
        const siguiente = p.firmantes
          .filter(f => !f.firmado)
          .sort((a, b) => a.orden - b.orden)[0]
        return !!siguiente && miFirmante.orden === siguiente.orden
      })
      setItems(filtrados)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [currentUserId, bandejaActual])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { onCountChange?.(items.length) }, [items.length, onCountChange])

  const dialogTarget = (() => {
    if (firmanteDialogId === null) return null
    for (const p of items) {
      const f = p.firmantes.find(x => x.id === firmanteDialogId)
      if (f) return { proceso: p, firmante: f }
    }
    return null
  })()

  const dialogIniciarEnSellado = !!(
    dialogTarget &&
    dialogTarget.firmante.bandeja === "emision" &&
    dialogTarget.firmante.firmado &&
    dialogTarget.proceso.pendiente_emision_por_mi
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-light text-[color:var(--color-core-piedra-20)] flex items-center gap-2">
          <Stamp className="h-4 w-4 text-secondary" /> Justificaciones pendientes de firmar como {bandejaActual}
        </h3>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-12">No tienes firmas pendientes en este filtro.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                <th className="px-4 py-2">Folio</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Rol a firmar</th>
                <th className="px-4 py-2">Progreso</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => {
                if (p.pendiente_emision_por_mi) {
                  const miEmisor = p.firmantes.find(f => f.id === p.mi_firmante_emisor_id)
                  return (
                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`}</td>
                      <td className="px-4 py-2 text-xs">{p.tipo_solicitud ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{miEmisor?.rol ?? "Emitió"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.firmados}/{p.total_firmantes}</td>
                      <td className="px-4 py-2">
                        <Badge className="bg-accent/30 text-accent-foreground border-0 text-[10px]">
                          {p.sellado_emision_subido ? "Listo para emitir" : "Falta sellar"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" onClick={() => p.mi_firmante_emisor_id && setFirmanteDialogId(p.mi_firmante_emisor_id)}
                          className="rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 gap-1.5">
                          <Stamp className="h-3.5 w-3.5" /> Sellar y emitir
                        </Button>
                      </td>
                    </tr>
                  )
                }

                const miOrden = p.mi_firmante_pendiente ? p.firmantes.find(f => f.id === p.mi_firmante_pendiente!.id)?.orden ?? Infinity : Infinity
                const siguiente = p.firmantes.filter(f => !f.firmado).sort((a, b) => a.orden - b.orden)[0] ?? null
                const esMiTurno = siguiente && miOrden === siguiente.orden
                return (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono text-xs">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`}</td>
                    <td className="px-4 py-2 text-xs">{p.tipo_solicitud ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{p.mi_firmante_pendiente?.rol}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.firmados}/{p.total_firmantes}</td>
                    <td className="px-4 py-2">
                      {esMiTurno
                        ? <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Tu turno</Badge>
                        : <Badge variant="outline" className="text-[10px]">Esperando #{siguiente?.orden} · {siguiente?.rol}</Badge>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" onClick={() => p.mi_firmante_pendiente && setFirmanteDialogId(p.mi_firmante_pendiente.id)}
                        disabled={!esMiTurno}
                        className="rounded-full bg-[#773357] text-white hover:bg-[#773357] hover:text-white hover:opacity-90 gap-1.5">
                        <Shield className="h-3.5 w-3.5" /> Firmar
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogTarget && (
        <FirmarInternoDialog
          open
          onClose={() => setFirmanteDialogId(null)}
          firmanteId={dialogTarget.firmante.id}
          usuarioId={currentUserId}
          titulo={
            dialogIniciarEnSellado
              ? `Sellar y emitir — ${dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion ?? `SOL-${dialogTarget.proceso.solicitud_id}`}`
              : `Firmar como ${dialogTarget.firmante.rol} — ${dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion ?? `SOL-${dialogTarget.proceso.solicitud_id}`}`
          }
          subtitulo={dialogTarget.firmante.cargo}
          bandeja={dialogTarget.firmante.bandeja}
          folio={dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion}
          folioDictamen={dialogTarget.proceso.folio_dictamen}
          solicitudId={dialogTarget.proceso.solicitud_id}
          iniciarEnSellado={dialogIniciarEnSellado}
          onFirmado={async () => { await cargar(); setFirmanteDialogId(null) }}
        />
      )}
    </div>
  )
}
