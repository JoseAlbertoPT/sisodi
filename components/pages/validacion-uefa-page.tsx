"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { applyTextRules } from "@/lib/utils"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReadOnlyField } from "@/components/ui/readonly-field"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, estadoBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  CheckCircle2, RotateCcw, Download, FileText, Inbox,
  AlertTriangle, ChevronDown, ChevronRight, ArrowLeft, FileCheck,
  RefreshCw, Loader2, HelpCircle, Printer, Stamp, Lock,
  Shield, FileSignature, X, MoreHorizontal,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileTypeIcon } from "@/components/ui/file-drop-zone"
import { generateJustificacionPDF, generateJustificacionPDFBase64 } from "@/lib/generate-justificacion-pdf"
import { FirmaModal } from "@/components/firma-modal"
import { useAuth } from "@/lib/auth-context"
import { getNombreForClave, formatClave } from "@/lib/ua-claves-catalog"
import { type HistorialEntryData } from "@/components/historial-timeline"
import { ConfirmToast } from "@/components/ui/confirm-toast"
import { TablePagination, ITEMS_PER_PAGE } from "@/components/ui/table-pagination"
import {
  StatusTabsList, HistorialPanel, BitacoraPanel, ObservacionesPanel,
  type BitacoraEntry, type StatusTabKey,
} from "@/components/solicitud-status-tabs"

type UefaEstado = string

type UefaTab =
  | "Nuevas"
  | "Pendiente Firma"
  | "En Proceso"
  | "Observadas"
  | "Devueltas"
  | "Observadas/Devueltas"
  | "Emitidas"
  | "Todas"

interface UefaSolicitud {
  id: number
  folio: string
  folioJustificacion: string
  folioDictamen: string | null
  modalidadFirma: "electronica" | "autografa" | null
  tipo: string
  secretaria: string
  fecha: string
  estado: UefaEstado
  denominacion: string
  unidadAdministrativa: string
  unidadResponsable: string
  programaProyecto: string
  regimen: string
  tipoActividades: string
  numeroPrestadores: string
  vigenciaInicio: string
  vigenciaFin: string
  fechaEnvio: string
  importeBruto: string
  esRenovacion: boolean
  esExtemporanea: boolean
  folioAnterior?: string
  historial: HistorialEntryData[]
  observacionesUefa: string
  observadoPor?: string
  fechaObservacion?: string
  tipoObservacion?: string
  todasObservaciones: { estado: string; fecha: string; usuario: string; comentario: string }[]
  numeroDictamen?: string
  fechaDictamen?: string
  tipoFirma?: string | null
  destinatarios?: string[]
  firmadoPor?: { reviso: string; valido: string; emitio: string } | null
  secretariaId: string | null
  objeto: string
  actividades: string[]
  responsabilidades: string[]
  escolaridad: string
  compAdm: string
  compTec: string
  compSoc: string
  valores: string
  areasExp: string
  reingresoCount: number
  _raw?: any
}
const INICIALES_MES_MAP: Record<string, string> = {
  "01": "EN", "02": "FE", "03": "MR", "04": "AB",
  "05": "MY", "06": "JN", "07": "JL", "08": "AG",
  "09": "SE", "10": "OC", "11": "NO", "12": "DI",
}

