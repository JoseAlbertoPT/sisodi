"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Search, Eye, Edit3, Download, FileCheck,
  ChevronDown, ChevronRight, Info, History, FileText,
  ArrowLeft, AlertTriangle, Lock, Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"
import {
  isPeriodoVigente,
  isRegimenTipoCompatible,
  CAP_3000,
  CAP_1000,
  NOMBRAMIENTO_TD,
  type RegimenPeriodo,
} from "@/lib/calendario-recepcion-mock"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
type UrgTab =
  | "Borradores"
  | "Enviadas a UEFA"
  | "Observadas/Devueltas"
  | "En proceso DO"
  | "Emitidas"
  | "Todas"

type UrgEstado =
  | "Borrador"
  | "En Captura"
  | "Enviada a Validacion (UEFA)"
  | "Enviada a Validacion"
  | "Observada por UEFA"
  | "Observado por UEFA"
  | "Devuelta por DO"
  | "Observado DO Filtro 1"
  | "Observado DO Filtro 2"
  | "Observado DO Filtro 3"
  | "En revision DO Filtro 1"
  | "En revision DO Filtro 2"
  | "En revision DO Filtro 3"
  | "En proceso DO"
  | "Aprobado"
  | "Emitido"

interface HistorialEntry {
  fecha: string
  usuario: string
  accion: string
}

interface BitacoraEntry {
  seccion: string
  eventos: { fecha: string; usuario: string; descripcion: string }[]
}

interface UrgSolicitud {
  id: string
  folio: string
  folioJustificacion: string | null
  folioRecepcion?: string
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
  historial: HistorialEntry[]
  bitacora: BitacoraEntry[]
  observacionMotivo?: string
  numeroDictamen?: string
  fechaDictamen?: string
  regimen: RegimenPeriodo
  periodoAplicacion: string
}
function getFolioSegunEstado(sol: UrgSolicitud, activeTab: UrgTab): React.ReactNode {
  const efectivaTab: UrgTab =
    activeTab === "Todas" ? getTab(sol.estado) : activeTab

  switch (efectivaTab) {
    case "Borradores": {
      const base = sol.folioJustificacion ?? sol.folio
      return (
        <span>
          <span className="font-semibold">{base}</span>
          <span className="ml-1.5 text-[11px] text-muted-foreground italic">(borrador)</span>
        </span>
      )
    }

    case "Enviadas a UEFA": {
      if (sol.folioJustificacion) {
        return <span className="font-semibold">{sol.folioJustificacion}</span>
      }
      const anio = new Date().getFullYear()
      const num = sol.folio.split("-").pop()?.padStart(4, "0") ?? "0000"
      return <span className="font-semibold">JUST-{anio}-{num}</span>
    }

    case "Observadas/Devueltas":
    case "En proceso DO":
    case "Emitidas": {
      if (sol.folioRecepcion) {
        return <span className="font-semibold">{sol.folioRecepcion}</span>
      }
      const num = sol.folioJustificacion?.split("-").pop() ?? sol.folio.split("-").pop() ?? "000"
      return <span className="font-semibold">MR-{num}</span>
    }

    default:
      return <span className="font-medium">{sol.folioJustificacion ?? sol.folio}</span>
  }
}

function getFolioHeader(tab: UrgTab): string {
  if (tab === "En proceso DO" || tab === "Emitidas") return "Folio de Recepción"
  if (tab === "Observadas/Devueltas") return "Folio de Recepción"
  if (tab === "Todas") return "Folio"
  if (tab === "Enviadas a UEFA") return "Folio de Justificación"
  return "Folio"
}

function getTab(estado: UrgEstado): UrgTab {
  const n = (estado ?? "").toLowerCase()
  if (n === "borrador" || n === "en captura") return "Borradores"
  if (n.includes("enviada a validacion") || (n.includes("observad") && n.includes("uefa")))
    return "Enviadas a UEFA"
  if (n.includes("devuelta por do") || (n.includes("observad") && n.includes("filtro")))
    return "Observadas/Devueltas"
  if (n.includes("en revision do") || n === "en proceso do" || n === "aprobado")
    return "En proceso DO"
  if (n === "emitido") return "Emitidas"
  return "Todas"
}

