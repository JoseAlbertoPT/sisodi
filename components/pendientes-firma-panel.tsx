"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { StatusBadge, C_AZUL_REVISION, C_AZUL_REVISION_BG, C_AMARILLO, C_AMARILLO_BG } from "@/components/ui/status-badge"
import { AlertCircle, Inbox, Stamp, Eye, MoreHorizontal, Upload } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { FirmarInternoDialog } from "@/components/firmar-interno-dialog"
import { FirmaProgresoDialog } from "@/components/firma-progreso-dialog"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Subconjunto de FiltroSolicitud (components/pages/bandeja-filtro-page.tsx) —
// duplicado en vez de importado para no crear una dependencia circular entre
// ambos archivos (ese módulo ya importa este componente).
interface AutografaItem {
  id: string
  folioRecepcion: string | null
  tipo: string
  secretaria: string
  _raw?: any
}

interface FirmanteInfo {
  id: number
  orden: number
  rol: string
  cargo: string
  tipo: string
  bandeja: string | null
  firmado: boolean
  verificado: boolean
  fecha_firma: string | null
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
  /** Solicitudes en firma autógrafa (solo filtro 3) — no tienen firma_firmante,
   *  así que no aparecen entre `items`; se agregan como filas extra en esta
   *  misma tabla para no tener dos tablas separadas en "Pendiente de firma". */
  autografaItems?: AutografaItem[]
  onOpenReview?: (solicitudId: string, filtro: 1 | 2 | 3) => void
}

function bandejaParaFiltro(filtro: 1 | 2 | 3): "revision" | "validacion" | "emision" {
  return filtro === 1 ? "revision" : filtro === 2 ? "validacion" : "emision"
}

