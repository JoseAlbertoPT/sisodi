"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { applyTextRules } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ReadOnlyField } from "@/components/ui/readonly-field"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, estadoBadge, C_ROSA_VINO, C_ROSA_VINO_BG, C_AMARILLO, C_AMARILLO_BG, C_VERDE_ESTADO, C_VERDE_ESTADO_BG } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { SearchInput, SEARCH_INPUT_MAX_W_SM } from "@/components/ui/search-input"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import { Separator } from "@/components/ui/separator"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import {

  Eye, Edit3, FileCheck,
  FileText,
  ArrowLeft, AlertTriangle, Lock, Inbox,
  PanelRightOpen, PanelRightClose,
} from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"
import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

import { useToast } from "@/hooks/use-toast"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import { type EditSolicitudPayload } from "@/components/pages/nueva-solicitud-page"
import {

  isPeriodoVigente,
  isRegimenTipoCompatible,
  parseDateDMY,
  normalizaRegimen,
  CAP_3000,
  CAP_1000,
  NOMBRAMIENTO_TD,
  type RegimenPeriodo,
} from "@/lib/calendario-recepcion-mock"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/lib/auth-context"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { HistorialTimeline, ROLES_OCULTAN_OBSERVACIONES, type HistorialEntryData } from "@/components/historial-timeline"
import { AvanceSolicitud } from "@/components/solicitud-status-tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRealtime } from "@/hooks/use-realtime"

type UrgTab =
  | "Borradores"
  | "En aprobación"
  | "Observadas / Devueltas"
  | "En proceso DGDO"
  | "Emitidas"
  | "Todas"

type UrgEstado =
  | "Borrador"
  | "En Captura"
  | "En Validacion Justificaciones"
  | "Enviada a Validacion (UEFA)"
  | "Enviada a Validacion"
  | "Pendiente Firma Justificacion"
  | "Observado por Validacion"
  | "Observada por UEFA"
  | "Observado por UEFA"
  | "Pendiente DO"
  | "En Revision Revisor"
  | "Aceptado por Revisor"
  | "Aprobado por Revisor"
  | "Observado por Revisor"
  | "Observado por DO"
  | "En Revision Emisor"
  | "Observado por Emisor"
  | "Pendiente Firma Dictamen"
  | "Pendiente Firma Revision"
  | "Pendiente Firma Verificacion"
  | "Pendiente Firma Emisor"
  | "En Verificacion Final"
  | "Observado por Verificacion Final"
  | "En revision DO Filtro 1"
  | "En revision DO Filtro 2"
  | "En revision DO Filtro 3"
  | "Observado DO Filtro 1"
  | "Observado DO Filtro 2"
  | "Observado DO Filtro 3"
  | "Devuelta por DO"
  | "En proceso DO"
  | "Aprobado"
  | "Emitido"
  | "Modificada"
  | "Rechazado"

interface BitacoraEntry {
  seccion: string
  eventos: { fecha: string; usuario: string; descripcion: string }[]
}

const INICIALES_MES: Record<string, string> = {
  "01": "EN", "02": "FE", "03": "MR", "04": "AB",
  "05": "MY", "06": "JN", "07": "JL", "08": "AG",
  "09": "SE", "10": "OC", "11": "NO", "12": "DI",
}
function formatFolioRecepcion(folio: string): string {
  const m1 = folio.match(/^([A-Z]{2})-(\d+)$/)
  if (m1) return `${m1[1]}-${String(parseInt(m1[2], 10)).padStart(3, "0")}`
  const m2 = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (m2) {
    const mes = m2[2].padStart(2, "0")
    return `${INICIALES_MES[mes] ?? mes}-${String(parseInt(m2[1], 10)).padStart(3, "0")}`
  }
  return folio
}

interface UrgSolicitud {
  id: string
  folio: string
  folioJustificacion: string | null
  folioRecepcion?: string
  folioDictamen?: string
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Determinado"
  secretaria: string
  fecha: string
  estado: UrgEstado
  denominacion: string
  unidadAdministrativa: string
  unidadResponsable: string
  programaProyecto: string
  tipoActividades: string
  numeroPrestadores: string
  vigenciaInicio: string
  vigenciaFin: string
  vigenciaInicioISO: string
  vigenciaFinISO: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior?: string
  objeto: string
  actividades: string
  responsabilidades: string
  escolaridad: string
  compAdm: string
  compTec: string
  compSoc: string
  valores: string
  areasExp: string
  nivelTabulador: string
  categoriaTabulador: string
  puestoJefeInmediato: string
  marcoNormativo: string[]
  condicionesRiesgos: string[]
  resguardoActivos: string
  tipoAdministracionNom: "centralizada" | "paraestatal"
  riesgoCaidas: string
  riesgoMutilaciones: string
  riesgoGolpes: string
  riesgoOtros: string
  condicionCambioDomicilio: boolean
  condicionHorario: boolean
  condicionViajar: boolean
  tipoImporte: string
  historial: HistorialEntryData[]
  bitacora: BitacoraEntry[]
  observacionMotivo?: string
  observacionFecha?: string
  observacionUsuario?: string
  observacionRonda: number
  reingresoCount: number
  todasObservaciones: { estado: string; fecha: string; usuario: string; comentario: string }[]
  numeroDictamen?: string
  fechaDictamen?: string
  regimen: RegimenPeriodo
  periodoAplicacion: string
  fechaRecepcion?: string
  slaRestante?: number | null
  adjuntos: { id: number; nombre_archivo: string; ruta: string }[]
}
function FoliosCell({ sol }: { sol: UrgSolicitud }) {
  const efectivaTab = getTab(sol.estado)
  const entries: { label: string; value: string; highlight?: boolean }[] = []
  if (efectivaTab === "Borradores") {
    entries.push({ label: "Borrador", value: "—", highlight: false })
  } else if (sol.folioRecepcion) {
    entries.push({
      label: "Recepción DO",
      value: formatFolioRecepcion(sol.folioRecepcion),
      highlight: true,
    })
  } else {
    entries.push({
      label: "Justificación",
      value: sol.folioJustificacion ?? "—",
      highlight: efectivaTab === "En aprobación" || efectivaTab === "Observadas / Devueltas",
    })
  }

  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(({ label, value }) => (
        <span key={label} className="text-xs text-muted-foreground">
          {value}
        </span>
      ))}
      {sol.fecha && (
        <span className="text-[10px] text-muted-foreground/70">
          {sol.fecha}
        </span>
      )}
    </div>
  )
}

function ordinalRegreso(n: number): string {
  if (n === 1) return "1er Regreso"
  if (n === 2) return "2do Regreso"
  if (n === 3) return "3er Regreso"
  return `${n}° Regreso`
}

function getFolioHeader(_tab: UrgTab): string {
  return "Folios"
}

function getTab(estado: UrgEstado): UrgTab {
  const n = (estado ?? "").toLowerCase()
  if (n === "borrador" || n === "en captura") return "Borradores"
  if (n === "emitido") return "Emitidas"
  if (
    (n.includes("observado por validacion") && !n.includes("final")) ||
    n.includes("observada por uefa") || n.includes("observado por uefa") ||
    n.includes("observado por revisor") || n.includes("observado por do") ||
    n.includes("devuelta por do") || n.includes("observado do filtro")
  ) return "Observadas / Devueltas"
  if (n.includes("en revision") || n.includes("en verificacion final") ||
      n === "pendiente do" || n.includes("pendiente firma") ||
      n === "aprobado por revisor" || n === "aceptado por revisor" || n === "en proceso do" || n === "aprobado")
    return "En proceso DGDO"
  if (n.includes("en validacion justificaciones") || n.includes("enviada a validacion") ||
      n.includes("pendiente firma justificacion"))
    return "En aprobación"
  return "Todas"
}

function getObservador(estado: UrgEstado): string | null {
  const n = (estado ?? "").toLowerCase()
  if (n.includes("observada por uefa") || n.includes("observado por uefa")) return "Validación UEFA"
  if (n.includes("observado por verificacion final")) return "Verificación DGDO"
  if (n.includes("observado por validacion")) return "Validación UEFA"
  if (n.includes("observado por revisor")) return "Revisión DGDO"
  if (n.includes("observado por do") || n.includes("observado do filtro") || n.includes("devuelta por do")) return "DO"
  if (n.includes("observado por emisor")) return "Emisión DGDO"
  return null
}
function getSubEstadoDGDO(estado: UrgEstado): string | null {
  return null
}

function esJsonEdicion(comentario: string | null | undefined): boolean {
  if (!comentario) return false
  const t = comentario.trim()
  if (!t.startsWith("{")) return false
  try { const p = JSON.parse(t); return p?.tipo === "edicion" } catch { return false }
}

