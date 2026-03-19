"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Eye, CheckCircle2, RotateCcw, Download, History, FileText, Inbox,
  AlertTriangle, ChevronDown, ChevronRight, ArrowLeft, FileCheck,
  Info, RefreshCw, Loader2, HelpCircle,
} from "lucide-react"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import { useAuth } from "@/lib/auth-context"

type UefaEstado = string

type UefaTab =
  | "Nuevas"
  | "En proceso DO"
  | "Observadas por UEFA"
  | "Devueltas por DO"
  | "Emitidas"
  | "Todas"

interface HistorialEntry { fecha: string; usuario: string; accion: string }

interface UefaSolicitud {
  id: number
  folio: string
  folioJustificacion: string
  tipo: string
  secretaria: string
  fecha: string
  estado: UefaEstado
  denominacion: string
  unidadAdministrativa: string
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior?: string
  historial: HistorialEntry[]
  observacionesUefa: string
  numeroDictamen?: string
  fechaDictamen?: string
  // Campos de contenido
  objeto: string
  actividades: string[]
  responsabilidades: string[]
  escolaridad: string
  compAdm: string
  compTec: string
  compSoc: string
  valores: string
  areasExp: string
  _raw?: any
}

function formatFecha(v: string | null | undefined) {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatFechaHora(v: string | null | undefined) {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getTabForEstado(estado: string): UefaTab {
  const n = norm(estado)

  if (n === "en captura" || n.includes("enviada a validacion")) return "Nuevas"
  if (n.includes("en revision") || n === "aprobado") return "En proceso DO"
  if (
    (n.includes("observada") || n.includes("observado")) &&
    (n.includes("filtro") || n.includes("do"))
  ) {
    if (!n.includes("por uefa")) return "Devueltas por DO"
  }
  if (n.includes("observad") && n.includes("uefa")) return "Observadas por UEFA"
  if (n === "emitido") return "Emitidas"

  return "Nuevas"
}

function mapBDtoSolicitud(item: any): UefaSolicitud {
  const historial: HistorialEntry[] = (item.historial_solicitud ?? []).map((h: any) => ({
    fecha:   formatFechaHora(h.fecha),
    usuario: h.usuario?.nombre ?? "Sistema",
    accion:  h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? h.comentario ?? "—",
  }))

  return {
    id:                   item.id,
    folio:                item.folio_recepcion ?? `SOL-${item.id}`,
    folioJustificacion:   item.folio_justificacion
      ?? `JUST-${new Date(item.fecha_creacion ?? Date.now()).getFullYear()}-${String(item.id).padStart(4, "0")}`,
    tipo:                 item.tipo_solicitud ?? "—",
    // Secretaria: primero el campo directo de BD, luego el área del usuario
    secretaria:           item.secretaria ?? item.usuario?.area?.nombre ?? "—",
    fecha:                item.fecha_creacion ? formatFecha(item.fecha_creacion) : "—",
    // Vigencias directas de BD
    vigenciaInicio:       item.vigencia_inicio ? formatFecha(item.vigencia_inicio) : "—",
    vigenciaFin:          item.vigencia_fin    ? formatFecha(item.vigencia_fin)    : "—",
    // Importe formateado
    importeBruto:         item.importe_bruto
      ? `$${Number(item.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—",
    estado:               item.estado?.nombre ?? "En Captura",
    denominacion:         item.denominacion ?? item.tipo_solicitud ?? "—",
    unidadAdministrativa: item.unidad_administrativa ?? item.usuario?.area?.nombre ?? "—",
    esRenovacion:         item.es_renovacion ?? false,
    folioAnterior:        item.folio_anterior ?? undefined,
    // Campos de contenido mapeados directamente desde BD
    objeto:               item.objeto ?? "—",
    actividades:          Array.isArray(item.actividades) ? item.actividades.filter(Boolean) : [],
    responsabilidades:    Array.isArray(item.responsabilidades) ? item.responsabilidades.filter(Boolean) : [],
    escolaridad:          item.escolaridad ?? "—",
    compAdm:              item.comp_adm ?? "—",
    compTec:              item.comp_tec ?? "—",
    compSoc:              item.comp_soc ?? "—",
    valores:              item.valores ?? "—",
    areasExp:             item.areas_exp ?? "—",
    historial,
    observacionesUefa:    "",
    _raw:                 item,
  }
}

function UefaEstadoBadge({ estado }: { estado: string }) {
  const tab = getTabForEstado(estado)
  const n   = norm(estado)

  const colores: Record<UefaTab, { bg: string; text: string }> = {
    "Nuevas":              { bg: "bg-secondary/15",   text: "text-secondary" },
    "En proceso DO":       { bg: "bg-accent/15",      text: "text-accent-foreground" },
    "Observadas por UEFA": { bg: "bg-destructive/15", text: "text-destructive" },
    "Devueltas por DO":    { bg: "bg-orange-500/15",  text: "text-orange-600" },
    "Emitidas":            { bg: "bg-primary/15",     text: "text-primary" },
    "Todas":               { bg: "bg-muted",          text: "text-muted-foreground" },
  }
  const { bg, text } = colores[tab] ?? { bg: "bg-muted", text: "text-muted-foreground" }

  let label = estado
  if (n === "en captura")            label = "Enviada a Validacion (UEFA)"
  else if (n === "aprobado")         label = "Aprobado – Pendiente Emisión"
  else if (n.includes("observada filtro 1") || n.includes("observado do filtro 1")) label = "Devuelta por DO (Filtro 1)"
  else if (n.includes("observada filtro 2") || n.includes("observado do filtro 2")) label = "Devuelta por DO (Filtro 2)"
  else if (n.includes("observada filtro 3")) label = "Devuelta por DO (Filtro 3)"

  return (
    <Badge className={`${bg} ${text} border-0 text-xs whitespace-nowrap`}>
      {label}
    </Badge>
  )
}

function UefaHistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
  if (!historial.length) return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>
  return (
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
          {num && <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">{num}</span>}
          {icon}{title}
          <span className="ml-auto">{open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</span>
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

function ListaItems({ items }: { items: string[] }) {
  const validItems = items.filter(Boolean)
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

function ExpedienteGenerico({ solicitud }: { solicitud: UefaSolicitud }) {
  const raw = solicitud._raw
  return (
    <div className="flex flex-col gap-4">
      {/* I. Datos Generales */}
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría"                          value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Responsable del Gasto"        value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Régimen de Contratación"             value={solicitud.tipo} />
          <ReadOnlyField label="Número de Prestadores de Servicio"   value={raw?.numero_prestadores?.toString() ?? "—"} />
          <ReadOnlyField label="Vigencia Inicio"                     value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                    value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Bruto"                       value={solicitud.importeBruto} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción" value={raw?.unidad_responsable ?? solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Programa o Proyecto"                 value={raw?.programa_proyecto ?? "—"} />
          <ReadOnlyField label="Denominación"                        value={solicitud.denominacion} />
        </div>
      </SectionCard>

      {/* Renovación */}
      <SectionCard title="Renovación">
        <div className="flex flex-col gap-3">
          <ReadOnlyField label="¿Es Renovación?" value={solicitud.esRenovacion ? "SÍ" : "NO"} />
          {solicitud.esRenovacion && solicitud.folioAnterior && (
            <ReadOnlyField label="Folio Anterior" value={solicitud.folioAnterior} />
          )}
        </div>
      </SectionCard>

      {/* I.1 Objeto */}
      <SectionCard title="I.1 Objeto de la Contratación">
        <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
          {solicitud.objeto && solicitud.objeto !== "—" ? solicitud.objeto : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>

      {/* I.2 Actividades */}
      <SectionCard title="I.2 Actividades a Realizar">
        <ListaItems items={solicitud.actividades} />
      </SectionCard>

      {/* I.3 Responsabilidades */}
      <SectionCard title="I.3 Responsabilidades">
        <ListaItems items={solicitud.responsabilidades} />
      </SectionCard>

      {/* Perfil */}
      <SectionCard title="Perfil">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Escolaridad Mínima"           value={solicitud.escolaridad} />
          <ReadOnlyField label="Competencias Administrativas"  value={solicitud.compAdm} />
          <ReadOnlyField label="Competencias Técnicas"         value={solicitud.compTec} />
          <ReadOnlyField label="Competencias Sociales"         value={solicitud.compSoc} />
          <ReadOnlyField label="Valores"                       value={solicitud.valores} />
          <ReadOnlyField label="Áreas de Experiencia"          value={solicitud.areasExp} />
        </div>
      </SectionCard>

      {/* Documentos */}
      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        {raw?.adjunto?.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {raw.adjunto.map((adj: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm text-card-foreground">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                {adj.nombre_archivo}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin documentos adjuntos.</p>
        )}
      </SectionCard>
    </div>
  )
}

function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel, confirmVariant = "default", icon }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel: string
  confirmVariant?: "default" | "destructive"; icon?: React.ReactNode
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
          <Button onClick={onConfirm} className={confirmVariant === "destructive"
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"}>
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
  const [obs,  setObs]  = useState("")
  const handleClose = () => { setStep("confirm"); setObs(""); onClose() }

  if (step === "confirm") return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <HelpCircle className="h-5 w-5 text-destructive" />¿Estás seguro de observar?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Vas a marcar <strong>{folio}</strong> con observaciones. Se enviará de regreso a la URG.</p>
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

function DetalleView({ solicitud, onBack, onAprobar, onObservar, guardando }: {
  solicitud: UefaSolicitud; onBack: () => void
  onAprobar: (id: number) => void; onObservar: (id: number) => void; guardando: boolean
}) {
  const [showObservarModal,  setShowObservarModal]  = useState(false)
  const [showAprobarConfirm, setShowAprobarConfirm] = useState(false)

  const tab         = getTabForEstado(solicitud.estado)
  const isNueva     = tab === "Nuevas"
  const isEmitida   = norm(solicitud.estado) === "emitido"
  const isDevuelta  = tab === "Devueltas por DO"
  const isEnProceso = tab === "En proceso DO"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-card-foreground">
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-semibold text-card-foreground">{solicitud.folioJustificacion}</span>
          <UefaEstadoBadge estado={solicitud.estado} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateJustificacionPDF({
            folio: solicitud.folioJustificacion, tipo: solicitud.tipo as any,
            secretaria: solicitud.secretaria, unidadAdministrativa: solicitud.unidadAdministrativa,
            denominacion: solicitud.denominacion, vigenciaInicio: solicitud.vigenciaInicio,
            vigenciaFin: solicitud.vigenciaFin, importeBruto: solicitud.importeBruto,
            esRenovacion: solicitud.esRenovacion, folioAnterior: solicitud.folioAnterior,
            fecha: solicitud.fecha, firmadoDigitalmente: !isNueva,
          })}>
            <Download className="h-4 w-4" />Justificación (PDF)
          </Button>
          {isNueva && (
            <>
              <Button
                onClick={() => setShowAprobarConfirm(true)}
                disabled={guardando}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                size="sm"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprobar → Filtro 1
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowObservarModal(true)}
                disabled={guardando}
                className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="h-4 w-4" />Observar
              </Button>
            </>
          )}
          {isEmitida && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5"><FileCheck className="h-4 w-4" />Ver Dictamen</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-4 w-4" />Descargar</Button>
            </>
          )}
        </div>
      </div>

      {isDevuelta && (
        <Card className="border-2 border-orange-500/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <span className="text-sm font-medium text-orange-600">Devuelta por DO</span>
              <p className="text-xs text-muted-foreground">Observada por un filtro DO. Pendiente de corrección por la URG.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isEnProceso && (
        <Card className="border-2 border-accent/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <Info className="h-5 w-5 text-accent-foreground" />
            <div>
              <span className="text-sm font-medium text-accent-foreground">En proceso DO</span>
              <p className="text-xs text-muted-foreground">La solicitud está siendo revisada por DO. Solo lectura.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {solicitud.observacionesUefa && (
        <Card className="border-2 border-destructive/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-destructive">Observaciones UEFA</span>
              <p className="text-sm text-card-foreground mt-1">{solicitud.observacionesUefa}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isEmitida && solicitud.numeroDictamen && (
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <FileCheck className="h-5 w-5 text-primary" />
            <div>
              <span className="text-sm font-medium text-primary">Dictamen Emitido</span>
              <p className="text-xs text-muted-foreground">No. {solicitud.numeroDictamen} — {solicitud.fechaDictamen}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ExpedienteGenerico solicitud={solicitud} /></div>
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <History className="h-4 w-4 text-secondary" />Historial
              </CardTitle>
            </CardHeader>
            <CardContent><UefaHistorialTimeline historial={solicitud.historial} /></CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={showAprobarConfirm}
        onClose={() => setShowAprobarConfirm(false)}
        onConfirm={() => { setShowAprobarConfirm(false); onAprobar(solicitud.id) }}
        title="¿Aprobar y enviar a Filtro 1?"
        description={`La solicitud ${solicitud.folioJustificacion} será enviada a revisión DO Filtro 1.`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={showObservarModal}
        onClose={() => setShowObservarModal(false)}
        onConfirm={() => { setShowObservarModal(false); onObservar(solicitud.id) }}
        folio={solicitud.folioJustificacion}
      />
    </div>
  )
}

export function ValidacionUefaPage() {
  const { user } = useAuth()

  const [solicitudes,      setSolicitudes]      = useState<UefaSolicitud[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [guardando,        setGuardando]        = useState(false)
  const [activeTab,        setActiveTab]        = useState<UefaTab>("Nuevas")
  const [selectedId,       setSelectedId]       = useState<number | null>(null)
  const [observarTargetId, setObservarTargetId] = useState<number | null>(null)
  const [aprobarTargetId,  setAprobarTargetId]  = useState<number | null>(null)

  // ── Carga todas las solicitudes ──────────────────────────────────────────
  const cargarSolicitudes = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch("/api/solicitudes?estado=todos")
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar solicitudes"); return }
      setSolicitudes((json.data ?? []).map(mapBDtoSolicitud))
    } catch { setError("Error de conexión al servidor") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargarSolicitudes() }, [cargarSolicitudes])

  // ── Aprobar ───────────────────────────────────────────────────────────────
  const handleAprobar = useCallback(async (id: number) => {
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: id,
          nuevoEstado: "En revision DO Filtro 1",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  "Aprobada por UEFA → Filtro 1",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al aprobar"); return }

      setSolicitudes(prev => prev.map(s => s.id === id ? {
        ...s,
        estado: "En revision DO Filtro 1",
        historial: [...s.historial, {
          fecha:   formatFechaHora(new Date().toISOString()),
          usuario: (user as any)?.nombre ?? "UEFA",
          accion:  "Aprobada por UEFA → Filtro 1",
        }],
      } : s))
      setSelectedId(null)
    } catch { alert("Error de conexión al aprobar") }
    finally { setGuardando(false); setAprobarTargetId(null) }
  }, [user])

  // ── Observar ──────────────────────────────────────────────────────────────
  const handleObservarConfirm = useCallback(async (obs: string) => {
    if (!observarTargetId) return
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: observarTargetId,
          nuevoEstado: "Observado por UEFA",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  obs,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al observar"); return }

      setSolicitudes(prev => prev.map(s => s.id === observarTargetId ? {
        ...s,
        estado: "Observado por UEFA",
        observacionesUefa: obs,
        historial: [...s.historial, {
          fecha:   formatFechaHora(new Date().toISOString()),
          usuario: (user as any)?.nombre ?? "UEFA",
          accion:  `Observada por UEFA — ${obs.substring(0, 60)}${obs.length > 60 ? "..." : ""}`,
        }],
      } : s))
      setObservarTargetId(null); setSelectedId(null)
    } catch { alert("Error de conexión al observar") }
    finally { setGuardando(false) }
  }, [observarTargetId, user])

  const tabDefs: { key: UefaTab; label: string }[] = [
    { key: "Nuevas",              label: "Nuevas" },
    { key: "En proceso DO",       label: "En proceso DO" },
    { key: "Observadas por UEFA", label: "Observadas por UEFA" },
    { key: "Devueltas por DO",    label: "Devueltas por DO" },
    { key: "Emitidas",            label: "Emitidas" },
    { key: "Todas",               label: "Todas" },
  ]

  const tabCounts = useMemo(() => {
    const counts: Record<UefaTab, number> = {
      "Nuevas": 0, "En proceso DO": 0, "Observadas por UEFA": 0,
      "Devueltas por DO": 0, "Emitidas": 0, "Todas": solicitudes.length,
    }
    for (const s of solicitudes) {
      const t = getTabForEstado(s.estado) as UefaTab
      counts[t] = (counts[t] ?? 0) + 1
    }
    return counts
  }, [solicitudes])

  const filtered = useMemo(() =>
    activeTab === "Todas" ? solicitudes : solicitudes.filter(s => getTabForEstado(s.estado) === activeTab),
    [solicitudes, activeTab]
  )

  const selectedSolicitud = selectedId !== null
    ? solicitudes.find(s => s.id === selectedId) ?? null
    : null

  if (selectedSolicitud) return (
    <div className="flex flex-col gap-6">
      <DetalleView
        solicitud={selectedSolicitud}
        onBack={() => setSelectedId(null)}
        onAprobar={handleAprobar}
        onObservar={id => setObservarTargetId(id)}
        guardando={guardando}
      />
      <ObservarModal
        open={!!observarTargetId}
        onClose={() => setObservarTargetId(null)}
        onConfirm={handleObservarConfirm}
        folio={solicitudes.find(s => s.id === observarTargetId)?.folioJustificacion ?? ""}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Bandeja de Validacion UEFA</h2>
          <p className="text-sm text-muted-foreground">Solicitudes enviadas por las URG para validacion y seguimiento</p>
        </div>
        <Button variant="outline" size="sm" onClick={cargarSolicitudes} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Actualizar
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargarSolicitudes} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {tabDefs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border hover:bg-muted hover:text-card-foreground"
            }`}
          >
            {tab.label}
            <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
              activeTab === tab.key
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Inbox className="h-4 w-4 text-secondary" />
            {loading
              ? "Cargando solicitudes..."
              : `${filtered.length} solicitud${filtered.length !== 1 ? "es" : ""}`}
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
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Folio de Justificación</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha de Creación</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha de Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado actual</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sol => {
                    const solTab = getTabForEstado(sol.estado)
                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-card-foreground">{sol.folioJustificacion}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.tipo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.fecha}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.vigenciaInicio}</td>
                        <td className="px-4 py-3"><UefaEstadoBadge estado={sol.estado} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setSelectedId(sol.id)}
                              className="text-secondary hover:text-primary gap-1.5"
                            >
                              <Eye className="h-4 w-4" />Ver
                            </Button>
                            {solTab === "Nuevas" && (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setAprobarTargetId(sol.id)}
                                  disabled={guardando}
                                  className="text-primary hover:text-primary/80 gap-1.5"
                                >
                                  <CheckCircle2 className="h-4 w-4" />Aprobar
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setObservarTargetId(sol.id)}
                                  disabled={guardando}
                                  className="text-destructive hover:text-destructive/80 gap-1.5"
                                >
                                  <RotateCcw className="h-4 w-4" />Observar
                                </Button>
                              </>
                            )}
                            {solTab === "Emitidas" && (
                              <>
                                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                                  <FileCheck className="h-4 w-4" />Ver Dictamen
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                                  <Download className="h-4 w-4" />Descargar
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox className="h-8 w-8 text-muted-foreground/40" />
                          <span>No hay solicitudes en esta categoría</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales globales (desde la tabla) */}
      <ConfirmModal
        open={!!aprobarTargetId}
        onClose={() => setAprobarTargetId(null)}
        onConfirm={() => { if (aprobarTargetId) handleAprobar(aprobarTargetId) }}
        title="¿Aprobar y enviar a Filtro 1?"
        description={`La solicitud ${solicitudes.find(s => s.id === aprobarTargetId)?.folioJustificacion ?? ""} será enviada a revisión DO Filtro 1.`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={!!observarTargetId}
        onClose={() => setObservarTargetId(null)}
        onConfirm={handleObservarConfirm}
        folio={solicitudes.find(s => s.id === observarTargetId)?.folioJustificacion ?? ""}
      />
    </div>
  )
}