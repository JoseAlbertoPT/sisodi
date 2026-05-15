"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Search, FileSearch, Filter, Clock, RotateCcw, CircleDot, Eye,
  AlertTriangle, ListFilter, RefreshCw, Loader2, CheckCircle2,
  HelpCircle, ArrowLeft, Info, ChevronDown, ChevronRight,
  FileText, History, Download, UserCheck, ClipboardCheck, Stamp, Pencil,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { PendientesFirmaPanel } from "@/components/pendientes-firma-panel"
import { ESTADOS_VISIBLES_EMISION } from "@/components/seguimiento-general-view"
import { type EditSolicitudPayload } from "@/components/pages/nueva-solicitud-page"
import { HistorialTimeline, type HistorialEntryData } from "@/components/historial-timeline"

interface FiltroSolicitud {
  id: string
  folioSolicitud: string | null
  folioRecepcion: string | null
  folioDictamen: string | null
  folioTemporal: boolean
  tipo: string
  denominacion: string
  secretaria: string
  secretariaId: string | null
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
  revisorAsignado: { id: string; nombre: string; correo: string } | null
  _raw?: any
}
type TabKey = "nuevas" | "correcciones" | "revision" | "observadas" | "pendientes_asignacion" | "en_validacion" | "pendientes_firma" | "todas" | "solicitudes"
const FILTRO_LABELS: Record<number, string> = {
  1: "Revisor",
  2: "Validación Final",
  3: "Emisor",
}
const MESES = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" }, { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" }, { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
]

