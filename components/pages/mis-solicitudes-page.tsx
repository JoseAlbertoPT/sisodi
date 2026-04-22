"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import {
  Search, Eye, Edit3, Download, FileCheck,
  ChevronDown, ChevronRight, Info, History, FileText,
  ArrowLeft, AlertTriangle, Lock, Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import { type EditSolicitudPayload } from "@/components/pages/nueva-solicitud-page"
import {
  isPeriodoVigente,
  isRegimenTipoCompatible,
  getPeriodoEndDate,
  parseDateDMY,
  CAP_3000,
  CAP_1000,
  NOMBRAMIENTO_TD,
  type RegimenPeriodo,
} from "@/lib/calendario-recepcion-mock"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
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
  | "En Validacion Final"
  | "Observado por Validacion Final"
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

interface HistorialEntry {
  fecha: string
  usuario: string
  accion: string
  comentario?: string | null
}

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
  tipoImporte: string
  historial: HistorialEntry[]
  bitacora: BitacoraEntry[]
  observacionMotivo?: string
  observacionFecha?: string
  observacionUsuario?: string
  numeroDictamen?: string
  fechaDictamen?: string
  regimen: RegimenPeriodo
  periodoAplicacion: string
  fechaRecepcion?: string
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
      {entries.map(({ label, value, highlight }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`text-[10px] rounded px-1 py-0.5 shrink-0 ${
            highlight
              ? "bg-primary/10 text-primary font-semibold"
              : "bg-muted text-muted-foreground"
          }`}>
            {label}
          </span>
          <span className={`text-xs ${highlight ? "font-semibold text-card-foreground" : "text-muted-foreground"}`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function getFolioHeader(_tab: UrgTab): string {
  return "Folios"
}

function getTab(estado: UrgEstado): UrgTab {
  const n = (estado ?? "").toLowerCase()
  if (n === "borrador" || n === "en captura") return "Borradores"
  if (n === "emitido") return "Emitidas"
  if (n.includes("observad") || n.includes("devuelta por do")) return "Observadas / Devueltas"
  if (n.includes("en revision") || n.includes("en validacion final") ||
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
  if (n.includes("observada por uefa") || n.includes("observado por uefa")) return "Validacion UEFA"
  if (n.includes("observado por validacion final")) return "Validacion DGDO"
  if (n.includes("observado por validacion")) return "Validacion UEFA"
  if (n.includes("observado por revisor")) return "Revision DGDO"
  if (n.includes("observado por do") || n.includes("observado do filtro") || n.includes("devuelta por do")) return "DO"
  if (n.includes("observado por emisor")) return "Emision DGDO"
  return null
}

function getSubEstadoDGDO(estado: UrgEstado): string | null {
  const n = (estado ?? "").toLowerCase()
  if (n === "pendiente do" || n.includes("en revision revisor") || n === "aprobado por revisor" ||
      n.includes("en revision do"))
    return "En Revisión"
  if (n.includes("en validacion final") || n === "aprobado")
    return "En Validacion DGDO"
  if (n.includes("en revision emisor") || n.includes("pendiente firma dictamen"))
    return "En Emisión"
  return null
}

function estadoBadge(estado: UrgEstado) {
  const n = (estado ?? "").toLowerCase()
  let bg = "bg-muted", text = "text-muted-foreground", label: string = estado ?? "—"
  if (n === "borrador" || n === "en captura") {
    bg = "bg-muted"; text = "text-muted-foreground"; label = "Borrador"
  } else if (
    n.includes("en validacion justificaciones") || n.includes("enviada a validacion") ||
    n.includes("pendiente firma justificacion")
  ) {
    bg = "bg-blue-100"; text = "text-blue-800"; label = "En Aprobación"
  } else if (n.includes("observada por uefa") || n.includes("observado por uefa")) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Observada por Validacion UEFA"
  } else if (n.includes("observado por validacion") && !n.includes("final")) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Observada por Validacion UEFA"
  } else if (n.includes("observado por revisor")) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Observada por Revision DGDO"
  } else if (n.includes("observado por validacion final")) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Observada por Validacion DGDO"
  } else if (n.includes("observado por emisor")) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Observada por Emision DGDO"
  } else if (
    n.includes("devuelta por do") || n.includes("observado do filtro") || n.includes("observado por do")
  ) {
    bg = "bg-[#832B56]/15"; text = "text-[#832B56]"; label = "Devuelta por DO"
  } else if (
    n.includes("en revision revisor") || n.includes("en validacion final") ||
    n.includes("en revision emisor") || n.includes("pendiente firma dictamen") ||
    n.includes("en revision do") || n === "en proceso do" ||
    n === "pendiente do" || n === "aprobado por revisor" || n === "aceptado por revisor" || n === "aprobado"
  ) {
    bg = "bg-indigo-100"; text = "text-indigo-800"; label = "En Proceso DGDO"
  } else if (n === "emitido") {
    bg = "bg-emerald-100"; text = "text-emerald-800"; label = "Emitido"
  }
  return (
    <Badge className={`${bg} ${text} hover:${bg} border-0 text-xs`}>{label}</Badge>
  )
}

