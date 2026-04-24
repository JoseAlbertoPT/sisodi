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
  FileText, History, Download, UserCheck, ClipboardCheck, Stamp, Globe,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { PendientesFirmaPanel } from "@/components/pendientes-firma-panel"
import { SeguimientoGeneralView, ESTADOS_VISIBLES_EMISION } from "@/components/seguimiento-general-view"

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
  if (n === "pendiente do") return "pendientes_asignacion"
  if (n === "pendiente firma dictamen") return "pendientes_firma"
  if (
    n.includes("observado por emisor") || n.includes("observado por revisor") ||
    n.includes("observado por do")     || n.includes("devuelta por do") ||
    n.includes("observado do filtro")
  ) return "observadas"
  if (
    n === "aceptado por revisor"     || n === "aprobado por revisor" ||
    n.includes("en validacion final") || n.includes("en revision revisor")
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
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma justificacion") return "pendientes_firma"
    if (estadoNorm === "aceptado por revisor" || estadoNorm === "aprobado por revisor") return "revision"
    if (estadoNorm === estadoEnRevision.toLowerCase()) {
      return s.openedInFiltro[filtro] ? "revision" : "nuevas"
    }
  }

  if (filtro === 3) {
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma justificacion") return "pendientes_firma"
    if (estadoNorm === estadoEnRevision.toLowerCase()) {
      return (s.openedInFiltro[filtro] || !!s.folioDictamen) ? "revision" : "nuevas"
    }
  }

  return "todas"
}
function getSlaColor(dias: number | null) {
  if (dias === null) return "text-muted-foreground"
  if (dias <= 0)  return "text-destructive"
  if (dias <= 5)  return "text-orange-600"
  if (dias <= 10) return "text-yellow-600"
  return "text-emerald-600"
}
function getSlaBackground(dias: number | null) {
  if (dias === null) return "bg-muted"
  if (dias <= 0)  return "bg-destructive/10"
  if (dias <= 5)  return "bg-orange-500/10"
  if (dias <= 10) return "bg-yellow-500/10"
  return "bg-emerald-500/10"
}
function getSlaLabel(dias: number | null) {
  if (dias === null) return "Sin fecha"
  if (dias <= 0) return `Vencido ${Math.abs(dias)}d`
  return `${dias} día${dias !== 1 ? "s" : ""}`
}
type TabCfg = Record<string, { label: string; icon: React.ReactNode; activeBg: string; activeText: string }>
const TAB_CONFIG_REVISION: TabCfg = {
  nuevas:          { label: "Asignadas",          icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  revision:        { label: "En revisión",         icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary" },
  observadas:      { label: "Observadas",          icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive" },
  pendientes_firma:{ label: "Pendiente de firma",  icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  todas:           { label: "Todas",               icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground" },
}
const TAB_CONFIG_EMISION: TabCfg = {
  solicitudes:     { label: "Solicitudes",          icon: <Globe className="h-3.5 w-3.5" />,         activeBg: "bg-primary/10",     activeText: "text-primary" },
  nuevas:          { label: "Estatus de recibidas", icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  revision:        { label: "En emisión",           icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary" },
  observadas:      { label: "Observadas",           icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive" },
  pendientes_firma:{ label: "Pendientes de firma",  icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  todas:           { label: "Todas",                icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground" },
}
const TAB_CONFIG_DO: TabCfg = {
  pendientes_asignacion: { label: "Pendientes de asignación", icon: <UserCheck className="h-3.5 w-3.5" />,     activeBg: "bg-orange-500/10",  activeText: "text-orange-600" },
  en_validacion:         { label: "En validación",            icon: <ClipboardCheck className="h-3.5 w-3.5" />, activeBg: "bg-primary/10",     activeText: "text-primary" },
  observadas:            { label: "Observadas",               icon: <AlertTriangle className="h-3.5 w-3.5" />,  activeBg: "bg-destructive/10", activeText: "text-destructive" },
  pendientes_firma:      { label: "Pendientes de firma",      icon: <Stamp className="h-3.5 w-3.5" />,          activeBg: "bg-secondary/10",   activeText: "text-secondary" },
  todas:                 { label: "Todas",                    icon: <ListFilter className="h-3.5 w-3.5" />,      activeBg: "bg-muted",          activeText: "text-card-foreground" },
}

function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getSlaBackground(diasRestantes)} ${getSlaColor(diasRestantes)}`}>
      <Clock className="h-3 w-3" />
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
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="text-sm font-medium text-card-foreground">{value || "—"}</span>
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

function ExpedienteCompleto({ raw }: { raw: any }) {
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

function DetalleView({ solicitud, filtro, onBack, onAprobar, onObservar, guardando }: {
  solicitud: FiltroSolicitud
  filtro: 1 | 2 | 3
  onBack: () => void
  onAprobar: (id: string, revisorId?: string) => void
  onObservar: (id: string, obs: string) => void
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

  const historial: Array<{ fecha: string; usuario: string; accion: string }> =
    (raw?.historial_solicitud ?? []).map((h: any) => ({
      fecha:   h.fecha ? new Date(h.fecha).toLocaleString("es-MX") : "—",
      usuario: h.usuario?.nombre ?? "Sistema",
      accion:  h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? h.comentario ?? "—",
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
      {/* Barra superior */}
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
            disabled={guardando}
            className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
            <RotateCcw className="h-4 w-4" />Observar
          </Button>
        </div>
      </div>

      {/* Banners */}
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
      {/* Layout principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <ExpedienteCompleto raw={raw} />
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
                {solicitud.esRegularizacion && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary w-fit">
                    Regularización / Extemporánea
                  </span>
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
          )}
        </div>
      </div>

      {/* Modales */}
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

// ── Bandeja principal ──
interface BandejaFiltroPageProps {
  filtro: 1 | 2 | 3
  onOpenReview?: (solicitudId: string, filtro: 1 | 2 | 3) => void
}
export function BandejaFiltroPage({ filtro, onOpenReview }: BandejaFiltroPageProps) {
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
    : filtro === 3 ? "solicitudes"
    : "nuevas"
  )
  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [observarTarget,        setObservarTarget]        = useState<string | null>(null)
  const [aprobarTarget,        setAprobarTarget]        = useState<string | null>(null)
  const [aprobarAsignarTarget,  setAprobarAsignarTarget]  = useState<string | null>(null)
  const [asignarRevisorTarget,  setAsignarRevisorTarget]  = useState<string | null>(null)

  const [searchTerm,       setSearchTerm]       = useState("")
  const [filterAnio,       setFilterAnio]       = useState("2026")
  const [filterMes,        setFilterMes]        = useState("todos")
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterTipo,       setFilterTipo]       = useState("todos")
  const [filterSla,        setFilterSla]        = useState("todos")

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
      setSolicitudes(prev => prev.filter(s => s.id !== id))
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
      .filter(s => activeTab === "todas" || classifySolicitud(s, filtro) === activeTab)
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
        if (filterAnio !== "todos " && s.fechaRecepcionDO) return s.fechaRecepcionDO.startsWith(filterAnio)
        return true
      })
      .filter(s => {
        if (filterMes !== "todos" && s.fechaRecepcionDO) return s.fechaRecepcionDO.slice(5, 7) === filterMes
        return true
      })
      .filter(s => filterSecretaria === "todas" || s.secretaria === filterSecretaria)
      .filter(s => filterTipo === "todos" || s.tipo === filterTipo)
      .filter(s => {
        if (filterSla === "todos")   return true
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

  return (
    <PageLayout>
      {/* Encabezado */}
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

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(filtro === 2
          ? [
              { label: "Total en bandeja",         value: solicitudes.length,                     icon: <Filter className="h-5 w-5 text-secondary" />,          bg: "bg-secondary/10" },
              { label: "Pendientes de asignación", value: tabCounts.pendientes_asignacion,         icon: <UserCheck className="h-5 w-5 text-orange-600" />,       bg: "bg-orange-500/10" },
              { label: "En validación",            value: tabCounts.en_validacion,                 icon: <ClipboardCheck className="h-5 w-5 text-primary" />,     bg: "bg-primary/10" },
              { label: "SLA en riesgo",            value: solicitudes.filter(s => s.slaRestante !== null && s.slaRestante <= 5).length,
                                                                                                    icon: <AlertTriangle className="h-5 w-5 text-destructive" />,  bg: "bg-destructive/10" },
            ]
          : [
              { label: "Total en bandeja", value: solicitudes.length,         icon: <Filter className="h-5 w-5 text-secondary" />,          bg: "bg-secondary/10" },
              { label: "Nuevas",           value: tabCounts.nuevas,           icon: <CircleDot className="h-5 w-5 text-secondary" />,        bg: "bg-secondary/10" },
              { label: "Correcciones",     value: tabCounts.correcciones,     icon: <RotateCcw className="h-5 w-5 text-accent-foreground" />, bg: "bg-accent/10" },
              { label: "SLA en riesgo",    value: solicitudes.filter(s => s.slaRestante !== null && s.slaRestante <= 5).length,
                                                                               icon: <AlertTriangle className="h-5 w-5 text-destructive" />,  bg: "bg-destructive/10" },
            ]
        ).map((c, i) => (
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
            icon:  cfg.icon,
          }
        })}
      />

      {/* filtros — ocultos en la vista global de Solicitudes (Emisor) */}
      {!(filtro === 3 && activeTab === "solicitudes") && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, denominacion, secretaría..."
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
      )}

      {activeTab === "pendientes_firma" ? (
        <Card className="shadow-sm border-border">
          <CardContent className="pt-6">
            <PendientesFirmaPanel filtro={filtro} currentUserId={(user as any)?.id ?? ""} onCountChange={setPendientesFirmaCount} />
          </CardContent>
        </Card>
      ) : filtro === 3 && activeTab === "solicitudes" ? (
        <SeguimientoGeneralView refreshSignal={refreshSignal} />
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
                    <th className="px-4 py-3 text-left font-semibold">SLA</th>
                    <th className="px-4 py-3 text-left font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
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

                        {/* Estatus */}
                        <td className="px-4 py-3">
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

                        {/* Folio Recepción */}
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <div className="flex flex-col gap-1">
                            {sol.folioRecepcion
                              ? <span className="font-mono">{formatearFolio(sol.folioRecepcion)}</span>
                              : <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                            }
                            {sol.esRegularizacion && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary w-fit">
                                Regularización
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px]">
                          <span className="line-clamp-2">{formatRegimen(sol._raw?.regimen)}</span>
                        </td>

                        {/* Secretaría */}
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
                                  <UserCheck className="h-4 w-4" />Asignar Revisor
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
                            {/* <Button
                              variant="ghost" size="sm"
                              onClick={() => {
                                const yaFiltro1 = (sol._raw?.historial_solicitud ?? []).some(
                                  (h: any) => (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "")
                                    .toLowerCase().includes("en revision revisor")
                                )
                                if (filtro === 2 && !yaFiltro1)
                                  setAprobarAsignarTarget(sol.id)
                                else
                                  setAprobarTarget(sol.id)
                              }}
                              disabled={guardando}
                              className="text-primary hover:text-primary/80 gap-1.5"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {filtro === 3 && sol.estado.toLowerCase().includes("pendiente firma dictamen")
                                ? "Firmar"
                                : "Aprobar"}
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setObservarTarget(sol.id)}
                              disabled={guardando}
                              className="text-destructive hover:text-destructive/80 gap-1.5"
                            >
                              <RotateCcw className="h-4 w-4" />Observar
                            </Button> */}
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