const INICIALES_MES_MAP: Record<string, string> = {
  "01": "EN", "02": "FE", "03": "MR", "04": "AB",
  "05": "MY", "06": "JN", "07": "JL", "08": "AG",
  "09": "SE", "10": "OC", "11": "NO", "12": "DI",
}
function formatearFolio(folio: string | null | undefined): string {
  if (!folio) return "---"
  const match = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[1]}/${match[2].padStart(2, "0")}/${match[3]}`
  return folio
}
function formatFecha(v: string | null | undefined) {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function formatRegimen(raw: string | null | undefined): string {
  const r = (raw ?? "").toLowerCase().trim()
  if (r.includes("asimilado")) return "Honorarios Asimilados a Salarios"
  if (r.includes("honorario")) return "Honorarios"
  if (r.includes("nombramiento") || r.includes("tiempo determinado"))
    return "Nombramiento por Tiempo Determinado"
  return raw || "—"
}
function formatEscolaridad(raw: string | null | undefined): string {
  const e = (raw ?? "").toLowerCase().trim()
  if (e === "bachillerato") return "Bachillerato"
  if (e === "tecnico")      return "Técnico Superior"
  if (e === "licenciatura") return "Licenciatura"
  if (e === "maestria")     return "Maestría"
  if (e === "doctorado")    return "Doctorado"
  return raw || "—"
}
function getEstadoEnRevision(filtro: number) {
  if (filtro === 1) return "En Revision Revisor"
  if (filtro === 2) return "En Validacion Final"
  return "En Revision Emisor"
}
function getEstadoObservado(filtro: number) {
  if (filtro === 1) return "Observado por Revisor"
  if (filtro === 2) return "Observado por Validacion Final"
  return "Observado por Emisor"
}
function classifyDO(s: FiltroSolicitud): TabKey {
  const n = s.estado.toLowerCase()
  if (n === "pendiente do" || n.includes("en revision revisor")) return "pendientes_asignacion"
  if (n === "pendiente firma dictamen" || n === "pendiente firma validacion") return "pendientes_firma"
  if (
    n.includes("observado por emisor") || n.includes("observado por revisor") ||
    n.includes("observado por do")     || n.includes("devuelta por do") ||
    n.includes("observado do filtro")
  ) return "observadas"
  if (
    n === "aceptado por revisor"     || n === "aprobado por revisor" ||
    n.includes("en validacion final")
  ) return "en_validacion"
  return "todas"
}
function classifySolicitud(s: FiltroSolicitud, filtro: 1 | 2 | 3): TabKey {
  if (filtro === 2) return classifyDO(s)
  const estadoEnRevision = getEstadoEnRevision(filtro)
  const estadoObservado  = getEstadoObservado(filtro)
  const estadoNorm       = s.estado.toLowerCase()
  if (estadoNorm === estadoObservado.toLowerCase() || estadoNorm === "observado por validacion final") return "observadas"
  if (filtro === 1) {
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma justificacion" || estadoNorm === "pendiente firma revision") return "pendientes_firma"
    if (estadoNorm === "aceptado por revisor" || estadoNorm === "aprobado por revisor") return "revision"
    if (estadoNorm === estadoEnRevision.toLowerCase()) {
      return s.openedInFiltro[filtro] ? "revision" : "nuevas"
    }
  }
  if (filtro === 3) {
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma emisor") return "pendientes_firma"
    if (estadoNorm === estadoEnRevision.toLowerCase()) {
      return (s.openedInFiltro[filtro] || !!s.folioDictamen) ? "revision" : "nuevas"
    }
    const preEmisor = new Set([
      "pendiente do",
      "en revision revisor",
      "observado por revisor",
      "aceptado por revisor",
      "aprobado por revisor",
      "pendiente firma justificacion",
      "en validacion final",
      "observado por validacion final",
    ])
    if (preEmisor.has(estadoNorm)) return "nuevas"
  }
  return "todas"
}
function getSlaStyle(dias: number | null): React.CSSProperties {
  if (dias === null) return { backgroundColor: "#e2e8f0", color: "#64748b" }
  if (dias <= 0)  return { backgroundColor: "#832B56", color: "#FFFFFF" }
  if (dias <= 7)  return { backgroundColor: "#C69C6D", color: "#FFFFFF" }
  return { backgroundColor: "#283C2A", color: "#FFFFFF" }
}
function getSlaLabel(dias: number | null) {
  if (dias === null) return "Sin periodo"
  if (dias <= 0) return "Cerrada"
  return `${dias} día${dias !== 1 ? "s" : ""} al cierre`
}
type TabCfg = Record<string, { label: string; icon: React.ReactNode; activeBg: string; activeText: string; badgeStyle: React.CSSProperties }>
const TAB_CONFIG_REVISION: TabCfg = {
  nuevas:          { label: "Asignadas",          icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: "#2563EB", color: "#FFFFFF" } },
  revision:        { label: "En revisión",         icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary",        badgeStyle: { backgroundColor: "#D97706", color: "#FFFFFF" } },
  observadas:      { label: "Observadas",          icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive",    badgeStyle: { backgroundColor: "#832B56", color: "#FFFFFF" } },
  pendientes_firma:{ label: "Pendiente de firma",  icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: "#6D28D9", color: "#FFFFFF" } },
  todas:           { label: "Todas",               icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "#FFFFFF" } },
}
const TAB_CONFIG_EMISION: TabCfg = {
  nuevas:          { label: "Estatus de recibidas", icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: "#2563EB", color: "#FFFFFF" } },
  revision:        { label: "En emisión",           icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary",        badgeStyle: { backgroundColor: "#0891B2", color: "#FFFFFF" } },
  observadas:      { label: "Observadas",           icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive",    badgeStyle: { backgroundColor: "#832B56", color: "#FFFFFF" } },
  pendientes_firma:{ label: "Pendientes de firma",  icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: "#6D28D9", color: "#FFFFFF" } },
  todas:           { label: "Todas",                icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "#FFFFFF" } },
}
const TAB_CONFIG_DO: TabCfg = {
  pendientes_asignacion: { label: "Pendientes de asignación", icon: <UserCheck className="h-3.5 w-3.5" />,     activeBg: "bg-orange-500/10",  activeText: "text-orange-600",      badgeStyle: { backgroundColor: "#C2410C", color: "#FFFFFF" } },
  en_validacion:         { label: "En validación",            icon: <ClipboardCheck className="h-3.5 w-3.5" />, activeBg: "bg-primary/10",     activeText: "text-primary",         badgeStyle: { backgroundColor: "#7C3AED", color: "#FFFFFF" } },
  observadas:            { label: "Observadas",               icon: <AlertTriangle className="h-3.5 w-3.5" />,  activeBg: "bg-destructive/10", activeText: "text-destructive",     badgeStyle: { backgroundColor: "#832B56", color: "#FFFFFF" } },
  pendientes_firma:      { label: "Pendientes de firma",      icon: <Stamp className="h-3.5 w-3.5" />,          activeBg: "bg-secondary/10",   activeText: "text-secondary",       badgeStyle: { backgroundColor: "#6D28D9", color: "#FFFFFF" } },
  todas:                 { label: "Todas",                    icon: <ListFilter className="h-3.5 w-3.5" />,      activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "#FFFFFF" } },
}

function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={getSlaStyle(diasRestantes)}
    >
      {getSlaLabel(diasRestantes)}
    </span>
  )
}

function SectionCard({ num, title, icon, children, defaultOpen = true }: {
  num?: string; title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          {num && (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
              {num}
            </span>
          )}
          {icon}{title}
          <span className="ml-auto">
            {open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="text-sm font-medium text-card-foreground break-words whitespace-normal">{value || "—"}</span>
    </div>
  )
}
function parseListField(text: string | null | undefined): string[] {
  if (!text || text === "—") return []
  return text.split(/[\n•·,]+/).map(s => s.trim()).filter(Boolean)
}
function PerfilListField({ label, value }: { label: string; value: string | null | undefined }) {
  const items = parseListField(value)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {items.length === 0 ? (
        <span className="text-sm font-medium text-card-foreground">—</span>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-card-foreground">
              <span className="shrink-0 text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListaItems({ items }: { items: string[] }) {
  const validItems = (items ?? []).filter(Boolean)
  if (validItems.length === 0) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <ul className="flex flex-col gap-2">
      {validItems.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-card-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ExpedienteCompleto({ raw, hidePerfil }: { raw: any; hidePerfil?: boolean }) {
  const esNombramiento = (raw?.regimen ?? raw?.tipo_solicitud ?? "").toLowerCase().includes("nombramiento")
  const marcoNormativo: string[] = Array.isArray(raw?.marco_normativo) ? raw.marco_normativo.filter(Boolean) : []
  const condicionesRiesgos: string[] = Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : []
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría / Dependencia / Organismo"  value={raw?.secretaria ?? "—"} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción"  value={formatClave(raw?.unidad_administrativa ?? raw?.clave_unidad_administrativa ?? "") || "—"} />
          <ReadOnlyField label="Unidad Responsable del Gasto"          value={getNombreForClave(raw?.unidad_responsable ?? "") || raw?.nombre_unidad_responsable || raw?.unidad_responsable_nombre || raw?.unidad_responsable || "—"} />
          <ReadOnlyField label="Régimen de Contratación"               value={formatRegimen(raw?.regimen)} />
          <ReadOnlyField label="Número de Prestadores de Servicio"     value={raw?.numero_prestadores != null ? String(raw.numero_prestadores) : "—"} />
          <ReadOnlyField label="Programa o Proyecto"                   value={raw?.programa_proyecto ?? "—"} />
          <ReadOnlyField label="Tipo de Actividades"                   value={raw?.tipo_actividades ?? "—"} />
          <ReadOnlyField label="Vigencia Inicio"                       value={formatFecha(raw?.vigencia_inicio)} />
          <ReadOnlyField label="Vigencia Término"                      value={formatFecha(raw?.vigencia_fin)} />
          <ReadOnlyField label="Importe Bruto"                         value={raw?.importe_bruto != null ? `$${Number(raw.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"} />
        </div>
      </SectionCard>
      <SectionCard title="I.1 Objeto de la Contratación">
        <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
          {raw?.objeto || <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>
      <SectionCard title="I.2 Actividades a Realizar">
        <ListaItems items={Array.isArray(raw?.actividades) ? raw.actividades : []} />
      </SectionCard>
      <SectionCard title="I.3 Responsabilidades">
        <ListaItems items={Array.isArray(raw?.responsabilidades) ? raw.responsabilidades : []} />
      </SectionCard>

      {esNombramiento && (raw?.nivel_tabulador || raw?.categoria_tabulador) && (
        <SectionCard title="Tabulador — Nivel y Categoría">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Nivel de Tabulador"  value={raw?.nivel_tabulador ?? "—"} />
            <ReadOnlyField label="Categoría Tabulador" value={raw?.categoria_tabulador ?? "—"} />
          </div>
        </SectionCard>
      )}

      {esNombramiento && marcoNormativo.length > 0 && (
        <SectionCard title="V. Marco Normativo">
          <ListaItems items={marcoNormativo} />
        </SectionCard>
      )}

      {esNombramiento && condicionesRiesgos.length > 0 && (
        <SectionCard title="VI. Condiciones y Riesgos">
          <ListaItems items={condicionesRiesgos} />
        </SectionCard>
      )}

      {esNombramiento && raw?.resguardo_activos && (
        <SectionCard title="VII. Resguardo Personalizado de Activos">
          <ReadOnlyField label="Resguardo de Activos" value={raw.resguardo_activos === "si" ? "Sí" : raw.resguardo_activos === "no" ? "No" : raw.resguardo_activos} />
        </SectionCard>
      )}

      {!hidePerfil && (
        <SectionCard num="II" title="Perfil">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Escolaridad Mínima"            value={formatEscolaridad(raw?.escolaridad)} />
            <PerfilListField label="Competencias Administrativas"  value={raw?.comp_adm} />
            <PerfilListField label="Competencias Técnicas"         value={raw?.comp_tec} />
            <PerfilListField label="Competencias Socioemocionales" value={raw?.comp_soc} />
            <PerfilListField label="Valores"                       value={raw?.valores} />
            <PerfilListField label="Áreas de Experiencia"          value={raw?.areas_exp} />
          </div>
        </SectionCard>
      )}
      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        {raw?.adjunto?.length > 0 ? (
          <div className="flex flex-col gap-2">
            {(raw.adjunto as any[]).map((adj, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <FileText className="h-5 w-5 text-secondary shrink-0" />
                <span className="flex-1 text-sm font-medium text-card-foreground truncate">{adj.nombre_archivo}</span>
                {adj.ruta && (
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
                    onClick={() => window.open(adj.ruta, "_blank")}>
                    Ver
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin documentos adjuntos.</p>
        )}
      </SectionCard>
    </div>
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
          <p className="text-sm text-muted-foreground">Escriba las Observaciones que se Enviarán a la URG.</p>
          <Textarea
            placeholder="Describa las Observaciones..."
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

interface RevisorInfo { id: string; nombre: string; correo: string }
function AprobarAsignarModal({ open, onClose, onConfirm, folio, guardando }: {
  open: boolean
  onClose: () => void
  onConfirm: (revisorId: string) => void
  folio: string
  guardando: boolean
}) {
  const [revisores,  setRevisores]  = useState<RevisorInfo[]>([])
  const [loading,    setLoading]    = useState(false)
  const [selectedId, setSelectedId] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedId("")
    setLoading(true)
    fetch("/api/usuarios?rol=Revisor")
      .then(r => r.json())
      .then(json => {
        const lista: RevisorInfo[] = (Array.isArray(json) ? json : [])
          .map((u: any) => ({ id: u.id, nombre: u.nombre, correo: u.correo }))
        setRevisores(lista)
      })
      .catch(() => setRevisores([]))
      .finally(() => setLoading(false))
  }, [open])
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-primary" />
            Aprobar
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Solicitud <span className="font-semibold text-card-foreground">{folio}</span> — selecciona el revisor que la atenderá en Filtro de Revisión.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
            </div>
          ) : revisores.length === 0 ? (
            <p className="text-sm text-destructive">No hay usuarios con rol Revisor disponibles.</p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar revisor..." />
              </SelectTrigger>
              <SelectContent>
                {revisores.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="font-medium">{r.nombre}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.correo}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selectedId || guardando || loading}
              onClick={() => onConfirm(selectedId)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Aprobar y asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AsignarRevisorModal({ open, onClose, onConfirm, folio, guardando }: {
  open: boolean
  onClose: () => void
  onConfirm: (revisorId: string) => void
  folio: string
  guardando: boolean
  }) {
  const [revisores,  setRevisores]  = useState<RevisorInfo[]>([])
  const [loading,    setLoading]    = useState(false)
  const [selectedId, setSelectedId] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedId("")
    setLoading(true)
    fetch("/api/usuarios?rol=Revisor")
      .then(r => r.json())
      .then(json => {
        const lista: RevisorInfo[] = (Array.isArray(json) ? json : [])
          .map((u: any) => ({ id: u.id, nombre: u.nombre, correo: u.correo }))
        setRevisores(lista)
        })
      .catch(() => setRevisores([]))
      .finally(() => setLoading(false))
      }, [open])

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-primary" />
            Asignar Revisor
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Solicitud <span className="font-semibold text-card-foreground">{folio}</span> — selecciona el revisor que la atenderá.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
            </div>
          ) : revisores.length === 0 ? (
            <p className="text-sm text-destructive">No hay usuarios con rol Revisor disponibles.</p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar revisor..." />
              </SelectTrigger>
              <SelectContent>
                {revisores.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="font-medium">{r.nombre}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.correo}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selectedId || guardando || loading}
              onClick={() => onConfirm(selectedId)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const MESES_DICT = [
  { value: "01", label: "ENERO(01)" }, { value: "02", label: "FEBRERO(02)" },
  { value: "03", label: "MARZO(03)" }, { value: "04", label: "ABRIL(04)" },
  { value: "05", label: "MAYO(05)" }, { value: "06", label: "JUNIO(06)" },
  { value: "07", label: "JULIO(07)" }, { value: "08", label: "AGOSTO(08)" },
  { value: "09", label: "SEPTIEMBRE(09)" }, { value: "10", label: "OCTUBRE(10)" },
  { value: "11", label: "NOVIEMBRE(11)" }, { value: "12", label: "DICIEMBRE(12)" },
]
function FolioDictamenCard({
  folioDictamen,
  onAsignar,
}: {
  folioDictamen: string | null
  onAsignar: (folio: string) => Promise<void>
}) {
  const today = new Date()
  const [mes,         setMes]         = useState(String(today.getMonth() + 1).padStart(2, "0"))
  const [anio,        setAnio]        = useState(String(today.getFullYear()))
  const [consecutivo, setConsecutivo] = useState("1")
  const [cargando,    setCargando]    = useState(false)
  const [guardando,   setGuardando]   = useState(false)

  useEffect(() => {
    const mesNum  = parseInt(mes,  10)
    const anioNum = parseInt(anio, 10)
    if (!mesNum || !anioNum || anioNum < 2020) return
    setCargando(true)
    fetch(`/api/folio-dictamen/siguiente?mes=${mesNum}&anio=${anioNum}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setConsecutivo(String(json.siguiente)) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [mes, anio])

  const folioPreview = `${String(consecutivo).padStart(2, "0")}/${mes}/${anio}`

  const handleAsignar = async () => {
    if (!consecutivo || !mes || !anio) return
    setGuardando(true)
    await onAsignar(folioPreview)
    setGuardando(false)
  }

  if (folioDictamen) {
    return (
      <Card className="shadow-sm border-secondary/30 border-2 bg-secondary/[0.03]">
        <CardContent className="flex items-center gap-3 p-4">
          <Stamp className="h-5 w-5 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-card-foreground">Folio de Dictamen Asignado</p>
            <p className="text-xs text-muted-foreground font-mono">{formatearFolio(folioDictamen)}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Stamp className="h-4 w-4 text-secondary" />Asignar Folio de Dictamen
        </CardTitle>
        <CardDescription className="text-xs">
          Selecciona mes y año — el consecutivo se calcula automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Mes</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="bg-background font-mono">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MESES_DICT.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Año</Label>
            <Input
              value={anio}
              onChange={e => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="2026"
              className="bg-background font-mono"
              maxLength={4}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Consecutivo</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 font-mono text-sm text-card-foreground">
              {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : consecutivo}
            </div>
          </div>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2 flex items-center gap-2">
          {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">Folio de dictamen: </span>
          <span className="text-sm font-semibold font-mono text-card-foreground">{folioPreview}</span>
        </div>
        <Button
          onClick={handleAsignar}
          disabled={guardando || cargando || !consecutivo || !mes || !anio}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
           >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
          Asignar Folio de Dictamen
        </Button>
      </CardContent>
    </Card>
  )
}

function rawToEditPayload(solicitud: FiltroSolicitud): EditSolicitudPayload {
  const raw = solicitud._raw ?? {}
  const regimenRaw = (raw.regimen ?? "").toLowerCase()
  const regimen: EditSolicitudPayload["regimen"] = regimenRaw.includes("asimilado") ? "asimilados"
    : regimenRaw.includes("nombramiento") || regimenRaw.includes("tiempo determinado") ? "nombramiento"
    : "honorarios"
  const tipo: EditSolicitudPayload["tipo"] = regimen === "nombramiento" ? "nombramiento" : "prestacion"
  const fmt = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : ""
  return {
    id: solicitud.id,
    tipo,
    regimen,
    periodo: solicitud.periodo ?? "",
    estado: solicitud.estado,
    formData: {
      secretaria:              raw.secretaria ?? "",
      unidadAdministrativa:    raw.clave_unidad_administrativa ?? raw.unidad_administrativa ?? "",
      unidadResponsable:       raw.unidad_responsable ?? "",
      programaProyecto:        raw.programa_proyecto ?? "",
      regimen:                 raw.regimen ?? "",
      tipoActividades:         raw.tipo_actividades ?? "",
      numeroPrestadores:       raw.numero_prestadores != null ? String(raw.numero_prestadores) : "",
      denominacion:            raw.denominacion ?? solicitud.denominacion ?? "",
      puestoJefeInmediato:     raw.puesto_jefe_inmediato ?? "",
      tipoAdministracionNom:   (raw.tipo_administracion === "paraestatal" ? "paraestatal" : "centralizada") as "centralizada" | "paraestatal",
      vigenciaInicio:          fmt(raw.vigencia_inicio),
      vigenciaFin:             fmt(raw.vigencia_fin),
      importeBruto:            raw.importe_bruto != null ? String(raw.importe_bruto) : "",
      tipoImporte:             raw.tipo_importe ?? "Mensual",
      nivelTabulador:          raw.nivel_tabulador ?? "",
      categoriaTabulador:      raw.categoria_tabulador ?? "",
      objeto:                  raw.objeto ?? "",
      actividades:             Array.isArray(raw.actividades) ? raw.actividades.filter(Boolean) : [],
      responsabilidades:       Array.isArray(raw.responsabilidades) ? raw.responsabilidades.filter(Boolean) : [],
      marcoNormativo:          Array.isArray(raw.marco_normativo) ? raw.marco_normativo.filter(Boolean) : [],
      condicionesRiesgos:      Array.isArray(raw.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : [],
      resguardoActivos:        raw.resguardo_activos ?? "",
      riesgoCaidas:            raw.riesgo_caidas ?? "",
      riesgoMutilaciones:      raw.riesgo_mutilaciones ?? "",
      riesgoGolpes:            raw.riesgo_golpes ?? "",
      riesgoOtros:             raw.riesgo_otros ?? "",
      condicionCambioDomicilio: raw.condicion_cambio_domicilio ?? false,
      condicionHorario:        raw.condicion_horario ?? false,
      condicionViajar:         raw.condicion_viajar ?? false,
      escolaridad:             raw.escolaridad ?? "",
      compAdm:                 raw.comp_adm ?? "",
      compTec:                 raw.comp_tec ?? "",
      compSoc:                 raw.comp_soc ?? "",
      valores:                 raw.valores ?? "",
      areasExp:                raw.areas_exp ?? "",
    },
  }
}

function DetalleView({ solicitud, filtro, onBack, onAprobar, onObservar, onEditSolicitud, guardando }: {
  solicitud: FiltroSolicitud
  filtro: 1 | 2 | 3
  onBack: () => void
  onAprobar: (id: string, revisorId?: string) => void
  onObservar: (id: string, obs: string) => void
  onEditSolicitud?: (payload: EditSolicitudPayload) => void
  guardando: boolean
}) {
  const { user } = useAuth()
  const [showAprobarModal,        setShowAprobarModal]        = useState(false)
  const [showAprobarAsignarModal, setShowAprobarAsignarModal] = useState(false)
  const [showObservarModal,       setShowObservarModal]       = useState(false)
  const [activePanel,             setActivePanel]             = useState<"revision" | "historial">("revision")
  const [folioDictamen,           setFolioDictamen]           = useState<string | null>(
    solicitud._raw?.folio_dictamen ?? solicitud._raw?.dictamen?.folio ?? null
  )

  const raw = solicitud._raw
  const handleAsignarFolioDictamen = async (folio: string) => {
    const res  = await fetch("/api/filtro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solicitudId: Number(solicitud.id),
        accion: "asignarFolio",
        usuarioId: (user as any)?.id ?? "",
        folioDictamen: folio,
      }),
    })
    const json = await res.json()
    if (json.ok) setFolioDictamen(folio)
  }

  const yaEstuvoEnRevisor = (solicitud._raw?.historial_solicitud ?? []).some(
    (h: any) => (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "")
      .toLowerCase().includes("en revision revisor")
  )

  const labelAprobar =
    filtro === 1 ? "Aprobar → Validación"
    : filtro === 2 ? (yaEstuvoEnRevisor ? "Aprobar → Emisor" : "Aprobar → Revisor")
    : solicitud.estado.toLowerCase().includes("pendiente firma dictamen")
      ? "Firmar Dictamen → Emitir"
      : "Aprobar → Firma Justificación"

  const folioFormateado = formatearFolio(solicitud.folioRecepcion)

  const historial: HistorialEntryData[] =
    (raw?.historial_solicitud ?? []).map((h: any) => ({
      fecha:          h.fecha ?? "",
      usuario:        h.usuario?.nombre ?? "Sistema",
      estadoAnterior: h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? null,
      estadoNuevo:    h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
    }))

  const observacionesUefa: string = raw?.observaciones_uefa ?? raw?.observacion_uefa ?? ""

  const ultimaObsDo: string | null = (() => {
    const entrada = (raw?.historial_solicitud ?? []).find((h: any) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      return nombre.toLowerCase().includes("observad") && nombre.toLowerCase().includes("filtro")
    })
    return entrada?.comentario ?? null
  })()

  const denominacion = raw?.denominacion || raw?.tipo_solicitud || solicitud.denominacion || solicitud.tipo || "—"

  return (
    <div className="flex flex-col gap-4">
      {}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="sm" onClick={onBack}
            className="gap-1.5 text-muted-foreground hover:text-card-foreground"
          >
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-card-foreground">{folioFormateado}</span>
            {denominacion !== "—" && (
              <span className="text-xs text-muted-foreground">{denominacion}</span>
            )}
          </div>
          <Badge className="bg-primary/15 text-primary border-0 text-xs">{solicitud.estado}</Badge>
          <SlaIndicator diasRestantes={solicitud.slaRestante} />
          </div>
          <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />Justificación (PDF)
          </Button>
          {onEditSolicitud && classifySolicitud(solicitud, filtro) !== "observadas" && (
            <Button
              variant="outline" size="sm"
              onClick={() => onEditSolicitud(rawToEditPayload(solicitud))}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />Editar
            </Button>
          )}
          <Button
            onClick={() => {
              if (filtro === 2 && !yaEstuvoEnRevisor) setShowAprobarAsignarModal(true)
              else setShowAprobarModal(true)
            }}
            disabled={guardando}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            size="sm"
            >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {labelAprobar}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowObservarModal(true)}
            disabled={guardando || classifySolicitud(solicitud, filtro) === "observadas"}
            className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
            <RotateCcw className="h-4 w-4" />Observar
          </Button>
        </div>
      </div>

      {}
      {solicitud.reingresoCount > 0 && (
        <Card className="border-2 border-accent/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-accent-foreground">
                Reingreso #{solicitud.reingresoCount}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Solicitud corregida y reenviada por la URG.
                {solicitud.lastObservedStage && ` Última observación desde: Filtro ${solicitud.lastObservedStage}.`}
              </p>
              {ultimaObsDo && (
                <p className="text-sm text-card-foreground mt-2 border-l-2 border-accent/40 pl-3 italic">
                  "{ultimaObsDo}"
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {observacionesUefa && (
        <Card className="border-2 border-[#832B56]/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-[#832B56] shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-[#832B56]">Observaciones UEFA</span>
              <p className="text-sm text-card-foreground mt-1">{observacionesUefa}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <ExpedienteCompleto raw={raw} hidePerfil={filtro === 1} />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setActivePanel("revision")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                activePanel === "revision"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <FileSearch className="h-4 w-4" />Revisión
            </button>
            <button
              onClick={() => setActivePanel("historial")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                activePanel === "historial"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
              >
              <History className="h-4 w-4" />Historial
            </button>
          </div>
          {activePanel === "revision" && (
            <Card className="shadow-sm border-border">
              <CardContent className="pt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Folio de Recepción</span>
                  {solicitud.folioRecepcion
                    ? <span className="text-sm font-semibold text-card-foreground font-mono">{folioFormateado}</span>
                    : <span className="text-sm text-muted-foreground italic">Sin asignar</span>
                  }
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Denominación</span>
                  <span className="text-sm font-medium text-card-foreground">{denominacion}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Régimen de Contratación</span>
                  <span className="text-sm font-medium text-card-foreground">{formatRegimen(raw?.regimen)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Estado actual</span>
                  <Badge className="bg-primary/15 text-primary border-0 text-xs w-fit">{solicitud.estado}</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Plazo de Atención</span>
                  <SlaIndicator diasRestantes={solicitud.slaRestante} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Fecha de Recepción DO</span>
                  <span className="text-sm font-medium text-card-foreground">
                    {solicitud.fechaRecepcionDO
                      ? new Date(solicitud.fechaRecepcionDO).toLocaleDateString("es-MX")
                      : "—"}
                  </span>
                </div>
                {solicitud.reingresoCount > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Reingresos</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent-foreground w-fit">
                      <RotateCcw className="h-3 w-3" />#{solicitud.reingresoCount}
                    </span>
                  </div>
                )}
                {solicitud.lastObservedStage && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Última observación desde</span>
                    <span className="text-sm font-medium text-card-foreground">
                      Filtro {solicitud.lastObservedStage}
                      {solicitud.lastObservedDate && ` — ${solicitud.lastObservedDate}`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {filtro === 1 && activePanel === "revision" && (
            <FolioDictamenCard
              folioDictamen={folioDictamen}
              onAsignar={handleAsignarFolioDictamen}
            />
          )}

          {activePanel === "historial" && (
            <Card className="shadow-sm border-border sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-secondary" />Historial de la solicitud
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HistorialTimeline entries={historial} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {}
      <ConfirmModal
        open={showAprobarModal}
        onClose={() => setShowAprobarModal(false)}
        onConfirm={() => { setShowAprobarModal(false); onAprobar(solicitud.id) }}
        title={`¿${labelAprobar}?`}
        description={`La solicitud ${folioFormateado} avanzará al siguiente paso del proceso.`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
        />
      <ObservarModal
        open={showObservarModal}
        onClose={() => setShowObservarModal(false)}
        onConfirm={(obs) => { setShowObservarModal(false); onObservar(solicitud.id, obs) }}
        folio={folioFormateado}
      />
      <AprobarAsignarModal
        open={showAprobarAsignarModal}
        onClose={() => setShowAprobarAsignarModal(false)}
        onConfirm={(revisorId) => { setShowAprobarAsignarModal(false); onAprobar(solicitud.id, revisorId) }}
        folio={folioFormateado}
        guardando={guardando}
      />
    </div>
  )
}

interface BandejaFiltroPageProps {
  filtro: 1 | 2 | 3
  onOpenReview?: (solicitudId: string, filtro: 1 | 2 | 3) => void
  onEditSolicitud?: (payload: EditSolicitudPayload) => void
}
export function BandejaFiltroPage({ filtro, onOpenReview, onEditSolicitud }: BandejaFiltroPageProps) {
  const { user } = useAuth()
  const [solicitudes,    setSolicitudes]    = useState<FiltroSolicitud[]>([])
  const [pendientesFirmaCount, setPendientesFirmaCount] = useState(0)
  const [solicitudesCount, setSolicitudesCount] = useState(0)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [guardando,      setGuardando]      = useState(false)
  const [activeTab,      setActiveTab]      = useState<TabKey>(
    filtro === 2 ? "pendientes_asignacion"
    : "nuevas"
  )
  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [observarTarget,        setObservarTarget]        = useState<string | null>(null)
  const [aprobarTarget,        setAprobarTarget]        = useState<string | null>(null)
  const [aprobarAsignarTarget,  setAprobarAsignarTarget]  = useState<string | null>(null)
  const [asignarRevisorTarget,  setAsignarRevisorTarget]  = useState<string | null>(null)

  const [searchTerm,    setSearchTerm]    = useState("")
  const [filterRegimen, setFilterRegimen] = useState("todos")

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    setRefreshSignal(v => v + 1)
    try {
      const userId = (user as any)?.id ?? ""
      const url = filtro === 1 && userId
        ? `/api/filtro?filtro=${filtro}&revisorId=${userId}&userId=${userId}`
        : `/api/filtro?filtro=${filtro}&userId=${userId}`
      const res  = await fetch(url)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setSolicitudes(json.data ?? [])
      if (filtro === 3) {
        fetch("/api/solicitudes-seguimiento", { cache: "no-store" })
          .then(r => r.json())
          .then(j => {
            if (!j.ok) return
            const visibles = (j.data ?? []).filter((s: any) =>
              ESTADOS_VISIBLES_EMISION.has((s.estado ?? "").toLowerCase())
            )
            setSolicitudesCount(visibles.length)
          })
          .catch(() => {})
      }
    } catch { setError("Error de conexión al servidor") }
    finally { setLoading(false) }
  }, [filtro, user])

  useEffect(() => { cargar() }, [cargar])

  // Para la bandeja de Emisor: precargar el conteo de la vista global "Solicitudes"
  // (todas las que han ingresado al flujo) para mostrarlo en la tab sin tener que abrirla.
  useEffect(() => {
    if (filtro !== 3) return
    let aborted = false
    fetch("/api/solicitudes-seguimiento", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (aborted || !json.ok) return
        const visibles = (json.data ?? []).filter((s: any) =>
          ESTADOS_VISIBLES_EMISION.has((s.estado ?? "").toLowerCase())
        )
        setSolicitudesCount(visibles.length)
      })
      .catch(() => {})
    return () => { aborted = true }
  }, [filtro])

  // Precargar conteo de "Pendientes de firma" para todas las bandejas (sin tener que abrir la tab).
  useEffect(() => {
    const userId = (user as any)?.id ?? ""
    if (!userId) return
    const bandejaActual = filtro === 1 ? "revision" : filtro === 2 ? "validacion" : "emision"
    let aborted = false
    fetch(`/api/firma-efirma/progreso?usuarioId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (aborted || !json.ok) return
        const procesos = json.procesos ?? []
        const count = procesos.filter((p: any) => {
          // Caso (b): emisor que ya firmó, falta sellar/emitir
          if (bandejaActual === "emision" && p.pendiente_emision_por_mi) return true
          // Caso (a): es mi turno de firmar
          if (!p.mi_firmante_pendiente || p.mi_firmante_pendiente.bandeja !== bandejaActual) return false
          const miFirmante = p.firmantes.find((f: any) => f.id === p.mi_firmante_pendiente.id)
          if (!miFirmante) return false
          const siguiente = [...p.firmantes].filter((f: any) => !f.firmado).sort((a: any, b: any) => a.orden - b.orden)[0]
          return !!siguiente && miFirmante.orden === siguiente.orden
        }).length
        setPendientesFirmaCount(count)
      })
      .catch(() => {})
    return () => { aborted = true }
  }, [filtro, user])

  const handleAprobar = useCallback(async (id: string, revisorId?: string) => {
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
          ...(revisorId ? { revisorId } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al aprobar"); return }
      setSolicitudes(prev =>
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s)
      )
      setSelectedId(null)
    } catch { alert("Error de conexión al aprobar") }
    finally { setGuardando(false); setAprobarTarget(null) }
  }, [filtro, user])

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
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s)
      )
      setSelectedId(null); setObservarTarget(null)
      setActiveTab("observadas")
    } catch { alert("Error de conexión al observar") }
    finally { setGuardando(false) }
  }, [filtro, user])

  const handleAceptar = useCallback(async (id: string) => {
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: Number(id),
          accion: "aceptar",
          usuarioId: (user as any)?.id ?? "",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al aceptar"); return }
      setSolicitudes(prev =>
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s)
      )
    } catch { alert("Error de conexión al aceptar") }
    finally { setGuardando(false) }
  }, [user])

  const handleAsignarRevisor = useCallback(async (id: string, revisorId: string) => {
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: Number(id),
          accion: "asignarRevisor",
          usuarioId: (user as any)?.id ?? "",
          revisorId,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al asignar revisor"); return }
      setSolicitudes(prev =>
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s)
      )
      setAsignarRevisorTarget(null)
      setSelectedId(null)
    } catch { alert("Error de conexión al asignar revisor") }
    finally { setGuardando(false) }
  }, [user])

  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = {
      nuevas: 0, correcciones: 0, revision: 0, observadas: 0,
      pendientes_asignacion: 0, en_validacion: 0, pendientes_firma: 0,
      todas: 0, solicitudes: 0,
    }
    c.todas = solicitudes.length
    solicitudes.forEach(s => {
      const tab = classifySolicitud(s, filtro)
      if (tab !== "todas") c[tab]++
    })
    c.pendientes_firma = pendientesFirmaCount
    c.solicitudes = solicitudesCount
    return c
  }, [solicitudes, filtro, pendientesFirmaCount, solicitudesCount])

  const filtered = useMemo(() =>
    solicitudes
      .filter(s => {
        if (activeTab !== "todas") return classifySolicitud(s, filtro) === activeTab
        if (filtro === 2) return classifySolicitud(s, filtro) !== "pendientes_asignacion"
        return true
      })
      .filter(s => {
        if (!searchTerm) return true
        const t = searchTerm.toLowerCase()
        return (
          (s.folioRecepcion?.toLowerCase().includes(t) ?? false) ||
          formatearFolio(s.folioRecepcion).toLowerCase().includes(t) ||
          (s.folioDictamen?.toLowerCase().includes(t) ?? false) ||
          formatearFolio(s.folioDictamen).toLowerCase().includes(t) ||
          s.secretaria.toLowerCase().includes(t) ||
          s.tipo.toLowerCase().includes(t) ||
          (s.denominacion ?? "").toLowerCase().includes(t)
        )
      })
      .filter(s => {
        if (filterRegimen === "todos") return true
        const r = (s._raw?.regimen ?? "").toLowerCase()
        if (filterRegimen === "asimilados")   return r.includes("asimilado")
        if (filterRegimen === "nombramiento") return r.includes("nombramiento") || r.includes("tiempo determinado")
        if (filterRegimen === "honorarios")   return r.includes("honorario") && !r.includes("asimilado")
        return true
      }),
    [solicitudes, activeTab, filtro, searchTerm, filterRegimen]
  )

  const selectedSolicitud = selectedId ? solicitudes.find(s => s.id === selectedId) ?? null : null

  if (selectedSolicitud) return (
    <DetalleView
      solicitud={selectedSolicitud}
      filtro={filtro}
      onBack={() => setSelectedId(null)}
      onAprobar={handleAprobar}
      onObservar={handleObservar}
      onEditSolicitud={onEditSolicitud}
      guardando={guardando}
    />
  )

  return (
    <PageLayout>
      {}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {filtro === 1 ? "Bandeja en revisión" : filtro === 2 ? "Bandeja en validación" : "Bandeja en emisión"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtro === 1
              ? "Revisa y analiza las solicitudes asignadas, realizando el primer filtro de revisión y observaciones."
              : filtro === 2
              ? "Valida y asigna las solicitudes, realizando el segundo filtro de revisión y observaciones."
              : "Gestiona la emisión de las solicitudes, realizando la dictaminación final y la generación de dictámenes u opiniones técnicas."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargar} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}




      <FilterTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        items={Object.keys(
          filtro === 2 ? TAB_CONFIG_DO : filtro === 3 ? TAB_CONFIG_EMISION : TAB_CONFIG_REVISION
        ).map((tabKey) => {
          const cfg = (filtro === 2 ? TAB_CONFIG_DO : filtro === 3 ? TAB_CONFIG_EMISION : TAB_CONFIG_REVISION)[tabKey]
          return {
            value: tabKey,
            label: cfg.label,
            count: tabCounts[tabKey as TabKey],
          }
        })}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, denominación, secretaría..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={filterRegimen} onValueChange={setFilterRegimen}>
          <SelectTrigger className="w-60 bg-card"><SelectValue placeholder="Régimen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los regímenes</SelectItem>
            <SelectItem value="honorarios">Honorarios</SelectItem>
            <SelectItem value="asimilados">Honorarios Asimilados a Salarios</SelectItem>
            <SelectItem value="nombramiento">Nombramiento por Tiempo Determinado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeTab === "pendientes_firma" ? (
        <Card className="shadow-sm border-border">
          <CardContent className="pt-6">
            <PendientesFirmaPanel filtro={filtro} currentUserId={(user as any)?.id ?? ""} onCountChange={setPendientesFirmaCount} />
          </CardContent>
        </Card>
      ) : (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-semibold text-card-foreground">
            <span>
              {loading
                ? "Cargando..."
                : `${filtered.length} solicitud${filtered.length !== 1 ? "es" : ""} en ${FILTRO_LABELS[filtro]}`}
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
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-3 text-left font-semibold">Estatus</th>
                    <th className="px-4 py-3 text-left font-semibold">Folio Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Régimen de Contratación</th>
                    <th className="px-4 py-3 text-left font-semibold">Secretaría</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Corrección</th>
                    <th className="px-4 py-3 text-left font-semibold">Ult. Observo</th>
                    <th className="px-4 py-3 text-left font-semibold">Plazo máximo de atención</th>
                    {!(filtro === 3 && activeTab === "nuevas") && (
                      <th className="px-4 py-3 text-left font-semibold">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={filtro === 3 && activeTab === "nuevas" ? 8 : 9} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="h-8 w-8 text-muted-foreground/40" />
                          <span>No hay solicitudes en esta clasificación</span>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(sol => {
                    const tab    = classifySolicitud(sol, filtro)
                    const config = (filtro === 2 ? TAB_CONFIG_DO : filtro === 3 ? TAB_CONFIG_EMISION : TAB_CONFIG_REVISION)[tab]
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">

                        <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                            {filtro === 2 && tab === "pendientes_asignacion" && sol.revisorAsignado ? (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: "#0E7490", color: "#FFFFFF" }}
                              >
                                Pendiente de aceptación
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={config.badgeStyle}
                              >
                                {config.label}
                              </span>
                            )}
                            {sol.reingresoCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                                Reingreso #{sol.reingresoCount}
                              </span>
                            )}
                          </div>
                        </td>

                        {}
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <div className="flex flex-col gap-1">
                            {sol.folioRecepcion
                              ? <span className="font-mono">{formatearFolio(sol.folioRecepcion)}</span>
                              : <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px]">
                          <span className="line-clamp-2">{formatRegimen(sol._raw?.regimen)}</span>
                        </td>

                        {}
                        <td className="px-4 py-3 text-muted-foreground text-xs">{sol.secretaria}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {sol.fechaRecepcionDO
                            ? new Date(sol.fechaRecepcionDO).toLocaleDateString("es-MX")
                            : "---"}
                        </td>
                        <td className="px-4 py-3">
                          {sol.lastObservedStage ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-card-foreground">Filtro {sol.lastObservedStage}</span>
                              <span className="text-[10px] text-muted-foreground">{sol.lastObservedDate}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sol.lastObservedEstado ? (
                            <span className="text-xs text-muted-foreground">{sol.lastObservedEstado}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">---</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><SlaIndicator diasRestantes={sol.slaRestante} /></td>
                        {!(filtro === 3 && activeTab === "nuevas") && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {filtro === 2 ? (
                              tab === "pendientes_asignacion" ? (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setAsignarRevisorTarget(sol.id)}
                                  disabled={guardando}
                                  className="text-primary hover:text-primary/80 gap-1.5 font-medium"
                                >
                                  <UserCheck className="h-4 w-4" />
                                  {sol.estado.toLowerCase().includes("en revision revisor") ? "Reasignar Revisor" : "Asignar Revisor"}
                                </Button>
                              ) : tab === "observadas" ? (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => { setSelectedId(sol.id); onOpenReview?.(sol.id, filtro) }}
                                  className="text-muted-foreground hover:text-card-foreground gap-1.5"
                                >
                                  <Eye className="h-4 w-4" />Ver
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => { setSelectedId(sol.id); onOpenReview?.(sol.id, filtro) }}
                                  className="text-secondary hover:text-primary gap-1.5"
                                >
                                  <FileSearch className="h-4 w-4" />Revisar
                                </Button>
                              )
                            ) : filtro === 1 && sol.estado.toLowerCase().includes("en revision revisor") ? (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleAceptar(sol.id)}
                                disabled={guardando}
                                className="text-primary hover:text-primary/80 gap-1.5 font-medium"
                              >
                                <ClipboardCheck className="h-4 w-4" />Aceptar
                              </Button>
                            ) : filtro === 1 && (sol.estado.toLowerCase() === "aceptado por revisor" || sol.estado.toLowerCase() === "aprobado por revisor") ? (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { setSelectedId(sol.id); onOpenReview?.(sol.id, filtro) }}
                                className="text-secondary hover:text-primary gap-1.5"
                              >
                                <FileSearch className="h-4 w-4" />Revisar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { setSelectedId(sol.id); onOpenReview?.(sol.id, filtro) }}
                                className="text-secondary hover:text-primary gap-1.5"
                              >
                                <FileSearch className="h-4 w-4" />Revisar
                              </Button>
                            )}
                            {}
                          </div>
                        </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
      <ConfirmModal
        open={!!aprobarTarget}
        onClose={() => setAprobarTarget(null)}
        onConfirm={() => { if (aprobarTarget) handleAprobar(aprobarTarget) }}
        title={(() => {
          const sol = solicitudes.find(s => s.id === aprobarTarget)
          if (filtro === 3 && sol?.estado.toLowerCase().includes("pendiente firma dictamen"))
            return "¿Firmar dictamen y emitir?"
          return "¿Aprobar y avanzar al siguiente paso?"
        })()}
        description={`La solicitud ${formatearFolio(solicitudes.find(s => s.id === aprobarTarget)?.folioRecepcion)} avanzará al siguiente paso del proceso.`}
        confirmLabel="Sí, confirmar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={!!observarTarget}
        onClose={() => setObservarTarget(null)}
        onConfirm={(obs) => { if (observarTarget) handleObservar(observarTarget, obs) }}
        folio={formatearFolio(solicitudes.find(s => s.id === observarTarget)?.folioRecepcion)}
      />
      <AprobarAsignarModal
        open={!!aprobarAsignarTarget}
        onClose={() => setAprobarAsignarTarget(null)}
        onConfirm={(revisorId) => {
          if (aprobarAsignarTarget) {
            handleAprobar(aprobarAsignarTarget, revisorId)
            setAprobarAsignarTarget(null)
          }
        }}
        folio={formatearFolio(solicitudes.find(s => s.id === aprobarAsignarTarget)?.folioRecepcion ?? "")}
        guardando={guardando}
       />
      <AsignarRevisorModal
        open={!!asignarRevisorTarget}
        onClose={() => setAsignarRevisorTarget(null)}
        onConfirm={(revisorId) => {
          if (asignarRevisorTarget) handleAsignarRevisor(asignarRevisorTarget, revisorId)
        }}
        folio={formatearFolio(solicitudes.find(s => s.id === asignarRevisorTarget)?.folioRecepcion ?? "")}
        guardando={guardando}
      />
    </PageLayout>
  )
}

