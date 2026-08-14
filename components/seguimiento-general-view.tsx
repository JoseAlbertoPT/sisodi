"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput, SEARCH_INPUT_MAX_W_SM } from "@/components/ui/search-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { C_VERDE_ESTADO, C_ROSA_VINO, C_VIOLETA_EMISION } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Loader2, AlertTriangle, FileText, Info, Inbox,
} from "lucide-react"

interface SolicitudSeguimiento {
  id: number
  folio_recepcion: string | null
  folio_justificacion: string | null
  folio_dictamen: string | null
  tipo_solicitud: string | null
  denominacion: string | null
  secretaria: string | null
  regimen: string | null
  fecha_creacion: string | null
  fecha_envio: string | null
  fecha_emision: string | null
  estado: string
  etapa: string
  responsable: { nombre: string; detalle: string }
  es_emitida: boolean
}

const FLUJO_ETAPAS: { key: string; label: string; short: string }[] = [
  { key: "captura",   label: "Captura",    short: "CAP" },
  { key: "uefa",      label: "UEFA",       short: "UEFA" },
  { key: "revisor",   label: "Revisor",    short: "REV" },
  { key: "validador", label: "Validador",  short: "VAL" },
  { key: "emisor",    label: "Emisor",     short: "EMI" },
  { key: "firmado",   label: "Firma",      short: "FIR" },
  { key: "emitido",   label: "Emitido",    short: "OK" },
]

export const ESTADOS_VISIBLES_EMISION = new Set<string>([
  "pendiente do",
  "en revision revisor",
  "observado por revisor",
  "aceptado por revisor",
  "aprobado por revisor",
  "pendiente firma justificacion",
  "en validacion final",
  "observado por validacion final",
])

function labelEstado(estado: string): string {
  const n = (estado ?? "").trim().toLowerCase()
  if (n === "pendiente do") return "Pendiente de asignación"
  return estado
}

function EstadoBadge({ estado, etapa }: { estado: string; etapa: string }) {
  const color =
    etapa === "emitido"   ? C_VERDE_ESTADO
    : etapa === "rechazado" ? C_ROSA_VINO
    : etapa === "emisor"    ? C_VIOLETA_EMISION
    : "#64748b"
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold w-fit"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {labelEstado(estado)}
    </span>
  )
}

function formatFecha(v: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function SeguimientoGeneralView({ refreshSignal }: { refreshSignal?: number }) {
  const [data, setData] = useState<SolicitudSeguimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [filterTipo, setFilterTipo] = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterEtapa, setFilterEtapa] = useState("todas")
  const [filterEstado, setFilterEstado] = useState("todos")
  const [filterResponsable, setFilterResponsable] = useState("Sin asignar")

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/solicitudes-seguimiento", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setData(json.data ?? [])
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshSignal])

  const dataVisible = useMemo(
    () => data.filter(s => ESTADOS_VISIBLES_EMISION.has(s.estado.toLowerCase())),
    [data]
  )

  const tipos = useMemo(() => [...new Set(dataVisible.map(d => d.tipo_solicitud).filter(Boolean))] as string[], [dataVisible])
  const secretarias = useMemo(() => [...new Set(dataVisible.map(d => d.secretaria).filter(Boolean))] as string[], [dataVisible])
  const estados = useMemo(() => [...new Set(dataVisible.map(d => d.estado).filter(Boolean))] as string[], [dataVisible])
  const responsables = useMemo(() => [...new Set(dataVisible.map(d => d.responsable.nombre).filter(Boolean))] as string[], [dataVisible])

  const filtered = useMemo(() => dataVisible.filter(s => {
    const t = q.trim().toLowerCase()
    if (t) {
      const coincide =
        (s.folio_recepcion ?? "").toLowerCase().includes(t) ||
        (s.folio_justificacion ?? "").toLowerCase().includes(t) ||
        (s.folio_dictamen ?? "").toLowerCase().includes(t) ||
        (s.secretaria ?? "").toLowerCase().includes(t) ||
        (s.denominacion ?? "").toLowerCase().includes(t) ||
        (s.tipo_solicitud ?? "").toLowerCase().includes(t)
      if (!coincide) return false
    }
    if (filterTipo !== "todos" && s.tipo_solicitud !== filterTipo) return false
    if (filterSecretaria !== "todas" && s.secretaria !== filterSecretaria) return false
    if (filterEtapa !== "todas" && s.etapa !== filterEtapa) return false
    if (filterEstado !== "todos" && s.estado !== filterEstado) return false
    if (filterResponsable !== "todos" && s.responsable.nombre !== filterResponsable) return false
    return true
  }), [dataVisible, q, filterTipo, filterSecretaria, filterEtapa, filterEstado, filterResponsable])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className={`flex flex-col gap-1 flex-1 min-w-[220px] ${SEARCH_INPUT_MAX_W_SM}`}>
          <Label className="text-xs text-muted-foreground">Búsqueda</Label>
          <SearchInput
            placeholder="Folio, secretaría, denominación..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Tipo de solicitud</Label>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Secretaría</Label>
          <Select value={filterSecretaria} onValueChange={setFilterSecretaria}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {secretarias.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Etapa del flujo</Label>
          <Select value={filterEtapa} onValueChange={setFilterEtapa}>
            <SelectTrigger className="w-36 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {FLUJO_ETAPAS.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Estatus</Label>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {estados.map(e => <SelectItem key={e} value={e}>{labelEstado(e)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Responsable</Label>
          <Select value={filterResponsable} onValueChange={setFilterResponsable}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsables.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mb-2.5" />}
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {loading ? "Cargando..." : `${filtered.length} solicitud${filtered.length !== 1 ? "es" : ""} en el flujo`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              <span className="text-sm text-muted-foreground">Cargando solicitudes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Inbox} title="Sin resultados" description="Ajusta los filtros para ver más resultados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-base text-content-high">
                    <th className="px-3 py-2.5 text-left font-semibold">Folio</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Secretaría</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Régimen</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Fecha de recepción</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Responsable</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const sinAsignar = s.responsable.nombre === "Sin asignar"
                    return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-card-foreground font-semibold">
                            {s.folio_recepcion ?? <span className="italic text-muted-foreground">Sin FREC</span>}
                          </span>
                          {s.folio_dictamen && (
                            <span className="text-[10px] text-muted-foreground">DIC: {s.folio_dictamen}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[180px] whitespace-normal">
                        <span className="line-clamp-2">{s.secretaria ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] whitespace-normal">
                        <span className="line-clamp-2">{s.regimen ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {s.fecha_envio ? formatFecha(s.fecha_envio) : <span className="italic">Pendiente</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className={sinAsignar ? "italic text-muted-foreground" : "text-card-foreground font-medium"}>
                            {s.responsable.nombre}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{s.responsable.detalle}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><EstadoBadge estado={s.estado} etapa={s.etapa} /></td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