function formatearFolio(folio: string | null | undefined): string {
  if (!folio || folio === "—") return "—"

  const matchLegacy = folio.match(/^(\d+)\/(\d{1,2})\/(\d{4})$/)
  if (matchLegacy) return `${matchLegacy[1]}/${matchLegacy[2].padStart(2, "0")}/${matchLegacy[3]}`

  const matchDictamen = folio.match(/^[A-Z]{2,3}-(\d+)-(\d{4})$/)
  if (matchDictamen) return `${matchDictamen[1].padStart(3, "0")}-${matchDictamen[2]}`

  const matchTemporal = folio.match(/^[A-Z]{2,3}-(\d+)$/)
  if (matchTemporal) return matchTemporal[1].padStart(3, "0")

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

function formatFechaHora(v: string | null | undefined) {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function getTabForEstado(estado: string): UefaTab {
  const n = norm(estado)

  if (n === "en captura" || n.includes("en validacion justificaciones") || n.includes("enviada a validacion")) return "Nuevas"
  if (n.includes("pendiente firma justificacion")) return "Pendiente Firma"
  if (n.includes("observado por validacion") && !n.includes("final")) return "Observadas/Devueltas"
  if (n.includes("observado por do") || n.includes("observado do")) return "Observadas/Devueltas"
  if (n.includes("observado por revisor")) return "Observadas/Devueltas"
  if (n.includes("observado por")) return "Observadas/Devueltas"
  if (n === "emitido") return "Emitidas"

  if (n.includes("observado por validacion final")) return "Observadas/Devueltas"
  if (
    n.includes("en revision") ||
    n.includes("en validacion final") ||
    n.includes("pendiente firma dictamen") ||
    n.includes("pendiente do") ||
    n.includes("aceptado por revisor") ||
    n.includes("aprobado por revisor") ||
    n.includes("observado por emisor")
  ) return "En Proceso"
  return "Nuevas"
}
function formatRegimen(raw: string): string {
  const r = (raw ?? "").toLowerCase().trim()
  if (r.includes("asimilado")) return "Honorarios Asimilados a Salarios"
  if (r.includes("honorario")) return "Honorarios"
  if (r.includes("nombramiento") || r.includes("tiempo determinado")) return "Nombramiento por Tiempo Determinado"
  return raw || "—"
}

function formatEscolaridad(raw: string): string {
  const e = (raw ?? "").toLowerCase().trim()
  if (e === "bachillerato") return "Bachillerato"
  if (e === "tecnico")      return "Técnico Superior"
  if (e === "licenciatura") return "Licenciatura"
  if (e === "maestria")     return "Maestría"
  if (e === "doctorado")    return "Doctorado"
  if (!raw) return "—"
  return applyTextRules(raw)
}

function resolverFolioDictamen(item: any): string | null {
  return (
    item?.folioDictamen         ??
    item?.dictamen?.folio       ??
    item?.folio_dictamen        ??
    item?.folio_anterior        ??
    item?._raw?.folioDictamen   ??
    item?._raw?.dictamen?.folio ??
    item?._raw?.folio_dictamen  ??
    item?._raw?.folio_anterior  ??
    null
  )
}

function ordinalRegreso(n: number): string {
  if (n === 1) return "1er Regreso"
  if (n === 2) return "2do Regreso"
  if (n === 3) return "3er Regreso"
  return `${n}° Regreso`
}

function getDevolucionLabel(estado: string): string {
  const n = norm(estado)
  if (n.includes("emisor"))           return "Emisión DGDO"
  if (n.includes("validacion final")) return "Validación Final DGDO"
  if (n.includes("revisor"))          return "Revisión DGDO"
  if (n.includes("validacion"))       return "Validacion UEFA"
  return "DGDO"
}
function calcReingresoCount(historialSolicitud: any[]): number {
  const firstObsIdx = historialSolicitud.findIndex((h: any) =>
    (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase().includes("observad")
  )
  if (firstObsIdx === -1) return 0
  return historialSolicitud.slice(firstObsIdx + 1).filter((h: any) => {
    const n = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
    return n.includes("enviada a validacion") || n.includes("en validacion justificaciones")
  }).length
}

function mapBDtoSolicitud(item: any): UefaSolicitud {
  const historial: HistorialEntryData[] = (item.historial_solicitud ?? []).map((h: any) => ({
    fecha:          h.fecha ?? "",
    usuario:        h.usuario?.nombre ?? "Sistema",
    estadoAnterior: h.estado_historial_solicitud_estado_anterior_idToestado?.nombre ?? null,
    estadoNuevo:    h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "—",
    comentario:     h.comentario ?? null,
  }))

  const folioDictamenRaw = resolverFolioDictamen(item)
  const numeroDictamen   = folioDictamenRaw ? formatearFolio(folioDictamenRaw) : undefined
  const emisorEntry = [...(item.historial_solicitud ?? [])].find((h: any) => {
    const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
    return nombre.toLowerCase().includes("emitido")
  })
  let destinatarios: string[] = []
  if (emisorEntry?.comentario) {
    const match = emisorEntry.comentario.match(/Destinatarios:\s*(.+)/i)
    if (match) destinatarios = match[1].split("|").map((d: string) => d.trim()).filter(Boolean)
  }
  const histArr = item.historial_solicitud ?? []
  const lastResubmitIdx = histArr.reduce((last: number, h: any, idx: number) => {
    const n = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
    return (n.includes("en validacion justificaciones") || n.includes("enviada a validacion") || n === "en captura")
      ? idx
      : last
  }, -1)
  const obsMap = new Map<string, { estado: string; fecha: string; usuario: string; comentario: string }>()
  histArr.forEach((h: any, idx: number) => {
    if (idx <= lastResubmitIdx) return
    const n = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
    if (!(n.includes("observad") || n.includes("devuelta")) || !h.comentario) return
    const estado = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "Observación"
    obsMap.set(estado, {
      estado,
      fecha:      h.fecha ? formatFechaHora(h.fecha) : "—",
      usuario:    h.usuario?.nombre ?? "—",
      comentario: h.comentario ?? "",
    })
  })
  const todasObservaciones = Array.from(obsMap.values())
  const observacionUefaEntry = [...histArr]
    .map((h, idx) => ({ h, idx }))
    .filter(({ idx }) => idx > lastResubmitIdx)
    .reverse()
    .find(({ h }) => {
      const n = (h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "").toLowerCase()
      return (n.includes("observad") || n.includes("devuelta")) && h.comentario
    })?.h ?? null
  const revisorEntry = (item.historial_solicitud ?? []).find((h: any) => {
    const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
    return nombre.toLowerCase().includes("filtro 2")
  })
  const validadorEntry = (item.historial_solicitud ?? []).find((h: any) => {
    const nombre = h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? ""
    return nombre.toLowerCase().includes("filtro 3") || nombre.toLowerCase().includes("aprobado")
  })

  return {
    id:                   item.id,
    folio:                item.folio_recepcion ?? `SOL-${item.id}`,
    folioJustificacion:   item.folio_justificacion
      ?? `JUST-${new Date(item.fecha_creacion ?? Date.now()).getFullYear()}-${String(item.id).padStart(4, "0")}`,
    folioDictamen:        folioDictamenRaw,
    modalidadFirma:       (item.modalidad_firma === "electronica" || item.modalidad_firma === "autografa") ? item.modalidad_firma : null,
    numeroDictamen,
    tipo:                 item.tipo_solicitud ?? "—",
    secretaria:           item.secretaria ?? item.usuario?.area?.nombre ?? "—",
    fecha:                item.fecha_creacion ? formatFecha(item.fecha_creacion) : "—",
    vigenciaInicio:       item.vigencia_inicio ? formatFecha(item.vigencia_inicio) : "—",
    vigenciaFin:          item.vigencia_fin    ? formatFecha(item.vigencia_fin)    : "—",
    fechaEnvio:           item.fecha_envio     ? formatFecha(item.fecha_envio)
                          : item.fecha_creacion ? formatFecha(item.fecha_creacion) : "—",
    importeBruto:         item.importe_bruto
      ? `$${Number(item.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—",
    estado:               item.estado?.nombre ?? "En Captura",
    denominacion:         item.denominacion || item.tipo_solicitud || "—",
    unidadAdministrativa: item.unidad_administrativa ?? item.usuario?.area?.nombre ?? "—",
    unidadResponsable:    item.unidad_responsable ?? "—",
    programaProyecto:     item.programa_proyecto ?? "—",
    regimen:              item.regimen ?? "—",
    tipoActividades:      item.tipo_actividades ?? "—",
    numeroPrestadores:    item.numero_prestadores?.toString() ?? "—",
    esRenovacion:         item.es_renovacion    ?? false,
    esExtemporanea:       item.es_extemporanea  ?? false,
    folioAnterior:        item.folio_anterior   ?? undefined,
    objeto:               item.objeto ?? "—",
    actividades:          Array.isArray(item.actividades) ? item.actividades.filter(Boolean) : [],
    responsabilidades:    Array.isArray(item.responsabilidades) ? item.responsabilidades.filter(Boolean) : [],
    escolaridad:          item.escolaridad ?? "—",
    compAdm:              item.comp_adm ?? "—",
    compTec:              item.comp_tec ?? "—",
    compSoc:              item.comp_soc ?? "—",
    valores:              item.valores ?? "—",
    areasExp:             item.areas_exp ?? "—",
    reingresoCount:       calcReingresoCount(item.historial_solicitud ?? []),
    historial,
    observacionesUefa:    observacionUefaEntry?.comentario ?? "",
    observadoPor:         observacionUefaEntry?.usuario?.nombre ?? undefined,
    fechaObservacion:     observacionUefaEntry?.fecha ? formatFechaHora(observacionUefaEntry.fecha) : undefined,
    tipoObservacion:      observacionUefaEntry
      ? (observacionUefaEntry.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? "Observación")
      : undefined,
    todasObservaciones,
    fechaDictamen:        item.dictamen?.fecha_emision ? formatFecha(item.dictamen.fecha_emision) : undefined,
    tipoFirma:            item.dictamen?.tipo_firma ?? null,
    destinatarios,
    firmadoPor: {
      reviso: revisorEntry?.usuario?.nombre   ?? "—",
      valido: validadorEntry?.usuario?.nombre ?? "—",
      emitio: emisorEntry?.usuario?.nombre    ?? "—",
    },
    secretariaId: item.usuario?.secretaria_id ?? null,
    _raw: item,
  }
}
function DictamenModal({
  solicitud,
  onClose,
}: {
  solicitud: UefaSolicitud
  onClose: () => void
}) {
  const esParaestatal = solicitud.tipo.toLowerCase().includes("paraestatal")
  const titulo = esParaestatal ? "OPINIÓN TÉCNICA FUNCIONAL" : "DICTAMEN TÉCNICO FUNCIONAL"
  const folioDictamenFormateado  = formatearFolio(solicitud.folioDictamen)
  const folioRecepcionFormateado = formatearFolio(solicitud.folio)
  const handlePrint = () => {
    const pw = window.open("", "_blank")
    if (!pw) return
    pw.document.write(`
      <!DOCTYPE html><html><head><title>${titulo}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 11pt; line-height: 1.5 }
        h2   { font-size: 12pt; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px }
        .header { text-align: center; border-bottom: 2px solid #283c2a; padding-bottom: 16px; margin-bottom: 20px }
        .header p { margin: 2px 0; font-size: 9pt; color: #555 }
        .header h1 { font-size: 14pt; margin-bottom: 4px; letter-spacing: 1px }
        .sello { text-align: center; margin-top: 30px; padding: 12px; border: 2px solid #283c2a;
                 color: #283c2a; font-weight: bold; letter-spacing: 3px; font-size: 14pt }
        .firmas { display: flex; justify-content: space-between; margin-top: 60px }
        .firma-block { text-align: center; width: 200px }
        .firma-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 4px }
        .firma-role { font-size: 9pt; color: #666 }
      </style></head><body>
      <div class="header">
        <p>GOBIERNO DEL ESTADO</p>
        <p>SECRETARÍA DE ADMINISTRACIÓN</p>
        <p>DIRECCIÓN DE ORGANIZACIÓN</p>
        <h1>${titulo}</h1>
      </div>
      <p><strong>Número:</strong> ${folioDictamenFormateado}</p>
      <p><strong>Folio Recepción:</strong> ${folioRecepcionFormateado}</p>
      <p><strong>Fecha:</strong> ${solicitud.fechaDictamen ?? "—"}</p>
      <p><strong>Modalidad:</strong> ${solicitud.tipoFirma === "electronica" ? "Firma Electrónica" : "Firma Autógrafa"}</p>
      <h2>Destinatarios</h2>
      <ul>${(solicitud.destinatarios ?? []).length > 0
        ? (solicitud.destinatarios ?? []).map((d) => `<li>${d}</li>`).join("")
        : "<li>—</li>"}</ul>
      <h2>Datos del Solicitante</h2>
      <p><strong>Secretaría:</strong> ${solicitud.secretaria} &nbsp;|&nbsp; <strong>Denominación:</strong> ${solicitud.denominacion}</p>
      <p><strong>Vigencia:</strong> ${solicitud.vigenciaInicio} — ${solicitud.vigenciaFin} &nbsp;|&nbsp; <strong>Importe:</strong> ${solicitud.importeBruto}</p>
      <div class="firmas">
        <div class="firma-block"><div class="firma-line"><p>${solicitud.firmadoPor?.reviso ?? "—"}</p><p class="firma-role">Revisó</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${solicitud.firmadoPor?.valido ?? "—"}</p><p class="firma-role">Validó</p></div></div>
        <div class="firma-block"><div class="firma-line"><p>${solicitud.firmadoPor?.emitio ?? "—"}</p><p class="firma-role">Emitió</p></div></div>
      </div>
      <div class="sello">DICTAMINADO</div>
      </body></html>
    `)
    pw.document.close()
    pw.focus()
    setTimeout(() => pw.print(), 500)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
          <div>
            <CardTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
              <FileTypeIcon name="dictamen.pdf" size="sm" />{titulo}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Número: {folioDictamenFormateado} | Folio Recepción: {folioRecepcionFormateado}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 rounded-2xl font-medium hover:opacity-90"
              style={{ backgroundColor: "#fce4f0", color: "#7c2d5e", border: "1px solid #f0b0d0" }}
            >
              <Printer className="h-4 w-4" />Imprimir
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="bg-card rounded-lg p-6 border border-border flex flex-col gap-4">
            <div className="text-center border-b-2 border-primary pb-4">
              <p className="text-xs text-muted-foreground">GOBIERNO DEL ESTADO</p>
              <p className="text-xs text-muted-foreground">SECRETARÍA DE ADMINISTRACIÓN</p>
              <p className="text-xs text-muted-foreground">DIRECCIÓN DE ORGANIZACIÓN</p>
              <p className="text-base font-bold text-card-foreground mt-2 tracking-wide">{titulo}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block">Número</span>
                <span className="text-sm font-semibold text-card-foreground font-mono">
                  {folioDictamenFormateado}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Folio Recepción</span>
                <span className="text-sm font-semibold text-card-foreground font-mono">
                  {folioRecepcionFormateado}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Fecha</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {solicitud.fechaDictamen ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Modalidad</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {solicitud.tipoFirma === "electronica" ? "Firma Electrónica" : "Firma Autógrafa"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Destinatarios</span>
              {(solicitud.destinatarios ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(solicitud.destinatarios ?? []).map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block">Secretaría</span>
                <span className="text-sm text-card-foreground">{solicitud.secretaria}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Denominación</span>
                <span className="text-sm text-card-foreground">{solicitud.denominacion}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Vigencia</span>
                <span className="text-sm text-card-foreground">
                  {solicitud.vigenciaInicio} — {solicitud.vigenciaFin}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Importe</span>
                <span className="text-sm text-card-foreground">{solicitud.importeBruto}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-2">
              {(["reviso", "valido", "emitio"] as const).map((rol) => (
                <div key={rol} className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                  <span className="text-[10px] text-muted-foreground">
                    {rol === "reviso" ? "Revisó" : rol === "valido" ? "Validó" : "Emitió"}
                  </span>
                  <span className="text-xs font-medium text-card-foreground text-center">
                    {solicitud.firmadoPor?.[rol] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-center py-3 border-2 border-primary text-primary font-bold tracking-widest text-lg mt-2">
              DICTAMINADO
            </div>
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}

function UefaEstadoBadge({ estado }: { estado: string }) {
  return estadoBadge(estado)
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

function SectionCard({ num, title, icon, children, defaultOpen = true }: {
  num?: string; title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
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
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <CardContent>{children}</CardContent>
        </div>
      </div>
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
  const validItems = items.filter(Boolean)
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
          <span style={{ wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}>
            {applyTextRules(item)}
          </span>
        </li>
      ))}
    </ul>
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

function ExpedienteGenerico({ solicitud }: { solicitud: UefaSolicitud }) {
  const raw = solicitud._raw
  const folioDictamenMostrar = solicitud.numeroDictamen
    ?? (solicitud.folioDictamen ? formatearFolio(solicitud.folioDictamen) : null)
  const regimenNorm      = (solicitud.regimen ?? "").toLowerCase()
  const esNombramiento   = regimenNorm.includes("nombramiento") || regimenNorm.includes("tiempo determinado")
  const marcoNormativo   = Array.isArray(raw?.marco_normativo)     ? raw.marco_normativo.filter(Boolean)     : []
  const condRiesgos      = Array.isArray(raw?.condiciones_riesgos) ? raw.condiciones_riesgos.filter(Boolean) : []
  const resguardoActivos = raw?.resguardo_activos ?? ""

  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría / Dependencia / Organismo" value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción" value={formatClave(raw?.unidad_administrativa ?? raw?.clave_unidad_administrativa ?? "") || "—"} />
          <ReadOnlyField label="Unidad Responsable del Gasto"         value={getNombreForClave(solicitud.unidadResponsable) || solicitud.unidadResponsable} />
          <ReadOnlyField label="Programa o Proyecto"                  value={applyTextRules(solicitud.programaProyecto)} />
          <ReadOnlyField label="Régimen de Contratación"              value={formatRegimen(solicitud.regimen)} />
          {esNombramiento && (
            <ReadOnlyField label="Denominación del Nombramiento"      value={applyTextRules(solicitud.denominacion)} />
          )}
          {esNombramiento && (
            <ReadOnlyField label="Puesto del Jefe Inmediato"          value={applyTextRules(raw?.puesto_jefe_inmediato ?? "—")} />
          )}
          <ReadOnlyField label="Número de Prestadores de Servicio"    value={solicitud.numeroPrestadores} />
          <ReadOnlyField label="Tipo de Actividad"                value={applyTextRules(solicitud.tipoActividades)} />
          <ReadOnlyField label="Tipo de Pago"    value={raw?.tipo_importe || "Mensual"} />
          <ReadOnlyField label="Vigencia Inicio"                      value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                     value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Neto"   value={solicitud.importeBruto} />
        </div>
      </SectionCard>

      <SectionCard title="Tabulador — Nivel y Categoría">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Nivel"     value={raw?.nivel_tabulador     ?? "—"} />
          <ReadOnlyField label="Categoría" value={raw?.categoria_tabulador ?? "—"} />
        </div>
      </SectionCard>

      <SectionCard title="I.1 Objeto de la Contratación">
        <p
          className="scroll-thin text-sm text-card-foreground leading-relaxed whitespace-pre-wrap"
          style={{ maxHeight: "300px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}
        >
          {solicitud.objeto && solicitud.objeto !== "—"
            ? applyTextRules(solicitud.objeto)
            : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>

      <SectionCard title="I.2 Actividades a Realizar">
        <ListaItems items={solicitud.actividades} />
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <ListaItems items={solicitud.responsabilidades} />
      </SectionCard>

      {esNombramiento && marcoNormativo.length > 0 && (
        <SectionCard title="V. Marco Normativo">
          <ListaItems items={marcoNormativo} />
        </SectionCard>
      )}

      {esNombramiento && (
        <SectionCard title="VI. Condiciones y Riesgos">
          <SeccionCondicionesRiesgos raw={raw} />
        </SectionCard>
      )}

      {esNombramiento && resguardoActivos && (
        <SectionCard title="VII. Resguardo Personalizado de Activos">
          <ReadOnlyField label="Resguardo de Activos" value={resguardoActivos === "si" ? "Sí" : resguardoActivos === "no" ? "No" : resguardoActivos} />
        </SectionCard>
      )}

      <SectionCard title="Perfil Requerido">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-4 flex-1">
            <ReadOnlyField   label="Escolaridad Mínima"          value={formatEscolaridad(solicitud.escolaridad)} />
            <PerfilListField label="Competencias Técnicas"        value={solicitud.compTec} />
            <PerfilListField label="Valores"                      value={solicitud.valores} />
          </div>
          <div className="flex flex-col gap-4 flex-1">
            <PerfilListField label="Competencias Administrativas" value={solicitud.compAdm} />
            <PerfilListField label="Competencias Sociales"        value={solicitud.compSoc} />
            <PerfilListField label="Áreas de Experiencia"         value={solicitud.areasExp} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        {raw?.adjunto?.length > 0 ? (
          <div className="flex flex-col gap-2">
            {raw.adjunto.map((adj: any, i: number) => (
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
        className="max-w-[min(24rem,calc(100%-2rem))] sm:max-w-[min(24rem,calc(100%-2rem))] border border-[#e4e3d6] shadow-lg p-6"
      >
        <div className="flex flex-col gap-3">
          <AlertTriangle className="h-7 w-7 text-[#2e3b2b]" strokeWidth={1.75} />
          <DialogTitle className="ds-title-sm text-[18px]! font-normal! leading-[1.35]! text-[#2e3b2b]">
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
            className="h-10 flex-1 rounded-full border-0 bg-[#ffeaea] text-sm font-medium text-[#87090c] hover:bg-[#ffeaea] hover:text-[#87090c] focus-visible:outline-[#e7b400]"
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

function AsignarRevisorModal({ open, onClose, onConfirm, folio, secretariaId }: {
  open: boolean; onClose: () => void
  onConfirm: (revisorId: string) => void
  folio: string; secretariaId: string | null
}) {
  const [revisores,   setRevisores]   = useState<{ id: string; nombre: string }[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [seleccionado, setSeleccionado] = useState<string>("")

  useEffect(() => {
    if (!open) { setSeleccionado(""); return }
    setCargando(true)
    const params = new URLSearchParams({ rol: "Revisor" })
    if (secretariaId) params.set("secretariaId", secretariaId)
    fetch(`/api/usuarios?${params}`)
      .then(r => r.json())
      .then(data => setRevisores(Array.isArray(data) ? data : []))
      .catch(() => setRevisores([]))
      .finally(() => setCargando(false))
  }, [open, secretariaId])

  const handleClose = () => { setSeleccionado(""); onClose() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="max-w-sm p-0">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#f3e8f0] flex items-center justify-center shrink-0">
                <img src="/Iconos1/account_circle-user-perfil.svg" width={24} height={24} alt="" />
              </div>
              <h3 className="font-bold text-gray-900 text-base leading-tight pt-2">Aprobar y Asignar Revisor</h3>
            </div>
            <button type="button" onClick={handleClose} className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 pl-[52px]">
            <p className="text-sm text-gray-500">
              Seleccione el Revisor que revisará la solicitud <strong className="text-gray-700">{folio}</strong>.
            </p>
            {cargando ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
              </div>
            ) : revisores.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />No hay usuarios con rol Revisor en su secretaría.
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {revisores.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSeleccionado(r.id)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                      seleccionado === r.id
                        ? "text-white"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                    style={seleccionado === r.id ? { backgroundColor: "#773357" } : undefined}
                  >
                    {seleccionado === r.id
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <span className="h-4 w-4 shrink-0 rounded-full border border-gray-300 inline-block" />
                    }
                    {r.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between pt-1">
            <Button
              onClick={handleClose}
              className="h-10 rounded-full border-0 bg-[#ffeaea] text-sm font-medium text-[#87090c] hover:bg-[#ffeaea] hover:text-[#87090c] focus-visible:outline-[#e7b400]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => { if (seleccionado) { onConfirm(seleccionado); handleClose() } }}
              disabled={!seleccionado || cargando}
              variant="primary"
              className="gap-1.5 h-10"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetalleView({ solicitud, onBack, onAprobar, onObservar, onFirmarJustificacion, guardando }: {
  solicitud: UefaSolicitud; onBack: () => void
  onAprobar: (id: number) => void; onObservar: (id: number) => void
  onFirmarJustificacion: (id: number) => void; guardando: boolean
}) {
  const [showFirmarConfirm,  setShowFirmarConfirm]  = useState(false)
  const [showDictamen,       setShowDictamen]       = useState(false)
  const [showAprobarConfirm, setShowAprobarConfirm] = useState(false)
  const [showDescargarConfirm, setShowDescargarConfirm] = useState(false)
  const tab                = getTabForEstado(solicitud.estado)
  const _n                 = norm(solicitud.estado)
  const isNueva            = tab === "Nuevas"
  const isEmitida          = _n === "emitido"
  const isPendienteFirma   = tab === "Pendiente Firma"
  const isObservada        = (_n.includes("observado por validacion") && !_n.includes("final")) ||
                             _n.includes("observado por ufa") || _n.includes("observada por ufa")
  const isDevuelta         = !isObservada && (_n.includes("observad") || _n.includes("devuelta"))
  const tieneObsActivas    = (isObservada || isDevuelta) && solicitud.todasObservaciones.length > 0

  const [rightTab, setRightTab] = useState<StatusTabKey>(
    tieneObsActivas ? "observaciones" : "historial"
  )
  const bitacora: BitacoraEntry[] = useMemo(() => {
    const cambios: BitacoraEntry = {
      seccion: "Historial de cambios",
      eventos: solicitud.historial.map((h) => ({
        fecha: h.fecha, usuario: h.usuario, descripcion: h.estadoNuevo,
      })),
    }
    const adjuntosRaw: any[] = solicitud._raw?.adjunto ?? []
    const adjuntos: BitacoraEntry = {
      seccion: "Documentos Adjuntos",
      eventos: adjuntosRaw.map((a: any) => ({
        fecha: a.fecha_subida
          ? new Date(a.fecha_subida).toISOString().replace("T", " ").slice(0, 16)
          : "",
        usuario: "Sistema",
        descripcion: `Archivo cargado: ${a.nombre_archivo}`,
      })),
    }
    return adjuntos.eventos.length > 0 ? [cambios, adjuntos] : [cambios]
  }, [solicitud])
  const isEnProceso        = tab === "En Proceso"

  const folioDictamenMostrar = solicitud.numeroDictamen
    ?? (solicitud.folioDictamen ? formatearFolio(solicitud.folioDictamen) : null)
  const folioRecepcionValido = solicitud.folio && solicitud.folio !== `SOL-${solicitud.id}` ? solicitud.folio : null
  const folioMostrar = folioRecepcionValido ?? solicitud.folioJustificacion

  return (
    <div className="flex flex-col gap-4 p-6">
      {showDictamen && (
        <DictamenModal solicitud={solicitud} onClose={() => setShowDictamen(false)} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-5 w-5" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-7" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="ds-title-md text-content-high">{folioMostrar}</h2>
              <UefaEstadoBadge estado={solicitud.estado} />
              {folioDictamenMostrar && (
                <Badge className="bg-secondary/15 text-secondary border-0 text-sm gap-1">
                  <Stamp className="h-3.5 w-3.5" />Dict. {folioDictamenMostrar}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{solicitud.tipo} — {solicitud.secretaria}</p>
            {solicitud.denominacion && solicitud.denominacion !== "—" && solicitud.denominacion !== solicitud.tipo && (
              <p className="text-sm text-muted-foreground font-medium">{solicitud.denominacion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            className="gap-1.5"
            onClick={() => setShowDescargarConfirm(true)}
          >
            Descargar Justificación
          </Button>
          {isNueva && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => onObservar(solicitud.id)}
                disabled={guardando}
              >
                Observar
              </Button>
              <Button
                onClick={() => setShowAprobarConfirm(true)}
                disabled={guardando}
                variant="primary"
                className="gap-1.5"
                size="sm"
              >
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                Aprobar
              </Button>
            </>
          )}
          {isPendienteFirma && (
            <Button
              onClick={() => setShowFirmarConfirm(true)}
              disabled={guardando}
              variant="primary"
              className="gap-1.5"
              size="sm"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Firmar Justificación
            </Button>
          )}
          {isEmitida && (
            <>
              <Button
                size="sm"
                onClick={() => setShowDictamen(true)}
                className="gap-1.5 rounded-2xl font-medium hover:opacity-90"
                style={{ backgroundColor: "#722F37", color: "#ffffff", border: "1px solid #5a252c" }}
              >
                <FileCheck className="h-4 w-4" />Ver Dictamen
              </Button>

            </>
          )}
          {isObservada && (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground py-1.5 px-3">
              <Lock className="h-3 w-3" />Solo lectura
            </Badge>
          )}
        </div>
      </div>


      {isPendienteFirma && (
        <Card className="border-2 border-accent/30 bg-accent/5 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <Stamp className="h-5 w-5 text-accent-foreground" />
            <div>
              <span className="text-sm font-medium text-accent-foreground">Pendiente de Firma</span>
              <p className="text-xs text-muted-foreground">El Revisor aprobó la justificación. Debe firmarla para continuar al paso de Validación Final.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isEnProceso && (
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <img src="/iconos2/Icon.svg" alt="" className="h-5 w-5 shrink-0" />
            <div>
              <span className="text-sm font-medium text-primary">En Proceso</span>
              <p className="text-xs text-muted-foreground">La solicitud está en revisión por Validación Final o Emisor. Solo lectura.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isEmitida && folioDictamenMostrar && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[#ecf2ff] px-4 py-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3266cb]">
            <span className="text-[12px] font-bold text-white leading-none">i</span>
          </div>
          <span className="text-sm font-light text-[#3266cb]">
            Dictamen Emitido — No. {folioDictamenMostrar}{solicitud.fechaDictamen ? ` — ${solicitud.fechaDictamen}` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            <ExpedienteGenerico solicitud={solicitud} />
          </div>
        </ScrollArea>

        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            <StatusTabsList
              value={rightTab}
              onChange={setRightTab}
              obsCount={tieneObsActivas ? solicitud.todasObservaciones.length : 0}
            />

            {rightTab === "historial" && (
              <HistorialPanel entries={solicitud.historial} title="Historial de Estatus" />
            )}

            {rightTab === "bitacora" && (
              <BitacoraPanel bitacora={bitacora} />
            )}

            {rightTab === "observaciones" && (
              <ObservacionesPanel
                title={
                  isObservada
                    ? "Observación de Validacion UEFA"
                    : isDevuelta
                      ? `Devolución — ${getDevolucionLabel(solicitud.estado)}`
                      : "Observaciones"
                }
                todasObservaciones={tieneObsActivas ? solicitud.todasObservaciones : []}
                single={
                  !tieneObsActivas && (isObservada || isDevuelta) && solicitud.observacionesUefa
                    ? { motivo: solicitud.observacionesUefa, fecha: solicitud.fechaObservacion, usuario: solicitud.observadoPor }
                    : null
                }
              />
            )}
          </div>
        </ScrollArea>
      </div>

      <ConfirmAlertDialog
        open={showAprobarConfirm}
        onOpenChange={setShowAprobarConfirm}
        onConfirm={() => { setShowAprobarConfirm(false); onAprobar(solicitud.id) }}
        title="¿Aprobar y enviar a Validación?"
        description={<>La solicitud <strong className="font-semibold">{solicitud.folioJustificacion}</strong> será enviada a la Bandeja de Validación (DO).</>}
        confirmLabel="Sí, aprobar"
      />
      <ConfirmModal
        open={showFirmarConfirm}
        onClose={() => setShowFirmarConfirm(false)}
        onConfirm={() => { setShowFirmarConfirm(false); onFirmarJustificacion(solicitud.id) }}
        title="¿Firmar Justificación?"
        description={`Se firmará la justificación ${solicitud.folioJustificacion} y pasará a Validación Final.`}
        confirmLabel="Sí, firmar"
      />
      <ConfirmModal
        open={showDescargarConfirm}
        onClose={() => setShowDescargarConfirm(false)}
        onConfirm={() => { setShowDescargarConfirm(false); generateJustificacionPDF(solicitud.id, solicitud.folioJustificacion) }}
        title="¿Descargar justificación en PDF?"
        description={`Se descargará el PDF de la justificación ${solicitud.folioJustificacion}.`}
        confirmLabel="Sí, descargar"
      />
    </div>
  )
}

export function ValidacionUefaPage() {
  const { user } = useAuth()

  const hasDataRef                               = useRef(false)
  const [solicitudes,      setSolicitudes]      = useState<UefaSolicitud[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [guardando,        setGuardando]        = useState(false)
  const [activeTab,        setActiveTab]        = useState<UefaTab>("Nuevas")
  const [currentPage,      setCurrentPage]      = useState(1)
  const [selectedId,       setSelectedId]       = useState<number | null>(null)
  const [observarTargetId, setObservarTargetId] = useState<number | null>(null)
  const [aprobarTargetId,  setAprobarTargetId]  = useState<number | null>(null)
  const [dictamenViewId,   setDictamenViewId]   = useState<number | null>(null)
  const [firmaTargetId,    setFirmaTargetId]    = useState<number | null>(null)
  const [actionToast, setActionToast] = useState<{ key: number; variant: "success" | "error"; title: string; description?: string } | null>(null)
  const [successMsg, setSuccessMsg] = useState<{ title: string; description: string; type: 'approve' | 'observe' } | null>(null)

  const showToast = (variant: "success" | "error", title: string, description?: string) => {
    setActionToast(prev => ({ key: (prev?.key ?? 0) + 1, variant, title, description }))
  }

  const cargarSolicitudes = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const viewerId = (user as any)?.id ?? ""
      const res  = await fetch(`/api/validacion?estado=todos&viewerId=${viewerId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar solicitudes"); return }
      setSolicitudes((json.data ?? []).map(mapBDtoSolicitud))
      hasDataRef.current = true
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarSolicitudes() }, [cargarSolicitudes])
  useRealtime(["validacion"], cargarSolicitudes)

  const handleAprobar = useCallback(async (id: number) => {
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: id,
          nuevoEstado: "Pendiente DO",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  "Aprobada por Validacion de Justificaciones → Pendiente de asignación en DO",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { showToast("error", "Error al aprobar", json.error ?? "No se pudo aprobar la solicitud."); return }
      setSolicitudes(prev => prev.map(s => s.id === id ? {
        ...s,
        estado: "Pendiente DO",
        historial: [...s.historial, {
          fecha:          new Date().toISOString(),
          usuario:        (user as any)?.nombre ?? "Validacion",
          estadoAnterior: s.estado,
          estadoNuevo:    "Pendiente DO",
        }],
      } : s))
      setSuccessMsg({ title: "Solicitud enviada al siguiente filtro", description: "La solicitud fue procesada exitosamente y avanzó a la siguiente bandeja.", type: 'approve' })
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.")
    } finally {
      setGuardando(false)
      setAprobarTargetId(null)
    }
  }, [user])

  const handleObservarConfirm = useCallback(async (obs: string) => {
    if (!observarTargetId) return
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: observarTargetId,
          nuevoEstado: "Observado por Validacion",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  obs,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { showToast("error", "Error al observar", json.error ?? "No se pudo registrar la observación."); return }
      setSolicitudes(prev => prev.map(s => s.id === observarTargetId ? {
        ...s,
        estado: "Observado por Validacion",
        observacionesUefa: obs,
        observadoPor:      (user as any)?.nombre ?? "Validacion",
        fechaObservacion:  formatFechaHora(new Date().toISOString()),
        historial: [...s.historial, {
          fecha:          new Date().toISOString(),
          usuario:        (user as any)?.nombre ?? "Validacion",
          estadoAnterior: s.estado,
          estadoNuevo:    "Observado por Validacion",
        }],
      } : s))
      setObservarTargetId(null)
      setSuccessMsg({ title: "Solicitud marcada con observaciones", description: "La solicitud fue devuelta con observaciones a la URG.", type: 'observe' })
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.")
    } finally {
      setGuardando(false)
    }
  }, [observarTargetId, user])

  const handleFirmarJustificacion = useCallback(async (id: number) => {
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: id,
          nuevoEstado: "Pendiente Firma Dictamen",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  "Justificacion firmada por Validacion — enviada a Emision (Filtro 3) para firma dictamen",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { showToast("error", "Error al firmar", json.error ?? "No se pudo firmar la justificación."); return }
      showToast("success", "Justificación firmada", "La justificación fue firmada y enviada a Emisión.")
      setSolicitudes(prev => prev.map(s => s.id === id ? {
        ...s,
        estado: "Pendiente Firma Dictamen",
        historial: [...s.historial, {
          fecha:          new Date().toISOString(),
          usuario:        (user as any)?.nombre ?? "Validacion",
          estadoAnterior: s.estado,
          estadoNuevo:    "Pendiente Firma Dictamen",
        }],
      } : s))
      setSelectedId(null)
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.")
    } finally {
      setGuardando(false)
    }
  }, [user])

  const tabDefs: { key: UefaTab; label: string }[] = [
    { key: "Nuevas",               label: "Nuevas" },
    { key: "En Proceso",           label: "En Proceso" },
    { key: "Observadas/Devueltas", label: "Observadas / Devueltas" },
    { key: "Pendiente Firma",      label: "Pendiente de Firma" },
    { key: "Todas",                label: "Todas" },
  ]

  const tabCounts = useMemo(() => {
    const counts: Record<UefaTab, number> = {
      "Nuevas": 0, "Pendiente Firma": 0, "En Proceso": 0,
      "Observadas": 0, "Devueltas": 0, "Observadas/Devueltas": 0, "Emitidas": 0, "Todas": solicitudes.length,
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

  useEffect(() => { setCurrentPage(1) }, [activeTab])
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const selectedSolicitud  = selectedId    !== null ? solicitudes.find(s => s.id === selectedId)    ?? null : null
  const dictamenViewSol    = dictamenViewId !== null ? solicitudes.find(s => s.id === dictamenViewId) ?? null : null

  if (selectedSolicitud) return (
    <PageLayout noContainer>
      <>
        <DetalleView
          solicitud={selectedSolicitud}
          onBack={() => setSelectedId(null)}
          onAprobar={handleAprobar}
          onObservar={id => setObservarTargetId(id)}
          onFirmarJustificacion={handleFirmarJustificacion}
          guardando={guardando}
        />
        <ObservarModal
          open={!!observarTargetId}
          onClose={() => setObservarTargetId(null)}
          onConfirm={handleObservarConfirm}
          folio={solicitudes.find(s => s.id === observarTargetId)?.folioJustificacion ?? ""}
        />
        <ConfirmationModal
          open={!!successMsg}
          type={successMsg?.type === "observe" ? "error" : "success"}
          title={successMsg?.title ?? ""}
          message={successMsg?.description ?? ""}
          primaryAction={{ label: "Regresar a bandeja", onClick: () => { setSelectedId(null); setSuccessMsg(null) } }}
          onClose={() => { setSelectedId(null); setSuccessMsg(null) }}
        />
      </>
    </PageLayout>
  )

  const firmaTargetSol = solicitudes.find(s => s.id === firmaTargetId) ?? null

  return (
    <>
    {actionToast && (
      <ConfirmToast key={actionToast.key} variant={actionToast.variant} title={actionToast.title} description={actionToast.description} />
    )}
    <PageLayout
      title="Bandeja de validación de justificaciones"
      description="Gestiona y da seguimiento a las justificaciones durante su proceso de validación y emisión."
    >
      {dictamenViewSol && (
        <DictamenModal solicitud={dictamenViewSol} onClose={() => setDictamenViewId(null)} />
      )}

      {firmaTargetSol && (
        <FirmaModal
          open={firmaTargetId !== null}
          onClose={() => setFirmaTargetId(null)}
          solicitudId={firmaTargetSol.id}
          folioJustificacion={firmaTargetSol.folioJustificacion}
          folioRecepcion={firmaTargetSol.folio && firmaTargetSol.folio !== `SOL-${firmaTargetSol.id}` ? firmaTargetSol.folio : null}
          folioDictamen={firmaTargetSol.numeroDictamen ?? (firmaTargetSol.folioDictamen ? formatearFolio(firmaTargetSol.folioDictamen) : null)}
          modalidadFirma={firmaTargetSol.modalidadFirma}
          currentUserId={(user as any)?.id ?? ""}
          onGenerarPdf={() => {
            generateJustificacionPDF(firmaTargetSol.id, firmaTargetSol.folioJustificacion)
          }}
          onGenerarPdfBase64={async () => generateJustificacionPDFBase64(firmaTargetSol.id)}
          onFinalizar={async () => { await handleFirmarJustificacion(firmaTargetSol.id) }}
          guardandoFinal={guardando}
        />
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="ghost" size="sm" onClick={cargarSolicitudes} className="ml-auto">Reintentar</Button>
          </CardContent>
        </Card>
      )}

      <FilterTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as UefaTab)}
        items={tabDefs.map((tab) => ({ value: tab.key, label: tab.label, count: tabCounts[tab.key] ?? 0 }))}
      />

      {}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {loading ? "Cargando solicitudes..." : `${filtered.length} solicitud${filtered.length !== 1 ? "es" : ""}`}
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
                    <th className="px-4 py-3 text-left font-semibold">Folio de Justificación</th>
                    <th className="px-4 py-3 text-left font-semibold">Régimen de Contratación</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Creación</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado Actual</th>
                    {activeTab === "Emitidas" && (
                      <th className="px-4 py-3 text-left font-semibold">Modalidad</th>
                    )}
                    <th className="px-4 py-3 font-semibold"><div className="flex justify-end">Acciones</div></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(sol => {
                    const solTab             = getTabForEstado(sol.estado)
                    const folioDictamenLabel = sol.numeroDictamen
                      ?? (sol.folioDictamen ? formatearFolio(sol.folioDictamen) : null)
                    const folioRecepcion     = sol.folio && sol.folio !== `SOL-${sol.id}` ? sol.folio : null
                    const usaFolioRecepcion  = !!folioRecepcion
                    const folioPrincipal     = folioRecepcion ?? sol.folioJustificacion
                    const folioSecundario    = usaFolioRecepcion && folioRecepcion
                      ? (solTab === "Emitidas" && folioDictamenLabel ? folioDictamenLabel : null)
                      : null

                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          <span>{folioPrincipal}</span>
                          {folioSecundario && (
                            <span className="block text-xs text-muted-foreground mt-0.5">{folioSecundario}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatRegimen(sol.regimen)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.fecha}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.fechaEnvio}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <UefaEstadoBadge estado={sol.estado} />
                          </div>
                        </td>
                        {activeTab === "Emitidas" && (
                          <td className="px-4 py-3">
                            {sol.modalidadFirma === "electronica" ? (
                              <Badge className="bg-primary/15 text-primary border-0 gap-1">
                                <Shield className="h-3 w-3" /> Electrónica
                              </Badge>
                            ) : sol.modalidadFirma === "autografa" ? (
                              <Badge className="bg-accent/20 text-accent-foreground border-0 gap-1">
                                <FileSignature className="h-3 w-3" /> Autógrafa
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end">
                          {solTab === "Pendiente Firma" ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 bg-bg-surface-low border border-border-low">
                                  <MoreHorizontal className="h-4 w-4 text-content-low" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedId(sol.id)} className="gap-2 cursor-pointer">
                                  <img src="/iconos2/visibility.svg" alt="ver" className="h-4 w-4" />Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setFirmaTargetId(sol.id)}
                                  disabled={guardando}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Stamp className="h-4 w-4" />Firmar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setSelectedId(sol.id)}
                              className="text-secondary hover:text-primary gap-1.5"
                            >
                              <img src="/iconos2/visibility.svg" alt="ver" className="h-4 w-4" />Ver
                            </Button>
                          )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>
                        <EmptyState icon={Inbox} title="No hay solicitudes en esta categoría" description="Ajusta los filtros para ver más resultados." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <ConfirmAlertDialog
        open={!!aprobarTargetId}
        onOpenChange={(v) => { if (!v) setAprobarTargetId(null) }}
        onConfirm={() => { if (aprobarTargetId) handleAprobar(aprobarTargetId) }}
        title="¿Aprobar y enviar a Validación?"
        description={<>La solicitud <strong className="font-semibold">{solicitudes.find(s => s.id === aprobarTargetId)?.folioJustificacion ?? ""}</strong> será enviada a la Bandeja de Validación Final (DO).</>}
        confirmLabel="Sí, aprobar"
      />
      <ObservarModal
        open={!!observarTargetId}
        onClose={() => setObservarTargetId(null)}
        onConfirm={handleObservarConfirm}
        folio={solicitudes.find(s => s.id === observarTargetId)?.folioJustificacion ?? ""}
      />
    </PageLayout>
    </>
  )
}