function normalizarComentario(comentario: string | null | undefined): string | null | undefined {
  if (!comentario) return comentario
  if (/ \| \d+\./.test(comentario)) return comentario.split(" | ").join("\n")
  return comentario
}

function mapApiItem(item: any): UrgSolicitud {
  const lastObsEntry = [...(item.historial ?? [])].reverse().find((h: any) => h.comentario)
  const lastObservacion = normalizarComentario(lastObsEntry?.comentario) as string | undefined
  const lastObservacionFecha   = lastObsEntry?.fecha
    ? new Date(lastObsEntry.fecha).toISOString().replace("T", " ").slice(0, 16)
    : undefined
  const lastObservacionUsuario = lastObsEntry?.usuario as string | undefined

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
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toISOString().slice(0, 10) : ""
  const periodoAplicacion = item.periodo
    ? `${item.periodo.mes}/${item.periodo.anio}`
    : ""
  const regimen = (item.regimen ?? "honorarios") as RegimenPeriodo
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
    "Pendiente Firma Dictamen",
    "En Validacion Final", "Observado por Validacion Final",
    "En revision DO Filtro 1", "En revision DO Filtro 2", "En revision DO Filtro 3",
    "Observado DO Filtro 1", "Observado DO Filtro 2", "Observado DO Filtro 3",
    "Devuelta por DO",
    "En proceso DO", "Aprobado", "Emitido",
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
    marcoNormativo:       Array.isArray(item.marco_normativo)      ? item.marco_normativo      : [],
    condicionesRiesgos:   Array.isArray(item.condiciones_riesgos)  ? item.condiciones_riesgos  : [],
    resguardoActivos:     item.resguardo_activos      ?? "",
    tipoImporte:          item.tipo_importe           ?? "",
    regimen,
    periodoAplicacion,
    observacionMotivo:    lastObservacion,
    observacionFecha:     lastObservacionFecha,
    observacionUsuario:   lastObservacionUsuario,
    numeroDictamen:       item.dictamen?.folio        ?? undefined,
    fechaDictamen:        item.dictamen?.fecha_emision
      ? fmt(item.dictamen.fecha_emision)
      : undefined,
    historial: (item.historial ?? []).map((h: any) => ({
      fecha:      h.fecha
        ? new Date(h.fecha).toISOString().replace("T", " ").slice(0, 16)
        : "",
      usuario:    h.usuario,
      accion:     h.accion,
      comentario: normalizarComentario(h.comentario) ?? null,
    })),
    bitacora,
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-card-foreground">{value || "—"}</span>
    </div>
  )
}
function toList(val: string | string[]): string[] {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (!val) return []
  return val.split(/[\n,•·]+/).map((s) => s.trim()).filter(Boolean)
}
function ReadOnlyList({ label, value, sub }: { label: string; value: string | string[]; sub?: string }) {
  const items = toList(value)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {sub && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{sub}</span>
        )}
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground italic px-3">—</span>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg px-3 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
                {idx + 1}
              </span>
              <span className="text-sm text-card-foreground">{item}</span>
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
        ? <p className="text-sm text-card-foreground whitespace-pre-line leading-relaxed border border-border rounded-md px-3 py-2 bg-muted/30">{value}</p>
        : <span className="text-sm text-muted-foreground italic">—</span>}
    </div>
  )
}

