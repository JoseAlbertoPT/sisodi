"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Search, FileSearch, Filter, Clock, RotateCcw, CircleDot, Eye,
  AlertTriangle, ListFilter, RefreshCw, Loader2, CheckCircle2,
  HelpCircle, ArrowLeft, Info, ChevronDown, ChevronRight,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"


interface FiltroSolicitud {
  id: string
  folioSolicitud: string
  folioRecepcion: string | null
  folioDictamen: string | null
  folioTemporal: boolean
  tipo: string
  secretaria: string
  estado: string
  esRegularizacion: boolean
  fechaRecepcionDO: string | null
  periodo: string | null
  reingresoCount: number
  lastObservedStage: number | null
  lastObservedDate: string | null
  lastObservedEstado: string | null
  slaRestante: number | null
  openedInFiltro: Record<number, boolean>
  isNuevaEnFiltro: Record<number, boolean>
  _raw?: any
}

type TabKey = "nuevas" | "correcciones" | "revision" | "observadas" | "todas"


const FILTRO_LABELS: Record<number, string> = {
  1: "Filtro 1",
  2: "Filtro 2",
  3: "Filtro 3 (Dirección General)",
}

const MESES = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" }, { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" }, { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
]

function classifySolicitud(s: FiltroSolicitud, filtro: 1 | 2 | 3): TabKey {
  const estadoEnRevision = `En revision DO Filtro ${filtro}`
  const estadoObservado  = `Observado DO Filtro ${filtro}`

  if (s.estado === estadoObservado) return "observadas"

  if (s.estado === estadoEnRevision) {
    if (s.reingresoCount > 0 && !s.openedInFiltro[filtro]) return "correcciones"
    if (s.isNuevaEnFiltro[filtro] && !s.openedInFiltro[filtro])  return "nuevas"
    if (s.openedInFiltro[filtro]) return "revision"
    return "nuevas"
  }

  return "todas"
}

function getSlaColor(dias: number | null) {
  if (dias === null) return "text-muted-foreground"
  if (dias <= 0) return "text-destructive"
  if (dias <= 5) return "text-orange-600"
  if (dias <= 10) return "text-yellow-600"
  return "text-emerald-600"
}

function getSlaBackground(dias: number | null) {
  if (dias === null) return "bg-muted"
  if (dias <= 0) return "bg-destructive/10"
  if (dias <= 5) return "bg-orange-500/10"
  if (dias <= 10) return "bg-yellow-500/10"
  return "bg-emerald-500/10"
}

function getSlaLabel(dias: number | null) {
  if (dias === null) return "Sin fecha"
  if (dias <= 0) return `Vencido ${Math.abs(dias)}d`
  return `${dias} día${dias !== 1 ? "s" : ""}`
}

