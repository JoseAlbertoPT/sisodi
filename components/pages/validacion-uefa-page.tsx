"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Eye, CheckCircle2, RotateCcw, Download, History, FileText, Inbox,
  AlertTriangle, ChevronDown, ChevronRight, ArrowLeft, FileCheck,
  Info, RefreshCw, Loader2, HelpCircle, Printer, Stamp,
} from "lucide-react"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import { useAuth } from "@/lib/auth-context"

type UefaEstado = string

type UefaTab =
  | "Nuevas"
  | "Pendiente Firma"
  | "En Proceso"
  | "Observadas"
  | "Devueltas"
  | "Emitidas"
  | "Todas"

interface HistorialEntry { fecha: string; usuario: string; accion: string }

interface UefaSolicitud {
  id: number
  folio: string
  folioJustificacion: string
  folioDictamen: string | null
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
  importeBruto: string
  esRenovacion: boolean
  folioAnterior?: string
  historial: HistorialEntry[]
  observacionesUefa: string
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
  _raw?: any
}



const INICIALES_MES_MAP: Record<string, string> = {
  "01": "EN", "02": "FE", "03": "MR", "04": "AB",
  "05": "MY", "06": "JN", "07": "JL", "08": "AG",
  "09": "SE", "10": "OC", "11": "NO", "12": "DI",
}