function ObservacionTimeline({ comentario }: { comentario: string }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const itemsChecklist = lineas.filter(l => /^\d+\.\s.+::/.test(l))
  const comentarioGeneral = lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join(" ").trim()

  if (itemsChecklist.length === 0) {
    return <p className="text-sm text-[#832B56] leading-relaxed">{comentario}</p>
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
function ParsedObservacion({ comentario, borderColor = "orange" }: { comentario: string; borderColor?: "orange" | "red" }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const esChecklist = lineas.some(l => /^\d+\.\s.+::/.test(l))
  const itemsChecklist    = esChecklist ? lineas.filter(l => /^\d+\.\s.+::/.test(l)) : []
  const comentarioGeneral = esChecklist
    ? lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join(" ").trim()
    : comentario
  const c = borderColor === "red"
    ? { wrap: "border-[#832B56]/30 bg-[#832B56]/5", title: "text-[#832B56]", text: "text-[#832B56]", item: "border-[#832B56]/20 bg-[#832B56]/5", itemTitle: "text-[#832B56]/90", itemText: "text-[#832B56]" }
    : { wrap: "border-[#832B56]/30 bg-[#832B56]/5", title: "text-[#832B56]", text: "text-[#832B56]/80", item: "border-[#832B56]/20 bg-white/60", itemTitle: "text-[#832B56]", itemText: "text-[#832B56]/80" }
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
function HistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
  if (!historial.length)
    return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>
  return (
    <div className="flex flex-col gap-0">
      {[...historial].reverse().map((entry, index) => {
        const esObservacion = /observad/i.test(entry.accion)
        return (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${esObservacion ? "border-[#832B56]" : "border-secondary"} bg-card`}>
                <div className={`h-2 w-2 rounded-full ${esObservacion ? "bg-[#832B56]" : "bg-secondary"}`} />
              </div>
              {index < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex flex-col gap-1 pb-4 flex-1">
              <span className={`text-xs font-semibold ${esObservacion ? "text-[#832B56]" : "text-card-foreground"}`}>
                {entry.accion}
              </span>
              <span className="text-[10px] text-muted-foreground">{entry.fecha} — {entry.usuario}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
function ExpedientePrestacion({ solicitud }: { solicitud: UrgSolicitud }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría / Dependencia / Organismo"                                value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción"   value={formatClave(solicitud.unidadAdministrativa) || solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto"           value={getNombreForClave(solicitud.unidadResponsable) || solicitud.unidadResponsable} />
          <ReadOnlyField label="Número de Prestadores de Servicios"     value={solicitud.numeroPrestadores} />
          <ReadOnlyField label="Programa o Proyecto"                    value={solicitud.programaProyecto} />
          <ReadOnlyField label="Tipo de Actividad"                    value={solicitud.tipoActividades} />
          <ReadOnlyField label="Régimen de Contratación"                value={formatRegimen(solicitud.regimen)} />
         {/* <ReadOnlyField label="Denominación"                           value={solicitud.denominacion} /> */}
          <ReadOnlyField label="Vigencia Inicio"                        value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                       value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Bruto"                          value={solicitud.importeBruto} />
        </div>
      </SectionCard>

     {/* <SectionCard title="Renovación" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Es Renovación"              value="Sí" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
          </div>

        ) : (
          <ReadOnlyField label="Es Renovación" value="No" />
        )}
      </SectionCard> */}

      <SectionCard title="Tabulador — Nivel y Categoría">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Nivel"     value={solicitud.nivelTabulador     || "—"} />
          <ReadOnlyField label="Categoría" value={solicitud.categoriaTabulador || "—"} />
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
        <div className="grid gap-5 md:grid-cols-2">
          <ReadOnlyList sub="II.1" label="Competencias Administrativas" value={solicitud.compAdm} />
          <ReadOnlyList sub="II.2" label="Competencias Técnicas"        value={solicitud.compTec} />
          <ReadOnlyList sub="II.3" label="Competencias Sociales"        value={solicitud.compSoc} />
          <ReadOnlyList label="Escolaridad Mínima"    value={solicitud.escolaridad} />
          <ReadOnlyList label="Áreas de Experiencia"  value={solicitud.areasExp} />
          <ReadOnlyList label="Valores"               value={solicitud.valores} />
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        <AdjuntosSection bitacora={solicitud.bitacora} />
      </SectionCard>
    </div>
  )
}

function ExpedienteNombramiento({ solicitud }: { solicitud: UrgSolicitud }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría / Dependencia / Organismo"  value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción"  value={formatClave(solicitud.unidadAdministrativa) || solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto"          value={solicitud.unidadResponsable} />
          <ReadOnlyField label="Programa o Proyecto"                   value={solicitud.programaProyecto} />
          <ReadOnlyField label="Régimen de Contratación"               value={formatRegimen(solicitud.regimen)} />
          <ReadOnlyField label="Denominación del Nombramiento"         value={solicitud.denominacion} />
          <ReadOnlyField label="Puesto del Jefe Inmediato"             value={solicitud.puestoJefeInmediato} />
          <ReadOnlyField label="Tipo de Actividad"                   value={solicitud.tipoActividades} />
          <ReadOnlyField label="Número de Personas a Contratar"        value={solicitud.numeroPrestadores} />
          <ReadOnlyField label="Tipo de Pago"    value={solicitud.tipoImporte || "Mensual"} />
          <ReadOnlyField label="Importe Neto"  value={solicitud.importeBruto} />
          <ReadOnlyField label="Vigencia Inicio"                       value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                      value={solicitud.vigenciaFin} />
        </div>
      </SectionCard>

      <SectionCard num="II" title="Tabulador">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Nivel de Tabulador"  value={solicitud.nivelTabulador} />
          <ReadOnlyField label="Categoría Tabulador" value={solicitud.categoriaTabulador} />
        </div>
      </SectionCard>

      {/*<SectionCard title="Renovación" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Es Renovación"              value="Sí" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
          </div>
        ) : (
          <ReadOnlyField label="Es Renovación" value="No" />
        )}
      </SectionCard> */}

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

      {solicitud.condicionesRiesgos.length > 0 && (
        <SectionCard num="VII" title="Condiciones y Riesgos">
          <ReadOnlyList label="" value={solicitud.condicionesRiesgos} />
        </SectionCard>
      )}

      {solicitud.resguardoActivos && (
        <SectionCard num="VIII" title="Resguardo Personalizado de Activos">
          <ReadOnlyField label="Resguardo de Activos" value={solicitud.resguardoActivos === "si" ? "Sí" : solicitud.resguardoActivos === "no" ? "No" : solicitud.resguardoActivos} />
        </SectionCard>
      )}

      <SectionCard num="IX" title="Perfil">
        <div className="grid gap-5 md:grid-cols-2">
          <ReadOnlyList label="Escolaridad Mínima"            value={solicitud.escolaridad} />
          <ReadOnlyList sub="VIII.1" label="Competencias Administrativas" value={solicitud.compAdm} />
          <ReadOnlyList sub="VIII.2" label="Competencias Técnicas"        value={solicitud.compTec} />
          <ReadOnlyList sub="VIII.3" label="Competencias Sociales"        value={solicitud.compSoc} />
          <ReadOnlyList label="Áreas de Experiencia"          value={solicitud.areasExp} />
          <ReadOnlyList label="Valores"                       value={solicitud.valores} />
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
          <FileText className="h-4 w-4 text-secondary shrink-0" />
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
    formData: {
      secretaria:           sol.secretaria,
      unidadAdministrativa: sol.unidadAdministrativa,
      unidadResponsable:    sol.unidadResponsable,
      programaProyecto:     sol.programaProyecto,
      regimen:              sol.regimen,
      tipoActividades:      sol.tipoActividades,
      numeroPrestadores:    sol.numeroPrestadores,
      denominacion:         sol.denominacion,
      puestoJefeInmediato:  sol.puestoJefeInmediato,
      vigenciaInicio:       sol.vigenciaInicio,
      vigenciaFin:          sol.vigenciaFin,
      importeBruto:         importeNum,
      tipoImporte:          sol.tipoImporte,
      nivelTabulador:       sol.nivelTabulador,
      categoriaTabulador:   sol.categoriaTabulador,
      objeto:               sol.objeto,
      actividades:          toList(sol.actividades),
      responsabilidades:    toList(sol.responsabilidades),
      marcoNormativo:       [],
      escolaridad:          sol.escolaridad,
      compAdm:              sol.compAdm,
      compTec:              sol.compTec,
      compSoc:              sol.compSoc,
      valores:              sol.valores,
      areasExp:             sol.areasExp,
    },
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
  sol, onBack, onUpdatePeriodo, onUpdatePeriodoYEnviar, onEditSolicitud, onReenviar, calData,
}: {
  sol: UrgSolicitud
  onBack: () => void
  onUpdatePeriodo?: (id: string, periodo: string) => void
  onUpdatePeriodoYEnviar?: (id: string, periodo: string) => Promise<void>
  onEditSolicitud?: (payload: EditSolicitudPayload) => void
  onReenviar?: (id: string) => Promise<void>
  calData?: CalData
}) {
  const cal = calData ?? { honorarios: [], asimilados: [], nombramiento: [] }
  const { toast } = useToast()
  const n         = (sol.estado ?? "").toLowerCase()
  const canEdit   = n === "borrador" || n === "en captura"
    || n.includes("observad")
    || n.includes("devuelta por do")
  const isEmitido  = n === "emitido"
  const isReadOnly = !canEdit && !isEmitido

  const periodoCheck   = checkVigenteFromCal(cal, sol.regimen, sol.periodoAplicacion)
  const tipoCompatible = isRegimenTipoCompatible(sol.regimen, sol.tipo)
  const canSend        = periodoCheck.vigente && tipoCompatible

  const periodoEndDate = getPeriodoEndDate(sol.regimen, sol.periodoAplicacion)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isBorradorFueraDeTiempo =
    (n === "borrador" || n === "en captura") &&
    (periodoEndDate === null || today > periodoEndDate)

  const [editingPeriodo,     setEditingPeriodo]     = useState(false)
  const [newPeriodo,         setNewPeriodo]         = useState(sol.periodoAplicacion)
  const [guardandoReenvio,   setGuardandoReenvio]   = useState(false)
  const [showConfirmPeriodo, setShowConfirmPeriodo] = useState(false)
  const [periodoConfirmado,  setPeriodoConfirmado]  = useState(false)

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
  const handleUpdatePeriodo = () => {
    if (newPeriodo !== sol.periodoAplicacion) {
      setShowConfirmPeriodo(true)
    }
  }
  const handleConfirmPeriodo = async () => {
    setShowConfirmPeriodo(false)
    setGuardandoReenvio(true)
    try {
      if (onUpdatePeriodoYEnviar) {
        await onUpdatePeriodoYEnviar(sol.id, newPeriodo)
      } else {
        if (onUpdatePeriodo) onUpdatePeriodo(sol.id, newPeriodo)
        toast({ title: "Periodo actualizado", description: `Periodo cambiado a "${newPeriodo}".` })
      }
      setEditingPeriodo(false)
      setPeriodoConfirmado(true)
    } finally {
      setGuardandoReenvio(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => generateJustificacionPDF({
              folio:                sol.folioJustificacion || sol.folio,
              tipo:                 sol.tipo,
              secretaria:           sol.secretaria,
              unidadAdministrativa: sol.unidadAdministrativa,
              regimen:              sol.regimen,
              denominacion:         sol.denominacion,
              vigenciaInicio:       sol.vigenciaInicio,
              vigenciaFin:          sol.vigenciaFin,
              importeBruto:         sol.importeBruto,
              esRenovacion:         sol.esRenovacion,
              folioAnterior:        sol.folioAnterior,
              fecha:                sol.fecha,
              firmadoDigitalmente:  !canEdit,
            })}>
            <Download className="h-4 w-4" />Justificación (PDF)
          </Button>
          {canEdit && !periodoConfirmado && (
            <>
              <Button size="sm"
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-1.5"
                onClick={() => onEditSolicitud
                  ? onEditSolicitud(solToEditPayload(sol))
                  : handleDemoAction("Continuar captura")
                }>
                <Edit3 className="h-4 w-4" />Continuar Captura
              </Button>
              {(n === "borrador" || n === "en captura") && (
                <Button size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                  disabled={!canSend}
                  onClick={() => handleDemoAction("Enviar a Validacion")}
                  title={!canSend ? "Periodo fuera de tiempo o régimen incompatible" : ""}>
                  <FileCheck className="h-4 w-4" />Enviar a Validación
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
        </div>
      </div>

      {(n.includes("en validacion justificaciones") || n.includes("enviada a validacion") ||
        n.includes("pendiente firma justificacion")) && (
        <Card className="border-2 border-blue-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-blue-700">Solicitud en revisión por UEFA</span>
              <p className="text-sm text-muted-foreground mt-1">
                No se puede modificar mientras esté en proceso de aprobación.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {getObservador(sol.estado) === "Validacion UEFA" || getObservador(sol.estado) === "Validacion DGDO" ? (
        <Card className="border-2 border-[#832B56]/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-[#832B56] shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-[#832B56]">
                  Observación de {getObservador(sol.estado)}
                </span>
                {sol.observacionFecha && (
                  <span className="text-[10px] text-muted-foreground">{sol.observacionFecha}</span>
                )}
              </div>
              {sol.observacionUsuario && (
                <p className="text-xs text-muted-foreground mt-0.5">Por: {sol.observacionUsuario}</p>
              )}
              {sol.observacionMotivo && (
                <ObservacionTimeline comentario={sol.observacionMotivo} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {getObservador(sol.estado) !== null &&
       getObservador(sol.estado) !== "Validacion UEFA" &&
       getObservador(sol.estado) !== "Validacion DGDO" ? (
        <Card className="border-2 border-[#832B56]/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-[#832B56] shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-[#832B56]">
                  Devolución — {getObservador(sol.estado)}
                </span>
                {sol.observacionFecha && (
                  <span className="text-[10px] text-muted-foreground">{sol.observacionFecha}</span>
                )}
              </div>
              {sol.observacionUsuario && (
                <p className="text-xs text-muted-foreground">Por: {sol.observacionUsuario}</p>
              )}
              {sol.observacionMotivo && (
                <ObservacionTimeline comentario={sol.observacionMotivo} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isBorradorFueraDeTiempo && (
        <Card className="border-2 border-destructive/40 shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-destructive">Periodo fuera de tiempo</span>
                <p className="text-sm text-card-foreground mt-1">
                  El periodo seleccionado ya no está disponible. Debes actualizarlo conforme al calendario de recepción.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Periodo: <strong>{sol.periodoAplicacion}</strong> ({regimenLabel}) — Límite DO:{" "}
                  <strong>{periodoCheck.limiteDO ?? "N/A"}</strong>
                </p>
              </div>
            </div>
            {!editingPeriodo && !periodoConfirmado ? (
              <Button variant="outline" size="sm"
                className="self-start gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => setEditingPeriodo(true)}>
                <Edit3 className="h-3.5 w-3.5" />Cambiar periodo
              </Button>
            ) : (
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
                        return (
                          <SelectItem key={p} value={p}>
                            {p} {check.vigente ? "(en tiempo)" : "(vencido)"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={newPeriodo === sol.periodoAplicacion || !checkVigenteFromCal(cal, sol.regimen, newPeriodo).vigente}
                  onClick={handleUpdatePeriodo}>
                  Actualizar
                </Button>
                <Button variant="ghost" size="sm"
                  onClick={() => { setEditingPeriodo(false); setNewPeriodo(sol.periodoAplicacion) }}>
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && !tipoCompatible && (
        <Card className="border-2 border-amber-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-amber-700">Régimen incompatible</span>
              <p className="text-sm text-card-foreground mt-1">
                El régimen <strong>{regimenLabel}</strong> no corresponde al tipo <strong>{sol.tipo}</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showConfirmPeriodo} onOpenChange={setShowConfirmPeriodo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de periodo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará el periodo a <strong>{newPeriodo}</strong> ({regimenLabel}) y la
              justificación será enviada automáticamente a Validación de Justificaciones.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmPeriodo(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPeriodo}>
              Sí, actualizar periodo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(n === "borrador" || n === "en captura") && periodoCheck.vigente && tipoCompatible && (
        <Card className="border-2 border-secondary/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <FileCheck className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-secondary">En tiempo para enviar</span>
              <p className="text-xs text-muted-foreground mt-1">
                Periodo: {sol.periodoAplicacion} — Límite DO: {periodoCheck.limiteDO}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isEmitido && sol.numeroDictamen && (
        <Card className="border-2 border-emerald-400/40 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <FileCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <span className="text-sm font-medium text-emerald-700">Dictamen Emitido</span>
              <p className="text-xs text-muted-foreground">
                No. {sol.numeroDictamen} — Fecha: {sol.fechaDictamen}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sol.tipo === "Prestacion de Servicios"
            ? <ExpedientePrestacion solicitud={sol} />
            : <ExpedienteNombramiento solicitud={sol} />}
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <History className="h-4 w-4 text-secondary" />Historial de Estatus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HistorialTimeline historial={sol.historial} />
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <Info className="h-4 w-4 text-secondary" />Bitácora de Captura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {sol.bitacora.map((entry, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-card-foreground mb-1.5">{entry.seccion}</p>
                    <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-border">
                      {entry.eventos.map((ev, j) => (
                        <div key={j} className="flex flex-col">
                          <span className="text-xs text-card-foreground">{ev.descripcion}</span>
                          <span className="text-[10px] text-muted-foreground">{ev.fecha} — {ev.usuario}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

function checkVigenteFromCal(
  cal: CalData,
  regimen: RegimenPeriodo,
  periodo: string,
): { vigente: boolean; limiteDO: string | null } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let row: { limiteDO: string } | undefined
  if (regimen === "honorarios") {
    row = cal.honorarios.find((r) => r.mes === periodo)
  } else if (regimen === "asimilados") {
    row = cal.asimilados.find((r) => r.quincena === periodo)
  } else {
    row = cal.nombramiento.find((r) => r.quincena === periodo)
  }
  if (!row) return { vigente: false, limiteDO: null }
  const fechaFin = getPeriodoEndDate(regimen, periodo)
  const vigente = fechaFin !== null ? today <= fechaFin : today <= parseDateDMY(row.limiteDO)
  return { vigente, limiteDO: row.limiteDO }
}

export function MisSolicitudesPage({ onEditSolicitud }: { onEditSolicitud?: (payload: EditSolicitudPayload) => void }) {
  const { user }    = useAuth()
  const { toast }   = useToast()
  const [data, setData]             = useState<UrgSolicitud[]>([])
  const [tabCounts, setTabCounts]   = useState<Record<UrgTab, number>>({
    Borradores: 0, "En aprobación": 0, "Observadas / Devueltas": 0,
    "En proceso DGDO": 0, Emitidas: 0, Todas: 0,
  })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<UrgTab>("Todas")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [calData, setCalData]       = useState<CalData>({ honorarios: [], asimilados: [], nombramiento: [] })

  const TABS: UrgTab[] = [
    "Borradores", "En aprobación", "Observadas / Devueltas",
    "En proceso DGDO", "Emitidas", "Todas",
  ]

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
    setLoading(true); setError(null)
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

  const filtered          = data
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
    setData((prev) => prev.map((s) =>
      s.id === id ? { ...s, estado: "En Validacion Justificaciones" } : s
    ))
    toast({ title: "Reenviado", description: "La solicitud fue reenviada a Validación." })
    setSelectedId(null)
  }, [user?.id, toast])

  const handleUpdatePeriodoYEnviar = useCallback(async (id: string, periodo: string) => {
    const resEnvio = await fetch("/api/validacion", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
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
    setData((prev) => prev.map((s) =>
      s.id === id ? { ...s, periodoAplicacion: periodo, estado: "En Validacion Justificaciones" } : s
    ))
    toast({ title: "Enviada a Validación", description: `Periodo actualizado a "${periodo}" y solicitud enviada a Validación.` })
    setSelectedId(null)
  }, [user?.id, toast])

  if (selectedSolicitud) {
    return (
      <PageLayout noContainer>
        <DetalleView
          sol={selectedSolicitud}
          calData={calData}
          onBack={() => setSelectedId(null)}
          onEditSolicitud={onEditSolicitud}
          onReenviar={handleReenviar}
          onUpdatePeriodo={(id, periodo) =>
            setData((prev) => prev.map((s) => s.id === id ? { ...s, periodoAplicacion: periodo } : s))
          }
          onUpdatePeriodoYEnviar={handleUpdatePeriodoYEnviar}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Bandeja de mis justificaciones"
      description="Consulta y da seguimiento al estado de tus solicitudes."
    >

      <FilterTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as UrgTab)}
        items={TABS.map((tab) => ({ value: tab, label: tab, count: tabCounts[tab] }))}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio, tipo, secretaría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {loading ? "Cargando solicitudes..." : `${filtered.length} solicitudes encontradas`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-4">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="px-4 py-3 text-left font-semibold">
                    {getFolioHeader(activeTab)}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Regimen  de Contratación
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
                  <th className="px-4 py-3 text-left font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                }
                {filtered.map((sol) => {
                  const observador  = getObservador(sol.estado)
                  const subEstado   = getSubEstadoDGDO(sol.estado)
                  const isObservada = observador !== null
                  const isEmitida   = (sol.estado ?? "").toLowerCase() === "emitido"
                  const solTab      = getTab(sol.estado)
                  const isBorrador  = solTab === "Borradores"
                  const periodoEndDate = getPeriodoEndDate(sol.regimen, sol.periodoAplicacion)
                  const todayRow = new Date(); todayRow.setHours(0, 0, 0, 0)
                  const isBorradorFueraDeTiempo =
                    isBorrador && (periodoEndDate === null || todayRow > periodoEndDate)
                  return (
                    <tr key={sol.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <FoliosCell sol={sol} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-card-foreground font-medium">
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
                              {sol.observacionMotivo && (
                                <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[220px]">
                                  {sol.observacionMotivo}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm"
                            onClick={() => setSelectedId(sol.id)}
                            className="text-secondary hover:text-primary gap-1.5">
                            <Eye className="h-4 w-4" />Ver
                          </Button>

                        </div>
                      </td>
                    </tr>
                  )
                })}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No se encontraron solicitudes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}