function estadoBadge(estado: UrgEstado) {
  const n = (estado ?? "").toLowerCase()
  let bg = "bg-muted", text = "text-muted-foreground", label = estado ?? "—"

  if (n === "borrador" || n === "en captura") {
    bg = "bg-muted"; text = "text-muted-foreground"; label = "Borrador"
  } else if (n.includes("enviada a validacion")) {
    bg = "bg-blue-100"; text = "text-blue-800"; label = "Enviada a UEFA"
  } else if (n.includes("observad") && n.includes("uefa")) {
    bg = "bg-amber-100"; text = "text-amber-800"; label = "Observada por UEFA"
  } else if (n.includes("devuelta por do")) {
    bg = "bg-red-100"; text = "text-red-800"; label = "Devuelta por DO"
  } else if (n.includes("observad") && n.includes("filtro")) {
    bg = "bg-red-100"; text = "text-red-800"
    const num = n.includes("1") ? "1" : n.includes("2") ? "2" : "3"
    label = `Observada Filtro ${num}`
  } else if (n.includes("en revision do filtro")) {
    bg = "bg-indigo-100"; text = "text-indigo-800"
    const num = n.includes("1") ? "1" : n.includes("2") ? "2" : "3"
    label = `En revisión Filtro ${num}`
  } else if (n === "en proceso do") {
    bg = "bg-indigo-100"; text = "text-indigo-800"; label = "En proceso DO"
  } else if (n === "aprobado") {
    bg = "bg-violet-100"; text = "text-violet-800"; label = "Aprobado"
  } else if (n === "emitido") {
    bg = "bg-emerald-100"; text = "text-emerald-800"; label = "Emitido"
  }

  return (
    <Badge className={`${bg} ${text} hover:${bg} border-0 text-xs`}>{label}</Badge>
  )
}