function formatearFolio(folio: string | null | undefined): string {
  if (!folio || folio === "—") return "—"

  const matchLegacy = folio.match(/^(\d+)\/(\d{1,2})\/\d{4}$/)
  if (matchLegacy) return matchLegacy[1].padStart(3, "0")

  const matchDictamen = folio.match(/^[A-Z]{2,3}-(\d+)-(\d{4})$/)
  if (matchDictamen) return `${matchDictamen[1].padStart(3, "0")}-${matchDictamen[2]}`

  const matchTemporal = folio.match(/^[A-Z]{2,3}-(\d+)$/)
  if (matchTemporal) return matchTemporal[1].padStart(3, "0")

  return folio
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
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function getTabForEstado(estado: string): UefaTab {
  const n = norm(estado)
  if (n === "en captura" || n.includes("en validacion justificaciones") || n.includes("enviada a validacion")) return "Nuevas"
  if (n.includes("pendiente firma justificacion")) return "Pendiente Firma"
  if (n.includes("en revision") || n.includes("en validacion final") || n.includes("pendiente firma dictamen")) return "En Proceso"
  if (n.includes("observado por validacion") && !n.includes("final")) return "Observadas"
  if (n.includes("observado por") || n.includes("observado do")) return "Devueltas"
  if (n === "emitido") return "Emitidas"
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
  return raw || "—"
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

function mapBDtoSolicitud(item: any): UefaSolicitud {
  const historial: HistorialEntry[] = (item.historial_solicitud ?? []).map((h: any) => ({
    fecha:   formatFechaHora(h.fecha),
    usuario: h.usuario?.nombre ?? "Sistema",
    accion:  h.estado_historial_solicitud_estado_nuevo_idToestado?.nombre ?? h.comentario ?? "—",
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
    numeroDictamen,
    tipo:                 item.tipo_solicitud ?? "—",
    secretaria:           item.secretaria ?? item.usuario?.area?.nombre ?? "—",
    fecha:                item.fecha_creacion ? formatFecha(item.fecha_creacion) : "—",
    vigenciaInicio:       item.vigencia_inicio ? formatFecha(item.vigencia_inicio) : "—",
    vigenciaFin:          item.vigencia_fin    ? formatFecha(item.vigencia_fin)    : "—",
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
    esRenovacion:         item.es_renovacion ?? false,
    folioAnterior:        item.folio_anterior ?? undefined,
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
    observacionesUefa:    item.observaciones_uefa ?? item.observacion_uefa ?? "",
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

// modal para ver en dictamen
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
              <Stamp className="h-4 w-4 text-primary" />{titulo}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Número: {folioDictamenFormateado} | Folio Recepción: {folioRecepcionFormateado}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />Imprimir
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="bg-card rounded-lg p-6 border border-border flex flex-col gap-4">
            {/* Encabezado institucional */}
            <div className="text-center border-b-2 border-primary pb-4">
              <p className="text-xs text-muted-foreground">GOBIERNO DEL ESTADO</p>
              <p className="text-xs text-muted-foreground">SECRETARÍA DE ADMINISTRACIÓN</p>
              <p className="text-xs text-muted-foreground">DIRECCIÓN DE ORGANIZACIÓN</p>
              <p className="text-base font-bold text-card-foreground mt-2 tracking-wide">{titulo}</p>
            </div>

            {/* Datos del dictamen */}
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

            {/* Destinatarios */}
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

            {/* Datos del solicitante */}
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

            {/* Firmas */}
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
  const tab = getTabForEstado(estado)
  const n   = norm(estado)

  const colores: Record<UefaTab, { bg: string; text: string }> = {
    "Nuevas":          { bg: "bg-secondary/15",   text: "text-secondary" },
    "Pendiente Firma": { bg: "bg-accent/15",       text: "text-accent-foreground" },
    "En Proceso":      { bg: "bg-primary/15",      text: "text-primary" },
    "Observadas":      { bg: "bg-destructive/15",  text: "text-destructive" },
    "Devueltas":       { bg: "bg-orange-500/15",   text: "text-orange-600" },
    "Emitidas":        { bg: "bg-primary/15",      text: "text-primary" },
    "Todas":           { bg: "bg-muted",           text: "text-muted-foreground" },
  }
  const { bg, text } = colores[tab] ?? { bg: "bg-muted", text: "text-muted-foreground" }

  let label = estado
  if (n === "en captura")                               label = "En Validacion Justificaciones"
  else if (n.includes("pendiente firma dictamen"))      label = "Pendiente Firma Dictamen"
  else if (n.includes("observado por revisor"))         label = "Devuelta por Revisor"
  else if (n.includes("observado por validacion final")) label = "Devuelta por Validacion Final"
  else if (n.includes("observado por emisor"))          label = "Devuelta por Emisor"

  return (
    <Badge className={`${bg} ${text} border-0 text-xs whitespace-nowrap`}>{label}</Badge>
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
          {num && (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
              {num}
            </span>
          )}
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
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="text-sm font-medium text-card-foreground">{value || "—"}</span>
    </div>
  )
}

function parseListField(text: string | null | undefined): string[] {
  if (!text || text === "—") return []
  return text.split(/[\n•·]+/).map(s => s.trim()).filter(Boolean)
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
  const folioDictamenMostrar = solicitud.numeroDictamen
    ?? (solicitud.folioDictamen ? formatearFolio(solicitud.folioDictamen) : null)

  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría"                           value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción" value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto"         value={solicitud.unidadResponsable} />
          <ReadOnlyField label="Programa o Proyecto"                  value={solicitud.programaProyecto} />
          <ReadOnlyField label="Régimen de Contratación"              value={formatRegimen(solicitud.regimen)} />
          <ReadOnlyField label="Tipo de Actividades"                  value={solicitud.tipoActividades} />
          <ReadOnlyField label="Número de Prestadores de Servicio"    value={solicitud.numeroPrestadores} />
          <ReadOnlyField label="Denominación"                         value={solicitud.denominacion} />
          <ReadOnlyField label="Vigencia Inicio"                      value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                     value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Bruto"                        value={solicitud.importeBruto} />
        </div>
      </SectionCard>

      <SectionCard title="Renovación">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="¿Es Renovación?"   value={solicitud.esRenovacion ? "SÍ" : "NO"} />
          <ReadOnlyField label="Folio del Dictamen" value={folioDictamenMostrar ?? solicitud.folioAnterior ?? "—"} />
        </div>
      </SectionCard>

      <SectionCard title="I.1 Objeto de la Contratación">
        <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
          {solicitud.objeto && solicitud.objeto !== "—"
            ? solicitud.objeto
            : <span className="text-muted-foreground">—</span>}
        </p>
      </SectionCard>

      <SectionCard title="I.2 Actividades a Realizar">
        <ListaItems items={solicitud.actividades} />
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <ListaItems items={solicitud.responsabilidades} />
      </SectionCard>

      <SectionCard title="Perfil">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Escolaridad Mínima"            value={formatEscolaridad(solicitud.escolaridad)} />
          <PerfilListField label="Competencias Administrativas"  value={solicitud.compAdm} />
          <PerfilListField label="Competencias Técnicas"         value={solicitud.compTec} />
          <PerfilListField label="Competencias Sociales"         value={solicitud.compSoc} />
          <PerfilListField label="Valores"                       value={solicitud.valores} />
          <PerfilListField label="Áreas de Experiencia"          value={solicitud.areasExp} />
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        {raw?.adjunto?.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {raw.adjunto.map((adj: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm text-card-foreground">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />{adj.nombre_archivo}
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
        <p className="text-sm text-muted-foreground">
          Vas a marcar <strong>{folio}</strong> con observaciones. Se enviará de regreso a la URG.
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />Aprobar y Asignar Revisor
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Seleccione el Revisor que revisará la solicitud <strong>{folio}</strong>.
        </p>
        {cargando ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Cargando revisores...
          </div>
        ) : revisores.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />No hay usuarios con rol Revisor en su secretaría.
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto py-1">
            {revisores.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSeleccionado(r.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  seleccionado === r.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-card-foreground"
                }`}
              >
                {seleccionado === r.id
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40 inline-block" />
                }
                {r.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => { if (seleccionado) { onConfirm(seleccionado); handleClose() } }}
            disabled={!seleccionado || cargando}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />Confirmar
          </Button>
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
  const [showObservarModal, setShowObservarModal] = useState(false)
  const [showFirmarConfirm, setShowFirmarConfirm] = useState(false)
  const [showDictamen,      setShowDictamen]      = useState(false)
  const [showAprobarConfirm, setShowAprobarConfirm] = useState(false)

  const tab                = getTabForEstado(solicitud.estado)
  const isNueva            = tab === "Nuevas"
  const isEmitida          = norm(solicitud.estado) === "emitido"
  const isPendienteFirma   = tab === "Pendiente Firma"
  const isObservada        = tab === "Observadas"
  const isDevuelta         = tab === "Devueltas"
  const isEnProceso        = tab === "En Proceso"

  const folioDictamenMostrar = solicitud.numeroDictamen
    ?? (solicitud.folioDictamen ? formatearFolio(solicitud.folioDictamen) : null)

  return (
    <div className="flex flex-col gap-4">
      {showDictamen && (
        <DictamenModal solicitud={solicitud} onClose={() => setShowDictamen(false)} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-card-foreground">
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-card-foreground">{solicitud.folioJustificacion}</span>
            {folioDictamenMostrar && (
              <span className="text-xs text-muted-foreground">
                Dictamen: <span className="font-medium text-secondary">{folioDictamenMostrar}</span>
              </span>
            )}
          </div>
          <UefaEstadoBadge estado={solicitud.estado} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={() => generateJustificacionPDF({
              folio: solicitud.folioJustificacion,
              tipo: solicitud.tipo as any,
              secretaria: solicitud.secretaria,
              unidadAdministrativa: solicitud.unidadAdministrativa,
              denominacion: solicitud.denominacion,
              vigenciaInicio: solicitud.vigenciaInicio,
              vigenciaFin: solicitud.vigenciaFin,
              importeBruto: solicitud.importeBruto,
              esRenovacion: solicitud.esRenovacion,
              folioAnterior: solicitud.folioAnterior,
              fecha: solicitud.fecha,
              firmadoDigitalmente: !isNueva,
            })}
          >
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
                Aprobar → Revisor
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
          {isPendienteFirma && (
            <Button
              onClick={() => setShowFirmarConfirm(true)}
              disabled={guardando}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-1.5"
              size="sm"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
              Firmar Justificación
            </Button>
          )}
          {isEmitida && (
            <>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowDictamen(true)}
                className="gap-1.5"
              >
                <FileCheck className="h-4 w-4" />Ver Dictamen
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowDictamen(true)}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />Descargar
              </Button>
            </>
          )}
        </div>
      </div>

      {isObservada && (
        <Card className="border-2 border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-destructive">Observaciones de Validación</span>
              {solicitud.observacionesUefa
                ? <p className="text-sm text-card-foreground mt-1">{solicitud.observacionesUefa}</p>
                : <p className="text-sm text-muted-foreground mt-1">Sin detalle de observaciones registrado.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {isDevuelta && (
        <Card className="border-2 border-orange-500/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <span className="text-sm font-medium text-orange-600">Devuelta con Observaciones</span>
              <p className="text-xs text-muted-foreground">Observada por Revisor, Validación Final o Emisor. Pendiente de corrección por la URG.</p>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Info className="h-5 w-5 text-primary" />
            <div>
              <span className="text-sm font-medium text-primary">En Proceso</span>
              <p className="text-xs text-muted-foreground">La solicitud está en revisión por Validación Final o Emisor. Solo lectura.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isEmitida && folioDictamenMostrar && (
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <FileCheck className="h-5 w-5 text-primary" />
            <div>
              <span className="text-sm font-medium text-primary">Dictamen Emitido</span>
              <p className="text-xs text-muted-foreground">
                No. {folioDictamenMostrar}{solicitud.fechaDictamen ? ` — ${solicitud.fechaDictamen}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ExpedienteGenerico solicitud={solicitud} />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <History className="h-4 w-4 text-secondary" />Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UefaHistorialTimeline historial={solicitud.historial} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={showAprobarConfirm}
        onClose={() => setShowAprobarConfirm(false)}
        onConfirm={() => { setShowAprobarConfirm(false); onAprobar(solicitud.id) }}
        title="¿Aprobar y enviar a Validación?"
        description={`La solicitud ${solicitud.folioJustificacion} será enviada a la Bandeja de Validación Final (DO).`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ConfirmModal
        open={showFirmarConfirm}
        onClose={() => setShowFirmarConfirm(false)}
        onConfirm={() => { setShowFirmarConfirm(false); onFirmarJustificacion(solicitud.id) }}
        title="¿Firmar Justificación?"
        description={`Se firmará la justificación ${solicitud.folioJustificacion} y pasará a Validación Final.`}
        confirmLabel="Sí, firmar"
        icon={<Stamp className="h-5 w-5 text-secondary" />}
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

// pagina principla
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
  const [dictamenViewId,   setDictamenViewId]   = useState<number | null>(null)

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true); setError(null)
    try {
        const res  = await fetch("/api/validacion?estado=todos")
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar solicitudes"); return }
      setSolicitudes((json.data ?? []).map(mapBDtoSolicitud))
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarSolicitudes() }, [cargarSolicitudes])

  const handleAprobar = useCallback(async (id: number) => {
    setGuardando(true)
    try {
      const res = await fetch("/api/validacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: id,
          nuevoEstado: "En Validacion Final",
          usuarioId:   (user as any)?.id ?? "",
          comentario:  "Aprobada por Validacion de Justificaciones → Enviada a Validación Final (DO)",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al aprobar"); return }
      setSolicitudes(prev => prev.map(s => s.id === id ? {
        ...s,
        estado: "En Validacion Final",
        historial: [...s.historial, {
          fecha:   formatFechaHora(new Date().toISOString()),
          usuario: (user as any)?.nombre ?? "Validacion",
          accion:  "Aprobada → Enviada a Validación Final (DO)",
        }],
      } : s))
      setSelectedId(null)
    } catch {
      alert("Error de conexión al aprobar")
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
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al observar"); return }
      setSolicitudes(prev => prev.map(s => s.id === observarTargetId ? {
        ...s,
        estado: "Observado por Validacion",
        observacionesUefa: obs,
        historial: [...s.historial, {
          fecha:   formatFechaHora(new Date().toISOString()),
          usuario: (user as any)?.nombre ?? "Validacion",
          accion:  `Observada — ${obs.substring(0, 60)}${obs.length > 60 ? "..." : ""}`,
        }],
      } : s))
      setObservarTargetId(null)
      setSelectedId(null)
    } catch {
      alert("Error de conexión al observar")
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
      if (!res.ok || !json.ok) { alert(json.error ?? "Error al firmar"); return }
      setSolicitudes(prev => prev.map(s => s.id === id ? {
        ...s,
        estado: "Pendiente Firma Dictamen",
        historial: [...s.historial, {
          fecha:   formatFechaHora(new Date().toISOString()),
          usuario: (user as any)?.nombre ?? "Validacion",
          accion:  "Justificacion firmada → Enviada a Emision para firma dictamen",
        }],
      } : s))
      setSelectedId(null)
    } catch {
      alert("Error de conexión al firmar")
    } finally {
      setGuardando(false)
    }
  }, [user])

  const tabDefs: { key: UefaTab; label: string }[] = [
    { key: "Nuevas",          label: "Nuevas" },
    { key: "Pendiente Firma", label: "Pendiente Firma" },
    { key: "En Proceso",      label: "En Proceso" },
    { key: "Observadas",      label: "Observadas" },
    { key: "Devueltas",       label: "Devueltas" },
    { key: "Emitidas",        label: "Emitidas" },
    { key: "Todas",           label: "Todas" },
  ]

  const tabCounts = useMemo(() => {
    const counts: Record<UefaTab, number> = {
      "Nuevas": 0, "Pendiente Firma": 0, "En Proceso": 0,
      "Observadas": 0, "Devueltas": 0, "Emitidas": 0, "Todas": solicitudes.length,
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

  const selectedSolicitud  = selectedId    !== null ? solicitudes.find(s => s.id === selectedId)    ?? null : null
  const dictamenViewSol    = dictamenViewId !== null ? solicitudes.find(s => s.id === dictamenViewId) ?? null : null

  if (selectedSolicitud) return (
    <PageLayout noContainer>
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
    </PageLayout>
  )

  return (
    <PageLayout>
      {dictamenViewSol && (
        <DictamenModal solicitud={dictamenViewSol} onClose={() => setDictamenViewId(null)} />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Bandeja de Validacion de Justificaciones</h2>
          <p className="text-sm text-muted-foreground">Revisión, firma y seguimiento de justificaciones enviadas por las URG</p>
        </div>
        <Button variant="outline" size="sm" onClick={cargarSolicitudes} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

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

      {/* Tabla */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Inbox className="h-4 w-4 text-secondary" />
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
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="px-4 py-3 text-left font-semibold">Folio de Justificación</th>
                    <th className="px-4 py-3 text-left font-semibold"> Nombramiento por Tiempo Determinado</th>
                    <th className="px-4 py-3 text-left font-semibold">Folio Dictamen</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Creación</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha de Recepción</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado Actual</th>
                    <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sol => {
                    const solTab             = getTabForEstado(sol.estado)
                    const folioDictamenLabel = sol.numeroDictamen
                      ?? (sol.folioDictamen ? formatearFolio(sol.folioDictamen) : null)

                    return (
                      <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-card-foreground">{sol.folioJustificacion}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sol.tipo}</td>
                        <td className="px-4 py-3">
                          {folioDictamenLabel ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">
                              {folioDictamenLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
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
                            {solTab === "Pendiente Firma" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleFirmarJustificacion(sol.id)}
                                disabled={guardando}
                                className="text-secondary hover:text-secondary/80 gap-1.5"
                              >
                                <Stamp className="h-4 w-4" />Firmar
                              </Button>
                            )}
                            {solTab === "Emitidas" && (
                              <>
                                { }
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setDictamenViewId(sol.id)}
                                  className="gap-1.5 text-primary hover:text-primary/80"
                                >
                                  <FileCheck className="h-4 w-4" />Ver Dictamen
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => setDictamenViewId(sol.id)}
                                  className="gap-1.5 text-muted-foreground hover:text-card-foreground"
                                >
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
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
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

      <ConfirmModal
        open={!!aprobarTargetId}
        onClose={() => setAprobarTargetId(null)}
        onConfirm={() => { if (aprobarTargetId) handleAprobar(aprobarTargetId) }}
        title="¿Aprobar y enviar a Validación?"
        description={`La solicitud ${solicitudes.find(s => s.id === aprobarTargetId)?.folioJustificacion ?? ""} será enviada a la Bandeja de Validación Final (DO).`}
        confirmLabel="Sí, aprobar"
        icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
      />
      <ObservarModal
        open={!!observarTargetId}
        onClose={() => setObservarTargetId(null)}
        onConfirm={handleObservarConfirm}
        folio={solicitudes.find(s => s.id === observarTargetId)?.folioJustificacion ?? ""}
      />
    </PageLayout>
  )
}