export function PendientesFirmaPanel({ filtro, currentUserId, onCountChange, autografaItems = [], onOpenReview }: Props) {
  const [items, setItems] = useState<ProcesoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firmanteDialogId, setFirmanteDialogId] = useState<number | null>(null)
  const [progresoTarget, setProgresoTarget] = useState<ProcesoItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

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
        // Si la solicitud ya llegó a "Emitido" por su propio flujo, el proceso de
        // firma quedó obsoleto (aunque queden firmantes internos sin marcar) y no
        // debe seguir apareciendo como pendiente en ningún apartado.
        if ((p.estado_solicitud ?? "").toLowerCase() === "emitido") return false
        // Se busca directo en la lista de firmantes (no solo mi_firmante_pendiente, que la
        // API solo resuelve para el primer pendiente en orden) para poder ver el proceso
        // aunque todavía no sea mi turno.
        return p.firmantes.some(f => f.tipo === "interno" && f.bandeja === bandejaActual && !f.firmado)
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

  // Misma paginación (10 por página) que el resto de las bandejas — ver
  // components/pages/bandeja-filtro-page.tsx. Se combinan ambos tipos de fila
  // en una sola lista para que el corte por página aplique a la tabla completa.
  type Row = { kind: "proceso"; item: ProcesoItem } | { kind: "autografa"; item: AutografaItem }
  const allRows: Row[] = useMemo(
    () => [
      ...items.map((item): Row => ({ kind: "proceso", item })),
      ...autografaItems.map((item): Row => ({ kind: "autografa", item })),
    ],
    [items, autografaItems],
  )
  const totalPages = Math.ceil(allRows.length / ITEMS_PER_PAGE)
  const paginatedRows = allRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  useEffect(() => { setCurrentPage(1) }, [filtro])
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages)) }, [totalPages, currentPage])

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {!loading && items.length === 0 && autografaItems.length === 0 && !error && (
        <EmptyState icon={Inbox} title="Sin firmas pendientes" description="No tienes firmas pendientes en este filtro." />
      )}

      {(items.length > 0 || autografaItems.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-base text-content-high">
                <th className="px-4 py-3 text-left font-semibold">Folio</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Rol a firmar</th>
                <th className="px-4 py-3 text-left font-semibold">Progreso</th>
                <th className="px-4 py-3 text-left font-semibold">Turno</th>
                <th className="px-4 py-3 text-left font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows
                .filter((r): r is Extract<Row, { kind: "proceso" }> => r.kind === "proceso")
                .map(({ item: p }) => {
                if (p.pendiente_emision_por_mi) {
                  const miEmisor = p.firmantes.find(f => f.id === p.mi_firmante_emisor_id)
                  return (
                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`}</td>
                      <td className="px-4 py-2 text-xs">{p.tipo_solicitud ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{miEmisor?.rol ?? "Emitió"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.firmados}/{p.total_firmantes}</td>
                      <td className="px-4 py-2">
                        <StatusBadge
                          label={p.sellado_emision_subido ? "Listo para emitir" : "Falta sellar"}
                          color={p.sellado_emision_subido ? C_AZUL_REVISION : C_AMARILLO}
                          bgColor={p.sellado_emision_subido ? C_AZUL_REVISION_BG : C_AMARILLO_BG}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => p.mi_firmante_emisor_id && setFirmanteDialogId(p.mi_firmante_emisor_id)}
                        >
                          Sellar y emitir
                        </Button>
                      </td>
                    </tr>
                  )
                }

                const miFirmante = p.firmantes.find(f => f.tipo === "interno" && f.bandeja === bandejaActual && !f.firmado) ?? null
                // Un externo firmado pero no verificado todavía cuenta como
                // "no listo" — bloquea el turno igual que si no hubiera firmado.
                const siguiente = p.firmantes
                  .filter(f => !f.firmado || (f.tipo === "externo" && !f.verificado))
                  .sort((a, b) => a.orden - b.orden)[0] ?? null
                const esMiTurno = !!(miFirmante && siguiente && miFirmante.id === siguiente.id)
                return (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono text-xs">{p.folio_recepcion ?? p.folio_justificacion ?? `SOL-${p.solicitud_id}`}</td>
                    <td className="px-4 py-2 text-xs">{p.tipo_solicitud ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{miFirmante?.rol}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.firmados}/{p.total_firmantes}</td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        label={esMiTurno ? "Para firmar" : "En firma"}
                        color={C_AMARILLO}
                        bgColor={C_AMARILLO_BG}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {esMiTurno ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setProgresoTarget(p)} className="gap-2 cursor-pointer">
                              <Eye className="h-4 w-4" />
                              Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => miFirmante && setFirmanteDialogId(miFirmante.id)}
                              className="gap-2 cursor-pointer"
                            >
                              <Stamp className="h-4 w-4" />
                              Firmar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setProgresoTarget(p)}
                          className="gap-1.5 font-medium -ml-3"
                        >
                          <Eye className="h-4 w-4" />Ver
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {paginatedRows
                .filter((r): r is Extract<Row, { kind: "autografa" }> => r.kind === "autografa")
                .map(({ item: sol }) => (
                <tr key={`autografa-${sol.id}`} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">{sol.folioRecepcion ?? sol._raw?.folio_justificacion ?? `SOL-${sol.id}`}</td>
                  <td className="px-4 py-2 text-xs">{sol.tipo}</td>
                  <td className="px-4 py-2 text-xs">Emitió</td>
                  <td className="px-4 py-2 font-mono text-xs">—</td>
                  <td className="px-4 py-2">
                    <StatusBadge label="En firma" color={C_AMARILLO} bgColor={C_AMARILLO_BG} />
                  </td>
                  <td className="px-4 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => onOpenReview?.(sol.id, filtro)} className="gap-2 cursor-pointer">
                          <Eye className="h-4 w-4" />
                          Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOpenReview?.(sol.id, filtro)} className="gap-2 cursor-pointer">
                          <Upload className="h-4 w-4" />
                          Subir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {dialogTarget && (
        <FirmarInternoDialog
          open
          onClose={() => setFirmanteDialogId(null)}
          firmanteId={dialogTarget.firmante.id}
          usuarioId={currentUserId}
          titulo={
            dialogIniciarEnSellado
              ? `Sellar y emitir — ${dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion ?? `SOL-${dialogTarget.proceso.solicitud_id}`}`
              : `Firmar Dictamen Técnico Funcional — ${dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion ?? `SOL-${dialogTarget.proceso.solicitud_id}`}`
          }
          subtitulo={`${dialogTarget.firmante.cargo} - Firmar como ${dialogTarget.firmante.rol}`}
          bandeja={dialogTarget.firmante.bandeja}
          folio={dialogTarget.proceso.folio_recepcion ?? dialogTarget.proceso.folio_justificacion}
          folioDictamen={dialogTarget.proceso.folio_dictamen}
          solicitudId={dialogTarget.proceso.solicitud_id}
          iniciarEnSellado={dialogIniciarEnSellado}
          onFirmado={async () => { await cargar(); setFirmanteDialogId(null) }}
        />
      )}

      <FirmaProgresoDialog proceso={progresoTarget} open={!!progresoTarget} onClose={() => setProgresoTarget(null)} />
    </div>
  )
}
