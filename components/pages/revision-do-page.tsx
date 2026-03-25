"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PageLayout } from "@/components/page-layout"
import {
  ArrowLeft, Clock, FileText, AlertCircle, CheckCircle2, XCircle,
  History, MessageSquare, ClipboardCheck, Eye, Info, MinusCircle,
  ChevronDown, ChevronRight, Send, Download, Upload, Lock, Stamp,
  Users, Printer, Shield, Loader2,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"

// tiṕos
interface HistorialEntry {
  fecha: string
  usuario: string
  accion: string
  estadoAnterior: string | null
  estadoNuevo: string
}

interface SolicitudDetalle {
  id: number
  folio: string
  folioJustificacion: string
  folioDictamen: string | null
  tipo: string
  secretaria: string
  unidadAdministrativa: string
  solicitante: string
  correo: string
  estado: string
  periodo: string
  fechaCreacion: string
  fechaEnvio: string | null
  esExtemporanea: boolean
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior: string | null
  slaRestante: number | null
  historial: HistorialEntry[]
  observacionesPrevias: string[]
  checklistDO: Record<string, { valor: "si" | "no" | "noAplica" | null; observacion: string }>
  _raw: any
}

type ChecklistValor = "si" | "no" | "noAplica" | null
type ActiveTab = "review" | "emision" | "historial"

interface RevisionDOPageProps {
  solicitudId: string
  filtro: 1 | 2 | 3
  onBack: (filtro: 1 | 2 | 3) => void
}

interface ChecklistItem { key: string; num: number; label: string }
const CHECKLIST_BASE: ChecklistItem[] = [
  { key: "c1",  num: 1,  label: "Oficio de solicitud con firma autógrafa del titular" },
  { key: "c2",  num: 2,  label: "Datos de la Unidad Responsable del Gasto (URG)" },
  { key: "c3",  num: 3,  label: "Programa o proyecto al que se adscribe" },
  { key: "c4",  num: 4,  label: "Régimen de contratación especificado" },
  { key: "c5",  num: 5,  label: "Tipo de actividades indicado" },
  { key: "c6",  num: 6,  label: "Número de prestadores de servicio" },
  { key: "c7",  num: 7,  label: "Denominación del puesto/servicio" },
  { key: "c8",  num: 8,  label: "Vigencia de inicio y término" },
  { key: "c9",  num: 9,  label: "Importe bruto mensual especificado" },
  { key: "c10", num: 10, label: "Objeto de la contratación descrito" },
  { key: "c11", num: 11, label: "Actividades a realizar detalladas" },
  { key: "c12", num: 12, label: "Responsabilidades definidas" },
  { key: "c13", num: 13, label: "Perfil del prestador especificado (escolaridad)" },
  { key: "c14", num: 14, label: "Competencias administrativas listadas" },
  { key: "c15", num: 15, label: "Competencias técnicas listadas" },
  { key: "c16", num: 16, label: "Suficiencia presupuestal acreditada" },
]

const CHECKLIST_NOMBRAMIENTO_EXTRA: ChecklistItem[] = [
  { key: "c17", num: 17, label: "Nivel y categoría del tabulador indicados" },
  { key: "c18", num: 18, label: "Marco normativo referenciado" },
  { key: "c19", num: 19, label: "Condiciones de disponibilidad especificadas" },
]

function getChecklistItems(tipo: string): ChecklistItem[] {
  if (tipo === "Nombramiento Tiempo Det.") {
    return [...CHECKLIST_BASE, ...CHECKLIST_NOMBRAMIENTO_EXTRA]
  }
  return CHECKLIST_BASE
}


function formatFecha(v: string | null | undefined): string {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatFechaHora(v: string | null | undefined): string {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function diasHabilesDesde(fechaStr: string | null): number | null {
  if (!fechaStr) return null
  const inicio = new Date(fechaStr)
  const hoy    = new Date()
  if (isNaN(inicio.getTime())) return null
  let dias = 0
  const cur = new Date(inicio)
  while (cur <= hoy) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) dias++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(0, 15 - dias)
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
  if (dias <= 0) return `Vencido`
  return `${dias} día${dias !== 1 ? "s" : ""}`
}


function mapBDtoDetalle(item: any): SolicitudDetalle {
  const historial: HistorialEntry[] = (item.historial_solicitud ?? []).map((h: any) => ({
    fecha:         formatFechaHora(h.fecha),
    usuario:       h.usuario?.nombre ?? "Sistema",
    accion:        h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? h.comentario ?? "—",
    estadoAnterior: h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? null,
    estadoNuevo:   h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
  }))

  const observacionesPrevias = (item.historial_solicitud ?? [])
    .filter((h: any) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      return /observad/i.test(nombre) && h.comentario
    })
    .map((h: any) => h.comentario as string)

  const fechaEnvio = item.fecha_envio ?? item.fecha_recepcion ?? item.fecha_creacion ?? null

  return {
    id:                  item.id,
    folio:               item.folio_recepcion ?? `SOL-${item.id}`,
    folioJustificacion:  item.folio_justificacion
      ?? `JUST-${new Date(item.fecha_creacion ?? Date.now()).getFullYear()}-${String(item.id).padStart(4, "0")}`,
    folioDictamen:       item.dictamen?.folio ?? item.folio_dictamen ?? null,
    tipo:                item.tipo_solicitud ?? "—",
    secretaria:          item.usuario?.area?.nombre ?? "—",
    unidadAdministrativa: item.usuario?.area?.nombre ?? "—",
    solicitante:         item.usuario?.nombre ?? "—",
    correo:              item.usuario?.correo ?? "—",
    estado:              item.estado?.nombre ?? "—",
    periodo:             item.periodo ? `${item.periodo.mes}/${item.periodo.anio}` : "—",
    fechaCreacion:       formatFecha(item.fecha_creacion),
    fechaEnvio,
    esExtemporanea:      item.es_extemporanea ?? false,
    vigenciaInicio:      formatFecha(fechaEnvio),
    vigenciaFin:         "—",
    importeBruto:        "—",
    esRenovacion:        false,
    folioAnterior:       null,
    slaRestante:         diasHabilesDesde(fechaEnvio),
    historial,
    observacionesPrevias,
    checklistDO:         {},
    _raw:                item,
  }
}


function SlaIndicatorLarge({ diasRestantes }: { diasRestantes: number | null }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 ${getSlaBackground(diasRestantes)}`}>
      <Clock className={`h-5 w-5 ${getSlaColor(diasRestantes)}`} />
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${getSlaColor(diasRestantes)}`}>{getSlaLabel(diasRestantes)}</span>
        <span className="text-[10px] text-muted-foreground">SLA (15 días hábiles)</span>
      </div>
    </div>
  )
}

function HistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
  if (!historial.length) return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>
  return (
    <div className="flex flex-col gap-0">
      {[...historial].reverse().map((entry, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card">
              <div className="h-2 w-2 rounded-full bg-secondary" />
            </div>
            {i < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex flex-col gap-0.5 pb-4">
            <span className="text-xs font-medium text-card-foreground">{entry.accion}</span>
            <span className="text-[10px] text-muted-foreground">{entry.fecha} — {entry.usuario}</span>
            {entry.estadoAnterior && (
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.estadoAnterior}</Badge>
                <span className="text-[10px] text-muted-foreground">→</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.estadoNuevo}</Badge>
              </div>
            )}
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

function ReadOnlyList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[10px] font-medium text-secondary">{i + 1}</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function RadioOption({ value, selected, onChange, label, colorClass }: {
  value: string; selected: boolean; onChange: () => void; label: string; colorClass: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
        selected ? `${colorClass} border-current` : "border-border text-muted-foreground hover:border-foreground/30 hover:text-card-foreground"
      }`}
    >
      {value === "si"      && <CheckCircle2 className="h-3.5 w-3.5" />}
      {value === "no"      && <XCircle className="h-3.5 w-3.5" />}
      {value === "noAplica"&& <MinusCircle className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

function ExpedienteGenerico({ sol }: { sol: SolicitudDetalle }) {
  const raw = sol._raw
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Folio de Recepción"        value={sol.folio} />
          <ReadOnlyField label="Folio de Justificación"    value={sol.folioJustificacion} />
          <ReadOnlyField label="Tipo de Solicitud"         value={sol.tipo} />
          <ReadOnlyField label="Secretaría / Área"         value={sol.secretaria} />
          <ReadOnlyField label="Solicitante"               value={sol.solicitante} />
          <ReadOnlyField label="Correo"                    value={sol.correo} />
          <ReadOnlyField label="Período"                   value={sol.periodo} />
          <ReadOnlyField label="Fecha de Creación"         value={sol.fechaCreacion} />
          <ReadOnlyField label="Fecha de Recepción DO"     value={sol.vigenciaInicio} />
          <ReadOnlyField label="Extemporánea"              value={sol.esExtemporanea ? "Sí" : "No"} />
          {sol.folioDictamen && (
            <ReadOnlyField label="Folio de Dictamen"       value={sol.folioDictamen} />
          )}
        </div>
      </SectionCard>

      {/* Actividades / Funciones según tipo */}
      {sol.tipo === "Prestacion de Servicios" && (
        <>
          <SectionCard title="I.1 Objeto de la Contratación">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Prestación de servicios profesionales para el desarrollo, implementación y seguimiento de actividades especializadas en el marco del programa institucional correspondiente.
            </p>
          </SectionCard>
          <SectionCard title="I.2 Actividades a Realizar">
            <ReadOnlyList items={["Coordinar y ejecutar actividades del programa", "Elaborar informes periódicos de avance", "Supervisar el cumplimiento de metas"]} />
          </SectionCard>
          <SectionCard title="I.3 Responsabilidades">
            <ReadOnlyList items={["Cumplir con los plazos establecidos", "Reportar avances semanales al superior jerárquico"]} />
          </SectionCard>
        </>
      )}

      {sol.tipo === "Nombramiento Tiempo Det." && (
        <>
          <SectionCard title="I.1 Objeto del Nombramiento">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nombramiento por tiempo determinado para cubrir necesidades operativas y administrativas del área solicitante, conforme al tabulador autorizado.
            </p>
          </SectionCard>
          <SectionCard title="I.2 Funciones Principales">
            <ReadOnlyList items={["Coordinar procesos administrativos del área", "Supervisar personal operativo", "Elaborar reportes de gestión"]} />
          </SectionCard>
          <SectionCard title="I.3 Marco Normativo">
            <ReadOnlyList items={["Ley Orgánica de la Administración Pública", "Reglamento Interior de la Secretaría", "Lineamientos de Contratación vigentes"]} />
          </SectionCard>
        </>
      )}

      <SectionCard num="II" title="Perfil Requerido">
        <div className="flex flex-col gap-3">
          <ReadOnlyField label="Escolaridad Mínima" value="Licenciatura" />
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Áreas de Experiencia</span>
            <ReadOnlyList items={["Administración Pública", "Tecnologías de la Información"]} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        {(raw?.adjunto ?? []).length > 0 ? (
          <div className="flex flex-col gap-2">
            {(raw.adjunto as any[]).map((adj: any, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <FileText className="h-8 w-8 text-secondary" />
                <div>
                  <p className="text-sm font-medium text-card-foreground">{adj.nombre_archivo}</p>
                  <p className="text-xs text-muted-foreground">{adj.tipo ?? "PDF"} — {formatFecha(adj.fecha_subida)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin documentos adjuntos registrados.</p>
        )}
      </SectionCard>
    </div>
  )
}

// destinatario para el panel de emisión

const AVAILABLE_DESTINATARIOS = [
  "URG-01 Oficina del Secretario", "URG-02 Dirección General", "URG-03 Coordinación Administrativa",
  "UEFA Sec. de Finanzas", "UEFA Sec. de Educación", "UEFA Sec. de Salud",
  "UEFA Sec. de Gobierno", "UEFA Sec. de Obras", "UEFA Sec. de Desarrollo",
  "Dir. Gral. de Administración y Finanzas", "Dir. Gral. de Profesionalización", "Dir. Gral. de Recursos Humanos",
]
export function RevisionDOPage({ solicitudId, filtro, onBack }: RevisionDOPageProps) {
  const { user } = useAuth()
  const [solicitud,  setSolicitud]  = useState<SolicitudDetalle | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [guardando,  setGuardando]  = useState(false)
  const [activeTab,          setActiveTab]          = useState<ActiveTab>("review")
  const [observacionGeneral, setObservacionGeneral] = useState("")
  const [observacionError,   setObservacionError]   = useState("")
  const [sinObservacion,     setSinObservacion]     = useState(false)
  const [showEmitConfirm,    setShowEmitConfirm]    = useState(false)
  const [showConfirmacion,   setShowConfirmacion]   = useState<string | null>(null)
  const [checklistErrors,    setChecklistErrors]    = useState<Record<string, boolean>>({})

  // Emisión (Filtro 3)
  const today = new Date().toISOString().slice(0, 10)
  const [fechaDictaminacion,   setFechaDictaminacion]   = useState(today)
  const [modalidadFirma,       setModalidadFirma]       = useState<"electronica" | "autografa">("electronica")
  const [selectedDestinatarios,setSelectedDestinatarios]= useState<string[]>([])
  const [archivoSubido,        setArchivoSubido]        = useState(false)
  const [autografaDescargado,  setAutografaDescargado]  = useState(false)

  // Fetch solicitud por ID
  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/filtro?filtro=${filtro}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }

      const item = (json.data ?? []).find((d: any) => String(d.id) === String(solicitudId))
      if (!item) {
        const res2  = await fetch(`/api/solicitudes?id=${solicitudId}`)
        const json2 = await res2.json()
        const item2 = json2.ok ? (json2.data ?? []).find((d: any) => String(d.id) === String(solicitudId)) : null
        if (item2) { setSolicitud(mapBDtoDetalle(item2)); return }
        setError("Solicitud no encontrada en este filtro")
        return
      }
      const mapped = mapBDtoDetalle(item)
      setSolicitud(mapped)
      if (filtro === 3) {
        const urgDefault = "URG-01 Oficina del Secretario"
        const uefaMatch = AVAILABLE_DESTINATARIOS.find(d => d.includes(mapped.secretaria.replace("Sec. de ", "")))
        setSelectedDestinatarios([urgDefault, ...(uefaMatch ? [uefaMatch] : [])])
      }
    } catch { setError("Error de conexión al servidor") }
    finally { setLoading(false) }
  }, [solicitudId, filtro])

  useEffect(() => { cargar() }, [cargar])
  const updateChecklist = useCallback((key: string, valor: ChecklistValor, obs?: string) => {
    setSolicitud(prev => {
      if (!prev) return prev
      const current = prev.checklistDO[key] ?? { valor: null, observacion: "" }
      return {
        ...prev,
        checklistDO: {
          ...prev.checklistDO,
          [key]: {
            valor:       valor !== undefined ? valor : current.valor,
            observacion: obs !== undefined   ? obs   : current.observacion,
          },
        },
      }
    })
  }, [])

  const checklistItems = useMemo(() => solicitud ? getChecklistItems(solicitud.tipo) : [], [solicitud])

  const checklistStats = useMemo(() => {
    if (!solicitud) return { completed: 0, total: 0, hasNo: false, noCount: 0, allDone: false, noWithoutObs: 0 }
    const total = checklistItems.length
    let completed = 0, noCount = 0, noWithoutObs = 0
    checklistItems.forEach(item => {
      const s = solicitud.checklistDO[item.key]
      if (s?.valor !== null && s?.valor !== undefined) completed++
      if (s?.valor === "no") { noCount++; if (!s.observacion.trim()) noWithoutObs++ }
    })
    return { completed, total, hasNo: noCount > 0, noCount, allDone: completed === total, noWithoutObs }
  }, [solicitud, checklistItems])
  const hasFolioDictamen = !!solicitud?.folioDictamen
  const canApproveChecklist = checklistStats.allDone && !checklistStats.hasNo
  const canApprove =
    filtro === 3 ? sinObservacion
    : filtro === 2 ? (canApproveChecklist && hasFolioDictamen)
    : canApproveChecklist
  const canObservar =
    filtro === 3 ? !sinObservacion
    : checklistStats.hasNo
  const observarBlocked = filtro !== 3 && checklistStats.noWithoutObs > 0

  const patchEstado = useCallback(async (accion: "aprobar" | "observar", observaciones?: string) => {
    if (!solicitud) return
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId:  solicitud.id,
          filtro,
          accion,
          usuarioId:    (user as any)?.id ?? "",
          observaciones: observaciones ? [observaciones] : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? `Error al ${accion}`); return }

      // Actualizar estado local
      setSolicitud(prev => prev ? { ...prev, estado: json.estadoNuevo ?? prev.estado } : prev)
      return json.estadoNuevo as string
    } catch { alert("Error de conexión") }
    finally { setGuardando(false) }
  }, [solicitud, filtro, user])

  const handleAprobar = async () => {
    if (filtro === 3) { setShowEmitConfirm(true); return }
    const nuevoEstado = await patchEstado("aprobar")
    if (nuevoEstado) setShowConfirmacion(`Solicitud aprobada y enviada a Filtro ${filtro + 1}.`)
  }

  const handleConfirmEmit = async () => {
    setShowEmitConfirm(false)
    const nuevoEstado = await patchEstado("aprobar")
    if (nuevoEstado) {
      setSolicitud(prev => prev ? { ...prev, estado: nuevoEstado } : prev)
      setActiveTab("emision")
      setShowConfirmacion("Solicitud aprobada por la Dirección General. Proceda a la emisión del dictamen.")
    }
  }

  const handleObservar = async () => {
    if (filtro === 3) {
      if (!observacionGeneral.trim()) { setObservacionError("Escribe una observación para devolver el expediente."); return }
      setObservacionError("")
      const nuevoEstado = await patchEstado("observar", observacionGeneral.trim())
      if (nuevoEstado) { setObservacionGeneral(""); setShowConfirmacion("Solicitud observada y regresada a URG.") }
      return
    }

    // Validar observaciones del checklist
    const errors: Record<string, boolean> = {}
    let hasErrors = false
    checklistItems.forEach(item => {
      const s = solicitud?.checklistDO[item.key]
      if (s?.valor === "no" && !s.observacion.trim()) { errors[item.key] = true; hasErrors = true }
    })
    if (hasErrors) { setChecklistErrors(errors); return }

    const resumen = checklistItems
      .filter(item => solicitud?.checklistDO[item.key]?.valor === "no")
      .map(item => `${item.num}. ${item.label}: ${solicitud?.checklistDO[item.key]?.observacion}`)
      .join(" | ")
    const obs = [observacionGeneral.trim(), resumen].filter(Boolean).join(" — ")
    const nuevoEstado = await patchEstado("observar", obs)
    if (nuevoEstado) { setObservacionGeneral(""); setChecklistErrors({}); setShowConfirmacion("Solicitud observada y regresada a URG.") }
  }
  const handleEmitir = () => {
    if (!solicitud) return
    setSolicitud(prev => prev ? { ...prev, estado: "Emitido" } : prev)
    setShowConfirmacion(
      modalidadFirma === "electronica"
        ? "Dictamen emitido y firmado electrónicamente. Expediente bloqueado."
        : "Dictamen emitido con firma autógrafa. Expediente bloqueado."
    )
  }

  const isEmitido  = solicitud?.estado === "Emitido"
  const isAprobado = solicitud?.estado === "Aprobado"
  const showEmisionTab = filtro === 3 && (isAprobado || isEmitido)
  const canEmit = selectedDestinatarios.length > 0 && fechaDictaminacion &&
    (modalidadFirma === "electronica" || (autografaDescargado && archivoSubido))
  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      <span className="text-sm text-muted-foreground">Cargando expediente...</span>
    </div>
  )

  if (error || !solicitud) return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <p className="text-muted-foreground">{error ?? "Solicitud no encontrada"}</p>
      <Button variant="outline" onClick={() => onBack(filtro)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />Regresar a bandeja
      </Button>
    </div>
  )

  // ── RENDER ──
  return (
    <PageLayout noContainer>
    <div className="flex flex-col gap-4 h-full">

      {/* Overlays de confirmación */}
      {showConfirmacion && !isEmitido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-secondary/30 border-2">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <CheckCircle2 className="h-12 w-12 text-secondary" />
              <p className="text-base font-semibold text-card-foreground text-center">{showConfirmacion}</p>
              {activeTab === "emision" ? (
                <Button onClick={() => setShowConfirmacion(null)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Continuar a Emisión
                </Button>
              ) : (
                <Button onClick={() => onBack(filtro)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Regresar a bandeja
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showConfirmacion && isEmitido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-primary/30 border-2">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="h-12 w-12 text-primary" />
              <p className="text-base font-semibold text-card-foreground text-center">{showConfirmacion}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowConfirmacion(null)}>Ver Expediente</Button>
                <Button onClick={() => onBack(filtro)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Regresar a bandeja
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showEmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-primary/30 border-2">
            <CardContent className="flex flex-col items-center gap-5 p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-card-foreground">Confirmación</h3>
                <p className="text-sm text-muted-foreground mt-2">¿Aprobar y pasar a emisión del dictamen?</p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setShowEmitConfirm(false)}>Cancelar</Button>
                <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleConfirmEmit} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, aprobar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onBack(filtro)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Regresar
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">Expediente {solicitud.folio}</h2>
              <Badge className="bg-primary/15 text-primary border-0 text-xs">{solicitud.estado}</Badge>
              {isEmitido && (
                <Badge className="bg-primary text-primary-foreground border-0 text-xs gap-1">
                  <Lock className="h-3 w-3" />Emitido
                </Badge>
              )}
              {solicitud.folioDictamen && (
                <Badge className="bg-secondary/15 text-secondary border-0 text-xs gap-1">
                  <Stamp className="h-3 w-3" />Dict. {solicitud.folioDictamen}
                </Badge>
              )}
              {solicitud.esExtemporanea && (
                <Badge className="bg-orange-500/15 text-orange-600 border-0 text-xs">Extemporánea</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {solicitud.folioJustificacion} — {solicitud.tipo} — {solicitud.secretaria}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() =>
            generateJustificacionPDF({
              folio: solicitud.folioJustificacion, tipo: solicitud.tipo as any,
              secretaria: solicitud.secretaria, unidadAdministrativa: solicitud.unidadAdministrativa,
              denominacion: solicitud.tipo, vigenciaInicio: solicitud.vigenciaInicio,
              vigenciaFin: solicitud.vigenciaFin, importeBruto: solicitud.importeBruto,
              esRenovacion: solicitud.esRenovacion, fecha: solicitud.fechaCreacion,
              firmadoDigitalmente: true,
            })}>
            <Download className="h-4 w-4" />Justificación (PDF)
          </Button>
          {!isEmitido && <SlaIndicatorLarge diasRestantes={solicitud.slaRestante} />}
        </div>
      </div>

      {/*  Vista dividida  */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 flex-1 min-h-0">

        {/*  Expediente */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            {solicitud.observacionesPrevias.length > 0 && (
              <Card className="shadow-sm border-destructive/30 border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" />Observaciones Previas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {solicitud.observacionesPrevias.map((obs, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-card-foreground whitespace-pre-line">
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />{obs}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <ExpedienteGenerico sol={solicitud} />
          </div>
        </ScrollArea>

        {/* Panel de revisión */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {!isEmitido && (
                <button onClick={() => setActiveTab("review")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "review" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"}`}>
                  <ClipboardCheck className="mr-1.5 inline h-4 w-4" />Revisión
                </button>
              )}
              {showEmisionTab && (
                <button onClick={() => setActiveTab("emision")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "emision" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"}`}>
                  <Stamp className="mr-1.5 inline h-4 w-4" />Emisión
                </button>
              )}
              <button onClick={() => setActiveTab("historial")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "historial" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"}`}>
                <History className="mr-1.5 inline h-4 w-4" />Historial
              </button>
            </div>

            {/* Tabla revision */}
            {activeTab === "review" && !isEmitido && (
              <>
                {/* Filtro 1/2 Checklist */}
                {filtro !== 3 && (
                  <>
                    <Card className={`shadow-sm border-2 ${checklistStats.hasNo ? "border-destructive/30 bg-destructive/[0.03]" : checklistStats.allDone ? "border-secondary/30 bg-secondary/[0.03]" : "border-border"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-secondary" />
                            <span className="text-sm font-semibold text-card-foreground">Checklist Normativo — Filtro {filtro}</span>
                          </div>
                          <Badge variant="outline" className="text-xs font-mono">{checklistStats.total} items</Badge>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-medium text-card-foreground">
                            {checklistStats.completed} de {checklistStats.total} verificaciones completas
                          </span>
                          <Badge className={`text-[10px] border-0 ${checklistStats.hasNo ? "bg-destructive/10 text-destructive" : checklistStats.allDone ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                            {checklistStats.hasNo ? `${checklistStats.noCount} observación(es)` : checklistStats.allDone ? "Completo" : "En progreso"}
                          </Badge>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full transition-all ${checklistStats.hasNo ? "bg-destructive" : checklistStats.allDone ? "bg-secondary" : "bg-primary"}`}
                            style={{ width: `${checklistStats.total > 0 ? (checklistStats.completed / checklistStats.total) * 100 : 0}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm border-border">
                      <CardContent className="p-0">
                        <div className="divide-y divide-border">
                          {checklistItems.map(item => {
                            const s      = solicitud.checklistDO[item.key]
                            const valor  = s?.valor ?? null
                            const itemObs = s?.observacion ?? ""
                            const hasErr  = checklistErrors[item.key]
                            const isExtra = item.num > 16

                            return (
                              <div key={item.key}>
                                {item.num === 17 && (
                                  <div className="border-t-2 border-primary/20 bg-primary/[0.05] px-4 py-2.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                      Campos adicionales — Tiempo Determinado
                                    </span>
                                  </div>
                                )}
                                <div className={`flex flex-col gap-3 p-4 ${isExtra ? "bg-primary/[0.03]" : ""} ${valor === "no" ? "bg-destructive/[0.04]" : ""}`}>
                                  <div className="flex items-start gap-3">
                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${valor === "si" ? "bg-secondary/15 text-secondary" : valor === "no" ? "bg-destructive/15 text-destructive" : valor === "noAplica" ? "bg-muted text-muted-foreground" : "bg-border text-muted-foreground"}`}>
                                      {item.num}
                                    </span>
                                    <div className="flex flex-1 flex-col gap-2">
                                      <span className={`text-sm leading-snug ${valor === "no" ? "text-destructive font-medium" : "text-card-foreground"}`}>
                                        {item.label}
                                      </span>
                                      <div className="flex flex-wrap gap-2">
                                        <RadioOption value="si"       selected={valor === "si"}       onChange={() => updateChecklist(item.key, valor === "si"       ? null : "si")}       label="Sí"       colorClass="text-secondary bg-secondary/10" />
                                        <RadioOption value="no"       selected={valor === "no"}       onChange={() => updateChecklist(item.key, valor === "no"       ? null : "no")}       label="No"       colorClass="text-destructive bg-destructive/10" />
                                        <RadioOption value="noAplica" selected={valor === "noAplica"} onChange={() => updateChecklist(item.key, valor === "noAplica" ? null : "noAplica")} label="No Aplica" colorClass="text-muted-foreground bg-muted" />
                                      </div>
                                      {(valor === "no" || itemObs) && (
                                        <div className="flex flex-col gap-1">
                                          <Textarea
                                            value={itemObs}
                                            onChange={e => updateChecklist(item.key, valor, e.target.value)}
                                            placeholder={valor === "no" ? "Obligatorio: describa la observación..." : "Observaciones de este punto..."}
                                            className={`bg-background min-h-10 text-xs resize-none ${hasErr ? "border-destructive" : ""}`}
                                            rows={2}
                                          />
                                          {hasErr && <span className="text-[10px] text-destructive font-medium">Debe escribir una observación para los puntos marcados como "No"</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Filtro 2 */}
                    {filtro === 2 && canApproveChecklist && !hasFolioDictamen && (
                      <Card className="shadow-sm border-primary/40 border-2 bg-primary/[0.04]">
                        <CardContent className="flex items-start gap-3 p-4">
                          <Stamp className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                          <div>
                            <span className="text-sm font-medium text-primary">Folio de dictamen requerido</span>
                            <p className="text-xs text-muted-foreground">Debe asignarse el folio de dictamen antes de aprobar.</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Observación general Filtro  */}
                    <Card className="shadow-sm border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                          <MessageSquare className="h-4 w-4 text-secondary" />Observación General
                          <span className="text-[10px] font-normal text-muted-foreground ml-1">(opcional)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea value={observacionGeneral} onChange={e => setObservacionGeneral(e.target.value)}
                          placeholder="Comentarios adicionales sobre la solicitud..." className="bg-background min-h-20" />
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Simplificado */}
                {filtro === 3 && (
                  <Card className={`shadow-sm border-2 ${sinObservacion ? "border-secondary/30 bg-secondary/[0.03]" : "border-border"}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                        <Shield className="h-4 w-4 text-primary" />Revisión de Dirección General
                      </CardTitle>
                      <CardDescription className="text-xs">Determine si procede la emisión o requiere observaciones.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <Checkbox id="sin-obs-dg" checked={sinObservacion}
                          onCheckedChange={v => { setSinObservacion(!!v); if (v) { setObservacionGeneral(""); setObservacionError("") } }} />
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="sin-obs-dg" className="text-sm font-medium cursor-pointer">No hay ninguna observación</Label>
                          <span className="text-xs text-muted-foreground">
                            {sinObservacion ? "El expediente está listo para emisión." : "Desmarque para agregar observaciones y devolver el expediente."}
                          </span>
                        </div>
                      </div>
                      {!sinObservacion && (
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium text-card-foreground">Observación</Label>
                          <Textarea value={observacionGeneral}
                            onChange={e => { setObservacionGeneral(e.target.value); if (e.target.value.trim()) setObservacionError("") }}
                            placeholder="Describa las observaciones para devolver el expediente..."
                            className={`bg-background min-h-24 ${observacionError ? "border-destructive" : ""}`} />
                          {observacionError && <span className="text-xs text-destructive">{observacionError}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Avisos */}
                {canObservar && observarBlocked && (
                  <Card className="shadow-sm border-destructive/40 border-2 bg-destructive/[0.04]">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Info className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-destructive">Observaciones incompletas</span>
                        <p className="text-xs text-muted-foreground">{checklistStats.noWithoutObs} punto(s) marcado(s) como "No" requieren observación obligatoria.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!canApprove && !canObservar && filtro !== 3 && checklistStats.completed < checklistStats.total && (
                  <Card className="shadow-sm border-border bg-muted/30">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-card-foreground">Verificación en progreso</span>
                        <p className="text-xs text-muted-foreground">Faltan {checklistStats.total - checklistStats.completed} verificaciones por completar.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Botones de acción */}
                <Card className="shadow-sm border-border sticky bottom-0">
                  <CardContent className="flex items-center justify-between p-4">
                    <Button variant="outline" onClick={handleObservar} disabled={!canObservar || observarBlocked || guardando}
                      className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Observar
                    </Button>
                    <Button onClick={handleAprobar} disabled={!canApprove || guardando}
                      className={`gap-1.5 ${canApprove ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {filtro < 3 ? `Aprobar → Filtro ${filtro + 1}` : "Aprobar (DG)"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Emisión */}
            {activeTab === "emision" && (
              isEmitido ? (
                /* Vista bloqueada post-emisión */
                <Card className="shadow-sm border-primary border-2 bg-primary/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Lock className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">Expediente Bloqueado Post-Emisión</p>
                      <p className="text-xs text-muted-foreground">Este expediente fue emitido y no puede ser modificado.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Panel de emisión */
                <div className="flex flex-col gap-4">
                  <Card className="shadow-sm border-primary/30 border-2 bg-primary/[0.03]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Stamp className="h-6 w-6 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">DICTAMEN TÉCNICO FUNCIONAL</p>
                        <p className="text-xs text-muted-foreground">Administración Centralizada</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-card-foreground">Fecha de Dictaminación</CardTitle></CardHeader>
                    <CardContent>
                      <Input type="date" value={fechaDictaminacion} onChange={e => setFechaDictaminacion(e.target.value)} className="bg-background w-48" />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-card-foreground">Modalidad de Firma</CardTitle></CardHeader>
                    <CardContent>
                      <RadioGroup value={modalidadFirma} onValueChange={v => { setModalidadFirma(v as any); if (v === "electronica") { setAutografaDescargado(false); setArchivoSubido(false) } }} className="flex flex-col gap-3">
                        {[
                          { value: "electronica", label: "Firma Electrónica", desc: "Se firmará digitalmente al emitir" },
                          { value: "autografa",   label: "Firma Autógrafa",   desc: "Descargue, firme y suba el documento" },
                        ].map(opt => (
                          <label key={opt.value} htmlFor={`firma-${opt.value}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${modalidadFirma === opt.value ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                            <RadioGroupItem value={opt.value} id={`firma-${opt.value}`} className="mt-0.5" />
                            <div>
                              <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                        <Users className="h-4 w-4 text-secondary" />Destinatarios
                        <Badge variant="outline" className="text-[10px] ml-1">{selectedDestinatarios.length} seleccionados</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {AVAILABLE_DESTINATARIOS.map(d => (
                          <label key={d} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                            <Checkbox checked={selectedDestinatarios.includes(d)}
                              onCheckedChange={() => setSelectedDestinatarios(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} />
                            <span className="text-sm text-card-foreground">{d}</span>
                          </label>
                        ))}
                      </div>
                      {selectedDestinatarios.length === 0 && <p className="text-xs text-destructive mt-2 font-medium">Debe seleccionar al menos un destinatario</p>}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border sticky bottom-0">
                    <CardContent className="flex items-center justify-end p-4">
                      <Button onClick={handleEmitir} disabled={!canEmit}
                        className={`gap-1.5 ${canEmit ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                        <Send className="h-4 w-4" />Emitir Dictamen
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            {/*  Historial */}
            {activeTab === "historial" && (
              <Card className="shadow-sm border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <History className="h-4 w-4 text-secondary" />Historial del Expediente
                  </CardTitle>
                  <CardDescription className="text-xs">Línea de tiempo de movimientos</CardDescription>
                </CardHeader>
                <CardContent>
                  <HistorialTimeline historial={solicitud.historial} />
                </CardContent>
              </Card>
            )}

          </div>
        </ScrollArea>
      </div>
    </div>
    </PageLayout>
  )
}