function normalizarComentario(comentario: string | null | undefined): string | null | undefined {
  if (!comentario) return comentario
  if (esJsonEdicion(comentario)) return null
  if (/ \| \d+\./.test(comentario)) return comentario.split(" | ").join("\n")
  return comentario
}

function mapApiItem(item: any): UrgSolicitud {
  const reversedHistorial = [...(item.historial ?? [])].reverse()
  const lastObsEntry = reversedHistorial.find(
    (h: any) => h.comentario && !esJsonEdicion(h.comentario) && /observad/i.test(h.accion ?? "")
  )
  const observacionRonda = (item.historial ?? []).filter(
    (h: any) => !!h.comentario && !esJsonEdicion(h.comentario)
  ).length
  const obsEsLaUltima = !!(lastObsEntry && lastObsEntry === reversedHistorial[0])
  const lastObservacion = obsEsLaUltima
    ? (normalizarComentario(lastObsEntry?.comentario) as string | undefined)
    : undefined
  const lastObservacionFecha = obsEsLaUltima && lastObsEntry?.fecha
    ? new Date(lastObsEntry.fecha).toISOString().replace("T", " ").slice(0, 16)
    : undefined
  const lastObservacionUsuario = obsEsLaUltima
    ? (lastObsEntry?.usuario as string | undefined)
    : undefined

  const bitacoraAdjuntos: BitacoraEntry = {
    seccion: "Documentos Adjuntos",
    eventos: (item.adjuntos ?? []).map((a: any) => ({
      fecha: a.fecha_subida
        ? new Date(a.fecha_subida).toISOString().replace("T", " ").slice(0, 16)
        : "",
      usuario: "Sistema",
      descripcion: `Archivo cargado: ${a.nombre_archivo}`,
    })),
  }

  const bitacoraHistorial: BitacoraEntry = {
    seccion: "Historial de cambios",
    eventos: (item.historial ?? []).map((h: any) => ({
      fecha: h.fecha
        ? new Date(h.fecha).toISOString().replace("T", " ").slice(0, 16)
        : "",
      usuario: h.usuario,
      descripcion: h.accion,
    })),
  }
  const bitacora: BitacoraEntry[] =
    bitacoraAdjuntos.eventos.length > 0
      ? [bitacoraHistorial, bitacoraAdjuntos]
      : [bitacoraHistorial]
  const importeBruto = item.importe_bruto != null
    ? `$${Number(item.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
    : "—"
  const fmt = (d: string | null | undefined) => {
    if (!d) return ""
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? (() => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day) })()
      : new Date(d)
    return isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
  }
  const fmtISO = (d: string | null | undefined): string => {
    if (!d) return ""
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10)
  }
  const regimen = normalizaRegimen(item.regimen)
  const _MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  const periodoAplicacion = item.periodo
    ? regimen === "honorarios"
      ? (_MESES[item.periodo.mes - 1] ?? `${item.periodo.mes}/${item.periodo.anio}`)
      : `${item.periodo.mes}/${item.periodo.anio}`
    : ""
  const rawEstado = item.estado?.nombre ?? ""
  const estadosValidos: UrgEstado[] = [
    "Borrador", "En Captura",
    "En Validacion Justificaciones",
    "Enviada a Validacion (UEFA)", "Enviada a Validacion",
    "Pendiente Firma Justificacion",
    "Observado por Validacion", "Observada por UEFA", "Observado por UEFA",
    "Pendiente DO",
    "En Revision Revisor", "Aceptado por Revisor", "Aprobado por Revisor", "Observado por Revisor",
    "Observado por DO",
    "En Revision Emisor", "Observado por Emisor",
    "Pendiente Firma Dictamen", "Pendiente Firma Revision", "Pendiente Firma Verificacion", "Pendiente Firma Emisor",
    "En Verificacion Final", "Observado por Verificacion Final",
    "En revision DO Filtro 1", "En revision DO Filtro 2", "En revision DO Filtro 3",
    "Observado DO Filtro 1", "Observado DO Filtro 2", "Observado DO Filtro 3",
    "Devuelta por DO",
    "En proceso DO", "Aprobado", "Emitido", "Modificada", "Rechazado",
  ]
  const estado: UrgEstado = (
    estadosValidos.find((e) => e.toLowerCase() === rawEstado.toLowerCase()) ?? "Borrador"
  )
  return {
    id:                   String(item.id),
    folio:                item.folio_recepcion ?? item.folio_justificacion ?? `SOL-${new Date().getFullYear()}-${String(item.id).padStart(4, "0")}`,
    folioJustificacion:   item.folio_justificacion ?? null,
    folioRecepcion:       item.folio_recepcion     ?? undefined,
    folioDictamen:        item.folio_dictamen      ?? item.dictamen?.folio ?? undefined,
    tipo:                 item.tipo_solicitud       as UrgSolicitud["tipo"],
    secretaria:           item.secretaria           ?? "",
    fecha:                fmt(item.fecha_creacion),
    fechaRecepcion:       item.fecha_envio ? fmt(item.fecha_envio) : undefined,
    estado,
    denominacion:         item.denominacion         || "",
    unidadAdministrativa: item.unidad_administrativa ?? "",
    unidadResponsable:    item.unidad_responsable   ?? "",
    programaProyecto:     item.programa_proyecto    ?? "",
    tipoActividades:      item.tipo_actividades     ?? "",
    numeroPrestadores:    item.numero_prestadores != null
      ? String(item.numero_prestadores)
      : "",
    vigenciaInicio:       fmt(item.vigencia_inicio),
    vigenciaFin:          fmt(item.vigencia_fin),
    vigenciaInicioISO:    fmtISO(item.vigencia_inicio),
    vigenciaFinISO:       fmtISO(item.vigencia_fin),
    importeBruto,
    esRenovacion:         item.es_renovacion        ?? false,
    folioAnterior:        item.folio_anterior        ?? undefined,
    objeto:               item.objeto               ?? "",
    actividades:          item.actividades           ?? "",
    responsabilidades:    item.responsabilidades     ?? "",
    escolaridad:          item.escolaridad           ?? "",
    compAdm:              item.comp_adm              ?? "",
    compTec:              item.comp_tec              ?? "",
    compSoc:              item.comp_soc              ?? "",
    valores:              item.valores               ?? "",
    areasExp:             item.areas_exp             ?? "",
    nivelTabulador:       item.nivel_tabulador        ?? "",
    categoriaTabulador:   item.categoria_tabulador   ?? "",
    puestoJefeInmediato:  item.puesto_jefe_inmediato ?? "",
    marcoNormativo:          Array.isArray(item.marco_normativo)     ? item.marco_normativo     : [],
    condicionesRiesgos:      Array.isArray(item.condiciones_riesgos) ? item.condiciones_riesgos : [],
    resguardoActivos:        item.resguardo_activos       ?? "",
    tipoAdministracionNom:   (item.tipo_administracion === "paraestatal" ? "paraestatal" : "centralizada") as "centralizada" | "paraestatal",
    riesgoCaidas:            item.riesgo_caidas           ?? "",
    riesgoMutilaciones:      item.riesgo_mutilaciones     ?? "",
    riesgoGolpes:            item.riesgo_golpes           ?? "",
    riesgoOtros:             item.riesgo_otros            ?? "",
    condicionCambioDomicilio: item.condicion_cambio_domicilio ?? false,
    condicionHorario:        item.condicion_horario       ?? false,
    condicionViajar:         item.condicion_viajar        ?? false,
    tipoImporte:             item.tipo_importe            ?? "",
    regimen,
    periodoAplicacion,
    slaRestante:          item.slaRestante ?? null,
    observacionMotivo:    lastObservacion,
    observacionFecha:     lastObservacionFecha,
    observacionUsuario:   lastObservacionUsuario,
    observacionRonda,
    reingresoCount:     item.reingresoCount ?? 0,
    todasObservaciones: obsEsLaUltima
      ? (item.historial ?? [])
          .filter((h: any, idx: number) => {
            if (!h.comentario || !/observad/i.test(h.accion ?? "")) return false
            const after = (item.historial ?? []).slice(idx + 1)
            return !after.some((h2: any) => !/observad/i.test(h2.accion ?? ""))
          })
          .map((h: any) => ({
            estado:     h.accion ?? "—",
            fecha:      h.fecha ? new Date(h.fecha).toISOString().replace("T", " ").slice(0, 16) : "",
            usuario:    typeof h.usuario === "string" ? h.usuario : (h.usuario?.nombre ?? "Sistema"),
            comentario: normalizarComentario(h.comentario) as string,
          }))
      : [],
    numeroDictamen:       item.dictamen?.folio        ?? undefined,
    fechaDictamen:        item.dictamen?.fecha_emision
      ? fmt(item.dictamen.fecha_emision)
      : undefined,
    historial: (item.historial ?? []).map((h: any) => ({
      fecha:          h.fecha ?? "",
      usuario:        h.usuario,
      estadoAnterior: h.estado_anterior ?? null,
      estadoNuevo:    h.accion ?? "—",
      comentario:     h.comentario ?? null,
    })),
    bitacora,
    adjuntos: (item.adjuntos ?? []).map((a: any) => ({
      id:             a.id,
      nombre_archivo: a.nombre_archivo,
      ruta:           a.ruta,
    })),
  }
}

function SectionCard({
  num, title, icon, children, defaultOpen = true,
}: {
  num?: string; title: string; icon?: React.ReactNode
  children: React.ReactNode; defaultOpen?: boolean
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
          {icon}
          {title}
          <span className="ml-auto">
            <img src="/iconos2/addPlus.svg" alt="" width={16} height={16} className={`transition-transform duration-200${open ? " rotate-45" : ""}`} />
          </span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}

function toList(val: string | string[]): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (!val) return []
  return val.split(/[\n\r•·]+/).map((s) => s.trim()).filter(Boolean)
}
function ReadOnlyList({ label, value, sub, noScroll }: { label: string; value: string | string[]; sub?: string; noScroll?: boolean }) {
  const items = toList(value)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {sub && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{sub}</span>
        )}
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground italic px-3">—</span>
      ) : (
        <div
          className={noScroll ? "flex flex-col gap-0.5" : "scroll-thin flex flex-col gap-0.5"}
          style={noScroll ? undefined : { maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}
        >
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-lg px-3 py-1 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
                {idx + 1}
              </span>
              <span className="text-sm text-card-foreground" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{applyTextRules(item)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function ReadOnlyTextarea({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 col-span-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value
        ? <p className="scroll-thin text-sm text-card-foreground whitespace-pre-line leading-relaxed border border-border rounded-md px-3 py-2 bg-muted/30" style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden" }}>{applyTextRules(value)}</p>
        : <span className="text-sm text-muted-foreground italic">—</span>}
    </div>
  )
}

function ObservacionTimeline({ comentario }: { comentario: string }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const itemsChecklist = lineas.filter(l => /^\d+\.\s.+::/.test(l))
  const comentarioGeneral = lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join(" ").trim()
  if (itemsChecklist.length === 0) {
    return <p className="text-sm text-[var(--sem-support-on-error-low)] leading-relaxed">{comentario}</p>
  }
  return (
    <div className="flex flex-col gap-0 mt-1">
      {comentarioGeneral && (
        <p className="text-xs text-[var(--sem-support-on-error-low)]/80 mb-2 leading-relaxed">{comentarioGeneral}</p>
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sem-support-on-error-low)]/60 bg-white text-[10px] font-bold text-[var(--sem-support-on-error-low)]">
                {num}
              </div>
              {!isLast && <div className="w-px flex-1 bg-[var(--sem-support-on-error-low)]/20 my-0.5" />}
            </div>
            <div className={`flex flex-col gap-1 flex-1 ${!isLast ? "pb-3" : "pb-1"}`}>
              <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)]/90 leading-snug">{label}</span>
              {obs?.trim() && (
                <span className="text-xs text-[var(--sem-support-on-error-low)]/80 bg-[var(--sem-support-on-error-low)]/5 rounded px-2 py-1 border border-[var(--sem-support-on-error-low)]/15 leading-relaxed">
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

function DevolucionObs({ comentario }: { comentario: string }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const itemsChecklist = lineas.filter(l => /^\d+\.\s.+::/.test(l))
  const comentarioGeneral = lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join("\n").trim()
  const tieneChecks   = itemsChecklist.length > 0
  const tieneGeneral  = comentarioGeneral.length > 0
  return (
    <div className="flex flex-col gap-0">
      {tieneChecks && (
        <div className="flex flex-col gap-0">
          {itemsChecklist.map((linea, idx) => {
            const [titulo, obs] = linea.split("::")
            const numMatch = titulo.match(/^(\d+)\./)
            const num   = numMatch ? numMatch[1] : String(idx + 1)
            const label = titulo.replace(/^\d+\.\s*/, "").trim()
            const isLast = idx === itemsChecklist.length - 1
            return (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sem-support-on-error-low)]/50 bg-[var(--sem-support-on-error-low)]/5 text-[10px] font-bold text-[var(--sem-support-on-error-low)]">
                    {num}
                  </div>
                  {(!isLast || tieneGeneral) && <div className="w-px flex-1 bg-[var(--sem-support-on-error-low)]/15 my-0.5" />}
                </div>
                <div className={`flex flex-col gap-1 flex-1 ${(!isLast || tieneGeneral) ? "pb-2.5" : "pb-0"}`}>
                  <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)] leading-snug">{label}</span>
                  {obs?.trim() && (
                    <span className="text-xs text-[var(--sem-support-on-error-low)]/80 bg-[var(--sem-support-on-error-low)]/5 rounded px-2 py-1 border border-[var(--sem-support-on-error-low)]/15 leading-relaxed">
                      {obs.trim()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tieneChecks && tieneGeneral && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sem-support-on-error-low)]/30 bg-white text-[10px] text-[var(--sem-support-on-error-low)]/50">
              <span className="text-[8px]">✎</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 pb-0">
            <span className="text-[10px] font-semibold text-[var(--sem-support-on-error-low)]/60 uppercase tracking-wide">Observación general</span>
            <p className="text-xs text-[var(--sem-support-on-error-low)]/90 leading-relaxed whitespace-pre-line">{comentarioGeneral}</p>
          </div>
        </div>
      )}
      {!tieneChecks && tieneGeneral && (
        <p className="text-sm text-[var(--sem-support-on-error-low)] leading-relaxed whitespace-pre-line">{comentarioGeneral}</p>
      )}
    </div>
  )
}

function ParsedObservacion({ comentario, borderColor = "orange" }: { comentario: string; borderColor?: "orange" | "red" }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const esChecklist = lineas.some(l => /^\d+\.\s.+::/.test(l))
  const itemsChecklist    = esChecklist ? lineas.filter(l => /^\d+\.\s.+::/.test(l)) : []
  const comentarioGeneral = esChecklist
    ? lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join(" ").trim()
    : comentario
  const c = borderColor === "red"
    ? { wrap: "border-[var(--sem-support-on-error-low)]/30 bg-[var(--sem-support-on-error-low)]/5", title: "text-[var(--sem-support-on-error-low)]", text: "text-[var(--sem-support-on-error-low)]", item: "border-[var(--sem-support-on-error-low)]/20 bg-[var(--sem-support-on-error-low)]/5", itemTitle: "text-[var(--sem-support-on-error-low)]/90", itemText: "text-[var(--sem-support-on-error-low)]" }
    : { wrap: "border-[var(--sem-support-on-error-low)]/30 bg-[var(--sem-support-on-error-low)]/5", title: "text-[var(--sem-support-on-error-low)]", text: "text-[var(--sem-support-on-error-low)]/80", item: "border-[var(--sem-support-on-error-low)]/20 bg-white/60", itemTitle: "text-[var(--sem-support-on-error-low)]", itemText: "text-[var(--sem-support-on-error-low)]/80" }
  return (
    <div className={`rounded-md border ${c.wrap} px-3 py-2 flex flex-col gap-2`}>
      <p className={`text-[10px] font-semibold ${c.title} uppercase tracking-wide`}>Observaciones</p>
      {comentarioGeneral && <p className={`text-xs ${c.text} leading-relaxed`}>{comentarioGeneral}</p>}
      {itemsChecklist.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {itemsChecklist.map((linea, idx) => {
            const [titulo, obs] = linea.split("::")
            return (
              <div key={idx} className={`rounded border ${c.item} px-2.5 py-1.5`}>
                <p className={`text-[10px] font-semibold ${c.itemTitle}`}>{titulo.trim()}</p>
                {obs?.trim() && <p className={`text-xs ${c.itemText} mt-0.5`}>{obs.trim()}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpedientePrestacion({ solicitud, wide = true }: { solicitud: UrgSolicitud; wide?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className={`grid gap-4 ${wide ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-2"}`}>
          <ReadOnlyField bold={false} label="Secretaría / Dependencia / Organismo"   value={solicitud.secretaria} />
          <ReadOnlyField bold={false} label="Unidad Administrativa de Adscripción"   value={formatClave(solicitud.unidadAdministrativa) || solicitud.unidadAdministrativa} />
          <ReadOnlyField bold={false} label="Unidad Responsable del Gasto"           value={getNombreForClave(solicitud.unidadResponsable) || solicitud.unidadResponsable} />
          <ReadOnlyField bold={false} label="Número de Prestadores de Servicios"     value={solicitud.numeroPrestadores} />
          <ReadOnlyField bold={false} label="Programa o Proyecto"                    value={applyTextRules(solicitud.programaProyecto)} />
          <ReadOnlyField bold={false} label="Tipo de Actividad"                      value={applyTextRules(solicitud.tipoActividades)} />
          <ReadOnlyField bold={false} label="Régimen de Contratación"                value={formatRegimen(solicitud.regimen)} />
          <ReadOnlyField bold={false} label="Vigencia Inicio"                        value={solicitud.vigenciaInicio} />
          <ReadOnlyField bold={false} label="Vigencia Término"                       value={solicitud.vigenciaFin} />
          <ReadOnlyField bold={false} label="Importe Bruto"                          value={solicitud.importeBruto} />
          {(solicitud.nivelTabulador || solicitud.categoriaTabulador) && (
            <ReadOnlyField bold={false}
              label="Nivel Catálogo"
              value={solicitud.nivelTabulador && solicitud.categoriaTabulador ? `${solicitud.nivelTabulador}/${solicitud.categoriaTabulador}` : (solicitud.nivelTabulador || solicitud.categoriaTabulador || "—")}
            />
          )}
        </div>
      </SectionCard>
      <SectionCard num="II" title="Objeto de la Contratación">
        <div className="grid gap-4">
          <ReadOnlyTextarea label="Objeto" value={solicitud.objeto} />
        </div>
      </SectionCard>
      <SectionCard num="III" title="Actividades a Realizar">
        <ReadOnlyList label="Actividades" value={solicitud.actividades} />
      </SectionCard>
      <SectionCard num="IV" title="Responsabilidades">
        <ReadOnlyList label="Responsabilidades" value={solicitud.responsabilidades} />
      </SectionCard>

      <SectionCard num="V" title="Perfil">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-4 flex-1">
            <ReadOnlyList noScroll label="Escolaridad Mínima"                      value={solicitud.escolaridad} />
            <ReadOnlyList noScroll sub="II.2" label="Competencias Técnicas"       value={solicitud.compTec} />
            <ReadOnlyList noScroll label="Valores"                                 value={solicitud.valores} />
          </div>
          <div className="flex flex-col gap-4 flex-1">
            <ReadOnlyList noScroll sub="II.1" label="Competencias Administrativas" value={solicitud.compAdm} />
            <ReadOnlyList noScroll sub="II.3" label="Competencias Sociales"        value={solicitud.compSoc} />
            <ReadOnlyList noScroll label="Áreas de Experiencia"                    value={solicitud.areasExp} />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        <AdjuntosSection bitacora={solicitud.bitacora} />
      </SectionCard>
    </div>
  )
}
function SeccionCondicionesRiesgos({ solicitud }: { solicitud: UrgSolicitud }) {
  const condiciones = [
    { label: "Cambio de domicilio", value: solicitud.condicionCambioDomicilio },
    { label: "Horario especial",    value: solicitud.condicionHorario },
    { label: "Viajar",              value: solicitud.condicionViajar },
  ]
  const riesgos = [
    { label: "Caídas",       value: solicitud.riesgoCaidas },
    { label: "Mutilaciones", value: solicitud.riesgoMutilaciones },
    { label: "Golpes",       value: solicitud.riesgoGolpes },
    { label: "Otros",        value: solicitud.riesgoOtros },
  ]
  const noBool = (v: boolean | null | undefined) =>
    v ? <span className="text-secondary font-semibold">Sí</span> : <span className="text-muted-foreground">No</span>
  const nivel = (v: string | null | undefined) =>
    v ? <span className="font-semibold text-card-foreground">{v}</span> : <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
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
                <td className="px-3 py-2 text-center">{noBool(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
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
                <td className="px-3 py-2 text-center">{nivel(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpedienteNombramiento({ solicitud, wide = true }: { solicitud: UrgSolicitud; wide?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className={`grid gap-4 ${wide ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-2"}`}>
          <ReadOnlyField bold={false} label="Secretaría / Dependencia / Organismo"  value={solicitud.secretaria} />
          <ReadOnlyField bold={false} label="Unidad Administrativa de Adscripción"  value={formatClave(solicitud.unidadAdministrativa) || solicitud.unidadAdministrativa} />
          <ReadOnlyField bold={false} label="Unidad Responsable del Gasto"          value={solicitud.unidadResponsable} />
          <ReadOnlyField bold={false} label="Programa o Proyecto"                   value={applyTextRules(solicitud.programaProyecto)} />
          <ReadOnlyField bold={false} label="Régimen de Contratación"               value={formatRegimen(solicitud.regimen)} />
          <ReadOnlyField bold={false} label="Denominación del Nombramiento"         value={applyTextRules(solicitud.denominacion)} />
          <ReadOnlyField bold={false} label="Puesto del Jefe Inmediato"             value={applyTextRules(solicitud.puestoJefeInmediato)} />
          <ReadOnlyField bold={false} label="Tipo de Actividad"                   value={applyTextRules(solicitud.tipoActividades)} />
          <ReadOnlyField bold={false} label="Número de Personas a Contratar"        value={solicitud.numeroPrestadores} />
          <ReadOnlyField bold={false} label="Tipo de Pago"    value={solicitud.tipoImporte || "Mensual"} />
          <ReadOnlyField bold={false} label="Importe Neto"  value={solicitud.importeBruto} />
          <ReadOnlyField bold={false} label="Vigencia Inicio"                       value={solicitud.vigenciaInicio} />
          <ReadOnlyField bold={false} label="Vigencia Término"                      value={solicitud.vigenciaFin} />
          {(solicitud.nivelTabulador || solicitud.categoriaTabulador) && (
            <ReadOnlyField bold={false}
              label="Nivel Catálogo"
              value={solicitud.nivelTabulador && solicitud.categoriaTabulador ? `${solicitud.nivelTabulador}/${solicitud.categoriaTabulador}` : (solicitud.nivelTabulador || solicitud.categoriaTabulador || "—")}
            />
          )}
        </div>
      </SectionCard>
      <SectionCard num="III" title="Objeto del Nombramiento">
        <ReadOnlyTextarea label="Objeto" value={solicitud.objeto} />
      </SectionCard>
      <SectionCard num="IV" title="Actividades a Realizar">
        <ReadOnlyList label="Actividades" value={solicitud.actividades} />
      </SectionCard>
      <SectionCard num="V" title="Responsabilidades">
        <ReadOnlyList label="Responsabilidades" value={solicitud.responsabilidades} />
      </SectionCard>
      {solicitud.marcoNormativo.length > 0 && (
        <SectionCard num="VI" title="Marco Normativo">
          <ReadOnlyList label="" value={solicitud.marcoNormativo} />
        </SectionCard>
      )}
      <SectionCard num="VII" title="Condiciones y Riesgos">
        <SeccionCondicionesRiesgos solicitud={solicitud} />
      </SectionCard>
      {solicitud.resguardoActivos && (
        <SectionCard num="VIII" title="Resguardo Personalizado de Activos">
          <ReadOnlyField bold={false} label="Resguardo de Activos" value={solicitud.resguardoActivos === "si" ? "Sí" : solicitud.resguardoActivos === "no" ? "No" : solicitud.resguardoActivos} />
        </SectionCard>
      )}
      <SectionCard num="IX" title="Perfil">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-4 flex-1">
            <ReadOnlyList noScroll label="Escolaridad Mínima"                       value={solicitud.escolaridad} />
            <ReadOnlyList noScroll sub="VIII.2" label="Competencias Técnicas"      value={solicitud.compTec} />
            <ReadOnlyList noScroll label="Valores"                                  value={solicitud.valores} />
          </div>
          <div className="flex flex-col gap-4 flex-1">
            <ReadOnlyList noScroll sub="VIII.1" label="Competencias Administrativas" value={solicitud.compAdm} />
            <ReadOnlyList noScroll sub="VIII.3" label="Competencias Sociales"        value={solicitud.compSoc} />
            <ReadOnlyList noScroll label="Áreas de Experiencia"                      value={solicitud.areasExp} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        <AdjuntosSection bitacora={solicitud.bitacora} />
      </SectionCard>
    </div>
  )
}
function AdjuntosSection({ bitacora }: { bitacora: BitacoraEntry[] }) {
  const adjuntosSection = bitacora.find((b) =>
    b.seccion.toLowerCase().includes("adjunto")
  )
  if (!adjuntosSection || adjuntosSection.eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sin documentos adjuntos registrados.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {adjuntosSection.eventos.map((ev, i) => (
        <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <FileTypeIcon name={ev.descripcion.replace("Archivo cargado: ", "")} size="sm" />
          <div className="flex flex-col">
            <span className="text-sm text-card-foreground">
              {ev.descripcion.replace("Archivo cargado: ", "")}
            </span>
            <span className="text-[10px] text-muted-foreground">{ev.fecha}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}


function solToEditPayload(sol: UrgSolicitud): EditSolicitudPayload {
  const tipo: EditSolicitudPayload["tipo"] =
    sol.tipo === "Prestacion de Servicios" ? "prestacion"
    : sol.tipo === "Nombramiento Tiempo Determinado" ? "nombramiento"
    : ""
  const regimen = (sol.regimen ?? "honorarios") as EditSolicitudPayload["regimen"]
  const importeNum = sol.importeBruto.replace(/[$,\s]/g, "")
  return {
    id: sol.id,
    tipo,
    regimen,
    periodo: sol.periodoAplicacion,
    estado: sol.estado,
    formData: {
      secretaria:              sol.secretaria,
      unidadAdministrativa:    sol.unidadAdministrativa,
      unidadResponsable:       sol.unidadResponsable,
      programaProyecto:        sol.programaProyecto,
      regimen:                 sol.regimen,
      tipoActividades:         sol.tipoActividades,
      numeroPrestadores:       sol.numeroPrestadores,
      denominacion:            sol.denominacion,
      puestoJefeInmediato:     sol.puestoJefeInmediato,
      tipoAdministracionNom:   sol.tipoAdministracionNom,
      vigenciaInicio:          sol.vigenciaInicioISO,
      vigenciaFin:             sol.vigenciaFinISO,
      importeBruto:            importeNum,
      tipoImporte:             sol.tipoImporte,
      nivelTabulador:          sol.nivelTabulador,
      categoriaTabulador:      sol.categoriaTabulador,
      objeto:                  sol.objeto,
      actividades:             toList(sol.actividades),
      responsabilidades:       toList(sol.responsabilidades),
      marcoNormativo:          sol.marcoNormativo,
      condicionesRiesgos:      sol.condicionesRiesgos,
      resguardoActivos:        sol.resguardoActivos,
      riesgoCaidas:            sol.riesgoCaidas,
      riesgoMutilaciones:      sol.riesgoMutilaciones,
      riesgoGolpes:            sol.riesgoGolpes,
      riesgoOtros:             sol.riesgoOtros,
      condicionCambioDomicilio: sol.condicionCambioDomicilio,
      condicionHorario:        sol.condicionHorario,
      condicionViajar:         sol.condicionViajar,
      escolaridad:             sol.escolaridad,
      compAdm:                 sol.compAdm,
      compTec:                 sol.compTec,
      compSoc:                 sol.compSoc,
      valores:                 sol.valores,
      areasExp:                sol.areasExp,
    },
    folio:                   sol.folioJustificacion ?? sol.folio,
    observacionMotivo:       sol.observacionMotivo ?? undefined,
    reingresoCount:          sol.reingresoCount > 0 ? sol.reingresoCount : undefined,
    isCapturadorCorrection:  true,
    adjuntos:                sol.adjuntos,
  }
}
function formatRegimen(raw: string): string {
  const r = (raw ?? "").toLowerCase().trim()
  if (r.includes("asimilado")) return "Honorarios Asimilados a Salarios"
  if (r.includes("honorario")) return "Honorarios"
  if (r.includes("nombramiento") || r.includes("tiempo determinado")) return "Nombramiento por Tiempo Determinado"
  return raw || "—"
}

function DetalleView({
  sol, onBack, onUpdatePeriodo, onUpdatePeriodoYEnviar, onEditSolicitud, onReenviar, onEnviarValidacion, calData,
}: {
  sol: UrgSolicitud
  onBack: () => void
  onUpdatePeriodo?: (id: string, periodo: string) => void
  onUpdatePeriodoYEnviar?: (id: string, periodo: string) => Promise<void>
  onEditSolicitud?: (payload: EditSolicitudPayload) => void
  onReenviar?: (id: string) => Promise<void>
  onEnviarValidacion?: (id: string) => Promise<void>
  calData?: CalData
}) {
  const cal = calData ?? { honorarios: [], asimilados: [], nombramiento: [] }
  const { toast } = useToast()
  const { user } = useAuth()
  const { getPermisosUsuario, consumirPermiso } = useAutorizaciones()
  const n         = (sol.estado ?? "").toLowerCase()
  const isDevueltaPorUrgObservador =
    (n.includes("observado por validacion") && !n.includes("final")) ||
    n.includes("observada por ufa") || n.includes("observado por ufa") ||
    n.includes("observado por revisor") ||
    n.includes("observado por do") || n.includes("devuelta por do") || n.includes("observado do filtro")
  const canEdit   = n === "borrador" || n === "en captura" || isDevueltaPorUrgObservador
  const isEmitido  = n === "emitido"
  const canContinuarCaptura = !isEmitido
  const isReadOnly = false
  const periodoCheck   = checkVigenteFromCal(cal, sol.regimen, sol.periodoAplicacion)
  const tipoCompatible = isRegimenTipoCompatible(sol.regimen, sol.tipo)
  const canSend        = periodoCheck.vigente && tipoCompatible

  const isBorradorFueraDeTiempo =
    (n === "borrador" || n === "en captura") &&
    sol.slaRestante != null && sol.slaRestante <= 0

  const permisoDisponible = (n === "borrador" || n === "en captura") && user?.id
    ? (getPermisosUsuario(user.id).find(
        (p) => p.regimen === (sol.regimen as string) && p.active && !p.used
      ) ?? null)
    : null

  const permisoActivoBorrador = isBorradorFueraDeTiempo ? permisoDisponible : null
  const [editingPeriodo,     setEditingPeriodo]     = useState(false)
  const [editingModoSolo,    setEditingModoSolo]    = useState(false)
  const [newPeriodo,         setNewPeriodo]         = useState(sol.periodoAplicacion)
  const [guardandoReenvio,   setGuardandoReenvio]   = useState(false)
  const [showConfirmPeriodo, setShowConfirmPeriodo] = useState(false)
  const [showDescargarConfirm, setShowDescargarConfirm] = useState(false)
  const [periodoConfirmado,  setPeriodoConfirmado]  = useState(false)
  const hasObs = sol.todasObservaciones.length > 0 || !!sol.observacionMotivo
  const [rightTab, setRightTab] = useState<"historial" | "bitacora" | "observaciones">(
    hasObs ? "observaciones" : "historial"
  )
  const [historialAbierto, setHistorialAbierto] = useState(false)

  const observacionesVisibles = ROLES_OCULTAN_OBSERVACIONES.includes((user as any)?.rol)
    ? sol.todasObservaciones.slice(-1)
    : sol.todasObservaciones

  const regimenLabel = formatRegimen(sol.regimen)
  const periodoOptions =
    sol.regimen === "honorarios"
      ? CAP_3000.map((r) => r.mes)
      : sol.regimen === "asimilados"
        ? CAP_1000.map((r) => r.quincena)
        : NOMBRAMIENTO_TD.map((r) => r.quincena)

  const handleDemoAction = (label: string) =>
  toast({ title: "Demo", description: `Acción "${label}" solo disponible en producción.` })

  const handleReenviarClick = async () => {
  if (!onReenviar) return
  setGuardandoReenvio(true)
  try {
  await onReenviar(sol.id)
    } finally {
  setGuardandoReenvio(false)
    }
  }
  const handleEnviarValidacionClick = async () => {
    if (!onEnviarValidacion) return
    setGuardandoReenvio(true)
    try {
      await onEnviarValidacion(sol.id)
    } finally {
      setGuardandoReenvio(false)
    }
  }
  const handleUpdatePeriodo = () => {
    if (newPeriodo === sol.periodoAplicacion) return
    const esPermisoPeriodo = !!(permisoDisponible && newPeriodo === permisoDisponible.periodo)
    const nuevoVigente = checkVigenteFromCal(cal, sol.regimen, newPeriodo).vigente
    setEditingModoSolo(nuevoVigente && !esPermisoPeriodo)
    setShowConfirmPeriodo(true)
  }
  const handleConfirmPeriodo = async () => {
    setShowConfirmPeriodo(false)
    setGuardandoReenvio(true)
    try {
      if (editingModoSolo) {
        const mesesN = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        const numericMatch = newPeriodo.match(/^(\d+)\/(\d{4})$/)
        const periodoMes = numericMatch
          ? Number(numericMatch[1])
          : mesesN.findIndex((m) => newPeriodo.includes(m)) + 1 || new Date().getMonth() + 1
        const periodoAnio = numericMatch
          ? Number(numericMatch[2])
          : new Date().getFullYear()
        const res = await fetch("/api/solicitudes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitudId: sol.id, periodoMes, periodoAnio }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          toast({ title: "Error", description: json.error ?? "Error al actualizar periodo", variant: "destructive" })
          return
        }
        if (onUpdatePeriodo) onUpdatePeriodo(sol.id, newPeriodo)
        toast({ title: "Periodo actualizado", description: `Periodo cambiado a "${newPeriodo}".` })
        setEditingPeriodo(false)
      } else {
        if (permisoDisponible && user?.id) {
          await consumirPermiso(user.id, sol.regimen, permisoDisponible.periodo)
        }
        if (onUpdatePeriodoYEnviar) {
          await onUpdatePeriodoYEnviar(sol.id, newPeriodo)
        } else {
          if (onUpdatePeriodo) onUpdatePeriodo(sol.id, newPeriodo)
          toast({ title: "Periodo actualizado", description: `Periodo cambiado a "${newPeriodo}".` })
        }
        setEditingPeriodo(false)
        setPeriodoConfirmado(true)
      }
    } finally {
      setGuardandoReenvio(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}
          className="gap-1.5 text-muted-foreground hover:text-card-foreground">
          <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <FoliosCell sol={sol} />
          {estadoBadge(sol.estado)}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={n === "borrador" || n === "en captura" ? "default" : "vino"} className="gap-1.5 rounded-full"
            onClick={() => setShowDescargarConfirm(true)}>
           Descargar Justificación
          </Button>
          {canEdit && !periodoConfirmado && (
            <>
              <Button size="sm" variant="default"
                onClick={() => onEditSolicitud
                  ? onEditSolicitud(solToEditPayload(sol))
                  : handleDemoAction("Continuar captura")
                }>
                {n === "borrador" || n === "en captura" ? "Continuar Captura" : (<><Edit3 className="h-4 w-4" />Editar</>)}
              </Button>
              {(n === "borrador" || n === "en captura") && (
                <Button size="sm" variant="vino"
                  disabled={!canSend || guardandoReenvio}
                  onClick={handleEnviarValidacionClick}
                  title={!canSend ? "Periodo fuera de tiempo o régimen incompatible" : ""}>
                  {guardandoReenvio ? "Enviando..." : "Enviar a Validación"}
                </Button>
              )}
            </>
          )}
          {periodoConfirmado && (
            <Badge className="gap-1.5 bg-blue-100 text-blue-800 border-0">
              <FileCheck className="h-3 w-3" />Enviada a Validación
            </Badge>
          )}
          {isEmitido && (
            <>
            </>
          )}
          {isReadOnly && (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground py-1.5 px-3">
              <Lock className="h-3 w-3" />Solo lectura
            </Badge>
          )}
          <Button size="sm" variant="default" className="gap-1.5 px-3"
            onClick={() => setHistorialAbierto((v) => !v)}>
            {historialAbierto
              ? <><PanelRightClose className="h-4 w-4" />Ocultar historial</>
              : <><PanelRightOpen className="h-4 w-4" />Ver Historial</>}
          </Button>
        </div>
      </div>

      {(n === "borrador" || n === "en captura") && !isBorradorFueraDeTiempo && (
        <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--sem-support-disabled-low)" }}>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--sem-content-low)" }}>
            <span className="text-[12px] font-bold text-white leading-none">i</span>
          </div>
          <span className="text-sm font-light" style={{ color: "var(--sem-content-low)" }}>
            <strong className="font-medium">Borrador</strong> — Aún no se ha enviado a validación.
          </span>
        </div>
      )}

      {(n.includes("en validacion justificaciones") || n.includes("enviada a validacion") ||
        n.includes("pendiente firma justificacion")) && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[#ecf2ff] px-4 py-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3266cb]">
            <span className="text-[12px] font-bold text-white leading-none">i</span>
          </div>
          <span className="text-sm font-light text-[#3266cb]">
            <strong className="font-medium">Solicitud en revisión por UEFA</strong> — No se puede modificar mientras esté en proceso de aprobación.
          </span>
        </div>
      )}

      {isBorradorFueraDeTiempo && (
        !editingPeriodo && !periodoConfirmado ? (
          <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: permisoActivoBorrador ? "#FFF7ED" : "var(--sem-support-error-low)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: permisoActivoBorrador ? "#EA580C" : "var(--sem-support-error)" }}>
                <span className="text-[12px] font-bold text-white leading-none">i</span>
              </div>
              <span className="text-sm font-light"
                style={{ color: permisoActivoBorrador ? "#C2410C" : "var(--sem-support-on-error-low)" }}>
                <strong className="font-medium">Periodo fuera de tiempo</strong> — Periodo: <strong>{sol.periodoAplicacion}</strong> — Límite DO: <strong>{periodoCheck.limiteDO ?? "N/A"}</strong>
                {permisoActivoBorrador && (
                  <> — Tiene habilitación especial para el periodo <strong>{permisoActivoBorrador.periodo}</strong>. Al actualizar se usará el token de captura.</>
                )}
              </span>
            </div>
            <Button variant="outline" size="sm"
              className={`shrink-0 gap-1.5 ${permisoActivoBorrador ? "border-orange-400/40 text-orange-600 hover:bg-orange-500/5" : "border-[var(--sem-support-error)]/30 text-[var(--sem-support-error)] hover:bg-[var(--sem-support-error)]/5"}`}
              onClick={() => {
                setEditingPeriodo(true)
                if (permisoActivoBorrador) setNewPeriodo(permisoActivoBorrador.periodo)
              }}>
              <Edit3 className="h-3.5 w-3.5" />Cambiar periodo
            </Button>
          </div>
        ) : (
          <Card className={`border-2 shadow-sm ${permisoActivoBorrador ? "border-orange-400/50" : "border-[var(--sem-support-error)]/40"}`}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-end gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                  <span className="text-xs font-medium text-muted-foreground">Régimen: {regimenLabel}</span>
                  <Select value={newPeriodo} onValueChange={setNewPeriodo}>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Selecciona periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodoOptions.map((p) => {
                        const check = checkVigenteFromCal(cal, sol.regimen, p)
                        const habilitadoPorPermiso = !check.vigente && permisoActivoBorrador && p === permisoActivoBorrador.periodo
                        return (
                          <SelectItem key={p} value={p}
                            disabled={!check.vigente && !habilitadoPorPermiso}>
                            {p} {check.vigente ? "(en tiempo)" : habilitadoPorPermiso ? "(habilitado)" : "(vencido)"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="vino" size="sm"
                  disabled={newPeriodo === sol.periodoAplicacion || (
                    !checkVigenteFromCal(cal, sol.regimen, newPeriodo).vigente &&
                    !(permisoActivoBorrador && newPeriodo === permisoActivoBorrador.periodo)
                  )}
                  onClick={handleUpdatePeriodo}>
                  Actualizar
                </Button>
                <Button variant="default" size="sm"
                  onClick={() => { setEditingPeriodo(false); setNewPeriodo(sol.periodoAplicacion) }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {canEdit && !tipoCompatible && (
        <div className="flex items-start gap-3 rounded-[8px] border-l-4 border-l-[#F5A800] bg-[#FFFBEB] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-semibold text-[var(--sem-content-high)]">Régimen incompatible</span>
            <p className="text-sm text-[var(--sem-content-high)] mt-0.5">
              El régimen <strong>{regimenLabel}</strong> no corresponde al tipo <strong>{sol.tipo}</strong>.
            </p>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showConfirmPeriodo}
        onClose={() => setShowConfirmPeriodo(false)}
        onConfirm={handleConfirmPeriodo}
        variant="aprobar"
        title="¿Confirmar cambio de periodo?"
        description={editingModoSolo
          ? <>Se actualizará el periodo a <strong>{newPeriodo}</strong> ({regimenLabel}). La solicitud permanecerá en borrador. Esta acción no se puede deshacer.</>
          : <>Se actualizará el periodo a <strong>{newPeriodo}</strong> ({regimenLabel}) y la justificación será enviada automáticamente a Validación de Justificaciones.
              {permisoDisponible && " Se consumirá el token de Habilitación de Captura."}
              {" "}Esta acción no se puede deshacer.</>
        }
        confirmLabel="Sí, actualizar periodo"
      />
      <ConfirmDialog
        open={showDescargarConfirm}
        onClose={() => setShowDescargarConfirm(false)}
        onConfirm={() => { setShowDescargarConfirm(false); generateJustificacionPDF(sol.id, sol.folioJustificacion || sol.folio) }}
        title="¿Descargar justificación en PDF?"
        description={`Se descargará el PDF de la justificación ${sol.folioJustificacion || sol.folio}.`}
        confirmLabel="Sí, descargar"
      />

      {(n === "borrador" || n === "en captura") && periodoCheck.vigente && tipoCompatible && !isBorradorFueraDeTiempo && (
        !editingPeriodo ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#ecf2ff] px-4 py-3">
            <span className="text-sm font-light text-[#3266cb]">
              <strong className="font-medium">En tiempo para enviar</strong> — Periodo: <strong>{sol.periodoAplicacion}</strong> — Límite DO: <strong>{periodoCheck.limiteDO ?? "N/A"}</strong>
              {permisoDisponible && (
                <> — Habilitación especial disponible para periodo <strong>{permisoDisponible.periodo}</strong> ({regimenLabel}).</>
              )}
            </span>
            <Button variant="outline" size="sm"
              className="shrink-0 gap-1.5 border-[#3266cb]/30 text-[#3266cb] hover:bg-[#3266cb]/5"
              onClick={() => { setEditingPeriodo(true); setNewPeriodo(sol.periodoAplicacion) }}>
              <Edit3 className="h-3.5 w-3.5" />Cambiar periodo
            </Button>
          </div>
        ) : (
          <Card className="border-2 border-secondary/30 shadow-sm">
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-3 rounded-lg border border-border bg-muted/50 p-3">
                  <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                    <span className="text-xs font-medium text-muted-foreground">Régimen: {regimenLabel}</span>
                    <Select value={newPeriodo} onValueChange={setNewPeriodo}>
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Selecciona periodo" />
                      </SelectTrigger>
                      <SelectContent>
                        {periodoOptions.map((p) => {
                          const check = checkVigenteFromCal(cal, sol.regimen, p)
                          const habPorPermiso = !check.vigente && !!permisoDisponible && p === permisoDisponible.periodo
                          return (
                            <SelectItem key={p} value={p} disabled={!check.vigente && !habPorPermiso}>
                              {p}{" "}{check.vigente ? "(en tiempo)" : habPorPermiso ? "(habilitado)" : "(vencido)"}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="vino" size="sm"
                    disabled={newPeriodo === sol.periodoAplicacion || (
                      !checkVigenteFromCal(cal, sol.regimen, newPeriodo).vigente &&
                      !(permisoDisponible && newPeriodo === permisoDisponible.periodo)
                    )}
                    onClick={handleUpdatePeriodo}>
                    Actualizar
                  </Button>
                  <Button variant="default" size="sm"
                    onClick={() => { setEditingPeriodo(false); setNewPeriodo(sol.periodoAplicacion) }}>
                    Cancelar
                  </Button>
                </div>
                {permisoDisponible && newPeriodo === permisoDisponible.periodo && (
                  <p className="text-xs text-orange-600 px-1">
                    Al actualizar se usará la habilitación especial y la solicitud se enviará automáticamente a validación.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}
      {isEmitido && sol.numeroDictamen && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[#ecf2ff] px-4 py-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3266cb]">
            <span className="text-[12px] font-bold text-white leading-none">i</span>
          </div>
          <span className="text-sm font-light text-[#3266cb]">
            <strong className="font-medium">Dictamen Emitido</strong> — No. {sol.numeroDictamen} — Fecha: {sol.fechaDictamen}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row flex-1 min-h-0">
        <div className="min-w-0 flex-1 max-w-7xl mx-auto">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="flex flex-col gap-4">
              {sol.tipo === "Prestacion de Servicios"
                ? <ExpedientePrestacion solicitud={sol} wide={!historialAbierto} />
                : <ExpedienteNombramiento solicitud={sol} wide={!historialAbierto} />}
            </div>
          </ScrollArea>
        </div>

        <div
          className={`overflow-hidden transition-[width,opacity] duration-300 ease-in-out ${
            historialAbierto ? "w-full opacity-100 lg:w-1/2" : "w-0 opacity-0"
          }`}
        >
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="flex flex-col gap-3 pr-4 min-w-[320px]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <FilterTabs
                  value={rightTab}
                  onValueChange={(v) => setRightTab(v as "historial" | "bitacora" | "observaciones")}
                  items={[
                    { value: "historial", label: "Historial" },
                    { value: "bitacora", label: "Bitácora" },
                    { value: "observaciones", label: "Observaciones", count: hasObs ? (observacionesVisibles.length || 1) : undefined },
                  ]}
                />
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {rightTab === "historial" &&
                      `Folio ${sol.folioJustificacion || sol.folio} · ${sol.historial.length} evento${sol.historial.length !== 1 ? "s" : ""}`}
                    {rightTab === "bitacora" &&
                      (() => {
                        const total = sol.bitacora.reduce((acc, e) => acc + e.eventos.length, 0)
                        return `${total} evento${total !== 1 ? "s" : ""} registrados`
                      })()}
                    {rightTab === "observaciones" &&
                      (observacionesVisibles.length > 0
                        ? `${observacionesVisibles.length} observación${observacionesVisibles.length !== 1 ? "es" : ""}`
                        : sol.observacionMotivo ? "1 observación" : "Sin observaciones")}
                  </span>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-card-foreground"
                    title="Cerrar panel" aria-label="Cerrar panel"
                    onClick={() => setHistorialAbierto(false)}>
                    <PanelRightClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {rightTab === "historial" && (
                <div className="overflow-hidden rounded-xl border border-border shadow-md">
                  <AvanceSolicitud estado={sol.estado} tipo={sol.tipo} historial={sol.historial} compact />
                  <div className="bg-card px-4 py-3">
                    <HistorialTimeline entries={sol.historial} variant="alerta" />
                  </div>
                </div>
              )}

              {rightTab === "bitacora" && (
                <div className="overflow-hidden rounded-xl border border-border shadow-md">
                  <div className="bg-card px-5 pt-4 pb-3">
                    <HistorialTimeline
                      entries={sol.bitacora.flatMap((entry) =>
                        entry.eventos.map((ev) => ({
                          fecha: ev.fecha,
                          usuario: ev.usuario,
                          estadoAnterior: null,
                          estadoNuevo: ev.descripcion.replace("Archivo cargado: ", ""),
                          comentario: null,
                        } satisfies HistorialEntryData))
                      )}
                      variant="alerta"
                    />
                  </div>
                </div>
              )}

              {rightTab === "observaciones" && (
                <div className="overflow-hidden rounded-xl border border-border shadow-md">
                  <div className="bg-card p-4 flex flex-col gap-3">
                    {(() => {
                      const obs = getObservador(sol.estado)
                      if (!obs) return null
                      const tipo = obs === "Validación UEFA" || obs === "Verificación DGDO" ? "Observación" : "Devolución"
                      return (
                        <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)]">
                          {tipo} — {obs}
                        </span>
                      )
                    })()}
                    {observacionesVisibles.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {observacionesVisibles.map((obs, i) => (
                          <div key={i} className="rounded-lg border border-[var(--sem-support-on-error-low)]/20 bg-[var(--sem-support-on-error-low)]/[0.03] p-3 flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)]">{obs.estado.replace(/Verificacion Final/i, "Verificación DGDO")}</span>
                              <span className="text-[10px] text-muted-foreground">{obs.fecha} — {obs.usuario}</span>
                            </div>
                            <DevolucionObs comentario={obs.comentario} />
                          </div>
                        ))}
                      </div>
                    ) : sol.observacionMotivo ? (
                      <div className="rounded-lg border border-[var(--sem-support-on-error-low)]/20 bg-[var(--sem-support-on-error-low)]/[0.03] p-3 flex flex-col gap-1">
                        {sol.observacionFecha && <span className="text-[10px] text-muted-foreground">{sol.observacionFecha}</span>}
                        {sol.observacionUsuario && <span className="text-[10px] text-muted-foreground">Por: {sol.observacionUsuario}</span>}
                        <DevolucionObs comentario={sol.observacionMotivo} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

type CalData = {
  honorarios:   { mes: string; limiteDO: string }[]
  asimilados:   { quincena: string; limiteDO: string }[]
  nombramiento: { quincena: string; limiteDO: string }[]
}

const MESES_NOMBRE = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function normalizarPeriodoANombre(periodo: string): string {
  const m = periodo.match(/^(\d+)\/\d{4}$/)
  if (m) return MESES_NOMBRE[parseInt(m[1], 10) - 1] ?? periodo
  return periodo
}

function checkVigenteFromCal(
  cal: CalData,
  regimen: RegimenPeriodo,
  periodo: string,
): { vigente: boolean; limiteDO: string | null } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let row: { limiteDO: string } | undefined
  if (regimen === "honorarios") {
    const nombre = normalizarPeriodoANombre(periodo)
    row = cal.honorarios.find((r) => r.mes === nombre || r.mes === periodo)
  } else if (regimen === "asimilados") {
    row = cal.asimilados.find((r) => r.quincena === periodo)
    if (!row) {
      const nombre = normalizarPeriodoANombre(periodo)
      row = cal.asimilados.find((r) => r.quincena.includes(nombre))
    }
  } else {
    row = cal.nombramiento.find((r) => r.quincena === periodo)
    if (!row) {
      const nombre = normalizarPeriodoANombre(periodo)
      row = cal.nombramiento.find((r) => r.quincena.includes(nombre))
    }
  }
  if (!row) return { vigente: false, limiteDO: null }
  const vigente = today <= parseDateDMY(row.limiteDO)
  return { vigente, limiteDO: row.limiteDO }
}

export function MisSolicitudesPage({ onEditSolicitud, initialTab }: { onEditSolicitud?: (payload: EditSolicitudPayload) => void; initialTab?: string }) {
  const { user }    = useAuth()
  const { toast }   = useToast()
  const [data, setData]             = useState<UrgSolicitud[]>([])
  const [tabCounts, setTabCounts]   = useState<Record<UrgTab, number>>({
    Borradores: 0, "En aprobación": 0, "Observadas / Devueltas": 0,
    "En proceso DGDO": 0, Emitidas: 0, Todas: 0,
  })
  const hasDataRef                   = useRef(false)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const TABS: UrgTab[] = [
    "Borradores", "En aprobación", "ObservDadas / Devueltas",
    "En proceso DGDO", "Todas",
  ]
  const validInitialTab = TABS.includes(initialTab as UrgTab) ? (initialTab as UrgTab) : "Todas"
  const [activeTab, setActiveTab]   = useState<UrgTab>(validInitialTab)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [calData, setCalData]       = useState<CalData>({ honorarios: [], asimilados: [], nombramiento: [] })

  useEffect(() => {
    fetch(`/api/calendario?ejercicio=${new Date().getFullYear()}`)
      .then((r) => r.json())
      .then((d) => setCalData({
        honorarios:   d.honorarios   ?? [],
        asimilados:   d.asimilados   ?? [],
        nombramiento: d.nombramiento ?? [],
      }))
      .catch(() => { })
  }, [])

  const fetchData = useCallback(async (tab: UrgTab, search: string) => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ tab, search, pageSize: "200" })
      const res = await fetch(`/api/mi-justificacion?${params}`, {
        headers: { "x-user-id": user?.id ?? "" },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Error ${res.status}`)
      }
      const json = await res.json()
      setData((json.items ?? []).map(mapApiItem))
      setTabCounts(json.tabCounts ?? {
        Borradores: 0, "En aprobación": 0, "Observadas / Devueltas": 0,
        "En proceso DGDO": 0, Emitidas: 0, Todas: 0,
      })
      hasDataRef.current = true
    } catch (err: any) {
      setError(err.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    const timer = setTimeout(
      () => fetchData(activeTab, searchTerm),
      searchTerm ? 400 : 0,
    )
    return () => clearTimeout(timer)
  }, [activeTab, searchTerm, fetchData])

  const reloadCurrent = useCallback(() => { fetchData(activeTab, searchTerm) }, [fetchData, activeTab, searchTerm])
  useRealtime(["solicitudes"], reloadCurrent)

  const filtered          = data
  useEffect(() => { setCurrentPage(1) }, [activeTab, searchTerm])
  const totalPages    = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages)) }, [totalPages, currentPage])
  const paginated     = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const selectedSolicitud = selectedId
    ? data.find((s) => s.id === selectedId) ?? null
    : null

  const handleReenviar = useCallback(async (id: string) => {
    const res = await fetch("/api/validacion", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        solicitudId: id,
        nuevoEstado: "En Validacion Justificaciones",
        usuarioId:   user?.id ?? "",
        comentario:  "Reenviado por capturista tras corrección de observaciones",
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      toast({ title: "Error", description: json.error ?? "Error al reenviar", variant: "destructive" })
      return
    }
    toast({ title: "Reenviado", description: "La solicitud fue reenviada a Validación." })
    setSelectedId(null)
    void fetchData(activeTab, searchTerm)
  }, [user?.id, toast, fetchData, activeTab, searchTerm])

  const handleEnviarValidacion = useCallback(async (id: string) => {
    const res = await fetch("/api/validacion", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        solicitudId: id,
        nuevoEstado: "En Validacion Justificaciones",
        usuarioId:   user?.id ?? "",
        comentario:  "Solicitud enviada a Validación de Justificaciones por la URG",
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      toast({ title: "Error", description: json.error ?? "Error al enviar a validación", variant: "destructive" })
      return
    }
    toast({ title: "Enviada a Validación", description: "La solicitud fue enviada a Validación de Justificaciones." })
    setSelectedId(null)
    void fetchData(activeTab, searchTerm)
  }, [user?.id, toast, fetchData, activeTab, searchTerm])

  const handleUpdatePeriodoYEnviar = useCallback(async (id: string, periodo: string) => {
    const resEnvio = await fetch("/api/validacion", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        solicitudId: id,
        nuevoEstado: "En Validacion Justificaciones",
        usuarioId:   user?.id ?? "",
        comentario:  `Periodo actualizado a "${periodo}" y enviado a validación por capturista`,
      }),
    })
    const jsonEnvio = await resEnvio.json()
    if (!resEnvio.ok || !jsonEnvio.ok) {
      toast({ title: "Error", description: jsonEnvio.error ?? "Error al enviar a validación", variant: "destructive" })
      return
    }
    toast({ title: "Enviada a Validación", description: `Periodo actualizado a "${periodo}" y solicitud enviada a Validación.` })
    setSelectedId(null)
    void fetchData(activeTab, searchTerm)
  }, [user?.id, toast, fetchData, activeTab, searchTerm])

  if (selectedSolicitud) {
    return (
      <PageLayout noContainer>
        <DetalleView
          sol={selectedSolicitud}
          calData={calData}
          onBack={() => setSelectedId(null)}
          onEditSolicitud={onEditSolicitud}
          onReenviar={handleReenviar}
          onEnviarValidacion={handleEnviarValidacion}
          onUpdatePeriodo={() => { void fetchData(activeTab, searchTerm) }}
          onUpdatePeriodoYEnviar={handleUpdatePeriodoYEnviar}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Bandeja de mis solicitudes"
      description="Consulta y da seguimiento al estado de tus solicitudes."
    >

      <FilterTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as UrgTab)}
        items={TABS.map((tab) => ({ value: tab, label: tab, count: tabCounts[tab] }))}
      />

      <SearchInput
        placeholder="Buscar por folio, tipo, secretaría..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        containerClassName={SEARCH_INPUT_MAX_W_SM}
      />
      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[var(--sem-support-error)] bg-[#FFF5F5] px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--sem-support-error)] mt-0.5" />
          <span className="text-sm text-[var(--sem-support-error)]">{error}</span>
        </div>
      )}
      <div className="rounded-2xl bg-background border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-base text-content-high">
                  <th className="px-4 py-3 text-left font-semibold">
                    {getFolioHeader(activeTab)}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Régimen de Contratación
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Fecha de Creación
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Fecha de Recepción
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Estatus
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Plazo máximo de atención
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                }
                {paginated.map((sol) => {
                  const observador  = getObservador(sol.estado)
                  const subEstado   = getSubEstadoDGDO(sol.estado)
                  const isObservada = observador !== null
                  const isEmitida   = (sol.estado ?? "").toLowerCase() === "emitido"
                  const solTab      = getTab(sol.estado)
                  const isBorrador  = solTab === "Borradores"
                  const isBorradorFueraDeTiempo =
                    isBorrador && sol.slaRestante != null && sol.slaRestante <= 0
                  return (
                    <tr key={sol.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <FoliosCell sol={sol} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-normal break-words max-w-[180px]">
                        <span className="text-muted-foreground">
                          {formatRegimen(sol.regimen)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sol.fecha}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {sol.fechaRecepcion
                          ? sol.fechaRecepcion
                          : <span className="italic text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {estadoBadge(sol.estado)}
                            {subEstado && (
                              <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-0 text-[10px] px-1.5">
                                {subEstado}
                              </Badge>
                            )}
                            {isBorradorFueraDeTiempo && (
                              <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-0 text-[10px] px-1.5 gap-1">
                                <AlertTriangle className="h-3 w-3" />Periodo vencido
                              </Badge>
                            )}
                          </div>
                          {isObservada && (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                Por: <span className="font-medium text-card-foreground">{observador}</span>
                                {sol.observacionFecha && (
                                  <span> — {sol.observacionFecha}</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sol.slaRestante == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (() => {
                          const color = sol.slaRestante <= 0 ? C_ROSA_VINO : sol.slaRestante <= 7 ? C_ROSA_VINO : sol.slaRestante <= 15 ? C_AMARILLO : C_VERDE_ESTADO
                          const bgColor = sol.slaRestante <= 0 ? C_ROSA_VINO_BG : sol.slaRestante <= 7 ? C_ROSA_VINO_BG : sol.slaRestante <= 15 ? C_AMARILLO_BG : C_VERDE_ESTADO_BG
                          const label = sol.slaRestante <= 0 ? "Cerrada" : `${sol.slaRestante} ${sol.slaRestante === 1 ? "día" : "días"}`
                          return (
                            <span
                              className="inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit"
                              style={{ backgroundColor: bgColor, color }}
                            >
                              {label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost" size="sm" aria-label="Ver solicitud"
                          onClick={() => setSelectedId(sol.id)}
                          className="gap-1.5 font-medium -ml-3"
                          style={{ color: "var(--sem-content-low)" }}
                        >
                          <Eye className="h-4 w-4" /> Ver
                        </Button>
                      </td>
                    </tr>
                  )
                })}

                {!loading && filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>
                      <EmptyState icon={Inbox} title="Sin resultados" description="Ajusta los filtros para ver más resultados." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </PageLayout>
  )
}