const TAB_CONFIG: Record<TabKey, { label: string; icon: React.ReactNode; activeBg: string; activeText: string }> = {
  nuevas:       { label: "Nuevas",       icon: <CircleDot className="h-3.5 w-3.5" />,   activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  correcciones: { label: "Correcciones", icon: <RotateCcw className="h-3.5 w-3.5" />,   activeBg: "bg-accent/10",      activeText: "text-accent-foreground" },
  revision:     { label: "En revisión",  icon: <Eye className="h-3.5 w-3.5" />,          activeBg: "bg-primary/10",     activeText: "text-primary" },
  observadas:   { label: "Observadas",   icon: <AlertTriangle className="h-3.5 w-3.5" />,activeBg: "bg-destructive/10", activeText: "text-destructive" },
  todas:        { label: "Todas",        icon: <ListFilter className="h-3.5 w-3.5" />,   activeBg: "bg-muted",          activeText: "text-card-foreground" },
}


function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getSlaBackground(diasRestantes)} ${getSlaColor(diasRestantes)}`}>
      <Clock className="h-3 w-3" />
      {getSlaLabel(diasRestantes)}
    </span>
  )
}

function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel, icon }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel: string; icon?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {icon ?? <HelpCircle className="h-5 w-5 text-primary" />}{title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ObservarModal({ open, onClose, onConfirm, folio }: {
  open: boolean; onClose: () => void; onConfirm: (obs: string) => void; folio: string
}) {
  const [step, setStep] = useState<"confirm" | "write">("confirm")
  const [obs, setObs]   = useState("")
  const handleClose = () => { setStep("confirm"); setObs(""); onClose() }

  if (step === "confirm") return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <HelpCircle className="h-5 w-5 text-destructive" />¿Estás seguro de observar?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Vas a marcar <strong>{folio}</strong> con observaciones. Se devolverá a la URG.
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => setStep("write")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5">
            <AlertTriangle className="h-4 w-4" />Sí, continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" />Observar — {folio}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Escriba las observaciones que se enviarán a la URG.</p>
          <Textarea
            placeholder="Describa las observaciones..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            className="min-h-[120px] bg-card"
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button
              onClick={() => { if (!obs.trim()) return; onConfirm(obs.trim()); setStep("confirm"); setObs("") }}
              disabled={!obs.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />Confirmar observación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          {icon}{title}
          <span className="ml-auto">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-card-foreground">{value || "—"}</span>
    </div>
  )
}


function DetalleView({ solicitud, filtro, onBack, onAprobar, onObservar, guardando }: {
  solicitud: FiltroSolicitud
  filtro: 1 | 2 | 3
  onBack: () => void
  onAprobar: (id: string) => void
  onObservar: (id: string, obs: string) => void
  guardando: boolean
}) {
  const [showAprobarModal,  setShowAprobarModal]  = useState(false)
  const [showObservarModal, setShowObservarModal] = useState(false)
  const raw = solicitud._raw

  const labelAprobar =
    filtro === 1 ? "Aprobar → Filtro 2"
    : filtro === 2 ? "Aprobar → Filtro 3"
    : "Aprobar → Emitir"

  const historial: Array<{ fecha: string; usuario: string; accion: string }> =
    (raw?.historial_solicitud ?? []).map((h: any) => ({
      fecha:   h.fecha ? new Date(h.fecha).toLocaleString("es-MX") : "—",
      usuario: h.usuario?.nombre ?? "Sistema",
      accion:  h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? h.comentario ?? "—",
    }))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-card-foreground">
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <span className="text-sm font-semibold text-card-foreground">{solicitud.folioRecepcion}</span>
          <Badge className="bg-primary/15 text-primary border-0 text-xs">{solicitud.estado}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAprobarModal(true)}
            disabled={guardando}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            size="sm"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {labelAprobar}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowObservarModal(true)}
            disabled={guardando}
            className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-4 w-4" />Observar
          </Button>
        </div>
      </div>

      {/* Alertas de contexto */}
      {solicitud.reingresoCount > 0 && (
        <Card className="border-2 border-accent/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <Info className="h-5 w-5 text-accent-foreground" />
            <div>
              <span className="text-sm font-medium text-accent-foreground">
                Reingreso #{solicitud.reingresoCount}
              </span>
              <p className="text-xs text-muted-foreground">
                Solicitud corregida y reenviada por la URG.
                {solicitud.lastObservedStage && ` Última observación: Filtro ${solicitud.lastObservedStage}.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contenido */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <SectionCard title="Datos Generales" icon={<Info className="h-4 w-4 text-secondary" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Folio de Recepción"   value={solicitud.folioRecepcion ?? "—"} />
              <ReadOnlyField label="Tipo de Solicitud"    value={solicitud.tipo} />
              <ReadOnlyField label="Secretaría / Área"    value={solicitud.secretaria} />
              <ReadOnlyField label="Solicitante"          value={raw?.usuario?.nombre ?? "—"} />
              <ReadOnlyField label="Correo"               value={raw?.usuario?.correo ?? "—"} />
              <ReadOnlyField label="Período"              value={solicitud.periodo ?? "—"} />
              <ReadOnlyField label="Fecha de Recepción"   value={solicitud.fechaRecepcionDO ?? "—"} />
              <ReadOnlyField label="Extemporánea"         value={solicitud.esRegularizacion ? "Sí" : "No"} />
            </div>
          </SectionCard>
          {filtro >= 2 && solicitud.folioDictamen && (
            <SectionCard title="Dictamen previo" icon={<FileSearch className="h-4 w-4 text-secondary" />}>
              <ReadOnlyField label="Folio Dictamen" value={solicitud.folioDictamen} />
            </SectionCard>
          )}
        </div>

        {/* Historial */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-secondary" />Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin historial registrado.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {[...historial].reverse().map((e, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card">
                          <div className="h-2 w-2 rounded-full bg-secondary" />
                        </div>
                        {i < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4">
                        <span className="text-xs font-medium text-card-foreground">{e.accion}</span>
                        <span className="text-[10px] text-muted-foreground">{e.fecha} — {e.usuario}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={showAprobarModal}
        onClose={() => setShowAprobarModal(false)}
        onConfirm={() => { setShowAprobarModal(false); onAprobar(solicitud.id) }}
        title={`¿${labelAprobar}?`}
        description={`La solicitud ${solicitud.folioRecepcion} avanzará al siguiente paso del proceso.`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={showObservarModal}
        onClose={() => setShowObservarModal(false)}
        onConfirm={(obs) => { setShowObservarModal(false); onObservar(solicitud.id, obs) }}
        folio={solicitud.folioRecepcion ?? solicitud.id}
      />
    </div>
  )
}
// pagina principal

interface BandejaFiltroPageProps {
  filtro: 1 | 2 | 3
  onOpenReview?: (solicitudId: string, filtro: 1 | 2 | 3) => void
}

export function BandejaFiltroPage({ filtro, onOpenReview }: BandejaFiltroPageProps) {
  const { user } = useAuth()

  const [solicitudes,     setSolicitudes]     = useState<FiltroSolicitud[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState<string | null>(null)
  const [guardando,       setGuardando]       = useState(false)
  const [activeTab,       setActiveTab]       = useState<TabKey>("todas")
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [observarTarget,  setObservarTarget]  = useState<string | null>(null)
  const [aprobarTarget,   setAprobarTarget]   = useState<string | null>(null)

  // Filtros de columna
  const [searchTerm,        setSearchTerm]        = useState("")
  const [filterAnio,        setFilterAnio]        = useState("2026")
  const [filterMes,         setFilterMes]         = useState("todos")
  const [filterSecretaria,  setFilterSecretaria]  = useState("todas")
  const [filterTipo,        setFilterTipo]        = useState("todos")
  const [filterSla,         setFilterSla]         = useState("todos")

  //  Cargar de la API
  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/filtro?filtro=${filtro}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setSolicitudes(json.data ?? [])
    } catch { setError("Error de conexión al servidor") }
    finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  // Aprobar
  const handleAprobar = useCallback(async (id: string) => {
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: Number(id),
          accion: "aprobar",
          filtro,
          usuarioId: (user as any)?.id ?? "",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al aprobar"); return }
      setSolicitudes(prev =>
        prev.map(s =>
          s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s
        )
      )
      setSelectedId(null)
    } catch { alert("Error de conexión al aprobar") }
    finally { setGuardando(false); setAprobarTarget(null) }
  }, [filtro, user])

  //  Observar
  const handleObservar = useCallback(async (id: string, obs: string) => {
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: Number(id),
          accion: "observar",
          filtro,
          usuarioId: (user as any)?.id ?? "",
          observaciones: [obs],
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al observar"); return }
      setSolicitudes(prev =>
        prev.map(s =>
          s.id === id
            ? { ...s, estado: json.estadoNuevo ?? s.estado, reingresoCount: s.reingresoCount }
            : s
        )
      )
      setSelectedId(null); setObservarTarget(null)
    } catch { alert("Error de conexión al observar") }
    finally { setGuardando(false) }
  }, [filtro, user])

  // Clasificar
  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = { nuevas: 0, correcciones: 0, revision: 0, observadas: 0, todas: 0 }
    c.todas = solicitudes.length
    solicitudes.forEach(s => {
      const tab = classifySolicitud(s, filtro)
      if (tab !== "todas") c[tab]++
    })
    return c
  }, [solicitudes, filtro])

  // Filtrar
  const filtered = useMemo(() =>
    solicitudes
      .filter(s => activeTab === "todas" || classifySolicitud(s, filtro) === activeTab)
      .filter(s => {
        if (!searchTerm) return true
        const t = searchTerm.toLowerCase()
        return (
          (s.folioRecepcion?.toLowerCase().includes(t) ?? false) ||
          (s.folioDictamen?.toLowerCase().includes(t) ?? false) ||
          s.secretaria.toLowerCase().includes(t) ||
          s.tipo.toLowerCase().includes(t)
        )
      })
      .filter(s => {
        if (filterAnio !== "todos" && s.fechaRecepcionDO) return s.fechaRecepcionDO.startsWith(filterAnio)
        return true
      })
      .filter(s => {
        if (filterMes !== "todos" && s.fechaRecepcionDO) return s.fechaRecepcionDO.slice(5, 7) === filterMes
        return true
      })
      .filter(s => filterSecretaria === "todas" || s.secretaria === filterSecretaria)
      .filter(s => filterTipo === "todos" || s.tipo === filterTipo)
      .filter(s => {
        if (filterSla === "todos") return true
        if (filterSla === "vencido") return (s.slaRestante ?? 1) <= 0
        if (filterSla === "critico") return (s.slaRestante ?? 99) >= 1 && (s.slaRestante ?? 99) <= 5
        if (filterSla === "medio")   return (s.slaRestante ?? 99) >= 6 && (s.slaRestante ?? 99) <= 10
        if (filterSla === "bien")    return (s.slaRestante ?? 0) > 10
        return true
      }),
    [solicitudes, activeTab, filtro, searchTerm, filterAnio, filterMes, filterSecretaria, filterTipo, filterSla]
  )
  const secretariasUnicas = useMemo(() =>
    [...new Set(solicitudes.map(s => s.secretaria))].filter(Boolean).sort(),
    [solicitudes]
  )
  const tiposUnicos = useMemo(() =>
    [...new Set(solicitudes.map(s => s.tipo))].filter(Boolean).sort(),
    [solicitudes]
  )

  const selectedSolicitud = selectedId ? solicitudes.find(s => s.id === selectedId) ?? null : null

  //  Vista detalle
  if (selectedSolicitud) return (
    <DetalleView
      solicitud={selectedSolicitud}
      filtro={filtro}
      onBack={() => setSelectedId(null)}
      onAprobar={handleAprobar}
      onObservar={handleObservar}
      guardando={guardando}
    />
  )

  //  Vista bandeja
  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Bandeja DO — {FILTRO_LABELS[filtro]}
          </h2>
          <p className="text-sm text-muted-foreground">
            Solicitudes asignadas al {FILTRO_LABELS[filtro]} para revisión y dictaminación
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargar} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total en bandeja", value: solicitudes.length, icon: <Filter className="h-5 w-5 text-secondary" />, bg: "bg-secondary/10" },
          { label: "Nuevas",           value: tabCounts.nuevas,   icon: <CircleDot className="h-5 w-5 text-secondary" />, bg: "bg-secondary/10" },
          { label: "Correcciones",     value: tabCounts.correcciones, icon: <RotateCcw className="h-5 w-5 text-accent-foreground" />, bg: "bg-accent/10" },
          { label: "SLA en riesgo",    value: solicitudes.filter(s => s.slaRestante !== null && s.slaRestante <= 5).length, icon: <AlertTriangle className="h-5 w-5 text-destructive" />, bg: "bg-destructive/10" },
        ].map((c, i) => (
          <Card key={i} className="shadow-sm border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>{c.icon}</div>
              <div>
                <span className="text-2xl font-bold text-card-foreground">{c.value}</span>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1.5 border border-border flex-wrap">
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((tabKey) => {
          const config  = TAB_CONFIG[tabKey]
          const count   = tabCounts[tabKey]
          const isActive = activeTab === tabKey
          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? `${config.activeBg} ${config.activeText} shadow-sm`
                  : "text-muted-foreground hover:text-card-foreground hover:bg-muted"
              }`}
            >
              {config.icon}
              <span>{config.label}</span>
              <span className={`ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                isActive ? `${config.activeText} bg-background` : "bg-muted text-muted-foreground"
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, secretaría o tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="w-28 bg-card"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMes} onValueChange={setFilterMes}>
          <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSecretaria} onValueChange={setFilterSecretaria}>
          <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Secretaría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {secretariasUnicas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-48 bg-card"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSla} onValueChange={setFilterSla}>
          <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="SLA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="bien">{"> 10 días"}</SelectItem>
            <SelectItem value="medio">6 - 10 días</SelectItem>
            <SelectItem value="critico">1 - 5 días</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-semibold text-card-foreground">
            <span>
              {loading ? "Cargando..." : `${filtered.length} solicitud${filtered.length !== 1 ? "es" : ""} en ${FILTRO_LABELS[filtro]}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              <span className="text-sm text-muted-foreground">Cargando desde la base de datos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Estatus</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Folio Recepción</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Secretaría</th>
                    {filtro >= 2 && <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Folio Dictamen</th>}
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Fecha Recepción</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Última obs.</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Plazo</th>
                    <th className="px-3 py-3 text-left font-semibold text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={filtro >= 2 ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="h-8 w-8 text-muted-foreground/40" />
                          <span>No hay solicitudes en esta clasificación</span>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(sol => {
                    const tab    = classifySolicitud(sol, filtro)
                    const config = TAB_CONFIG[tab]
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.activeBg} ${config.activeText}`}>
                              {config.icon}{config.label}
                            </span>
                            {sol.reingresoCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                                <RotateCcw className="h-2.5 w-2.5" />Reingreso #{sol.reingresoCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-card-foreground">
                          <div className="flex flex-col gap-1">
                            <span>{sol.folioRecepcion || "---"}</span>
                            {sol.folioTemporal && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive w-fit">
                                Folio temporal
                              </span>
                            )}
                            {sol.esRegularizacion && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary w-fit">
                                Regularización
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{sol.tipo}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{sol.secretaria}</td>
                        {filtro >= 2 && (
                          <td className="px-3 py-3">
                            {sol.folioDictamen
                              ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">{sol.folioDictamen}</span>
                              : <span className="text-xs text-muted-foreground">---</span>
                            }
                          </td>
                        )}
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {sol.fechaRecepcionDO
                            ? new Date(sol.fechaRecepcionDO).toLocaleDateString("es-MX")
                            : "---"
                          }
                        </td>
                        <td className="px-3 py-3">
                          {sol.lastObservedStage ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-card-foreground">Filtro {sol.lastObservedStage}</span>
                              <span className="text-[10px] text-muted-foreground">{sol.lastObservedDate}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">---</span>
                          )}
                        </td>
                        <td className="px-3 py-3"><SlaIndicator diasRestantes={sol.slaRestante} /></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedId(sol.id); onOpenReview?.(sol.id, filtro) }}
                              className="text-secondary hover:text-primary gap-1.5"
                            >
                              <FileSearch className="h-4 w-4" />Revisar
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setAprobarTarget(sol.id)}
                              disabled={guardando}
                              className="text-primary hover:text-primary/80 gap-1.5"
                            >
                              <CheckCircle2 className="h-4 w-4" />Aprobar
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setObservarTarget(sol.id)}
                              disabled={guardando}
                              className="text-destructive hover:text-destructive/80 gap-1.5"
                            >
                              <RotateCcw className="h-4 w-4" />Observar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales globales (acciones desde tabla) */}
      <ConfirmModal
        open={!!aprobarTarget}
        onClose={() => setAprobarTarget(null)}
        onConfirm={() => { if (aprobarTarget) handleAprobar(aprobarTarget) }}
        title={`¿Aprobar y avanzar al siguiente filtro?`}
        description={`La solicitud ${solicitudes.find(s => s.id === aprobarTarget)?.folioRecepcion ?? ""} avanzará al siguiente paso.`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={!!observarTarget}
        onClose={() => setObservarTarget(null)}
        onConfirm={(obs) => { if (observarTarget) handleObservar(observarTarget, obs) }}
        folio={solicitudes.find(s => s.id === observarTarget)?.folioRecepcion ?? ""}
      />
    </div>
  )
}