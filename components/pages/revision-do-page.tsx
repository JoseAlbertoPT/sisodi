"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { applyTextRules, applyTextRulesArray } from "@/lib/utils"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ReadOnlyField } from "@/components/ui/readonly-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ActionResultScreen } from "@/components/ui/action-result-screen"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageLayout } from "@/components/page-layout"
import {

  ArrowLeft, Clock, FileText, AlertCircle, CheckCircle2, XCircle, RotateCcw,
  History, MessageSquare, ClipboardCheck, MinusCircle,
  ChevronDown, ChevronRight, Send, Download, Lock, Stamp,
  Users, Shield, Loader2, GraduationCap, Brain, Wrench, Heart, Star, Briefcase,
  UserCheck, Pencil, X,

} from "lucide-react"
import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import { useAuth } from "@/lib/auth-context"
import { generateJustificacionPDF, generateJustificacionPDFBase64 } from "@/lib/generate-justificacion-pdf"
import { type EditSolicitudPayload, type FormularioData } from "@/components/pages/nueva-solicitud-page"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { SelladoDocumentoSection } from "@/components/sellado-documento-section"
import { FirmaModal } from "@/components/firma-modal"
import { ConfirmToast } from "@/components/ui/confirm-toast"
import { HistorialTimeline, type HistorialEntryData } from "@/components/historial-timeline"
import { DatePickerHabil, isoToDate, dateToIso } from "@/components/ui/date-picker-habil"
import { parseDateDMY } from "@/lib/calendario-recepcion-mock"
const COLOR_SI        = "#6E795A"
const COLOR_SI_TEXT   = "#283c2a"
const COLOR_NO        = "#832B56"
const COLOR_NO_APLICA = "#B8860B"
const INICIALES_MES_MAP: Record<string, string> = {
  "01": "EN",
  "02": "FE",
  "03": "MR",
  "04": "AB",
  "05": "MY",
  "06": "JN",
  "07": "JL",
  "08": "AG",
  "09": "SE",
  "10": "OC",
  "11": "NO",
  "12": "DI",
}
const MESES_RECEPCION = [
  { num: 1,  code: "EN", label: "Enero"      },
  { num: 2,  code: "FE", label: "Febrero"    },
  { num: 3,  code: "MR", label: "Marzo"      },
  { num: 4,  code: "AB", label: "Abril"      },
  { num: 5,  code: "MY", label: "Mayo"       },
  { num: 6,  code: "JN", label: "Junio"      },
  { num: 7,  code: "JL", label: "Julio"      },
  { num: 8,  code: "AG", label: "Agosto"     },
  { num: 9,  code: "SE", label: "Septiembre" },
  { num: 10, code: "OC", label: "Octubre"    },
  { num: 11, code: "NO", label: "Noviembre"  },
  { num: 12, code: "DI", label: "Diciembre"  },
]
function generarFolioTemporal(id: number, fecha: Date | null | undefined): string {
  const f      = fecha ?? new Date()
  const mes    = f.getMonth() + 1
  const mesStr = String(mes).padStart(2, "0")
  const ini    = INICIALES_MES_MAP[mesStr] ?? "XX"
  const num    = String(id).padStart(3, "0")
  return `${ini}-${num}-${f.getFullYear()}`
}
function formatearFolio(folio: string | null | undefined): string {
  if (!folio) return "---"
  const match = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[1]}/${match[2].padStart(2, "0")}/${match[3]}`
  return folio
}
function resolverFolioRecepcion(item: any): string {
  if (item.folio_recepcion) return formatearFolio(item.folio_recepcion)
  const fechaRaw = item.fecha_envio ?? item.fecha_creacion ?? null
  return generarFolioTemporal(item.id, fechaRaw ? new Date(fechaRaw) : null)
}
function resolverFolioDictamen(item: any): string | null {
  if (!item) return null
  return (
    item.folioDictamen        ??
    item.dictamen?.folio      ??
    item.folio_dictamen       ??
    item._raw?.folioDictamen  ??
    item._raw?.dictamen?.folio ??
    item._raw?.folio_dictamen ??
    null
  )
}
interface SolicitudDetalle {
  id: number
  folio: string | null
  folioJustificacion: string
  folioDictamen: string | null
  folioRecepcion: string | null
  tipo: string
  regimen: string
  tipoActividades: string
  denominacion: string
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
  historial: HistorialEntryData[]
  observacionesPrevias: { fecha: string; usuario: string; estado: string; comentario: string }[]
  observacionesTodas: { fecha: string; usuario: string; estado: string; comentario: string }[]
  checklistDO: Record<string, { valor: "si" | "no" | "noAplica" | null; observacion: string }>
  _raw: any
}
type ChecklistValor = "si" | "no" | "noAplica" | null
type ActiveTab = "review" | "emision" | "observaciones" | "historial"
interface RevisionDOPageProps {
  solicitudId: string
  filtro: 1 | 2 | 3
  onBack: (filtro: 1 | 2 | 3) => void
  onEditSolicitud?: (payload: EditSolicitudPayload) => void
}

function getEstadoSiguienteTrasSave(estado: string): string | undefined {
  const n = estado.toLowerCase()
  if (n.includes("observado por validacion final")) return "En Validacion Final"
  if (n.includes("observado por emisor"))           return "En Revision Emisor"
  if (n.includes("observado por do") || n.includes("devuelta por do")) return "Pendiente DO"
  return undefined
}

function rawToEditPayload(sol: SolicitudDetalle): EditSolicitudPayload {
  const raw = sol._raw
  const regimenRaw = (raw?.regimen ?? sol.regimen ?? "").toLowerCase()
  const regimen: EditSolicitudPayload["regimen"] =
    regimenRaw.includes("asimilado") ? "asimilados" :
    regimenRaw.includes("nombramiento") || regimenRaw.includes("tiempo determi  nado") ? "nombramiento" :
    regimenRaw.includes("honorario") ? "honorarios" : "honorarios"
  const tipo: EditSolicitudPayload["tipo"] =
    (raw?.tipo_solicitud ?? sol.tipo ?? "").toLowerCase().includes("nombramiento") ? "nombramiento" : "prestacion"
  const formData: Partial<FormularioData> = {
    secretaria:           sol.secretaria !== "—" ? sol.secretaria : "",
    unidadAdministrativa: raw?.unidad_administrativa ?? "",
    unidadResponsable:    raw?.unidad_responsable ?? "",
    programaProyecto:     raw?.programa_proyecto ?? "",
    regimen:              raw?.regimen ?? sol.regimen ?? "",
    tipoActividades:      raw?.tipo_actividades ?? sol.tipoActividades ?? "",
    numeroPrestadores:    raw?.numero_prestadores != null ? String(raw.numero_prestadores) : "",
    denominacion:         sol.denominacion !== "—" ? sol.denominacion : "",
    puestoJefeInmediato:     raw?.puesto_jefe_inmediato ?? "",
    tipoAdministracionNom:   (raw?.tipo_administracion === "paraestatal" ? "paraestatal" : "centralizada") as "centralizada" | "paraestatal",
    vigenciaInicio:          raw?.vigencia_inicio ? raw.vigencia_inicio.toString().slice(0, 10) : "",
    vigenciaFin:             raw?.vigencia_fin   ? raw.vigencia_fin.toString().slice(0, 10) : "",
    importeBruto:            raw?.importe_bruto  != null ? String(raw.importe_bruto) : "",
    tipoImporte:             raw?.tipo_importe ?? "",
    nivelTabulador:          raw?.nivel_tabulador ?? "",
    categoriaTabulador:      raw?.categoria_tabulador ?? "",
    objeto:                  raw?.objeto ?? "",
    actividades:             Array.isArray(raw?.actividades) ? raw.actividades : [],
    responsabilidades:       Array.isArray(raw?.responsabilidades) ? raw.responsabilidades : [],
    marcoNormativo:          Array.isArray(raw?.marco_normativo) ? raw.marco_normativo : [],
    condicionesRiesgos:      Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos : [],
    resguardoActivos:        raw?.resguardo_activos ?? "",
    riesgoCaidas:            raw?.riesgo_caidas ?? "",
    riesgoMutilaciones:      raw?.riesgo_mutilaciones ?? "",
    riesgoGolpes:            raw?.riesgo_golpes ?? "",
    riesgoOtros:             raw?.riesgo_otros ?? "",
    condicionCambioDomicilio: raw?.condicion_cambio_domicilio ?? false,
    condicionHorario:        raw?.condicion_horario ?? false,
    condicionViajar:         raw?.condicion_viajar ?? false,
    escolaridad:             raw?.escolaridad ?? "",
    compAdm:                 raw?.comp_adm ?? "",
    compTec:                 raw?.comp_tec ?? "",
    compSoc:                 raw?.comp_soc ?? "",
    valores:                 raw?.valores ?? "",
    areasExp:                raw?.areas_exp ?? "",
  }
  return { id: String(sol.id), tipo, regimen, periodo: sol.periodo, estado: sol.estado, estadoSiguienteTrasSave: getEstadoSiguienteTrasSave(sol.estado), formData, adjuntos: (raw?.adjunto ?? []).map((a: any) => ({ id: a.id, nombre_archivo: a.nombre_archivo, ruta: a.ruta })) }
}
interface ChecklistItem { key: string; num: number; label: string }
const CHECKLIST_16: ChecklistItem[] = [
  { key: "c1",  num: 1,  label: "Unidad Administrativa de Adscripción" },
  { key: "c2",  num: 2,  label: "Unidad Responsable del Gasto" },
  { key: "c3",  num: 3,  label: "Programa o Proyecto" },
  { key: "c4",  num: 4,  label: "Régimen de contratación correcto" },
  { key: "c5",  num: 5,  label: "Tipo de actividad especificado" },
  { key: "c6",  num: 6,  label: "Número de prestadores de servicio" },
  { key: "c7",  num: 7,  label: "Vigencia correcta (inicio y término)" },
  { key: "c8",  num: 8,  label: "Importe bruto conforme al tabulador vigente" },
  { key: "c9",  num: 9,  label: "Ordenamientos legales y administrativos citados" },
  { key: "c10", num: 10, label: "Oficio de suficiencia presupuestal adjunto" },
]
const CHECKLIST_NOMBRAMIENTO: ChecklistItem[] = [
  { key: "n1",  num: 1,  label: "Unidad Administrativa de Adscripción" },
  { key: "n2",  num: 2,  label: "Unidad Responsable del Gasto" },
  { key: "n3",  num: 3,  label: "Programa o Proyecto" },
  { key: "n4",  num: 4,  label: "Régimen de contratación correcto" },
  { key: "n5",  num: 5,  label: "Denominación del nombramiento" },
  { key: "n6",  num: 6,  label: "Equivalencia de acuerdo al Tabulador de Sueldos del Poder Ejecutivo Estatal, vigente (Nivel/Categoría)" },
  { key: "n7",  num: 7,  label: "Tipo de actividad especificado" },
  { key: "n8",  num: 8,  label: "Número de personas a contratar" },
  { key: "n9",  num: 9,  label: "Vigencia correcta (inicio y término)" },
  { key: "n10", num: 10, label: "Importe neto mensual (conforme al tabulador vigente)" },
  { key: "n11", num: 11, label: "Ordenamientos legales y administrativos citados" },
  { key: "n12", num: 12, label: "Oficio de suficiencia presupuestal adjunto" },
]
const CHECKLIST_HONORARIOS: ChecklistItem[] = [
  { key: "h1",  num: 1,  label: "Unidad Administrativa de Adscripción" },
  { key: "h2",  num: 2,  label: "Unidad Responsable del Gasto" },
  { key: "h3",  num: 3,  label: "Programa o Proyecto" },
  { key: "h4",  num: 4,  label: "Régimen de contratación correcto" },
  { key: "h5",  num: 5,  label: "Tipo de actividad especificado" },
  { key: "h6",  num: 6,  label: "Número de prestadores de servicio" },
  { key: "h7",  num: 7,  label: "Vigencia correcta (inicio y término)" },
  { key: "h8",  num: 8,  label: "Importe bruto conforme al tabulador vigente" },
  { key: "h9",  num: 9,  label: "Ordenamientos legales y administrativos citados" },
  { key: "h10", num: 10, label: "Oficio de suficiencia presupuestal adjunto" },
]
function getChecklistItems(filtro: 1 | 2 | 3, tipo?: string | null): ChecklistItem[] {
  const t = (tipo ?? "").toLowerCase()
  if (t.includes("honorarios") || t.includes("asimilados")) return CHECKLIST_HONORARIOS
  if (t.includes("nombramiento"))                           return CHECKLIST_NOMBRAMIENTO
  return CHECKLIST_16
}
function parseDateLocal(v: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(v)
}
function formatFecha(v: string | null | undefined): string {
  if (!v) return "—"
  const d = parseDateLocal(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function formatFechaHora(v: string | null | undefined): string {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
function slaDesdeApiRestante(valor: number | null | undefined): number | null {
  if (valor == null) return null
  return valor
}

function formatRegimen(raw: string | null | undefined): string {
  const r = (raw ?? "").toLowerCase().trim()
  if (r.includes("asimilado"))  return "Honorarios Asimilados  a Salarios"
  if (r.includes("honorario"))  return "Honorarios"
  if (r.includes("nombramiento") || r.includes("tiempo Determinado")) return "Nombramiento por Tiempo Determinado"
  return raw || "—"
}
function formatEscolaridad(e: string | null | undefined): string {
  const v = (e ?? "").toLowerCase().trim()
  if (v === "bachillerato") return "Bachillerato"
  if (v === "tecnico")      return "Técnico Superior"
  if (v === "licenciatura") return "Licenciatura"
  if (v === "maestria")     return "Maestría"
  if (v === "doctorado")    return "Doctorado"
  if (!e) return "—"
  return applyTextRules(e)
}

function getSlaColor(dias: number | null): string {
  if (dias === null) return "#64748b"
  if (dias <= 0)    return "#832B56"
  return "#283C2A"
}
function getSlaStyle(dias: number | null): React.CSSProperties {
  const c = getSlaColor(dias)
  return { backgroundColor: `${c}18`, color: c }
}
function getSlaLabel(dias: number | null) {
  if (dias === null) return "Sin periodo"
  if (dias <= 0) return "Cerrada"
  return `${dias} día${dias !== 1 ? "s" : ""} al cierre`
}
function mapBDtoDetalle(item: any): SolicitudDetalle {
  const historial: HistorialEntryData[] = (item.historial_solicitud ?? []).map((h: any) => ({
    fecha:          h.fecha ?? "",
    usuario:        h.usuario?.nombre ?? "Sistema",
    estadoAnterior: h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? null,
    estadoNuevo:    h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
    comentario:     h.comentario ?? null,
  }))
  const historialSolicitud = item.historial_solicitud ?? []
  const observacionesPrevias = (historialSolicitud as any[])
    .filter((h, idx) => {
      const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
      if (!/observad/i.test(nombre) || !h.comentario) return false
      const historialAfter = (historialSolicitud as any[]).slice(idx + 1)
      return !historialAfter.some((h2: any) => {
        const n2 = (h2.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
        return !n2.includes("observad")
      })
    })
    .map((h) => ({
      fecha:      formatFechaHora(h.fecha),
      usuario:    h.usuario?.nombre ?? "Sistema",
      estado:     h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
      comentario: h.comentario as string,
    }))
  const fechaEnvio = item.fecha_envio ?? item.fecha_recepcion ?? item.fecha_creacion ?? null
  const folioDictamen = resolverFolioDictamen(item)
  return {
    id:                   item.id,
    folio:                item.folio_recepcion ? formatearFolio(item.folio_recepcion) : null,
    folioJustificacion:   item.folio_justificacion
      ?? `SDTF-${new Date(item.fecha_creacion ?? Date.now()).getFullYear()}-${String(item.id).padStart(4, "0")}`,
    folioDictamen,
    folioRecepcion:       item.folio_recepcion ?? null,
    tipo:                 item.tipo_solicitud ?? "—",
    denominacion:         item.denominacion || "—",
    tipoActividades:      item.tipo_actividades ?? item.tipoActividades ?? "—",
    regimen:              item.regimen ?? "—",
    secretaria:           item.secretaria ?? item.usuario?.area?.nombre ?? "—",
    unidadAdministrativa: item.unidad_administrativa ?? item.usuario?.area?.nombre ?? "—",
    solicitante:          item.usuario?.nombre ?? "—",
    correo:               item.usuario?.correo ?? "—",
    estado:               item.estado?.nombre ?? "—",
    periodo:              item.periodo ? `${item.periodo.mes}/${item.periodo.anio}` : "—",
    fechaCreacion:        formatFecha(item.fecha_creacion),
    fechaEnvio,
    esExtemporanea:       item.es_extemporanea ?? false,
    vigenciaInicio:       formatFecha(item.vigencia_inicio),
    vigenciaFin:          formatFecha(item.vigencia_fin),
    importeBruto:         item.importe_bruto != null
      ? `$${Number(item.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
      : "—",
    esRenovacion:         item.es_renovacion ?? false,
    folioAnterior:        item.folio_anterior ?? null,
    slaRestante:          slaDesdeApiRestante(item.slaRestante),
    historial,
    observacionesPrevias,
    observacionesTodas: (historialSolicitud as any[])
      .filter((h: any, idx: number) => {
        const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
        if (!/observad/i.test(nombre) || !h.comentario) return false
        const after = (historialSolicitud as any[]).slice(idx + 1)
        return !after.some((h2: any) => {
          const n2 = (h2.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
          return !n2.includes("observad")
        })
      })
      .map((h: any) => ({
        fecha:      formatFechaHora(h.fecha),
        usuario:    h.usuario?.nombre ?? "Sistema",
        estado:     h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
        comentario: h.comentario as string,
      })),
    checklistDO:          {},
    _raw:                 item,
  }
}

function getSlaSubtitle(dias: number | null) {
  if (dias === null) return "Sin información de periodo"
  if (dias <= 0) return "El periodo ya cerró"
  return "días restantes al cierre"
}

function SlaIndicatorLarge({ diasRestantes }: { diasRestantes: number | null }) {
  const bg = diasRestantes === null ? "#64748b" : diasRestantes <= 7 ? "#832B56" : diasRestantes <= 15 ? "#C69C6D" : "#4a7a55"
  return (
    <div className="flex items-center gap-2 rounded-lg px-4 py-2.5" style={{ backgroundColor: bg, color: "#FFFFFF" }}>
      <Clock className="h-5 w-5" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{getSlaLabel(diasRestantes)}</span>
        <span className="text-[10px] opacity-75">{getSlaSubtitle(diasRestantes)}</span>
      </div>
    </div>
  )
}

function ObservacionChecklist({ comentario }: { comentario: string }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const itemsChecklist = lineas.filter(l => /^\d+\.\s.+::/.test(l))
  const comentarioGeneral = lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join(" ").trim()
  if (itemsChecklist.length === 0) {
    return <p className="text-xs text-[#832B56]/90 leading-relaxed">{comentario}</p>
  }
  return (
    <div className="flex flex-col gap-0 mt-1">
      {comentarioGeneral && (
        <p className="text-xs text-[#832B56]/80 mb-2 leading-relaxed">{comentarioGeneral}</p>
      )}
      {itemsChecklist.map((linea, idx) => {
        const [titulo, obs] = linea.split("::")
        const numMatch = titulo.match(/^(\d+)\./)
        const num = numMatch ? numMatch[1] : String(idx + 1)
        const label = titulo.replace(/^\d+\.\s*/, "").trim()
        const isLast = idx === itemsChecklist.length - 1
        return (
          <div key={idx} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#832B56]/60 bg-white text-[10px] font-bold text-[#832B56]">
                {num}
              </div>
              {!isLast && <div className="w-px flex-1 bg-[#832B56]/20 my-0.5" />}
            </div>
            <div className={`flex flex-col gap-1 flex-1 ${!isLast ? "pb-3" : "pb-1"}`}>
              <span className="text-xs font-semibold text-[#832B56]/90 leading-snug">{label}</span>
              {obs?.trim() && (
                <span className="text-xs text-[#832B56]/80 bg-[#832B56]/5 rounded px-2 py-1 border border-[#832B56]/15 leading-relaxed">
                  {obs.trim()}
                </span>
              )}
            </div>
          </div>
        )
      })}
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
function SeccionCondicionesRiesgos({ raw }: { raw: any }) {
  const condiciones = [
    { label: "Cambio de domicilio", value: raw?.condicion_cambio_domicilio },
    { label: "Horario especial",    value: raw?.condicion_horario },
    { label: "Viajar",              value: raw?.condicion_viajar },
  ]
  const riesgos = [
    { label: "Caídas",       value: raw?.riesgo_caidas },
    { label: "Mutilaciones", value: raw?.riesgo_mutilaciones },
    { label: "Golpes",       value: raw?.riesgo_golpes },
    { label: "Otros",        value: raw?.riesgo_otros },
  ]
  const noBoolDot = (v: boolean | null | undefined) =>
    v ? <span className="text-secondary font-semibold">Sí</span> : <span className="text-muted-foreground">No</span>
  const nivelDot = (v: string | null | undefined) =>
    v ? <span className="font-semibold text-card-foreground">{v}</span> : <span className="text-muted-foreground">—</span>

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[8px] border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Condición</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Aplica</th>
            </tr>
          </thead>
          <tbody>
            {condiciones.map((c, i) => (
              <tr key={c.label} className={`border-t border-border/60 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                <td className="px-3 py-2 text-sm text-card-foreground">{c.label}</td>
                <td className="px-3 py-2 text-center">{noBoolDot(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Riesgo</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {riesgos.map((r, i) => (
              <tr key={r.label} className={`border-t border-border/60 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                <td className="px-3 py-2 text-sm text-card-foreground">{r.label}</td>
                <td className="px-3 py-2 text-center">{nivelDot(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
function ReadOnlyList({ items }: { items: string[] }) {
  return (
    <ul
      className="scroll-thin flex flex-col gap-2"
      style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}
    >
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-card-foreground min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[10px] font-medium text-secondary mt-0.5">
            {i + 1}
          </span>
          <span style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{applyTextRules(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function RadioOption({ value, selected, onChange, label, style }: {
  value: string; selected: boolean; onChange: () => void; label: string; colorClass?: string; style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={selected ? style : { backgroundColor: "transparent", color: "#4B5563", borderColor: "#D1D5DB" }}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-100"
    >
      {value === "si"       && <CheckCircle2 className="h-3.5 w-3.5" />}
      {value === "no"       && <XCircle className="h-3.5 w-3.5" />}
      {value === "noAplica" && <MinusCircle className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

function PerfilList({ value }: { value: string }) {
  if (!value || value === "—") return <span className="text-sm text-muted-foreground">—</span>
  const items = value.split(/[\n\r•·]+/).map(s => s.trim()).filter(Boolean)
  if (items.length === 0) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-card-foreground">
          <span className="shrink-0 text-muted-foreground">•</span>
          <span>{applyTextRules(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function PerfilListField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <PerfilList value={value} />
    </div>
  )
}

function SeccionDatosGenerales({ sol }: { sol: SolicitudDetalle }) {
  const raw = sol._raw
  const esNombramiento = (sol.tipo ?? "").toLowerCase().includes("nombramiento")
    || (raw?.tipo_solicitud ?? "").toLowerCase().includes("nombramiento")
  return (
    <SectionCard num="I" title="Datos Generales">
      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyField label="Secretaría / Dependencia / Organismo" value={sol.secretaria} />
        <ReadOnlyField label="Unidad Administrativa de Adscripción" value={formatClave(raw?.unidad_administrativa ?? raw?.clave_unidad_administrativa ?? "") || "—"} />
        <ReadOnlyField label="Unidad Responsable del Gasto"         value={getNombreForClave(raw?.unidad_responsable ?? "") || raw?.nombre_unidad_responsable || raw?.unidad_responsable_nombre || raw?.unidad_responsable || "—"} />
        {esNombramiento ? (
          <>
            <ReadOnlyField label="Programa o Proyecto"              value={applyTextRules(raw?.programa_proyecto ?? "—")} />
            <ReadOnlyField label="Denominación del Nombramiento"    value={applyTextRules(sol.denominacion)} />
            <ReadOnlyField label="Puesto del Jefe Inmediato"        value={applyTextRules(raw?.puesto_jefe_inmediato ?? "—")} />
            <ReadOnlyField label="Tipo de Actividad"              value={applyTextRules(raw?.tipo_actividades ?? "—")} />
            <ReadOnlyField label="Régimen de Contratación"          value={formatRegimen(sol.regimen)} />
            <ReadOnlyField label="Número de Personas a Contratar"   value={raw?.numero_prestadores != null ? String(raw.numero_prestadores) : "—"} />
            <ReadOnlyField label="Tipo de Pago"                     value={raw?.tipo_importe || "Mensual"} />
            <ReadOnlyField label="Vigencia Inicio"                  value={sol.vigenciaInicio} />
            <ReadOnlyField label="Vigencia Término"                 value={sol.vigenciaFin} />
            <ReadOnlyField label="Importe Neto"                     value={sol.importeBruto} />
          </>
        ) : (
          <>
            <ReadOnlyField label="Número de Prestadores de Servicios" value={raw?.numero_prestadores != null ? String(raw.numero_prestadores) : "—"} />
            <ReadOnlyField label="Programa o Proyecto"                value={applyTextRules(raw?.programa_proyecto ?? "—")} />
            <ReadOnlyField label="Tipo de Actividad"                value={applyTextRules(sol.tipoActividades)} />
            <ReadOnlyField label="Régimen de Contratación"            value={formatRegimen(sol.regimen)} />
            <ReadOnlyField label="Vigencia Inicio"                    value={sol.vigenciaInicio} />
            <ReadOnlyField label="Vigencia Término"                   value={sol.vigenciaFin} />
            <ReadOnlyField label="Importe Bruto"                      value={sol.importeBruto} />
          </>
        )}
      </div>
    </SectionCard>
  )
}
function SeccionRenovacion({ sol }: { sol: SolicitudDetalle }) {
  const folioDictamen =
    sol.folioDictamen ??
    resolverFolioDictamen(sol._raw) ??
    null
  return (
    <SectionCard title="Renovación">
      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyField label="¿Es Renovación?" value={sol.esRenovacion ? "SÍ" : "NO"} />
        <ReadOnlyField
          label="Folio del Dictamen"
          value={folioDictamen ? formatearFolio(folioDictamen) : "—"}
        />
      </div>
    </SectionCard>
  )
}

function SeccionPerfil({ raw }: { raw: any }) {
  return (
    <SectionCard num="II" title="Perfil Requerido">
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-4 flex-1">
          <ReadOnlyField   label="Escolaridad Mínima"         value={formatEscolaridad(raw?.escolaridad)} />
          <PerfilListField label="Competencias Técnicas"       value={raw?.comp_tec ?? "—"} />
          <PerfilListField label="Valores"                     value={raw?.valores ?? "—"} />
        </div>
        <div className="flex flex-col gap-4 flex-1">
          <PerfilListField label="Competencias Administrativas" value={raw?.comp_adm ?? "—"} />
          <PerfilListField label="Competencias Sociales"        value={raw?.comp_soc ?? "—"} />
          <PerfilListField label="Áreas de Experiencia"         value={raw?.areas_exp ?? "—"} />
        </div>
      </div>
    </SectionCard>
  )
}
function SeccionDocumentosAdjuntos({ raw }: { raw: any }) {
  return (
    <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
      {(raw?.adjunto ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          {(raw.adjunto as any[]).map((adj: any, i: number) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <FileTypeIcon name={adj.nombre_archivo} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{adj.nombre_archivo}</p>
                <p className="text-xs text-muted-foreground">{adj.tipo ?? "PDF"} — {formatFecha(adj.fecha_subida)}</p>
              </div>
              {adj.ruta && (
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
                  onClick={() => window.open(adj.ruta, "_blank")}>
                  <Download className="h-3.5 w-3.5" />Ver
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin documentos adjuntos registrados.</p>
      )}
    </SectionCard>
  )
}

function ExpedienteFiltro1({ sol, hidePerfil }: { sol: SolicitudDetalle; hidePerfil?: boolean }) {
  const raw = sol._raw
  const actividades: string[]        = Array.isArray(raw?.actividades)        ? raw.actividades.filter(Boolean)        : []
  const responsabilidades: string[]  = Array.isArray(raw?.responsabilidades)   ? raw.responsabilidades.filter(Boolean)   : []
  const marcoNormativo: string[]     = Array.isArray(raw?.marco_normativo)     ? raw.marco_normativo.filter(Boolean)     : []
  const condicionesRiesgos: string[] = Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : []
  const resguardoActivos             = raw?.resguardo_activos as string | null | undefined
  const esNombramiento = (sol.regimen ?? "").toLowerCase().includes("nombramiento")
  return (
    <div className="flex flex-col gap-4">
      <SeccionDatosGenerales sol={sol} />
      {esNombramiento && (
        <SectionCard title="II. Tabulador — Nivel y Categoría">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Nivel"     value={raw?.nivel_tabulador ?? "—"} />
            <ReadOnlyField label="Categoría" value={raw?.categoria_tabulador ?? "—"} />
          </div>
        </SectionCard>
      )}
      <SectionCard title={esNombramiento ? "III. Objeto del Nombramiento" : "I.1 Objeto de la Contratación"}>
        <p className="scroll-thin text-sm text-card-foreground leading-relaxed whitespace-pre-wrap" style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>
          {raw?.objeto ? applyTextRules(raw.objeto) : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>
      <SectionCard title={esNombramiento ? "IV. Actividades a Realizar" : "I.2 Actividades a Realizar"}>
        {actividades.length > 0 ? <ReadOnlyList items={actividades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      <SectionCard title={esNombramiento ? "V. Responsabilidades" : "I.3 Responsabilidades"}>
        {responsabilidades.length > 0 ? <ReadOnlyList items={responsabilidades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      {esNombramiento && (
        <>
          <SectionCard title="VI. Marco Normativo">
            {marcoNormativo.length > 0 ? <ReadOnlyList items={marcoNormativo} /> : <p className="text-sm text-muted-foreground">—</p>}
          </SectionCard>
          <SectionCard title="VII. Condiciones y Riesgos">
            <SeccionCondicionesRiesgos raw={raw} />
          </SectionCard>
          <SectionCard title="VIII. Resguardo Personalizado de Activos">
            <ReadOnlyField label="Resguardo de Activos" value={resguardoActivos === "si" ? "Sí" : resguardoActivos === "no" ? "No" : resguardoActivos || "—"} />
          </SectionCard>
        </>
      )}
      <SeccionPerfil raw={raw} />
      <SeccionDocumentosAdjuntos raw={raw} />
    </div>
  )
}

function ExpedienteFiltro2({ sol }: { sol: SolicitudDetalle }) {
  const raw = sol._raw
  const actividades: string[]        = Array.isArray(raw?.actividades)        ? raw.actividades.filter(Boolean)        : []
  const responsabilidades: string[]  = Array.isArray(raw?.responsabilidades)   ? raw.responsabilidades.filter(Boolean)   : []
  const marcoNormativo: string[]     = Array.isArray(raw?.marco_normativo)     ? raw.marco_normativo.filter(Boolean)     : []
  const condicionesRiesgos: string[] = Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : []
  const resguardoActivos             = raw?.resguardo_activos as string | null | undefined
  const regimenNorm      = (sol.regimen ?? "").toLowerCase()
  const esNombramientoTD = regimenNorm.includes("nombramiento") || regimenNorm.includes("tiempo determinado")
  return (
    <div className="flex flex-col gap-4">
      <SeccionDatosGenerales sol={sol} />
      {esNombramientoTD && (
        <SectionCard title="II. Tabulador — Nivel y Categoría">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Nivel"     value={raw?.nivel_tabulador ?? "—"} />
            <ReadOnlyField label="Categoría" value={raw?.categoria_tabulador ?? "—"} />
          </div>
        </SectionCard>
      )}
      <SectionCard title={esNombramientoTD ? "III. Objeto del Nombramiento" : "I.1 Objeto de la Contratación"}>
        <p className="scroll-thin text-sm text-card-foreground leading-relaxed whitespace-pre-wrap" style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>
          {raw?.objeto ? applyTextRules(raw.objeto) : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>
      <SectionCard title={esNombramientoTD ? "IV. Actividades a Realizar" : "I.2 Actividades a Realizar"}>
        {actividades.length > 0 ? <ReadOnlyList items={actividades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      <SectionCard title={esNombramientoTD ? "V. Responsabilidades" : "I.3 Responsabilidades"}>
        {responsabilidades.length > 0 ? <ReadOnlyList items={responsabilidades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      {esNombramientoTD && (
        <>
          <SectionCard title="VI. Marco Normativo">
            {marcoNormativo.length > 0 ? <ReadOnlyList items={marcoNormativo} /> : <p className="text-sm text-muted-foreground">—</p>}
          </SectionCard>
          <SectionCard title="VII. Condiciones y Riesgos">
            <SeccionCondicionesRiesgos raw={raw} />
          </SectionCard>
          <SectionCard title="VIII. Resguardo Personalizado de Activos">
            <ReadOnlyField label="Resguardo de Activos" value={resguardoActivos === "si" ? "Sí" : resguardoActivos === "no" ? "No" : resguardoActivos || "—"} />
          </SectionCard>
        </>
      )}
      <SeccionPerfil raw={raw} />
      <SeccionDocumentosAdjuntos raw={raw} />
    </div>
  )
}
function ExpedienteFiltro3({ sol }: { sol: SolicitudDetalle }) {
  const raw = sol._raw
  const actividades: string[]        = Array.isArray(raw?.actividades)        ? raw.actividades.filter(Boolean)        : []
  const responsabilidades: string[]  = Array.isArray(raw?.responsabilidades)   ? raw.responsabilidades.filter(Boolean)   : []
  const marcoNormativo: string[]     = Array.isArray(raw?.marco_normativo)     ? raw.marco_normativo.filter(Boolean)     : []
  const condicionesRiesgos: string[] = Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : []
  const resguardoActivos             = raw?.resguardo_activos as string | null | undefined
  const esNombramiento = (sol.regimen ?? "").toLowerCase().includes("nombramiento")
  return (
    <div className="flex flex-col gap-4">
      <SeccionDatosGenerales sol={sol} />
      {esNombramiento && (
        <SectionCard title="II. Tabulador — Nivel y Categoría">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Nivel"     value={raw?.nivel_tabulador ?? "—"} />
            <ReadOnlyField label="Categoría" value={raw?.categoria_tabulador ?? "—"} />
          </div>
        </SectionCard>
      )}
      <SectionCard title={esNombramiento ? "III. Objeto del Nombramiento" : "I.1 Objeto de la Contratación"}>
        <p className="scroll-thin text-sm text-card-foreground leading-relaxed whitespace-pre-wrap" style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>
          {raw?.objeto ? applyTextRules(raw.objeto) : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>
      <SectionCard title={esNombramiento ? "IV. Actividades a Realizar" : "I.2 Actividades a Realizar"}>
        {actividades.length > 0 ? <ReadOnlyList items={actividades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      <SectionCard title={esNombramiento ? "V. Responsabilidades" : "I.3 Responsabilidades"}>
        {responsabilidades.length > 0 ? <ReadOnlyList items={responsabilidades} /> : <p className="text-sm text-muted-foreground">—</p>}
      </SectionCard>
      {esNombramiento && (
        <>
          <SectionCard title="VI. Marco Normativo">
            {marcoNormativo.length > 0 ? <ReadOnlyList items={marcoNormativo} /> : <p className="text-sm text-muted-foreground">—</p>}
          </SectionCard>
          <SectionCard title="VII. Condiciones y Riesgos">
            <SeccionCondicionesRiesgos raw={raw} />
          </SectionCard>
          <SectionCard title="VIII. Resguardo Personalizado de Activos">
            <ReadOnlyField label="Resguardo de Activos" value={resguardoActivos === "si" ? "Sí" : resguardoActivos === "no" ? "No" : resguardoActivos || "—"} />
          </SectionCard>
        </>
      )}
      <SeccionPerfil raw={raw} />
      <SeccionDocumentosAdjuntos raw={raw} />
    </div>
  )
}
function FolioDictamenCard({
  folioDictamen,
  onAsignar,
  esExtemporanea,
}: {
  folioDictamen: string | null
  onAsignar: (folio: string) => Promise<void>
  esExtemporanea: boolean
}) {
  const today = new Date()
  const [mes,         setMes]         = useState<number>(today.getMonth() + 1)
  const [anio,        setAnio]        = useState(String(today.getFullYear()))
  const [consecutivo, setConsecutivo] = useState("1")
  const [guardando,   setGuardando]   = useState(false)
  const autoCalledRef = useRef(false)
  const hasFetchedRef = useRef(false)
  useEffect(() => {
    const mesNum  = today.getMonth() + 1
    const anioNum = today.getFullYear()
    fetch(`/api/folio-dictamen/siguiente?mes=${mesNum}&anio=${anioNum}`)
      .then(r => r.json())
      .then(async json => {
        if (!json.ok) return
        const sig = String(json.siguiente)
        hasFetchedRef.current = true
        setConsecutivo(sig)
        if (!esExtemporanea && !folioDictamen && !autoCalledRef.current) {
          autoCalledRef.current = true
          await onAsignar(`${sig.padStart(2, "0")}/${String(mesNum).padStart(2, "0")}/${anioNum}`)
        }
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!esExtemporanea || folioDictamen || !hasFetchedRef.current) return
    const anioNum = parseInt(anio, 10)
    if (isNaN(anioNum) || anioNum < 2000) return
    fetch(`/api/folio-dictamen/siguiente?mes=${mes}&anio=${anioNum}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setConsecutivo(String(json.siguiente)) })
      .catch(() => {})
  }, [mes, anio])
  const mesStr      = String(mes).padStart(2, "0")
  const folioPreview = `${String(consecutivo).padStart(2, "0")}/${mesStr}/${anio}`
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
  if (!esExtemporanea) return null
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Stamp className="h-4 w-4 text-secondary" />
          {folioDictamen ? "Reasignar Folio de Dictamen" : "Asignar Folio de Dictamen"}
        </CardTitle>
        <CardDescription className="text-xs">
          {folioDictamen
            ? `Folio actual: ${formatearFolio(folioDictamen)}. Asigne el folio definitivo.`
            : "Asigne el número secuencial de dictamen antes de aprobar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Mes</Label>
            <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES_RECEPCION.map(m => (
                  <SelectItem key={m.num} value={String(m.num)}>
                    {m.label} ({String(m.num).padStart(2, "0")})
                  </SelectItem>
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
            <Input
              type="number"
              value={consecutivo}
              readOnly
              disabled
              className="bg-muted font-mono cursor-not-allowed opacity-70"
            />
          </div>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Folio de dictamen: </span>
          <span className="text-sm font-semibold font-mono text-card-foreground">{folioPreview}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">Formato NN/MM/AAAA: número secuencial / mes / año.</p>
        </div>
        <Button onClick={handleAsignar} disabled={guardando || !consecutivo || !mes || !anio} className="w-full gap-2">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
          Asignar Folio de Dictamen
        </Button>
      </CardContent>
    </Card>
  )
}
function FolioRecepcionCard({
  folioRecepcion,
  onAsignar,
  esExtemporanea,
}: {
  folioRecepcion: string | null
  onAsignar: (folio: string) => Promise<void>
  esExtemporanea: boolean
}) {
  const today = new Date()
  const mesNumHoy  = today.getMonth() + 1
  const anioNum    = today.getFullYear()
  const mesCodeHoy = INICIALES_MES_MAP[String(mesNumHoy).padStart(2, "0")] ?? "XX"
  const [siguienteFrec, setSiguienteFrec] = useState<number | null>(null)
  const [ultimoFrec,    setUltimoFrec]    = useState<number | null>(null)
  const [siguienteExt,  setSiguienteExt]  = useState<number | null>(null)
  const [mesDefinitivo,      setMesDefinitivo]      = useState<number>(mesNumHoy)
  const [anioDefinitivo,     setAnioDefinitivo]     = useState<string>(String(anioNum))
  const [siguienteDefinitivo, setSiguienteDefinitivo] = useState<number | null>(null)
  const [cargandoDefinitivo,  setCargandoDefinitivo]  = useState(false)
  const [guardando,    setGuardando]    = useState(false)
  const autoCalledRef = useRef(false)

  useEffect(() => {
    fetch(`/api/folio-recepcion/siguiente?mes=${mesNumHoy}&anio=${anioNum}`)
      .then(r => r.json())
      .then(async json => {
        if (!json.ok) return
        setSiguienteFrec(json.siguiente)
        setUltimoFrec(json.ultimo)
        if (!esExtemporanea && !folioRecepcion && !autoCalledRef.current) {
          autoCalledRef.current = true
          const folio = `${mesCodeHoy}-${String(json.siguiente).padStart(3, "0")}-${anioNum}`
          await onAsignar(folio)
        }
      })
      .catch(() => {})

    if (esExtemporanea) {
      fetch(`/api/folio-recepcion/siguiente?mes=${mesNumHoy}&anio=${anioNum}&ext=true`)
        .then(r => r.json())
        .then(json => { if (json.ok) setSiguienteExt(json.siguiente) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!esExtemporanea || !folioRecepcion) return
    const anio = parseInt(anioDefinitivo, 10)
    if (isNaN(anio) || anio < 2000) return
    setCargandoDefinitivo(true)
    fetch(`/api/folio-recepcion/siguiente?mes=${mesDefinitivo}&anio=${anio}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setSiguienteDefinitivo(json.siguiente) })
      .catch(() => {})
      .finally(() => setCargandoDefinitivo(false))
  }, [mesDefinitivo, anioDefinitivo, esExtemporanea, folioRecepcion])

  const mesCodeDefinitivo = INICIALES_MES_MAP[String(mesDefinitivo).padStart(2, "0")] ?? "XX"
  const folioDefinitivo   = siguienteDefinitivo !== null
    ? `${mesCodeDefinitivo}-${String(siguienteDefinitivo).padStart(3, "0")}-${parseInt(anioDefinitivo, 10)}`
    : null

  const folioTemporalPreview = `${mesCodeHoy}-${String(ultimoFrec ?? 0).padStart(3, "0")}-${siguienteExt ?? 1}`

  const handleAsignar = async (folio: string) => {
    setGuardando(true)
    await onAsignar(folio)
    setGuardando(false)
  }

  // Temporal = 3 partes donde la última NO es un año de 4 dígitos (ej. MY-001-1)
  // Normal con año = 3 partes donde la última SÍ es año (ej. MY-001-2026)
  const esFolioTemporal = (f: string) => {
    const p = f.split("-")
    return p.length >= 3 && !/^\d{4}$/.test(p[p.length - 1])
  }

  if (folioRecepcion && (!esExtemporanea || !esFolioTemporal(folioRecepcion))) {
    return (
      <Card className="shadow-sm border-primary/30 border-2 bg-primary/[0.03]">
        <CardContent className="flex items-center gap-3 p-4">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-card-foreground">Folio de Recepción Asignado</p>
            <p className="text-xs text-muted-foreground font-mono">{folioRecepcion}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!esExtemporanea) return null
  if (folioRecepcion) {
    return (
      <Card className="shadow-sm border-amber-300 border-2 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <FileText className="h-4 w-4 text-amber-600" />Folio de Recepción
          </CardTitle>
          <CardDescription className="text-xs">
            Elija el mes y el año
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Folio temporal: </span>
            <span className="text-sm font-semibold font-mono text-amber-700">{folioRecepcion}</span>
          </div>

          {}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Mes del folio definitivo</Label>
              <Select
                value={String(mesDefinitivo)}
                onValueChange={v => setMesDefinitivo(Number(v))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_RECEPCION.map(m => (
                    <SelectItem key={m.num} value={String(m.num)}>
                      {m.label} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Año</Label>
              <Input
                value={anioDefinitivo}
                onChange={e => setAnioDefinitivo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2026"
                className="bg-background font-mono"
                maxLength={4}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Folio definitivo: </span>
            <span className="text-sm font-semibold font-mono text-card-foreground">
              {cargandoDefinitivo ? "Cargando…" : (folioDefinitivo ?? "—")}
            </span>
          </div>

          <Button
            onClick={() => folioDefinitivo && handleAsignar(folioDefinitivo)}
            disabled={guardando || cargandoDefinitivo || !folioDefinitivo}
            className="w-full gap-2"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Asignar Folio Definitivo
          </Button>
        </CardContent>
      </Card>
    )
  }
  const listoTemporal = ultimoFrec !== null && siguienteExt !== null
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <FileText className="h-4 w-4 text-primary" />Asignar Folio de Recepción
        </CardTitle>
        <CardDescription className="text-xs">
          Folio de extemporánea: último folio asignado + número de extemporánea (ej. AB-001-1).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Folio de recepción: </span>
          <span className="text-sm font-semibold font-mono text-card-foreground">
            {listoTemporal ? folioTemporalPreview : "Cargando…"}
          </span>
        </div>
        <Button onClick={() => handleAsignar(folioTemporalPreview)} disabled={guardando || !listoTemporal} className="w-full gap-2">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Asignar Folio de Recepción
        </Button>
      </CardContent>
    </Card>
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
              <h3 className="font-bold text-gray-900 text-base leading-tight pt-2">Aprobar y Asignar Revisor</h3>
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
              disabled={!selectedId || guardando || loading}
              onClick={() => onConfirm(selectedId)}
              className="gap-1.5 bg-[#773357] text-white rounded-full hover:bg-[#5c2844]"
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

const AVAILABLE_DESTINATARIOS = [
  "URG-01 Oficina del Secretario", "URG-02 Dirección General", "URG-03 Coordinación Administrativa",
  "UEFA Sec. de Finanzas", "UEFA Sec. de Educación", "UEFA Sec. de Salud",
  "UEFA Sec. de Gobierno", "UEFA Sec. de Obras", "UEFA Sec. de Desarrollo",
  "Dir. Gral. de Administración y Finanzas", "Dir. Gral. de Profesionalización", "Dir. Gral. de Recursos Humanos",
]

export function RevisionDOPage({ solicitudId, filtro, onBack, onEditSolicitud }: RevisionDOPageProps) {
  const { user } = useAuth()
  const hasDataRef       = useRef(false)
  const accionExitosaRef = useRef<'aprobar' | 'observar' | null>(null)
  const avanzadaRef      = useRef(false)
  const [solicitud,  setSolicitud]  = useState<SolicitudDetalle | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [guardando,  setGuardando]  = useState(false)

  const [activeTab,          setActiveTab]          = useState<ActiveTab>("review")
  const [observacionGeneral, setObservacionGeneral] = useState("")
  const [observacionError,   setObservacionError]   = useState("")
  const [sinObservacion,     setSinObservacion]     = useState(false)
  const [showEmitConfirm,         setShowEmitConfirm]         = useState(false)
  const [showAprobarAsignarModal, setShowAprobarAsignarModal] = useState(false)
  const [showConfirmacion,        setShowConfirmacion]        = useState<string | null>(null)
  const [checklistErrors,    setChecklistErrors]    = useState<Record<string, boolean>>({})
  const [errorToast, setErrorToast] = useState<{ key: number; title: string; description?: string } | null>(null)
  const showToast = (variant: "success" | "error", title: string, description?: string) => {
    if (variant === "error") setErrorToast(prev => ({ key: (prev?.key ?? 0) + 1, title, description }))
  }

  const today = new Date().toISOString().slice(0, 10)
  const [fechaDictaminacion,    setFechaDictaminacion]    = useState(today)

  const [calData, setCalData] = useState<{ honorarios: any[]; asimilados: any[]; nombramiento: any[] }>({ honorarios: [], asimilados: [], nombramiento: [] })
  useEffect(() => {
    const year = new Date().getFullYear()
    fetch(`/api/calendario?ejercicio=${year}`)
      .then(r => r.json())
      .then(data => setCalData({ honorarios: data.honorarios ?? [], asimilados: data.asimilados ?? [], nombramiento: data.nombramiento ?? [] }))
      .catch(() => {})
  }, [])

  const dictaminacionRange = useMemo(() => {
    if (!solicitud) return { from: undefined, to: undefined }
    const [mesStr] = solicitud.periodo.split("/")
    const mesNum = parseInt(mesStr, 10)
    const mesNombre = MESES_RECEPCION.find(m => m.num === mesNum)?.label ?? ""
    const regimenNorm = (solicitud._raw?.regimen ?? solicitud.regimen ?? "").toLowerCase()

    let row: { limiteDO: string; limiteDGRH: string } | undefined

    if (regimenNorm.includes("honorario")) {
      row = calData.honorarios.find((r: any) => r.mes === mesNombre)
    } else {
      const vigFin: string = solicitud._raw?.vigencia_fin ?? ""
      const finDay = vigFin ? new Date(vigFin).getUTCDate() : 0
      const quincena = finDay > 0 && finDay <= 15 ? "1ra" : "2da"
      const quincenaLabel = `${quincena} ${mesNombre}`
      const table = regimenNorm.includes("asimilado") ? calData.asimilados : calData.nombramiento
      row = table.find((r: any) => r.quincena === quincenaLabel)
    }

    if (!row?.limiteDO || !row?.limiteDGRH) return { from: undefined, to: undefined }
    const dateA = parseDateDMY(row.limiteDO)
    const dateB = parseDateDMY(row.limiteDGRH)
    const from = dateA <= dateB ? dateA : dateB
    const to   = dateA <= dateB ? dateB : dateA
    return { from, to }
  }, [solicitud, calData])
  const [modalidadFirma,        setModalidadFirma]        = useState<"electronica" | "autografa">("electronica")
  const [selectedDestinatarios, setSelectedDestinatarios] = useState<string[]>([])
  const [archivoSubido,         setArchivoSubido]         = useState(false)
  const [autografaDescargado,   setAutografaDescargado]   = useState(false)
  const [selladoEmisionSubido,  setSelladoEmisionSubido]  = useState(false)
  const [firmaEmisionAbierta,   setFirmaEmisionAbierta]   = useState(false)

  const cargar = useCallback(async () => {
    if (avanzadaRef.current) return
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const userId = (user as any)?.id ?? ""
      const res  = await fetch(`/api/filtro?filtro=${filtro}&userId=${userId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar"); return }

      const item = (json.data ?? []).find((d: any) => String(d.id) === String(solicitudId))
      if (!item) {
        const res2  = await fetch(`/api/solicitudes?id=${solicitudId}`)
        const json2 = await res2.json()
        const item2 = json2.ok ? (json2.data ?? []).find((d: any) => String(d.id) === String(solicitudId)) : null
        if (item2) { setSolicitud(mapBDtoDetalle(item2._raw ?? item2)); hasDataRef.current = true; return }
        if (accionExitosaRef.current) {
          avanzadaRef.current = true
          setError(`__avanzada__${accionExitosaRef.current}`)
        } else {
          setError("Solicitud enviada al siguiente filtro")
        }
        return
      }
      accionExitosaRef.current = null
      avanzadaRef.current = false
      const rawBase = item._raw ?? item
      const folioDictamenResuelto =
        resolverFolioDictamen(item) ??
        resolverFolioDictamen(rawBase)
      const merged = {
        ...rawBase,
        folioDictamen: folioDictamenResuelto,
        dictamen:      rawBase.dictamen ?? item.dictamen ?? null,
        slaRestante:   item.slaRestante ?? null,
        _raw:          rawBase,
      }
      const mapped = mapBDtoDetalle(merged)
      setSolicitud(mapped)
      hasDataRef.current = true

      if (filtro === 3) {
        const urgDefault = "URG-01 Oficina del Secretario"
        const uefaMatch  = AVAILABLE_DESTINATARIOS.find(d => d.includes(mapped.secretaria.replace("Sec. de ", "")))
        setSelectedDestinatarios([urgDefault, ...(uefaMatch ? [uefaMatch] : [])])
      }
    } catch { setError("Error de conexión al servidor") }
    finally { setLoading(false) }
  }, [solicitudId, filtro])
  useEffect(() => { cargar() }, [cargar])
  useRealtime(["revision"], cargar)
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
            observacion: obs   !== undefined ? obs   : current.observacion,
          },
        },
      }
    })
  }, [])
  const checklistItems = useMemo(() => getChecklistItems(filtro, solicitud?.tipo), [filtro, solicitud?.tipo])
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
  const folioDictamenResuelto = useMemo(() => {
    if (!solicitud) return null
    return solicitud.folioDictamen ?? resolverFolioDictamen(solicitud._raw) ?? null
  }, [solicitud])
  const folioRecepcionResuelto = useMemo(() => {
    if (!solicitud) return null
    return solicitud.folioRecepcion ?? solicitud._raw?.folio_recepcion ?? null
  }, [solicitud])
  const hasFolioDictamen    = !!folioDictamenResuelto
  const canApproveChecklist = checklistStats.allDone && !checklistStats.hasNo
  const canApprove =
    filtro === 3 ? sinObservacion
    : filtro === 2 ? (sinObservacion && hasFolioDictamen)
    : canApproveChecklist
  const checklistYaRealizado = filtro === 1 && (
    (solicitud?.estado ?? "").toLowerCase().includes("observado por validacion final") ||
    (solicitud?.estado ?? "").toLowerCase() === "observado por revisor"
  )
  const isEnTabObservadas = (() => {
    const n = (solicitud?.estado ?? "").toLowerCase()
    if (filtro === 1) return n === "observado por revisor"
    if (filtro === 3) return n === "observado por emisor"
    return (n.includes("observad") || n.includes("devuelta")) && !n.includes("por emisor")
  })()
  const isCheckboxSinObsDisabled = (solicitud?.estado ?? "").toLowerCase().includes("observad")
  const canObservar = isEnTabObservadas || (filtro === 1 && checklistYaRealizado) || (
    (filtro === 2 || filtro === 3)
      ? !sinObservacion
      : (checklistStats.allDone && checklistStats.hasNo && checklistStats.noWithoutObs === 0)
  )
  const observarBlocked = false

  const patchEstado = useCallback(async (accion: "aprobar" | "observar", observaciones?: string, revisorId?: string, modalidadFirmaValue?: "electronica" | "autografa") => {
    if (!solicitud) return
    setGuardando(true)
    try {
      const res  = await fetch("/api/filtro", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId:   solicitud.id,
          filtro,
          accion,
          usuarioId:     (user as any)?.id ?? "",
          observaciones: observaciones ? [observaciones] : undefined,
          ...(revisorId ? { revisorId } : {}),
          ...(modalidadFirmaValue ? { modalidadFirma: modalidadFirmaValue } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { showToast("error", accion === "aprobar" ? "Error al aprobar" : "Error al observar", json.error ?? `No se pudo ${accion} la solicitud.`); return }
      accionExitosaRef.current = accion
      setSolicitud(prev => prev ? {
        ...prev,
        estado:        json.estadoNuevo ?? prev.estado,
        folioDictamen: json.folioDictamen ?? prev.folioDictamen,
      } : prev)
      return json.estadoNuevo as string
    } catch { showToast("error", "Error de conexión", "No se pudo conectar con el servidor.") }
    finally { setGuardando(false) }
  }, [solicitud, filtro, user])

  const yaEstuvoEnRevisor = useMemo(() =>
    (solicitud?.historial ?? []).some(h =>
      h.estadoNuevo.toLowerCase().includes("en revision revisor")
    )
  , [solicitud])
  const handleAprobar = async (revisorId?: string) => {
    if (filtro === 3) {
      const modalidadExistente = (solicitud as any)?.modalidadFirma as "electronica" | "autografa" | null | undefined
      if (modalidadExistente === "electronica" || modalidadExistente === "autografa") {
        await patchEstado("aprobar", undefined, undefined, modalidadExistente)
        return
      }
      setShowEmitConfirm(true); return
    }
    if (filtro === 2 && !yaEstuvoEnRevisor && !revisorId) {
      setShowAprobarAsignarModal(true)
      return
    }
    await patchEstado("aprobar", undefined, revisorId)
  }
  const handleConfirmEmit = async () => {
    setShowEmitConfirm(false)
    const nuevoEstado = await patchEstado("aprobar", undefined, undefined, modalidadFirma)
    if (nuevoEstado) setSolicitud(prev => prev ? { ...prev, estado: nuevoEstado } : prev)
  }
  const handleObservar = async () => {
    if (filtro === 2 || filtro === 3 || (filtro === 1 && checklistYaRealizado)) {
      if (!observacionGeneral.trim()) { setObservacionError("Escribe una observación para devolver el expediente."); return }
      setObservacionError("")
      const nuevoEstado = await patchEstado("observar", observacionGeneral.trim())
      if (nuevoEstado) {
        setObservacionGeneral("")
        avanzadaRef.current = true
        setError("__avanzada__observar")
      }
      return
    }
    const errors: Record<string, boolean> = {}
    let hasErrors = false
    checklistItems.forEach(item => {
      const s = solicitud?.checklistDO[item.key]
      if (s?.valor === "no" && !s.observacion.trim()) { errors[item.key] = true; hasErrors = true }
    })
    if (hasErrors) { setChecklistErrors(errors); return }
    const resumen = checklistItems
      .filter(item => solicitud?.checklistDO[item.key]?.valor === "no")
      .map(item => `${item.num}. ${item.label}::${solicitud?.checklistDO[item.key]?.observacion}`)
      .join("\n")
    const obs = [observacionGeneral.trim(), resumen].filter(Boolean).join("\n")
    const nuevoEstado = await patchEstado("observar", obs)
    if (nuevoEstado) {
      setObservacionGeneral("")
      setChecklistErrors({})
      avanzadaRef.current = true
      setError("__avanzada__observar")
    }
  }

  const handleEmitir = async () => {
    if (!solicitud) return
    const nuevoEstado = await patchEstado("aprobar", undefined, undefined, modalidadFirma)
    if (nuevoEstado) setSolicitud(prev => prev ? { ...prev, estado: nuevoEstado } : prev)
  }

  const handleAsignarFolioDictamen = useCallback(async (folio: string) => {
    if (!solicitud) return
    try {
      const res = await fetch("/api/filtro", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId:   solicitud.id,
          accion:        "asignarFolio",
          folioDictamen: folio,
          usuarioId:     (user as any)?.id ?? "",
          filtro,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        console.warn("[asignarFolio] API error:", json?.error)
        return
      }
      setSolicitud(prev => prev ? { ...prev, folioDictamen: folio } : prev)
    } catch (err) {
      console.error("[asignarFolio] Network error:", err)
    }
  }, [solicitud, filtro, user])

  const handleAsignarFolioRecepcion = useCallback(async (folio: string) => {
    if (!solicitud) return
    try {
      const res = await fetch("/api/filtro", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId:    solicitud.id,
          accion:         "asignarFolioRecepcion",
          folioRecepcion: folio,
          usuarioId:      (user as any)?.id ?? "",
          filtro,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        console.warn("[asignarFolioRecepcion] API error:", json?.error)
        return
      }
      setSolicitud(prev => prev ? { ...prev, folioRecepcion: folio, folio } : prev)
    } catch (err) {
      console.error("[asignarFolioRecepcion] Network error:", err)
    }
  }, [solicitud, filtro, user])

  const isEmitido      = solicitud?.estado === "Emitido"
  const isAprobado     = solicitud?.estado === "Pendiente Firma Dictamen"
  const isAceptadoPorRevisor = filtro === 1 && (
    solicitud?.estado?.toLowerCase() === "aceptado por revisor" ||
    solicitud?.estado?.toLowerCase() === "aprobado por revisor"
  )
  const showEmisionTab = filtro === 3 && (isAprobado || isEmitido)
  const canEmit        = selectedDestinatarios.length > 0 && fechaDictaminacion &&
    (modalidadFirma === "electronica"
      ? true
      : (autografaDescargado && archivoSubido))

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      <span className="text-sm text-muted-foreground">Cargando expediente...</span>
    </div>
  )

  if (error || !solicitud) {
    const esAvanzada = error?.startsWith('__avanzada__')
    const esObservada = error === '__avanzada__observar'
    if (esAvanzada) return (
      <ActionResultScreen
        type={esObservada ? "observe" : "approve"}
        onBack={() => onBack(filtro)}
      />
    )
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f4f6]">
          <AlertCircle className="h-8 w-8 text-[#9ca3af]" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-foreground">{error ?? "Solicitud no encontrada"}</h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[#773357] px-5 py-2 text-sm font-medium text-[#773357] transition-colors hover:bg-[#773357]/5"
          onClick={() => onBack(filtro)}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />Regresar a bandeja
        </button>
      </div>
    )
  }

  return (
    <PageLayout noContainer>
    <div className="flex flex-col gap-4 h-full">
      {errorToast && (
        <ConfirmToast key={errorToast.key} variant="error" title={errorToast.title} description={errorToast.description} />
      )}
      {showEmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-primary/30 border-2">
            <CardContent className="flex flex-col items-center gap-5 p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-card-foreground">Modalidad de Firma</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Selecciona cómo se firmará el dictamen. Esta decisión aplicará a todas las firmas del flujo; no se puede mezclar electrónica y autógrafa.
                </p>
              </div>
              <RadioGroup value={modalidadFirma}
                onValueChange={v => { setModalidadFirma(v as any); if (v === "electronica") { setAutografaDescargado(false); setArchivoSubido(false) } else { setSelladoEmisionSubido(false) } }}
                className="flex flex-col gap-3 w-full">
                {[
                  { value: "electronica", label: "Firma Electrónica", desc: "Se firmará digitalmente al emitir" },
                  { value: "autografa",   label: "Firma Autógrafa",   desc: "Descargue, firme y suba el documento" },
                ].map(opt => (
                  <label key={opt.value} htmlFor={`confirm-firma-${opt.value}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${modalidadFirma === opt.value ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"}`}>
                    <RadioGroupItem value={opt.value} id={`confirm-firma-${opt.value}`} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-card-foreground">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <div className="flex items-center gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setShowEmitConfirm(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleConfirmEmit} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar y aprobar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AprobarAsignarModal
        open={showAprobarAsignarModal}
        onClose={() => setShowAprobarAsignarModal(false)}
        onConfirm={(revisorId) => { setShowAprobarAsignarModal(false); handleAprobar(revisorId) }}
        folio={formatearFolio(solicitud?.folioJustificacion ?? solicitud?.folio ?? null)}
        guardando={guardando}
      />


      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onBack(filtro)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Regresar
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">
                {solicitud.folio ?? <span className="text-muted-foreground font-normal text-base">Sin Folio de Recepción</span>}
              </h2>
              <Badge className="bg-primary/15 text-primary border-0 text-xs">{solicitud.estado}</Badge>
              {isEmitido && (
                <Badge className="bg-primary text-primary-foreground border-0 text-xs gap-1">
                  <Lock className="h-3 w-3" />Emitido
                </Badge>
              )}
              {solicitud.folio && (
                <Badge className="bg-primary/15 text-primary border-0 text-xs gap-1">
                  <FileText className="h-3 w-3" />Rec. {solicitud.folio}
                </Badge>
              )}
              {folioDictamenResuelto && (
                <Badge className="bg-secondary/15 text-secondary border-0 text-xs gap-1">
                  <Stamp className="h-3 w-3" />Dict. {formatearFolio(folioDictamenResuelto)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {solicitud.tipo} — {solicitud.secretaria}
            </p>
            {solicitud.denominacion && solicitud.denominacion !== "—" && !isCheckboxSinObsDisabled && (
              <p className="text-xs text-muted-foreground font-medium">{solicitud.denominacion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="gap-1.5 rounded-full border-gray-300 text-gray-700 hover:bg-gray-100 bg-transparent"
            onClick={() => generateJustificacionPDF(solicitud.id, solicitud.folioJustificacion)}
          >
            <Download className="h-4 w-4" />Justificación (PDF)
          </Button>
          {onEditSolicitud && !isEnTabObservadas && (
            <Button size="sm" className="gap-1.5"
              onClick={() => onEditSolicitud(rawToEditPayload(solicitud))}
            >
              <Pencil className="h-4 w-4" />Editar
            </Button>
          )}
          {!isEmitido && <SlaIndicatorLarge diasRestantes={solicitud.slaRestante} />}
        </div>
      </div>


      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            {filtro === 1 && <ExpedienteFiltro1 sol={solicitud} />}
            {filtro === 2 && <ExpedienteFiltro2 sol={solicitud} />}
            {filtro === 3 && <ExpedienteFiltro3 sol={solicitud} />}
          </div>
        </ScrollArea>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
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
              {solicitud.observacionesTodas.length > 0 && (
                <button onClick={() => setActiveTab("observaciones")}
                  className={`relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "observaciones" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"}`}>
                  <AlertCircle className="mr-1.5 inline h-4 w-4" />Observaciones
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#832B56] text-[9px] font-bold text-white">
                    {solicitud.observacionesTodas.length}
                  </span>
                </button>
              )}
              <button onClick={() => setActiveTab("historial")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === "historial" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"}`}>
                <History className="mr-1.5 inline h-4 w-4" />Historial
              </button>
            </div>

            {activeTab === "review" && !isEmitido && (
              <>
                {filtro !== 3 && !isEnTabObservadas && (
                  <>
                    {filtro === 1 && (
                      <FolioDictamenCard folioDictamen={folioDictamenResuelto} onAsignar={handleAsignarFolioDictamen} esExtemporanea={solicitud.esExtemporanea} />
                    )}
                    {filtro === 1 && (
                      <FolioRecepcionCard folioRecepcion={folioRecepcionResuelto} onAsignar={handleAsignarFolioRecepcion} esExtemporanea={solicitud.esExtemporanea} />
                    )}
                    {filtro === 1 && checklistYaRealizado && (
                      <Card className="shadow-sm border-2 border-secondary/40 bg-secondary/[0.04]">
                        <CardContent className="flex items-start gap-3 p-4">
                          <ClipboardCheck className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-secondary">Checklist ya fue realizado</span>
                            <p className="text-xs text-muted-foreground">
                              El checklist normativo fue completado en la revisión anterior.
                              Para aplicar correcciones, utilice el botón <strong>Editar</strong>.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {filtro === 1 && !checklistYaRealizado && (
                      <>
                        {}
                        <Card className={`shadow-sm border-2 ${checklistStats.hasNo ? "border-destructive/30 bg-destructive/[0.03]" : checklistStats.allDone ? "border-secondary/30 bg-secondary/[0.03]" : "border-border"}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4 text-secondary" />
                                <span className="text-sm font-semibold text-card-foreground">Checklist Normativo — Revisor</span>
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

                        {}
                        <Card className="shadow-sm border-border">
                          <CardContent className="p-0">
                            <div className="divide-y divide-border">
                              {checklistItems.map(item => {
                                const s       = solicitud.checklistDO[item.key]
                                const valor   = s?.valor ?? null
                                const itemObs = s?.observacion ?? ""
                                const hasErr  = checklistErrors[item.key]

                                const rowStyle: React.CSSProperties | undefined =
                                  valor === "si"
                                    ? { borderLeftColor: COLOR_SI,        backgroundColor: `${COLOR_SI}55` }
                                    : valor === "no"
                                    ? { borderLeftColor: COLOR_NO,        backgroundColor: `${COLOR_NO}20` }
                                    : valor === "noAplica"
                                    ? { borderLeftColor: COLOR_NO_APLICA, backgroundColor: `${COLOR_NO_APLICA}20` }
                                    : undefined

                                const rowBorderClass = valor ? "border-l-4" : ""

                                const badgeStyle: React.CSSProperties | undefined =
                                  valor === "si"
                                    ? { backgroundColor: `${COLOR_SI}30`,        color: COLOR_SI_TEXT }
                                    : valor === "no"
                                    ? { backgroundColor: `${COLOR_NO}30`,        color: COLOR_NO }
                                    : valor === "noAplica"
                                    ? { backgroundColor: `${COLOR_NO_APLICA}50`, color: COLOR_NO_APLICA }
                                    : undefined

                                const labelStyle: React.CSSProperties | undefined =
                                  valor === "si"
                                    ? { color: COLOR_SI_TEXT }
                                    : valor === "no"
                                    ? { color: COLOR_NO }
                                    : valor === "noAplica"
                                    ? { color: COLOR_NO_APLICA }
                                    : undefined

                                return (
                                  <div key={item.key}>
                                    <div
                                      className={`flex flex-col gap-3 p-4 transition-colors ${rowBorderClass}`}
                                      style={rowStyle}
                                    >
                                      <div className="flex items-start gap-3">
                                        {}
                                        <span
                                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                                          style={
                                            valor
                                              ? badgeStyle
                                              : { backgroundColor: "var(--border)", color: "var(--muted-foreground)" }
                                          }
                                        >
                                          {item.num}
                                        </span>

                                        <div className="flex flex-1 flex-col gap-2">
                                          {}
                                          <span
                                            className={`text-sm leading-snug ${valor ? "font-medium" : "text-card-foreground"}`}
                                            style={labelStyle}
                                          >
                                            {item.label}
                                          </span>

                                          {}
                                          <div className="flex flex-wrap gap-2">
                                            <RadioOption
                                              value="si"
                                              selected={valor === "si"}
                                              onChange={() => updateChecklist(item.key, valor === "si" ? null : "si", "")}
                                              label="Sí"
                                              style={{ backgroundColor: "#d2fad2", color: "#1c7d29", borderColor: "#1c7d29" }}
                                            />
                                            <RadioOption
                                              value="no"
                                              selected={valor === "no"}
                                              onChange={() => updateChecklist(item.key, valor === "no" ? null : "no")}
                                              label="No"
                                              style={{ backgroundColor: "#ffd6d7", color: "#87090c", borderColor: "#87090c" }}
                                            />
                                            <RadioOption
                                              value="noAplica"
                                              selected={valor === "noAplica"}
                                              onChange={() => updateChecklist(item.key, valor === "noAplica" ? null : "noAplica", "")}
                                              label="No Aplica"
                                              style={{ backgroundColor: "#f3f2ee", color: "#4B5563", borderColor: "#9CA3AF" }}
                                            />
                                          </div>

                                          {}
                                          {(valor === "no" || itemObs) && (
                                            <div className="flex flex-col gap-1">
                                              <Textarea
                                                value={itemObs}
                                                onChange={e => updateChecklist(item.key, valor, e.target.value)}
                                                placeholder={valor === "no" ? "Obligatorio: describa la observación..." : "Observaciones de este punto..."}
                                                className={`bg-background min-h-10 text-xs resize-none ${hasErr ? "border-destructive" : ""}`}
                                                rows={2}
                                              />
                                              {hasErr && (
                                                <span className="text-[10px] text-destructive font-medium">
                                                  Debe escribir una observación para los puntos marcados como "No"
                                                </span>
                                              )}
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
                      </>
                    )}

                    {filtro === 2 && !hasFolioDictamen && (
                      <Card className="shadow-sm border-primary/40 border-2 bg-primary/[0.04]">
                        <CardContent className="flex items-start gap-3 p-4">
                          <Stamp className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                          <div>
                            <span className="text-sm font-medium text-primary">Folio de Dictamen requerido</span>
                            <p className="text-xs text-muted-foreground">Debe asignarse el folio de dictamen antes de aprobar.</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {filtro === 1 && !isEnTabObservadas && (
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
                    )}
                  </>
                )}

                {filtro !== 1 && (
                  <div className={`overflow-hidden rounded-xl border border-border shadow-md transition-opacity ${isEnTabObservadas ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #A0845C 0%, #C4A882 100%)" }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          Revisión de Dirección General
                          {isEnTabObservadas && <Lock className="h-3.5 w-3.5 text-white/60" />}
                        </span>
                        <span className="text-xs font-semibold text-white/90">
                          {isEnTabObservadas
                            ? `Solicitud en estado "${solicitud?.estado}" — no disponible para edición.`
                            : "Determine si procede la emisión o requiere observaciones."}
                        </span>
                      </div>
                      {sinObservacion && (
                        <div className="ml-auto flex h-7 items-center rounded-full bg-white/15 px-3">
                          <span className="text-[11px] font-semibold text-white/90">Sin obs.</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-card p-4 flex flex-col gap-4">
                      <div className={`flex items-start gap-3 rounded-lg border p-3 ${isCheckboxSinObsDisabled ? "pointer-events-none border-destructive/30 bg-destructive/[0.04]" : "border-border bg-muted/30"}`}>
                        <Checkbox id="sin-obs-dg" checked={sinObservacion}
                          disabled={isCheckboxSinObsDisabled}
                          onCheckedChange={v => { if (isCheckboxSinObsDisabled) return; setSinObservacion(!!v); if (v) { setObservacionGeneral(""); setObservacionError("") } }} />
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="sin-obs-dg" className={`text-sm font-medium ${isCheckboxSinObsDisabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}>No hay ninguna observación</Label>
                          <span className="text-xs text-muted-foreground">
                            {isCheckboxSinObsDisabled
                              ? "La solicitud se encuentra observada — esta opción no está disponible."
                              : sinObservacion
                                ? "El expediente está listo para continuar. Desmarque para agregar observaciones y devolver el expediente."
                                : "Marque para confirmar que no hay observaciones y continuar con el proceso."}
                          </span>
                        </div>
                      </div>
                      {!sinObservacion && !isEnTabObservadas && (
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium text-card-foreground">Observación</Label>
                          <Textarea value={observacionGeneral}
                            onChange={e => { setObservacionGeneral(e.target.value); if (e.target.value.trim()) setObservacionError("") }}
                            placeholder="Describa las observaciones para devolver el expediente..."
                            className={`bg-background min-h-24 ${observacionError ? "border-destructive" : ""}`} />
                          {observacionError && <span className="text-xs text-destructive">{observacionError}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {filtro === 1 && !canApprove && !canObservar && checklistStats.completed === checklistStats.total && checklistStats.hasNo && checklistStats.noWithoutObs > 0 && (
                  <Card className="shadow-sm border-destructive/40 border-2 bg-destructive/[0.04]">
                    <CardContent className="flex items-start gap-3 p-4">
                      <img src="/iconos2/Icon.svg" alt="" className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-destructive">Observaciones incompletas</span>
                        <p className="text-xs text-muted-foreground">{checklistStats.noWithoutObs} punto(s) marcado(s) como "No" requieren comentario obligatorio antes de observar.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!isAceptadoPorRevisor && !canApprove && !canObservar && filtro !== 3 && checklistStats.completed < checklistStats.total && (
                  <Card className="shadow-sm border-border bg-muted/30">
                    <CardContent className="flex items-start gap-3 p-4">
                      <img src="/iconos2/Icon.svg" alt="" className="h-5 w-5 shrink-0 mt-0.5 opacity-50" />
                      <div>
                        <span className="text-sm font-medium text-card-foreground">Verificación en progreso</span>
                        <p className="text-xs text-muted-foreground">Faltan {checklistStats.total - checklistStats.completed} verificaciones por completar.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {}
                {isAceptadoPorRevisor ? (
                  <Card className="shadow-sm border-border sticky bottom-0">
                    <CardContent className="flex items-center justify-between p-4">
                      <Button size="sm" onClick={handleObservar}
                        disabled={!canObservar || observarBlocked || guardando}
                        className="rounded-2xl font-medium hover:opacity-90"
                        style={{ backgroundColor: "#fce4f0", color: "#7c2d5e", border: "1px solid #f0b0d0" }}>
                        Observar
                      </Button>
                      <Button size="sm" onClick={() => handleAprobar()} disabled={!canApprove || guardando}
                        className="gap-1.5">
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Aprobar
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-sm border-border sticky bottom-0">
                    <CardContent className="flex items-center justify-between p-4">
                      <Button size="sm" onClick={handleObservar}
                        disabled={!canObservar || observarBlocked || guardando}
                        className="rounded-2xl font-medium hover:opacity-90"
                        style={{ backgroundColor: "#fce4f0", color: "#7c2d5e", border: "1px solid #f0b0d0" }}>
                        Observar
                      </Button>
                      <Button size="sm" onClick={() => handleAprobar()} disabled={!canApprove || guardando}
                        className="gap-1.5">
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Aprobar
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {activeTab === "emision" && (
              isEmitido ? (
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
                      <DatePickerHabil
                        value={isoToDate(fechaDictaminacion)}
                        fromDate={dictaminacionRange.from}
                        toDate={dictaminacionRange.to}
                        startMonth={dictaminacionRange.from ?? isoToDate(fechaDictaminacion)}
                        onChange={date => setFechaDictaminacion(date ? dateToIso(date) : "")}
                      />
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-card-foreground">Modalidad de Firma</CardTitle></CardHeader>
                    <CardContent>
                      <RadioGroup value={modalidadFirma}
                        onValueChange={v => { setModalidadFirma(v as any); if (v === "electronica") { setAutografaDescargado(false); setArchivoSubido(false) } else { setSelladoEmisionSubido(false) } }}
                        className="flex flex-col gap-3">
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
                      {selectedDestinatarios.length === 0 && (
                        <p className="text-xs text-destructive mt-2 font-medium">Debe seleccionar al menos un destinatario</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border sticky bottom-0">
                    <CardContent className="flex items-center justify-end p-4">
                      <Button
                        onClick={() => {
                          if (modalidadFirma === "electronica") {
                            setFirmaEmisionAbierta(true)
                          } else {
                            handleEmitir()
                          }
                        }}
                        disabled={!canEmit}
                        className={`gap-1.5 ${canEmit ? "" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
                      >
                        <Send className="h-4 w-4" />
                        {modalidadFirma === "electronica" ? "Firmar y Emitir Dictamen" : "Emitir Dictamen"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            {activeTab === "observaciones" && (
              <div className="overflow-hidden rounded-xl border border-border shadow-md">
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #3a1020 0%, #5c1a30 100%)" }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Observaciones</span>
                    <span className="text-[10px] text-white/60">
                      {solicitud.observacionesTodas.length} observación{solicitud.observacionesTodas.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div className="ml-auto flex h-7 items-center rounded-full bg-white/15 px-3">
                    <span className="text-[11px] font-semibold text-white/90">{solicitud.observacionesTodas.length} obs.</span>
                  </div>
                </div>
                <div className="bg-card p-4 flex flex-col gap-2">
                  {solicitud.observacionesTodas.map((obs, i) => (
                    <div key={i} className="rounded-lg border border-[#832B56]/20 bg-[#832B56]/[0.03] p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[#832B56]">{obs.estado.replace(/Validacion Final/i, "Validacion DGDO")}</span>
                        <span className="text-[10px] text-muted-foreground">{obs.fecha} — {obs.usuario}</span>
                      </div>
                      <p className="text-xs text-card-foreground leading-relaxed whitespace-pre-line">{obs.comentario}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "historial" && (
              <div className="overflow-hidden rounded-xl border border-border shadow-md">
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg, #1f2d1a 0%, #2e4226 100%)" }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
                    <History className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Historial del Expediente</span>
                    <span className="text-[10px] text-white/60">
                      {solicitud.historial.length} entrada{solicitud.historial.length !== 1 ? "s" : ""} registrada{solicitud.historial.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ml-auto flex h-7 items-center rounded-full bg-white/15 px-3">
                    <span className="text-[11px] font-semibold text-white/90">{solicitud.historial.length} entrada{solicitud.historial.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="bg-card px-5 pt-4 pb-2">
                  <HistorialTimeline entries={solicitud.historial} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>

    {solicitud && (
      <FirmaModal
        open={firmaEmisionAbierta}
        onClose={() => setFirmaEmisionAbierta(false)}
        solicitudId={solicitud.id}
        folioJustificacion={solicitud.folioJustificacion ?? `SOL-${solicitud.id}`}
        folioRecepcion={solicitud.folioRecepcion ?? null}
        folioDictamen={solicitud.folioDictamen ? formatearFolio(solicitud.folioDictamen) : null}
        modalidadFirma="electronica"
        currentUserId={(user as any)?.id ?? ""}
        onGenerarPdf={() => generateJustificacionPDF(solicitud.id, solicitud.folioJustificacion ?? `SOL-${solicitud.id}`)}
        onGenerarPdfBase64={async () => generateJustificacionPDFBase64(solicitud.id)}
        onFinalizar={async () => { handleEmitir() }}
        guardandoFinal={guardando}
        selladoEtapa="emision"
      />
    )}
    </PageLayout>
  )
}