"use client"

import { normalizeText, applyTextRules } from "@/lib/utils"
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ReadOnlyField } from "@/components/ui/readonly-field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  StatusBadge, estadoBadge,
  C_ROSA_VINO, C_ROSA_VINO_BG,
  C_AZUL_REVISION, C_AZUL_REVISION_BG,
  C_VIOLETA_EMISION, C_VIOLETA_EMISION_BG,
  C_AMARILLO, C_AMARILLO_BG,
  C_VERDE_ESTADO, C_VERDE_ESTADO_BG,
} from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog"
import { ActionResultScreen } from "@/components/ui/action-result-screen"
import { SearchInput, SEARCH_INPUT_MAX_W_SM } from "@/components/ui/search-input"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import {
  FileSearch, Filter, Clock, RotateCcw, CircleDot, Eye,
  AlertTriangle, ListFilter, RefreshCw, Loader2, CheckCircle2,
  ArrowLeft, ChevronDown, ChevronRight,
  FileText, History, Download, UserCheck, ClipboardCheck, Stamp, Pencil, X, Inbox,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import { useAuth } from "@/lib/auth-context"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PendientesFirmaPanel } from "@/components/pendientes-firma-panel"
import { ESTADOS_VISIBLES_EMISION } from "@/components/seguimiento-general-view"
import { type EditSolicitudPayload } from "@/components/pages/nueva-solicitud-page"
import { HistorialTimeline, type HistorialEntryData } from "@/components/historial-timeline"
import { ConfirmToast } from "@/components/ui/confirm-toast"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import { useRealtime } from "@/hooks/use-realtime"

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
const FILTRO_STAGE_LABELS: Record<number, string> = {
  1: "Revision",
  2: "Validacion DGDO",
  3: "Emision",
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
function ordinalRegreso(n: number): string {
  if (n === 1) return "1er Regreso"
  if (n === 2) return "2do Regreso"
  if (n === 3) return "3er Regreso"
  return `${n}° Regreso`
}
function formatearFolio(folio: string | null | undefined): string {
  if (!folio) return "---"
  const match = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[1]}/${match[2].padStart(2, "0")}/${match[3]}`
  return folio
}
function parseDateLocal(v: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(v)
}
function formatFecha(v: string | null | undefined) {
  if (!v) return "—"
  const d = parseDateLocal(v)
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
  if (!raw) return "—"
  return applyTextRules(raw)
}
function getEstadoEnRevision(filtro: number) {
  if (filtro === 1) return "En Revision Revisor"
  if (filtro === 2) return "En Validacion Final"
  return "En Revision Emisor"
}
function getEstadoObservado(filtro: number) {
  if (filtro === 1) return "Observado por Revisor"
  if (filtro === 2) return "Observado por Validacion DGDO"
  return "Observado por Emisor"
}
function classifyDO(s: FiltroSolicitud): TabKey {
  const n = s.estado.toLowerCase()
  if (n === "pendiente do" || n.includes("en revision revisor")) return "pendientes_asignacion"
  if (n === "pendiente firma dictamen" || n === "pendiente firma validacion") return "pendientes_firma"
  if (n.includes("observado por emisor")) return "en_validacion"
  if (
    n.includes("observado por validacion final") ||
    n.includes("observado por do")     || n.includes("devuelta por do") ||
    n.includes("observado do filtro")
  ) return "observadas"
  if (
    n === "aceptado por revisor"     || n === "aprobado por revisor" ||
    n.includes("en validacionfinal") || n.includes("en validacion final")
  ) return "en_validacion"
  return "todas"
}
function classifySolicitud(s: FiltroSolicitud, filtro: 1 | 2 | 3): TabKey {
  if (filtro === 2) return classifyDO(s)
  const estadoEnRevision = getEstadoEnRevision(filtro)
  const estadoObservado  = getEstadoObservado(filtro)
  const estadoNorm       = s.estado.toLowerCase()
  if (filtro === 3 && estadoNorm === "observado por validacion final") return "todas"
  if (filtro === 1 && estadoNorm === "observado por validacion final") return "revision"
  if (estadoNorm === estadoObservado.toLowerCase()) return "observadas"
  if (filtro === 1) {
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma justificacion" || estadoNorm === "pendiente firma revision") return "pendientes_firma"
    if (estadoNorm === "aceptado por revisor" || estadoNorm === "aprobado por revisor") return "revision"
    if (estadoNorm === estadoEnRevision.toLowerCase()) return "nuevas"
  }
  if (filtro === 3) {
    if (estadoNorm === "pendiente firma dictamen" || estadoNorm === "pendiente firma emisor") return "pendientes_firma"
    if (estadoNorm === estadoEnRevision.toLowerCase()) {
      if (filtro === 3) return "revision"
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
    ])
    if (preEmisor.has(estadoNorm)) return "nuevas"
  }
  return "todas"
}
function getSlaColor(dias: number | null): string {
  if (dias === null) return "#64748b"
  if (dias <= 0)  return C_ROSA_VINO
  if (dias <= 7)  return C_ROSA_VINO
  if (dias <= 15) return C_AMARILLO
  return C_VERDE_ESTADO
}
function getSlaBgColor(dias: number | null): string {
  if (dias === null) return "#64748b18"
  if (dias <= 0)  return C_ROSA_VINO_BG
  if (dias <= 7)  return C_ROSA_VINO_BG
  if (dias <= 15) return C_AMARILLO_BG
  return C_VERDE_ESTADO_BG
}
function getSlaStyle(dias: number | null): React.CSSProperties {
  return { backgroundColor: getSlaBgColor(dias), color: getSlaColor(dias) }
}
function getSlaLabel(dias: number | null) {
  if (dias === null) return "Sin periodo"
  if (dias <= 0) return "Cerrada"
  return `${dias} día${dias !== 1 ? "s" : ""} al cierre`
}
type TabCfg = Record<string, { label: string; icon: React.ReactNode; activeBg: string; activeText: string; badgeStyle: React.CSSProperties }>
const TAB_CONFIG_REVISION: TabCfg = {
  nuevas:          { label: "Asignadas",          icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: C_AZUL_REVISION_BG, color: C_AZUL_REVISION } },
  revision:        { label: "En revisión",         icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary",        badgeStyle: { backgroundColor: C_AZUL_REVISION_BG, color: C_AZUL_REVISION } },
  observadas:      { label: "Observado",          icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive",    badgeStyle: { backgroundColor: C_ROSA_VINO_BG, color: C_ROSA_VINO } },
  pendientes_firma:{ label: "Pendiente de firma",            icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: C_AMARILLO_BG, color: C_AMARILLO } },
  todas:           { label: "Todas",               icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "var(--sem-bg-base)" } },
}
const TAB_CONFIG_EMISION: TabCfg = {
  nuevas:          { label: "Estatus de recibidas", icon: <CircleDot className="h-3.5 w-3.5" />,    activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: C_VERDE_ESTADO_BG, color: C_VERDE_ESTADO } },
  revision:        { label: "En revisión",          icon: <Eye className="h-3.5 w-3.5" />,           activeBg: "bg-primary/10",     activeText: "text-primary",        badgeStyle: { backgroundColor: C_AZUL_REVISION_BG, color: C_AZUL_REVISION } },
  observadas:      { label: "Observado",           icon: <AlertTriangle className="h-3.5 w-3.5" />, activeBg: "bg-destructive/10", activeText: "text-destructive",    badgeStyle: { backgroundColor: C_ROSA_VINO_BG, color: C_ROSA_VINO } },
  pendientes_firma:{ label: "Pendiente de firma",   icon: <Stamp className="h-3.5 w-3.5" />,         activeBg: "bg-secondary/10",   activeText: "text-secondary",      badgeStyle: { backgroundColor: C_AMARILLO_BG, color: C_AMARILLO } },
  todas:           { label: "Todas",                icon: <ListFilter className="h-3.5 w-3.5" />,    activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "var(--sem-bg-base)" } },
}
const TAB_CONFIG_DO: TabCfg = {
  pendientes_asignacion: { label: "Pendientes de asignación", icon: <UserCheck className="h-3.5 w-3.5" />,     activeBg: "bg-orange-500/10",  activeText: "text-orange-600",      badgeStyle: { backgroundColor: C_VIOLETA_EMISION_BG, color: C_VIOLETA_EMISION } },
  en_validacion:         { label: "En revisión",              icon: <ClipboardCheck className="h-3.5 w-3.5" />, activeBg: "bg-primary/10",     activeText: "text-primary",         badgeStyle: { backgroundColor: C_AZUL_REVISION_BG, color: C_AZUL_REVISION } },
  observadas:            { label: "Observado",               icon: <AlertTriangle className="h-3.5 w-3.5" />,  activeBg: "bg-destructive/10", activeText: "text-destructive",     badgeStyle: { backgroundColor: C_ROSA_VINO_BG, color: C_ROSA_VINO } },
  pendientes_firma:      { label: "Pendiente de firma",                 icon: <Stamp className="h-3.5 w-3.5" />,          activeBg: "bg-secondary/10",   activeText: "text-secondary",       badgeStyle: { backgroundColor: C_AMARILLO_BG, color: C_AMARILLO } },
  todas:                 { label: "Todas",                    icon: <ListFilter className="h-3.5 w-3.5" />,      activeBg: "bg-muted",          activeText: "text-card-foreground", badgeStyle: { backgroundColor: "#94a3b8", color: "var(--sem-bg-base)" } },
}


function SlaIndicator({ diasRestantes }: { diasRestantes: number | null }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit"
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
            <img src="/iconos2/addPlus.svg" alt="" width={16} height={16} className={`transition-transform duration-200${open ? " rotate-45" : ""}`} />
          </span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}
function parseListField(text: string | null | undefined): string[] {
  if (!text || text === "—") return []
  return text.split(/[\n\r•·]+/).map(s => s.trim()).filter(Boolean)
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
              <span>{applyTextRules(item)}</span>
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
    <ul
      className="scroll-thin flex flex-col gap-2"
      style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}
    >
      {validItems.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-card-foreground min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary mt-0.5">
            {i + 1}
          </span>
          <span style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{applyTextRules(item)}</span>
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
          <ReadOnlyField label="Programa o Proyecto"                   value={applyTextRules(raw?.programa_proyecto ?? "—")} />
          <ReadOnlyField label="Tipo de Actividades"                   value={applyTextRules(raw?.tipo_actividades ?? "—")} />
          <ReadOnlyField label="Vigencia Inicio"                       value={formatFecha(raw?.vigencia_inicio)} />
          <ReadOnlyField label="Vigencia Término"                      value={formatFecha(raw?.vigencia_fin)} />
          <ReadOnlyField label="Importe Bruto"                         value={raw?.importe_bruto != null ? `$${Number(raw.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"} />
        </div>
      </SectionCard>
      <SectionCard title="I.1 Objeto de la Contratación">
        <p
          className="scroll-thin text-sm text-card-foreground leading-relaxed whitespace-pre-wrap"
          style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}
        >
          {raw?.objeto ? applyTextRules(raw.objeto) : <span className="text-muted-foreground">—</span>}
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
                <FileTypeIcon name={adj.nombre_archivo} size="sm" />
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
function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel: string
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="aprobar"
    />
  )
}
function ObservarModal({ open, onClose, onConfirm, folio }: {
  open: boolean; onClose: () => void; onConfirm: (obs: string) => void; folio: string
}) {
  const [step, setStep] = useState<"confirm" | "write">("confirm")
  const [obs, setObs] = useState("")

  const handleClose = () => { setStep("confirm"); setObs(""); onClose() }

  if (step === "confirm") {
    return (
      <ConfirmAlertDialog
        open={open}
        onOpenChange={(v) => { if (!v) handleClose() }}
        onConfirm={() => setStep("write")}
        title="¿Estás seguro de observar?"
        description={<>Vas a marcar <strong className="font-semibold">{folio}</strong> con observaciones. Se devolverá a la URG.</>}
        confirmLabel="Sí, continuar"
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(24rem,calc(100%-2rem))] sm:max-w-[min(24rem,calc(100%-2rem))] border border-[var(--sem-bg-surface-high)] shadow-lg p-6"
      >
        <div className="flex flex-col gap-3">
          <AlertTriangle className="h-7 w-7 text-[var(--sem-content-high)]" strokeWidth={1.75} />
          <DialogTitle className="ds-title-sm text-[18px]! font-normal! leading-[1.35]! text-[var(--sem-content-high)]">
            Observar — {folio}
          </DialogTitle>
          <p className="ds-label-md text-sm! font-light! leading-[1.4]! text-[#5d5e5f]">
            Escriba las observaciones que se enviarán a la URG.
          </p>
          <Textarea
            placeholder="Describa las observaciones..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            className="min-h-[120px] bg-card"
          />
        </div>
        <div className="flex gap-3 pt-3">
          <Button
            className="h-10 flex-1 rounded-full border-0 bg-[var(--sem-support-error-low)] text-sm font-medium text-[var(--sem-support-on-error-low)] hover:bg-[var(--sem-support-error-low)] hover:text-[var(--sem-support-on-error-low)] focus-visible:outline-[var(--sem-support-focus)]"
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="h-10 flex-1"
            onClick={() => { if (!obs.trim()) return; onConfirm(obs.trim()); setStep("confirm"); setObs("") }}
            disabled={!obs.trim()}
          >
            Confirmar observación
          </Button>
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
      <DialogContent showCloseButton={false} className="max-w-sm p-0">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#f3e8f0] flex items-center justify-center shrink-0">
                <img src="/Iconos1/account_circle-user-perfil.svg" width={24} height={24} alt="" />
              </div>
              <h3 className="font-bold text-gray-900 text-base leading-tight pt-2">Aprobar</h3>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 pl-[52px]">
            <p className="text-sm text-gray-500">
              Solicitud <span className="font-semibold text-gray-800">{folio}</span> — selecciona el revisor que la atenderá en Filtro de Revisión.
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
              </div>
            ) : revisores.length === 0 ? (
              <p className="text-sm text-destructive">No hay usuarios con rol Revisor disponibles.</p>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full max-w-sm">
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
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!selectedId || guardando || loading}
              onClick={() => onConfirm(selectedId)}
              className="gap-1.5"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
      <DialogContent showCloseButton={false} className="max-w-sm p-0">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#f3e8f0] flex items-center justify-center shrink-0">
                <img src="/Iconos1/account_circle-user-perfil.svg" width={24} height={24} alt="" />
              </div>
              <DialogTitle className="font-bold text-gray-900 text-base leading-tight pt-2">Asignar Revisor</DialogTitle>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 pl-[52px]">
            <p className="text-sm text-gray-500">
              Solicitud <span className="font-semibold text-gray-800">{folio}</span> — selecciona el revisor que la atenderá.
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
              </div>
            ) : revisores.length === 0 ? (
              <p className="text-sm text-destructive">No hay usuarios con rol Revisor disponibles.</p>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full max-w-sm">
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
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              onClick={onClose}
              disabled={guardando}
              className="h-10 rounded-full border-0 bg-[#F3F4F6] text-sm font-medium text-[#374151] hover:bg-[#E5E7EB]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!selectedId || guardando || loading}
              onClick={() => onConfirm(selectedId)}
              className="h-11 px-6 min-w-[120px] gap-1.5"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
          className="w-full gap-2"
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
  const fmt = (d: any) => { if (!d) return ""; const dt = new Date(d); return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10) }
  function getEstadoSig(estado: string): string | undefined {
    const n = estado.toLowerCase()
    if (n.includes("observado por validacion final")) return "En Validacion Final"
    if (n.includes("observado por emisor"))           return "En Revision Emisor"
    if (n.includes("observado por do") || n.includes("devuelta por do")) return "Pendiente DO"
    return undefined
  }
  return {
    id: solicitud.id,
    tipo,
    regimen,
    periodo: solicitud.periodo ?? "",
    estado: solicitud.estado,
    estadoSiguienteTrasSave: getEstadoSig(solicitud.estado),
    adjuntos: (raw.adjunto ?? []).map((a: any) => ({ id: a.id, nombre_archivo: a.nombre_archivo, ruta: a.ruta })),
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
  const [showDescargarConfirm,    setShowDescargarConfirm]    = useState(false)
  const [showAprobarAsignarModal, setShowAprobarAsignarModal] = useState(false)
  const [showObservarModal,       setShowObservarModal]       = useState(false)
  const [showEditarConfirm,       setShowEditarConfirm]       = useState(false)
  const [activePanel,             setActivePanel]             = useState<"revision" | "observaciones" | "historial">("revision")
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
      comentario:     h.comentario ?? null,
    }))
  const observacionesUefa: string = raw?.observaciones_uefa ?? raw?.observacion_uefa ?? ""
  const observacionesUefaActiva: boolean = (() => {
    if (!observacionesUefa) return false
    const historialItems: any[] = raw?.historial_solicitud ?? []
    let lastUefaObsIdx = -1
    historialItems.forEach((h: any, idx: number) => {
      const n = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
      if (
        n.includes("observada por ufa") ||
        n.includes("observado por ufa") ||
        (n.includes("observado por validacion") && !n.includes("final"))
      ) {
        lastUefaObsIdx = idx
      }
    })
    if (lastUefaObsIdx === -1) return false
    return !historialItems.slice(lastUefaObsIdx + 1).some((h2: any) => {
      const n2 = (h2.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
      return (
        n2.includes("enviada a validacion") ||
        n2.includes("en validacion justificaciones") ||
        n2 === "pendiente do"
      )
    })
  })()

  const ultimaObsDo: string | null = (() => {
    const entrada = (raw?.historial_solicitud ?? []).find((h: any) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      return nombre.toLowerCase().includes("observad") && nombre.toLowerCase().includes("filtro")
    })
    return entrada?.comentario ?? null
  })()

  const historialItems: any[] = raw?.historial_solicitud ?? []
  const observacionesFiltro: { estado: string; fecha: string; usuario: string; comentario: string }[] =
    historialItems
      .filter((h: any, idx: number) => {
        const nombre = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
        if (!nombre.includes("observad") || !h.comentario) return false
        const historialAfter = historialItems.slice(idx + 1)
        return !historialAfter.some((h2: any) => {
          const n2 = (h2.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
          return !n2.includes("observad")
        })
      })
      .map((h: any) => ({
        estado:     h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
        fecha:      h.fecha ? new Date(h.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        usuario:    h.usuario?.nombre ?? "Sistema",
        comentario: h.comentario as string,
      }))
  const denominacion = raw?.denominacion || raw?.tipo_solicitud || solicitud.denominacion || solicitud.tipo || "—"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="sm" onClick={onBack}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="ds-title-md text-content-high">
                {folioFormateado || <span className="text-muted-foreground font-normal text-base">Sin Folio de Recepción</span>}
              </h2>
              {estadoBadge(solicitud.estado)}
              {folioDictamen && (
                <Badge className="bg-secondary/15 text-secondary border-0 text-xs gap-1">
                  <Stamp className="h-3 w-3" />Dict. {folioDictamen}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{solicitud.tipo} — {solicitud.secretaria}</p>
            {denominacion !== "—" && (
              <p className="text-xs text-muted-foreground font-medium">{denominacion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SlaIndicator diasRestantes={solicitud.slaRestante} />
          <Button
            variant="default"
            size="sm" className="gap-1.5"
            onClick={() => setShowDescargarConfirm(true)}
          >
            Descagar Justificacion
          </Button>
          {onEditSolicitud && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowEditarConfirm(true)}
              className="gap-1.5"
            >
              Editar
            </Button>
          )}
          <Button
            onClick={() => {
              if (filtro === 2 && !yaEstuvoEnRevisor) setShowAprobarAsignarModal(true)
              else setShowAprobarModal(true)
            }}
            disabled={guardando}
            className="gap-1.5"
            size="sm"
            variant="primary"
            >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {labelAprobar}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowObservarModal(true)}
            disabled={guardando}
          >
            Observar
          </Button>
        </div>
      </div>

      {observacionesUefaActiva && (
        <Card className="border-2 border-[var(--color-core-mora-20)]/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-[var(--color-core-mora-20)] shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-[var(--color-core-mora-20)]">Observaciones UEFA</span>
              <p className="text-sm text-card-foreground mt-1">{observacionesUefa}</p>
            </div>
          </CardContent>
        </Card>
      )}

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
                  ? "bg-[var(--sem-bg-surface-high)] text-[var(--color-core-bosque-30)]"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <FileSearch className="h-4 w-4" />Revisión
            </button>
            {observacionesFiltro.length > 0 && (
              <button
                onClick={() => setActivePanel("observaciones")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative ${
                  activePanel === "observaciones"
                    ? "bg-[var(--color-core-mora-20)] text-white"
                    : "bg-card text-[var(--color-core-mora-20)] hover:bg-[var(--color-core-mora-20)]/10"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />Observaciones
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-core-mora-20)] text-[9px] font-bold text-white leading-none">
                  {observacionesFiltro.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setActivePanel("historial")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                activePanel === "historial"
                  ? "bg-[var(--sem-bg-surface-high)] text-[var(--color-core-bosque-30)]"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
              >
              <History className="h-4 w-4" />Historial
            </button>
          </div>

          {activePanel === "observaciones" && observacionesFiltro.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border shadow-md">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #3a1020 0%, #5c1a30 100%)" }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Observaciones</span>
                  <span className="text-[10px] text-white/60">
                    {observacionesFiltro.length} observación{observacionesFiltro.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="ml-auto flex h-7 items-center rounded-full bg-white/15 px-3">
                  <span className="text-[11px] font-semibold text-white/90">{observacionesFiltro.length} obs.</span>
                </div>
              </div>
              <div className="bg-card p-4 flex flex-col gap-2">
                {observacionesFiltro.map((obs, i) => (
                  <div key={i} className="rounded-lg border border-[var(--color-core-mora-20)]/20 bg-[var(--color-core-mora-20)]/[0.03] p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--color-core-mora-20)]">{obs.estado.replace(/Validacion Final/i, "Validacion DGDO")}</span>
                      <span className="text-[10px] text-muted-foreground">{obs.fecha}{obs.usuario && ` — ${obs.usuario}`}</span>
                    </div>
                    <p className="text-xs text-card-foreground leading-relaxed whitespace-pre-line">{obs.comentario}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  {estadoBadge(solicitud.estado)}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Plazo de Atención</span>
                  <SlaIndicator diasRestantes={solicitud.slaRestante} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Fecha de Recepción DO</span>
                  <span className="text-sm font-medium text-card-foreground">
                    {solicitud.fechaRecepcionDO
                      ? (() => { const [y,m,d] = solicitud.fechaRecepcionDO!.split("-"); return new Date(+y,+m-1,+d).toLocaleDateString("es-MX") })()
                      : "—"}
                  </span>
                </div>
                {solicitud.reingresoCount > 0 && solicitud.lastObservedStage && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Última Observacion desde</span>
                    <span className="text-sm font-medium text-card-foreground">
                      {solicitud.lastObservedDate ?? "—"}
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
            <div className="overflow-hidden rounded-xl border border-border shadow-md sticky top-4">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #1f2d1a 0%, #2e4226 100%)" }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Historial de Estatus</span>
                  <span className="text-[10px] text-white/60">
                    {historial.length} entrada{historial.length !== 1 ? "s" : ""} registrada{historial.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="ml-auto flex h-7 items-center rounded-full bg-white/15 px-3">
                  <span className="text-[11px] font-semibold text-white/90">{historial.length} entrada{historial.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="bg-card px-5 pt-4 pb-2">
                <HistorialTimeline entries={historial} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmAlertDialog
        open={showAprobarModal}
        onOpenChange={setShowAprobarModal}
        onConfirm={() => { setShowAprobarModal(false); onAprobar(solicitud.id) }}
        title={`¿${labelAprobar}?`}
        description={<>La solicitud <strong className="font-semibold">{folioFormateado}</strong> avanzará al siguiente paso del proceso.</>}
        confirmLabel="Sí, aprobar"
      />
      <ConfirmModal
        open={showDescargarConfirm}
        onClose={() => setShowDescargarConfirm(false)}
        onConfirm={() => { setShowDescargarConfirm(false); generateJustificacionPDF(solicitud.id, solicitud.folioSolicitud ?? undefined) }}
        title="¿Descargar justificación en PDF?"
        description={`Se descargará el PDF de la justificación ${folioFormateado}.`}
        confirmLabel="Sí, descargar"
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
      {onEditSolicitud && (
        <ConfirmAlertDialog
          open={showEditarConfirm}
          onOpenChange={setShowEditarConfirm}
          onConfirm={() => { setShowEditarConfirm(false); onEditSolicitud(rawToEditPayload(solicitud)) }}
          title="¿Estás seguro de editar?"
          description={<>Vas a editar la solicitud <strong className="font-semibold">{folioFormateado}</strong>.</>}
          confirmLabel="Sí, editar"
        />
      )}
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
  const loadGenRef  = useRef(0)
  const hasDataRef  = useRef(false)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [guardando,      setGuardando]      = useState(false)
  const [activeTab,      setActiveTab]      = useState<TabKey>(
    filtro === 2 ? "pendientes_asignacion"
    : filtro === 3 ? "revision"
    : "nuevas"
  )
  const userChangedTabRef = useRef(false)
  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [observarTarget,        setObservarTarget]        = useState<string | null>(null)
  const [aprobarTarget,        setAprobarTarget]        = useState<string | null>(null)
  const [aprobarAsignarTarget,  setAprobarAsignarTarget]  = useState<string | null>(null)
  const [asignarRevisorTarget,  setAsignarRevisorTarget]  = useState<string | null>(null)
  const [actionToast, setActionToast] = useState<{ key: number; variant: "success" | "error"; title: string; description?: string } | null>(null)
  const [successMsg, setSuccessMsg] = useState<{ title: string; description: string; type: 'approve' | 'observe' } | null>(null)

  const showToast = (variant: "success" | "error", title: string, description?: string) => {
    setActionToast(prev => ({ key: (prev?.key ?? 0) + 1, variant, title, description }))
  }

  const [searchTerm,    setSearchTerm]    = useState("")
  const [currentPage,   setCurrentPage]   = useState(1)
  const [filterRegimen, setFilterRegimen] = useState("todos")

  const cargar = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    setRefreshSignal(v => v + 1)
    const gen = ++loadGenRef.current
    try {
      const userId = (user as any)?.id ?? ""
      const url = filtro === 1 && userId
        ? `/api/filtro?filtro=${filtro}&revisorId=${userId}&userId=${userId}`
        : `/api/filtro?filtro=${filtro}&userId=${userId}`
      const res  = await fetch(url)
      const json = await res.json()
      if (gen !== loadGenRef.current) return
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }
      setSolicitudes(json.data ?? [])
      hasDataRef.current = true
      if (filtro === 3) {
        fetch("/api/solicitudes-seguimiento", { cache: "no-store" })
          .then(r => r.json())
          .then(j => {
            if (gen !== loadGenRef.current) return
            if (!j.ok) return
            const visibles = (j.data ?? []).filter((s: any) =>
              ESTADOS_VISIBLES_EMISION.has((s.estado ?? "").toLowerCase())
            )
            setSolicitudesCount(visibles.length)
          })
          .catch(() => {})
      }
    } catch { if (gen === loadGenRef.current) setError("Error de conexión al servidor") }
    finally { if (gen === loadGenRef.current) setLoading(false) }
  }, [filtro, user])

  useEffect(() => { cargar() }, [cargar])
  useRealtime(["filtro"], cargar)
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
          if (bandejaActual === "emision" && p.pendiente_emision_por_mi) return true
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
      if (!res.ok || !json.ok) { showToast("error", "Error al aprobar", json.error ?? "No se pudo aprobar la solicitud."); return }
      void cargar()
      setSuccessMsg({ title: "Solicitud enviada al siguiente filtro", description: "La solicitud fue procesada exitosamente y avanzó a la siguiente bandeja.", type: 'approve' })
    } catch { showToast("error", "Error de conexión", "No se pudo conectar con el servidor.") }
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
      if (!res.ok || !json.ok) { showToast("error", "Error al observar", json.error ?? "No se pudo registrar la observación."); return }
      setObservarTarget(null)
      userChangedTabRef.current = true
      setActiveTab("observadas")
      void cargar()
      setSuccessMsg({ title: "Solicitud marcada con observaciones", description: "La solicitud fue devuelta con observaciones a la URG.", type: 'observe' })
    } catch { showToast("error", "Error de conexión", "No se pudo conectar con el servidor.") }
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
      if (!res.ok || !json.ok) { showToast("error", "Error al aceptar", json.error ?? "No se pudo aceptar la solicitud."); return }
      showToast("success", "Solicitud aceptada", "La solicitud ha sido aceptada para revisión.")
      setSolicitudes(prev =>
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? "Aceptado por Revisor" } : s)
      )
    } catch { showToast("error", "Error de conexión", "No se pudo conectar con el servidor.") }
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
      if (!res.ok || !json.ok) { showToast("error", "Error al asignar revisor", json.error ?? "No se pudo asignar el revisor."); return }
      showToast("success", "Revisor asignado", "El revisor fue asignado correctamente.")
      setSolicitudes(prev =>
        prev.map(s => s.id === id ? { ...s, estado: json.estadoNuevo ?? s.estado } : s)
      )
      setAsignarRevisorTarget(null)
      setSelectedId(null)
    } catch { showToast("error", "Error de conexión", "No se pudo conectar con el servidor.") }
    finally { setGuardando(false) }
  }, [user])

  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = {
      nuevas: 0, correcciones: 0, revision: 0, observadas: 0,
      pendientes_asignacion: 0, en_validacion: 0, pendientes_firma: 0,
      todas: 0, solicitudes: 0,
    }
    c.todas = solicitudes.filter(s => classifySolicitud(s, filtro) !== "pendientes_firma").length
    solicitudes.forEach(s => {
      const tab = classifySolicitud(s, filtro)
      if (tab !== "todas") c[tab]++
    })
    if (filtro === 3) c.nuevas = solicitudes.filter(s => classifySolicitud(s, filtro) !== "todas").length
    c.pendientes_firma = pendientesFirmaCount
    c.solicitudes = solicitudesCount
    return c
  }, [solicitudes, filtro, pendientesFirmaCount, solicitudesCount])

  const filtered = useMemo(() =>
    solicitudes
      .filter(s => {
        const tab = classifySolicitud(s, filtro)
        if (filtro === 3 && tab === "todas") return false
        if (filtro === 3 && activeTab === "nuevas") return true
        if (activeTab !== "todas") return tab === activeTab
        if (tab === "pendientes_firma") return false
        if (filtro === 2) return tab !== "pendientes_asignacion"
        return true
      })
      .filter(s => {
        if (!searchTerm) return true
        const t = normalizeText(searchTerm)
        return (
          normalizeText(s.folioRecepcion ?? "").includes(t) ||
          normalizeText(formatearFolio(s.folioRecepcion)).includes(t) ||
          normalizeText(s.folioDictamen ?? "").includes(t) ||
          normalizeText(formatearFolio(s.folioDictamen)).includes(t) ||
          normalizeText(s.secretaria).includes(t) ||
          normalizeText(s.tipo).includes(t) ||
          normalizeText(s.denominacion ?? "").includes(t)
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

  useEffect(() => {
    if (filtro !== 1) return
    if (loading) return
    if (userChangedTabRef.current) return
    const desired: TabKey =
      tabCounts.nuevas > 0 ? "nuevas" : tabCounts.revision > 0 ? "revision" : "todas"
    if (activeTab !== desired) setActiveTab(desired)
  }, [filtro, loading, tabCounts, activeTab])

  useEffect(() => {
    if (filtro !== 2) return
    if (loading) return
    if (userChangedTabRef.current) return
    const desired: TabKey =
      tabCounts.pendientes_asignacion > 0 ? "pendientes_asignacion" : tabCounts.en_validacion > 0 ? "en_validacion" : "todas"
    if (activeTab !== desired) setActiveTab(desired)
  }, [filtro, loading, tabCounts, activeTab])

  useEffect(() => {
    if (filtro !== 3) return
    if (loading) return
    if (userChangedTabRef.current) return
    const desired: TabKey =
      tabCounts.revision > 0 ? "revision" : tabCounts.nuevas > 0 ? "nuevas" : "todas"
    if (activeTab !== desired) setActiveTab(desired)
  }, [filtro, loading, tabCounts, activeTab])

  useEffect(() => { setCurrentPage(1) }, [activeTab, filtro, searchTerm, filterRegimen])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const selectedSolicitud = selectedId ? solicitudes.find(s => s.id === selectedId) ?? null : null

  if (successMsg) return (
    <ActionResultScreen
      type={successMsg.type}
      title={successMsg.title}
      description={successMsg.description}
      onBack={() => { setSelectedId(null); setSuccessMsg(null) }}
    />
  )

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
    <>
    {actionToast && (
      <ConfirmToast key={actionToast.key} variant={actionToast.variant} title={actionToast.title} description={actionToast.description} />
    )}
    <PageLayout
      title={filtro === 1 ? "Bandeja en revisión" : filtro === 2 ? "Bandeja en validación" : "Bandeja en emisión"}
      description={filtro === 1
        ? "Revisa y analiza las solicitudes asignadas, realizando el primer filtro de revisión y observaciones."
        : filtro === 2
        ? "Valida y asigna las solicitudes, realizando el segundo filtro de revisión y observaciones."
        : "Gestiona la emisión de las solicitudes, realizando la dictaminación final y la generación de dictámenes u opiniones técnicas."}
    >

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
        onValueChange={(v) => { userChangedTabRef.current = true; setActiveTab(v as TabKey) }}
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
        <SearchInput
          placeholder="Buscar por folio, denominación, secretaría..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          containerClassName={`flex-1 ${SEARCH_INPUT_MAX_W_SM}`}
        />
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              {pendientesFirmaCount} solicitud{pendientesFirmaCount !== 1 ? "es" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  <tr className="bg-bg-base text-content-high">
                    <th className="px-4 py-3 text-left font-semibold">Estatus</th>
                    <th className="px-4 py-3 text-left font-semibold">Folio Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Régimen de Contratación</th>
                    <th className="px-4 py-3 text-left font-semibold">Secretaría</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Corrección</th>
                    <th className="px-4 py-3 text-left font-semibold">Ult. Observo</th>
                    <th className="px-4 py-3 text-left font-semibold">Plazo máximo de atención</th>
                    {!(filtro === 3 && activeTab === "nuevas") && (
                      <th className="px-4 py-3 font-semibold"><div className="flex justify-end">Acción</div></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={filtro === 3 && activeTab === "nuevas" ? 8 : 9}>
                        <EmptyState icon={Inbox} title="No hay solicitudes en esta clasificación" description="Ajusta los filtros para ver más resultados." />
                      </td>
                    </tr>
                  ) : paginated.map(sol => {
                    const tab    = classifySolicitud(sol, filtro)
                    const config = (filtro === 2 ? TAB_CONFIG_DO : filtro === 3 ? TAB_CONFIG_EMISION : TAB_CONFIG_REVISION)[tab]
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">

                        <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                            {filtro === 2 && tab === "pendientes_asignacion" && sol.revisorAsignado
                              ? <StatusBadge label="Pendiente de aceptación" color={C_AZUL_REVISION} bgColor={C_AZUL_REVISION_BG} />
                              : filtro === 3 && tab === "pendientes_firma"
                              ? <StatusBadge label="En firma" color={config.badgeStyle.color as string} bgColor={config.badgeStyle.backgroundColor as string} />
                              : <StatusBadge label={config.label} color={config.badgeStyle.color as string} bgColor={config.badgeStyle.backgroundColor as string} />
                            }
                            {((filtro === 1 && sol.estado.toLowerCase() === "observado por validacion final") ||
                              (filtro === 2 && sol.estado.toLowerCase().includes("observado por emisor"))) && (
                              <StatusBadge label="Observado" color={C_ROSA_VINO} bgColor={C_ROSA_VINO_BG} />
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <div className="flex flex-col gap-1">
                            {sol.folioRecepcion
                              ? <span className="font-mono">{formatearFolio(sol.folioRecepcion)}</span>
                              : <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] break-words">
                          <span className="line-clamp-2">{formatRegimen(sol._raw?.regimen)}</span>
                        </td>

                        {}
                        <td className="px-4 py-3 text-muted-foreground text-xs break-words max-w-[200px]">{sol.secretaria}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {sol.fechaRecepcionDO
                            ? (() => { const [y,m,d] = sol.fechaRecepcionDO!.split("-"); return new Date(+y,+m-1,+d).toLocaleDateString("es-MX") })()
                            : "---"}
                        </td>
                        <td className="px-4 py-3">
                          {sol.lastObservedDate ? (
                            <span className="text-xs text-card-foreground">{sol.lastObservedDate}</span>
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                                  <img src="/iconos2/visibility.svg" alt="ver" className="h-4 w-4" />Ver
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
                                className="gap-1.5 font-medium"
                                style={{ color: "var(--sem-content-low)" }}
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
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      <ConfirmAlertDialog
        open={!!aprobarTarget}
        onOpenChange={(v) => { if (!v) setAprobarTarget(null) }}
        onConfirm={() => { if (aprobarTarget) handleAprobar(aprobarTarget) }}
        title={(() => {
          const sol = solicitudes.find(s => s.id === aprobarTarget)
          if (filtro === 3 && sol?.estado.toLowerCase().includes("pendiente firma dictamen"))
            return "¿Firmar dictamen y emitir?"
          return "¿Aprobar y avanzar al siguiente paso?"
        })()}
        description={<>La solicitud <strong className="font-semibold">{formatearFolio(solicitudes.find(s => s.id === aprobarTarget)?.folioRecepcion)}</strong> avanzará al siguiente paso del proceso.</>}
        confirmLabel="Sí, confirmar"
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
    </>
  )
}