function mapApiItem(item: any): UrgSolicitud {
  const lastObservacion = [...(item.historial ?? [])]
    .reverse()
    .find((h: any) => h.comentario)?.comentario as string | undefined

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
      descripcion: h.accion + (h.comentario ? `: ${h.comentario}` : ""),
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
    "Enviada a Validacion (UEFA)", "Enviada a Validacion",
    "Observada por UEFA", "Observado por UEFA",
    "Devuelta por DO",
    "Observado DO Filtro 1", "Observado DO Filtro 2", "Observado DO Filtro 3",
    "En revision DO Filtro 1", "En revision DO Filtro 2", "En revision DO Filtro 3",
    "En proceso DO", "Aprobado", "Emitido",
  ]
  const estado: UrgEstado = estadosValidos.includes(rawEstado as UrgEstado)
    ? (rawEstado as UrgEstado)
    : "Borrador"

  return {
    id:                   String(item.id),
    folio:                item.folio_justificacion ?? `SOL-${new Date().getFullYear()}-${String(item.id).padStart(4, "0")}`,
    folioJustificacion:   item.folio_justificacion ?? null,
    folioRecepcion:       item.folio_recepcion     ?? undefined,
    tipo:                 item.tipo_solicitud       as UrgSolicitud["tipo"],
    secretaria:           item.secretaria           ?? "",
    fecha:                fmt(item.fecha_creacion),
    estado,
    denominacion:         item.denominacion         ?? "",
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
    nivelTabulador:       item.nivel_tabulador       ?? "",
    categoriaTabulador:   item.categoria_tabulador   ?? "",
    regimen,
    periodoAplicacion,
    observacionMotivo:    lastObservacion,
    numeroDictamen:       item.dictamen?.folio        ?? undefined,
    fechaDictamen:        item.dictamen?.fecha_emision
      ? fmt(item.dictamen.fecha_emision)
      : undefined,
    historial: (item.historial ?? []).map((h: any) => ({
      fecha:   h.fecha
        ? new Date(h.fecha).toISOString().replace("T", " ").slice(0, 16)
        : "",
      usuario: h.usuario,
      accion:  h.accion + (h.comentario ? `: ${h.comentario}` : ""),
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

function HistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
  if (!historial.length)
    return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>
  return (
    <div className="flex flex-col gap-0">
      {[...historial].reverse().map((entry, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card">
              <div className="h-2 w-2 rounded-full bg-secondary" />
            </div>
            {index < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex flex-col gap-0.5 pb-4">
            <span className="text-xs font-medium text-card-foreground">{entry.accion}</span>
            <span className="text-[10px] text-muted-foreground">
              {entry.fecha} — {entry.usuario}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ExpedientePrestacion({ solicitud }: { solicitud: UrgSolicitud }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaría"                              value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripción"   value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto"           value={solicitud.unidadResponsable} />
          <ReadOnlyField label="Régimen de Contratación"                value={solicitud.regimen} />
          <ReadOnlyField label="Número de Prestadores de Servicios"     value={solicitud.numeroPrestadores} />
          <ReadOnlyField label="Programa o Proyecto"                    value={solicitud.programaProyecto} />
          <ReadOnlyField label="Tipo de Actividades"                    value={solicitud.tipoActividades} />
          <ReadOnlyField label="Denominación"                           value={solicitud.denominacion} />
          <ReadOnlyField label="Vigencia Inicio"                        value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"                       value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Bruto"                          value={solicitud.importeBruto} />
        </div>
      </SectionCard>

      <SectionCard title="Renovación" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Es Renovación"              value="Sí" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
          </div>
        ) : (
          <ReadOnlyField label="Es Renovación" value="No" />
        )}
      </SectionCard>

      <SectionCard title="I.1 Objeto de la Contratación">
        <div className="grid gap-4">
          <ReadOnlyTextarea label="Objeto" value={solicitud.objeto} />
        </div>
      </SectionCard>

      <SectionCard title="I.2 Actividades a Realizar">
        <div className="grid gap-4">
          <ReadOnlyTextarea label="Actividades" value={solicitud.actividades} />
        </div>
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <div className="grid gap-4">
          <ReadOnlyTextarea label="Responsabilidades" value={solicitud.responsabilidades} />
        </div>
      </SectionCard>

      <SectionCard num="II" title="Perfil">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Escolaridad Mínima"          value={solicitud.escolaridad} />
          <ReadOnlyField label="Competencias Administrativas" value={solicitud.compAdm} />
          <ReadOnlyField label="Competencias Técnicas"        value={solicitud.compTec} />
          <ReadOnlyField label="Competencias Sociales"        value={solicitud.compSoc} />
          <ReadOnlyField label="Valores"                      value={solicitud.valores} />
          <ReadOnlyField label="Áreas de Experiencia"         value={solicitud.areasExp} />
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
          <ReadOnlyField label="Secretaría"            value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa" value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Denominación"          value={solicitud.denominacion} />
          <ReadOnlyField label="Nivel de Tabulador"    value={solicitud.nivelTabulador} />
          <ReadOnlyField label="Categoría Tabulador"   value={solicitud.categoriaTabulador} />
          <ReadOnlyField label="Importe Neto Mensual"  value={solicitud.importeBruto} />
          <ReadOnlyField label="Vigencia Inicio"       value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Término"      value={solicitud.vigenciaFin} />
        </div>
      </SectionCard>

      <SectionCard title="Renovación" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Es Renovación"              value="Sí" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
          </div>
        ) : (
          <ReadOnlyField label="Es Renovación" value="No" />
        )}
      </SectionCard>

      <SectionCard title="I.1 Objeto de la Contratación">
        <ReadOnlyTextarea label="Objeto" value={solicitud.objeto} />
      </SectionCard>

      <SectionCard title="I.2 Actividades a Realizar">
        <ReadOnlyTextarea label="Actividades" value={solicitud.actividades} />
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <ReadOnlyTextarea label="Responsabilidades" value={solicitud.responsabilidades} />
      </SectionCard>

      <SectionCard num="II" title="Perfil">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Escolaridad Mínima"          value={solicitud.escolaridad} />
          <ReadOnlyField label="Competencias Administrativas" value={solicitud.compAdm} />
          <ReadOnlyField label="Competencias Técnicas"        value={solicitud.compTec} />
          <ReadOnlyField label="Competencias Sociales"        value={solicitud.compSoc} />
          <ReadOnlyField label="Valores"                      value={solicitud.valores} />
          <ReadOnlyField label="Áreas de Experiencia"         value={solicitud.areasExp} />
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

function DetalleView({
  sol, onBack, onUpdatePeriodo,
}: {
  sol: UrgSolicitud
  onBack: () => void
  onUpdatePeriodo?: (id: string, periodo: string) => void
}) {
  const { toast } = useToast()

  const n         = (sol.estado ?? "").toLowerCase()
  const canEdit   = n === "borrador" || n === "en captura"
    || n.includes("devuelta por do")
    || (n.includes("observad") && n.includes("filtro"))
  const isEmitido  = n === "emitido"
  const isReadOnly = !canEdit && !isEmitido

  const periodoCheck   = isPeriodoVigente(sol.regimen, sol.periodoAplicacion)
  const tipoCompatible = isRegimenTipoCompatible(sol.regimen, sol.tipo)
  const canSend        = periodoCheck.vigente && tipoCompatible
  const isBorradorFueraDeTiempo = (n === "borrador" || n === "en captura") && !periodoCheck.vigente

  const [editingPeriodo, setEditingPeriodo] = useState(false)
  const [newPeriodo, setNewPeriodo]         = useState(sol.periodoAplicacion)

  const regimenLabel =
    sol.regimen === "honorarios" ? "Honorarios"
    : sol.regimen === "asimilados" ? "Asimilados"
    : "Nombramiento"

  const periodoOptions =
    sol.regimen === "honorarios"
      ? CAP_3000.map((r) => r.mes)
      : sol.regimen === "asimilados"
        ? CAP_1000.map((r) => r.quincena)
        : NOMBRAMIENTO_TD.map((r) => r.quincena)

  const handleDemoAction = (label: string) =>
    toast({ title: "Demo", description: `Acción "${label}" solo disponible en producción.` })

  const handleUpdatePeriodo = () => {
    if (onUpdatePeriodo && newPeriodo !== sol.periodoAplicacion) {
      onUpdatePeriodo(sol.id, newPeriodo)
      setEditingPeriodo(false)
      toast({ title: "Periodo actualizado", description: `Periodo cambiado a "${newPeriodo}".` })
    }
  }

  const folioHeader = sol.folioJustificacion || sol.folioRecepcion || sol.folio

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}
            className="gap-1.5 text-muted-foreground hover:text-card-foreground">
            <ArrowLeft className="h-4 w-4" />Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-semibold text-card-foreground">{folioHeader}</span>
          {estadoBadge(sol.estado)}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => generateJustificacionPDF({
              folio:                sol.folioJustificacion || sol.folio,
              tipo:                 sol.tipo,
              secretaria:           sol.secretaria,
              unidadAdministrativa: sol.unidadAdministrativa,
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
          {canEdit && (
            <>
              <Button size="sm"
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-1.5"
                onClick={() => handleDemoAction("Continuar captura")}>
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
          {isEmitido && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => handleDemoAction("Ver dictamen")}>
                <FileCheck className="h-4 w-4" />Ver Dictamen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => handleDemoAction("Descargar")}>
                <Download className="h-4 w-4" />Descargar
              </Button>
            </>
          )}
          {isReadOnly && (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground py-1.5 px-3">
              <Lock className="h-3 w-3" />Solo lectura
            </Badge>
          )}
        </div>
      </div>

      {sol.observacionMotivo && n.includes("observad") && n.includes("uefa") && (
        <Card className="border-2 border-amber-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-amber-700">Observación de UEFA</span>
              <p className="text-sm text-card-foreground mt-1">{sol.observacionMotivo}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {sol.observacionMotivo && (
        n.includes("devuelta por do") || (n.includes("observad") && n.includes("filtro"))
      ) && (
        <Card className="border-2 border-red-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-red-700">Observación / Devolución DO</span>
              <p className="text-sm text-card-foreground mt-1">{sol.observacionMotivo}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isBorradorFueraDeTiempo && (
        <Card className="border-2 border-destructive/40 shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-destructive">Periodo fuera de tiempo</span>
                <p className="text-sm text-card-foreground mt-1">
                  El periodo <strong>{sol.periodoAplicacion}</strong> ({regimenLabel}) — límite DO:{" "}
                  <strong>{periodoCheck.limiteDO ?? "N/A"}</strong> ya expiró.
                </p>
              </div>
            </div>
            {!editingPeriodo ? (
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
                        const check = isPeriodoVigente(sol.regimen, p)
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
                  disabled={newPeriodo === sol.periodoAplicacion || !isPeriodoVigente(sol.regimen, newPeriodo).vigente}
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
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="shadow-sm border-border sticky top-4">
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

export function MisSolicitudesPage() {
  const { user } = useAuth()

  const [data, setData]             = useState<UrgSolicitud[]>([])
  const [tabCounts, setTabCounts]   = useState<Record<UrgTab, number>>({
    Borradores: 0, "Enviadas a UEFA": 0, "Observadas/Devueltas": 0,
    "En proceso DO": 0, Emitidas: 0, Todas: 0,
  })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<UrgTab>("Todas")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const TABS: UrgTab[] = [
    "Borradores", "Enviadas a UEFA", "Observadas/Devueltas",
    "En proceso DO", "Emitidas", "Todas",
  ]

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
        Borradores: 0, "Enviadas a UEFA": 0, "Observadas/Devueltas": 0,
        "En proceso DO": 0, Emitidas: 0, Todas: 0,
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

  if (selectedSolicitud) {
    return (
      <div className="flex flex-col gap-6">
        <DetalleView
          sol={selectedSolicitud}
          onBack={() => setSelectedId(null)}
          onUpdatePeriodo={(id, periodo) =>
            setData((prev) => prev.map((s) => s.id === id ? { ...s, periodoAplicacion: periodo } : s))
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Bandeja URG — Mis Solicitudes</h2>
        <p className="text-sm text-muted-foreground">
          Solicitudes capturadas por mi área, con seguimiento de validación (UEFA) y dictaminación (DO).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                isActive
                  ? "bg-secondary-foreground/20 text-secondary-foreground"
                  : "bg-background text-muted-foreground"
              }`}>
                {tabCounts[tab]}
              </span>
            </button>
          )
        })}
      </div>

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
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    {getFolioHeader(activeTab)}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Régimen de Contratación
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Fecha de Creación
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Fecha de Recepción
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Estatus
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
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
                  const n      = (sol.estado ?? "").toLowerCase()
                  const isUefa = n.includes("observad") && n.includes("uefa")
                  const isDO   = n.includes("devuelta por do") ||
                    (n.includes("observad") && n.includes("filtro"))

                  const fechaRecepcionDO = sol.folioRecepcion
                    ? sol.historial
                        .find((h) => h.accion.toLowerCase().includes("filtro 1"))
                        ?.fecha.split(" ")[0] ?? "—"
                    : "—"

                  return (
                    <tr key={sol.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-card-foreground">
                        {getFolioSegunEstado(sol, activeTab)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sol.tipo}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sol.fecha}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {fechaRecepcionDO !== "—"
                          ? fechaRecepcionDO
                          : <span className="italic text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {estadoBadge(sol.estado)}
                          {isUefa && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-[10px] px-1.5">
                              UEFA
                            </Badge>
                          )}
                          {isDO && (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0 text-[10px] px-1.5">
                              DO
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm"
                          onClick={() => setSelectedId(sol.id)}
                          className="text-secondary hover:text-primary gap-1.5">
                          <Eye className="h-4 w-4" />Ver
                        </Button>
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
    </div>
  )
}