"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { PageLayout } from "@/components/page-layout"
import {
  Search,
  Eye,
  Edit3,
  Download,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Info,
  History,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Lock,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Types ──
type UrgTab = "Borradores" | "Enviadas a UEFA" | "Observadas/Devueltas" | "En proceso DO" | "Emitidas" | "Todas"

type UrgEstado =
  | "Borrador"
  | "Enviada a Validacion (UEFA)"
  | "Observada por UEFA"
  | "Devuelta por DO"
  | "En proceso DO"
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
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Determinado"
  secretaria: string
  fecha: string
  estado: UrgEstado
  denominacion: string
  unidadAdministrativa: string
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior?: string
  historial: HistorialEntry[]
  bitacora: BitacoraEntry[]
  observacionMotivo?: string
  numeroDictamen?: string
  fechaDictamen?: string
  regimen: RegimenPeriodo
  periodoAplicacion: string
  folioRecepcion?: string
}

// ── Tab mapping ──
function getTab(estado: UrgEstado): UrgTab {
  switch (estado) {
    case "Borrador": return "Borradores"
    case "Enviada a Validacion (UEFA)": return "Enviadas a UEFA"
    case "Observada por UEFA":
    case "Devuelta por DO": return "Observadas/Devueltas"
    case "En proceso DO": return "En proceso DO"
    case "Emitido": return "Emitidas"
  }
}

// ── Helper: does this tab use the "Folio Justificacion" layout? ──
function usaFolioJustificacion(tab: UrgTab): boolean {
  return tab === "Borradores" || tab === "Enviadas a UEFA"
}

// ── Badge helpers ──
function estadoBadge(estado: UrgEstado) {
  const map: Record<UrgEstado, { bg: string; text: string }> = {
    "Borrador": { bg: "bg-muted", text: "text-muted-foreground" },
    "Enviada a Validacion (UEFA)": { bg: "bg-blue-100", text: "text-blue-800" },
    "Observada por UEFA": { bg: "bg-amber-100", text: "text-amber-800" },
    "Devuelta por DO": { bg: "bg-red-100", text: "text-red-800" },
    "En proceso DO": { bg: "bg-indigo-100", text: "text-indigo-800" },
    "Emitido": { bg: "bg-emerald-100", text: "text-emerald-800" },
  }
  const v = map[estado]
  return (
    <Badge className={`${v.bg} ${v.text} hover:${v.bg} border-0 text-xs`}>
      {estado}
    </Badge>
  )
}

// ── Mock data ──
function createMockData(): UrgSolicitud[] {
  const defaultBitacora: BitacoraEntry[] = [
    {
      seccion: "Datos Generales",
      eventos: [
        { fecha: "2026-02-01 09:00", usuario: "Maria Lopez (URG)", descripcion: "Campos llenados: Tipo de solicitud, Secretaria, Unidad Administrativa" },
        { fecha: "2026-02-01 09:15", usuario: "Maria Lopez (URG)", descripcion: "Campo editado: Denominacion del puesto" },
      ],
    },
    {
      seccion: "Renovacion",
      eventos: [
        { fecha: "2026-02-01 09:20", usuario: "Maria Lopez (URG)", descripcion: "Se marco como nueva contratacion" },
      ],
    },
    {
      seccion: "Documentos Adjuntos",
      eventos: [
        { fecha: "2026-02-01 09:30", usuario: "Maria Lopez (URG)", descripcion: "Archivo cargado: constancia_no_adeudo.pdf" },
        { fecha: "2026-02-01 09:32", usuario: "Maria Lopez (URG)", descripcion: "Archivo cargado: identificacion_oficial.pdf" },
      ],
    },
    {
      seccion: "Objeto de la Contratacion",
      eventos: [
        { fecha: "2026-02-01 09:40", usuario: "Maria Lopez (URG)", descripcion: "Campo llenado: Descripcion del objeto" },
      ],
    },
    {
      seccion: "Actividades Principales",
      eventos: [
        { fecha: "2026-02-01 09:45", usuario: "Maria Lopez (URG)", descripcion: "Se registraron 3 actividades principales" },
      ],
    },
  ]

  return [
    // ── Borradores (2) ──
    {
      id: "urg-1", folio: "SOL-2026-0060", folioJustificacion: null, tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Administracion", fecha: "2026-02-18", estado: "Borrador",
      denominacion: "Auxiliar Contable", unidadAdministrativa: "Dir. de Contabilidad",
      vigenciaInicio: "2026-04-01", vigenciaFin: "2026-12-31", importeBruto: "$18,500.00",
      esRenovacion: false,
      regimen: "honorarios", periodoAplicacion: "Enero",
      historial: [
        { fecha: "2026-02-18 10:00", usuario: "Maria Lopez (URG)", accion: "Solicitud creada como borrador" },
      ],
      bitacora: defaultBitacora,
    },
    {
      id: "urg-2", folio: "SOL-2026-0061", folioJustificacion: null, tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Finanzas", fecha: "2026-02-19", estado: "Borrador",
      denominacion: "Analista Presupuestal", unidadAdministrativa: "Dir. de Presupuesto",
      vigenciaInicio: "2026-04-01", vigenciaFin: "2026-09-30", importeBruto: "$24,000.00",
      esRenovacion: false,
      regimen: "nombramiento", periodoAplicacion: "2da Enero",
      historial: [
        { fecha: "2026-02-19 14:30", usuario: "Pedro Gomez (URG)", accion: "Solicitud creada como borrador" },
      ],
      bitacora: defaultBitacora,
    },
    // ── Enviadas a UEFA (2) ──
    {
      id: "urg-3", folio: "SOL-2026-0055", folioJustificacion: "JUST-2026-0012", tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Educacion", fecha: "2026-02-12", estado: "Enviada a Validacion (UEFA)",
      denominacion: "Coordinador de Capacitacion", unidadAdministrativa: "Dir. de Desarrollo Profesional",
      vigenciaInicio: "2026-03-15", vigenciaFin: "2026-12-31", importeBruto: "$28,000.00",
      esRenovacion: true, folioAnterior: "DICT-2025-0134",
      regimen: "asimilados", periodoAplicacion: "1ra Marzo",
      historial: [
        { fecha: "2026-02-12 08:00", usuario: "Carlos Ruiz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-12 08:10", usuario: "Carlos Ruiz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0012" },
      ],
      bitacora: defaultBitacora,
    },
    {
      id: "urg-4", folio: "SOL-2026-0056", folioJustificacion: "JUST-2026-0013", tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Obras Publicas", fecha: "2026-02-13", estado: "Enviada a Validacion (UEFA)",
      denominacion: "Ingeniero de Supervision", unidadAdministrativa: "Dir. de Infraestructura",
      vigenciaInicio: "2026-03-01", vigenciaFin: "2026-11-30", importeBruto: "$36,000.00",
      esRenovacion: false,
      regimen: "nombramiento", periodoAplicacion: "1ra Marzo",
      historial: [
        { fecha: "2026-02-13 09:00", usuario: "Jorge Mendez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-13 09:05", usuario: "Jorge Mendez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0013" },
      ],
      bitacora: defaultBitacora,
    },
    // ── Observada por UEFA (1) ──
    {
      id: "urg-5", folio: "SOL-2026-0048", folioJustificacion: "JUST-2026-0014", tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Desarrollo Social", fecha: "2026-02-08", estado: "Observada por UEFA",
      denominacion: "Promotor Comunitario", unidadAdministrativa: "Dir. de Programas Sociales",
      vigenciaInicio: "2026-03-01", vigenciaFin: "2026-12-31", importeBruto: "$20,000.00",
      esRenovacion: false,
      regimen: "honorarios", periodoAplicacion: "Marzo",
      observacionMotivo: "La vigencia no puede exceder el ejercicio fiscal. Falta firma del titular en oficio de justificacion.",
      historial: [
        { fecha: "2026-02-08 11:00", usuario: "Rosa Diaz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-08 11:05", usuario: "Rosa Diaz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0014" },
        { fecha: "2026-02-09 10:00", usuario: "Laura Vega (UEFA)", accion: "Solicitud observada por UEFA" },
      ],
      bitacora: defaultBitacora,
    },
    // ── Devuelta por DO (1) ──
    {
      id: "urg-6", folio: "SOL-2026-0042", folioJustificacion: "JUST-2026-0015", folioRecepcion: "FE-010", tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Turismo", fecha: "2026-02-03", estado: "Devuelta por DO",
      denominacion: "Coordinador de Eventos", unidadAdministrativa: "Dir. de Promocion Turistica",
      vigenciaInicio: "2026-03-01", vigenciaFin: "2026-08-31", importeBruto: "$26,500.00",
      esRenovacion: true, folioAnterior: "DICT-2025-0098",
      regimen: "nombramiento", periodoAplicacion: "1ra Febrero",
      observacionMotivo: "Inconsistencia en datos del beneficiario. El RFC no coincide con la CURP proporcionada.",
      historial: [
        { fecha: "2026-02-03 09:00", usuario: "Luis Herrera (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-03 09:05", usuario: "Luis Herrera (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0015" },
        { fecha: "2026-02-04 10:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-05 09:00", usuario: "Ana Rivera (DO F1)", accion: "Devuelta por DO Filtro 1" },
      ],
      bitacora: defaultBitacora,
    },
    // ── En proceso DO (3) ──
    {
      id: "urg-7", folio: "SOL-2026-0040", folioJustificacion: "JUST-2026-0016", folioRecepcion: "FE-011", tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Salud", fecha: "2026-02-01", estado: "En proceso DO",
      denominacion: "Medico General", unidadAdministrativa: "Dir. de Servicios de Salud",
      vigenciaInicio: "2026-03-01", vigenciaFin: "2026-12-31", importeBruto: "$45,000.00",
      esRenovacion: false,
      regimen: "asimilados", periodoAplicacion: "1ra Febrero",
      historial: [
        { fecha: "2026-02-01 08:00", usuario: "Pedro Gomez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-01 08:05", usuario: "Pedro Gomez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0016" },
        { fecha: "2026-02-02 09:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-03 10:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada Filtro 1" },
        { fecha: "2026-02-04 11:00", usuario: "Roberto Diaz (DO F2)", accion: "En revision Filtro 2" },
      ],
      bitacora: defaultBitacora,
    },
    {
      id: "urg-8", folio: "SOL-2026-0041", folioJustificacion: "JUST-2026-0017", folioRecepcion: "FE-012", tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Seguridad", fecha: "2026-02-02", estado: "En proceso DO",
      denominacion: "Analista de Inteligencia", unidadAdministrativa: "Dir. de Analisis",
      vigenciaInicio: "2026-03-01", vigenciaFin: "2026-12-31", importeBruto: "$32,000.00",
      esRenovacion: false,
      regimen: "nombramiento", periodoAplicacion: "1ra Febrero",
      historial: [
        { fecha: "2026-02-02 10:00", usuario: "Carlos Ruiz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-02 10:05", usuario: "Carlos Ruiz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0017" },
        { fecha: "2026-02-03 08:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-04 09:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada Filtro 1" },
        { fecha: "2026-02-05 10:00", usuario: "Roberto Diaz (DO F2)", accion: "Aprobada Filtro 2" },
        { fecha: "2026-02-06 11:00", usuario: "Sofia Martinez (DO F3)", accion: "En revision Filtro 3" },
      ],
      bitacora: defaultBitacora,
    },
    {
      id: "urg-9", folio: "SOL-2026-0043", folioJustificacion: "JUST-2026-0018", folioRecepcion: "FE-013", tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Medio Ambiente", fecha: "2026-02-04", estado: "En proceso DO",
      denominacion: "Biologo Ambiental", unidadAdministrativa: "Dir. de Proteccion Ambiental",
      vigenciaInicio: "2026-03-15", vigenciaFin: "2026-12-31", importeBruto: "$27,500.00",
      esRenovacion: true, folioAnterior: "DICT-2025-0145",
      regimen: "honorarios", periodoAplicacion: "Marzo",
      historial: [
        { fecha: "2026-02-04 08:00", usuario: "Jorge Mendez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-04 08:05", usuario: "Jorge Mendez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0018" },
        { fecha: "2026-02-05 09:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-06 10:00", usuario: "Ana Rivera (DO F1)", accion: "En revision Filtro 1" },
      ],
      bitacora: defaultBitacora,
    },
    // ── Emitidas (2) ──
    {
      id: "urg-10", folio: "SOL-2026-0025", folioJustificacion: "JUST-2026-0019", folioRecepcion: "FE-014", tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Administracion", fecha: "2026-01-15", estado: "Emitido",
      denominacion: "Asesor Juridico", unidadAdministrativa: "Dir. Juridica",
      vigenciaInicio: "2026-02-01", vigenciaFin: "2026-12-31", importeBruto: "$40,000.00",
      esRenovacion: false, numeroDictamen: "DICT-2026-0015", fechaDictamen: "2026-02-15",
      regimen: "asimilados", periodoAplicacion: "2da Enero",
      historial: [
        { fecha: "2026-01-15 08:00", usuario: "Luis Herrera (URG)", accion: "Solicitud creada" },
        { fecha: "2026-01-15 08:05", usuario: "Luis Herrera (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0019" },
        { fecha: "2026-01-16 09:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-01-17 10:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada Filtro 1" },
        { fecha: "2026-01-18 11:00", usuario: "Roberto Diaz (DO F2)", accion: "Aprobada Filtro 2" },
        { fecha: "2026-01-19 09:00", usuario: "Sofia Martinez (DO F3)", accion: "Aprobada Filtro 3" },
        { fecha: "2026-02-15 12:00", usuario: "Sistema", accion: "Dictamen emitido: DICT-2026-0015" },
      ],
      bitacora: defaultBitacora,
    },
    {
      id: "urg-11", folio: "SOL-2026-0028", folioJustificacion: "JUST-2026-0020", folioRecepcion: "FE-015", tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Cultura", fecha: "2026-01-20", estado: "Emitido",
      denominacion: "Director Artistico", unidadAdministrativa: "Dir. de Fomento Cultural",
      vigenciaInicio: "2026-02-15", vigenciaFin: "2026-12-31", importeBruto: "$38,000.00",
      esRenovacion: true, folioAnterior: "DICT-2025-0067",
      numeroDictamen: "DICT-2026-0018", fechaDictamen: "2026-02-18",
      regimen: "nombramiento", periodoAplicacion: "1ra Febrero",
      historial: [
        { fecha: "2026-01-20 09:00", usuario: "Rosa Diaz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-01-20 09:05", usuario: "Rosa Diaz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0020" },
        { fecha: "2026-01-21 10:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-01-22 11:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada Filtro 1" },
        { fecha: "2026-01-23 09:00", usuario: "Roberto Diaz (DO F2)", accion: "Aprobada Filtro 2" },
        { fecha: "2026-01-24 10:00", usuario: "Sofia Martinez (DO F3)", accion: "Aprobada Filtro 3" },
        { fecha: "2026-02-18 12:00", usuario: "Sistema", accion: "Dictamen emitido: DICT-2026-0018" },
      ],
      bitacora: defaultBitacora,
    },
  ]
}

// ── Shared sub-components ──

function SectionCard({
  num,
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  num?: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
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
      <span className="text-sm font-medium text-card-foreground">{value}</span>
    </div>
  )
}

function ReadOnlyList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[10px] font-medium text-secondary">
            {i + 1}
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function HistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
  return (
    <div className="flex flex-col gap-0">
      {[...historial].reverse().map((entry, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card">
              <div className="h-2 w-2 rounded-full bg-secondary" />
            </div>
            {index < historial.length - 1 && (
              <div className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 pb-4">
            <span className="text-xs font-medium text-card-foreground">{entry.accion}</span>
            <span className="text-[10px] text-muted-foreground">
              {entry.fecha} - {entry.usuario}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Full form: Prestacion de Servicios (read-only) ──
function ExpedientePrestacion({ solicitud }: { solicitud: UrgSolicitud }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaria" value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa de Adscripcion" value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto" value="URG-01 Oficina del Secretario" />
          <ReadOnlyField label="Programa o Proyecto" value="P-003 Modernizacion Administrativa" />
          <ReadOnlyField label="Regimen de Contratacion" value="Honorarios Asimilados a Salarios" />
          <ReadOnlyField label="Tipo de Actividades" value="Profesionales" />
          <ReadOnlyField label="Numero de Prestadores de Servicio" value="3" />
          <ReadOnlyField label="Denominacion" value={solicitud.denominacion} />
          <ReadOnlyField label="Vigencia Inicio" value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Termino" value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Importe Bruto" value={solicitud.importeBruto} />
        </div>
      </SectionCard>

      <SectionCard title="Renovacion" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="flex flex-col gap-3">
            <ReadOnlyField label="Es Renovacion" value="Si" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
            <ReadOnlyField label="Condicion" value="Mismas condiciones tecnicas y funcionales" />
          </div>
        ) : (
          <ReadOnlyField label="Es Renovacion" value="No" />
        )}
      </SectionCard>

      <SectionCard title="I.1 Objeto de la Contratacion">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Prestacion de servicios profesionales para el desarrollo, implementacion y seguimiento de actividades especializadas en el marco del programa institucional correspondiente.
        </p>
      </SectionCard>

      <SectionCard title="I.2 Actividades a Realizar">
        <ReadOnlyList items={[
          "Coordinar y ejecutar actividades del programa",
          "Elaborar informes periodicos de avance",
          "Supervisar el cumplimiento de metas",
        ]} />
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <ReadOnlyList items={[
          "Cumplir con los plazos establecidos",
          "Reportar avances semanales al superior jerarquico",
        ]} />
      </SectionCard>

      <SectionCard num="II" title="Perfil">
        <div className="flex flex-col gap-4">
          <ReadOnlyField label="Escolaridad Minima" value="Licenciatura" />
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Administrativas</span>
            <ReadOnlyList items={["Planeacion", "Organizacion", "Control de recursos"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Tecnicas</span>
            <ReadOnlyList items={["Desarrollo de software", "Bases de datos", "Redes"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Sociales</span>
            <ReadOnlyList items={["Trabajo en equipo", "Comunicacion efectiva"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Valores</span>
            <ReadOnlyList items={["Integridad", "Responsabilidad", "Transparencia"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Areas de Experiencia</span>
            <ReadOnlyList items={["Tecnologias de la informacion", "Administracion publica"]} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Oficio_Solicitud.pdf</p>
              <p className="text-xs text-muted-foreground">1.2 MB - Subido el {solicitud.fecha}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Oficio_Suficiencia_Presupuestal.pdf</p>
              <p className="text-xs text-muted-foreground">0.8 MB - Subido el {solicitud.fecha}</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Full form: Nombramiento (read-only) ──
function ExpedienteNombramiento({ solicitud }: { solicitud: UrgSolicitud }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard num="I" title="Datos Generales">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Secretaria" value={solicitud.secretaria} />
          <ReadOnlyField label="Unidad Administrativa" value={solicitud.unidadAdministrativa} />
          <ReadOnlyField label="Unidad Responsable del Gasto" value="URG-02 Direccion General" />
          <ReadOnlyField label="Programa o Proyecto" value="P-005 Fortalecimiento Institucional" />
          <ReadOnlyField label="Denominacion del Nombramiento" value={solicitud.denominacion} />
          <ReadOnlyField label="Puesto del Jefe Inmediato" value="Director de Area" />
          <ReadOnlyField label="Numero de Personas a Contratar" value="2" />
          <ReadOnlyField label="Importe Neto Mensual" value={solicitud.importeBruto} />
          <ReadOnlyField label="Vigencia Inicio" value={solicitud.vigenciaInicio} />
          <ReadOnlyField label="Vigencia Termino" value={solicitud.vigenciaFin} />
          <ReadOnlyField label="Clave Presupuestal" value="CP-2026-0045" />
        </div>
      </SectionCard>

      <SectionCard title="Renovacion" defaultOpen={solicitud.esRenovacion}>
        {solicitud.esRenovacion ? (
          <div className="flex flex-col gap-3">
            <ReadOnlyField label="Es Renovacion" value="Si" />
            <ReadOnlyField label="Folio del Dictamen Anterior" value={solicitud.folioAnterior || "N/A"} />
            <ReadOnlyField label="Condicion" value="Mismas condiciones tecnicas y funcionales" />
          </div>
        ) : (
          <ReadOnlyField label="Es Renovacion" value="No" />
        )}
      </SectionCard>

      <SectionCard title="Tabulador - Nivel y Categoria">
        <div className="flex flex-col gap-3">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Nivel" value="104" />
            <ReadOnlyField label="Categoria" value="B" />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-secondary/5 px-3 py-2">
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-xs">Nivel 104</Badge>
            <Badge variant="outline" className="text-xs">Categoria B</Badge>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="I.1 Objeto del Nombramiento">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nombramiento por tiempo determinado para cubrir necesidades operativas y administrativas del area solicitante, conforme al tabulador autorizado.
        </p>
      </SectionCard>

      <SectionCard title="I.2 Funciones Principales">
        <ReadOnlyList items={[
          "Coordinar procesos administrativos del area",
          "Supervisar personal operativo",
          "Elaborar reportes de gestion",
        ]} />
      </SectionCard>

      <SectionCard title="I.3 Responsabilidades">
        <ReadOnlyList items={[
          "Cumplimiento normativo del area",
          "Reportes trimestrales al superior",
        ]} />
      </SectionCard>

      <SectionCard title="I.4 Marco Normativo">
        <ReadOnlyList items={[
          "Ley Organica de la Administracion Publica",
          "Reglamento Interior de la Secretaria",
          "Lineamientos de Contratacion vigentes",
        ]} />
      </SectionCard>

      <SectionCard num="II" title="Perfil">
        <div className="flex flex-col gap-4">
          <ReadOnlyField label="Escolaridad Minima" value="Licenciatura" />
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Administrativas</span>
            <ReadOnlyList items={["Planeacion estrategica", "Gestion de recursos", "Coordinacion interinstitucional"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Tecnicas</span>
            <ReadOnlyList items={["Administracion publica", "Normatividad aplicable", "Gestion de proyectos"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Competencias Sociales</span>
            <ReadOnlyList items={["Liderazgo", "Trabajo en equipo", "Comunicacion efectiva"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Valores</span>
            <ReadOnlyList items={["Integridad", "Responsabilidad", "Transparencia", "Eficiencia"]} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Areas de Experiencia</span>
            <ReadOnlyList items={["Administracion publica", "Gestion de personal", "Planeacion institucional"]} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos Adjuntos" icon={<FileText className="h-4 w-4 text-secondary" />}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Oficio_Solicitud.pdf</p>
              <p className="text-xs text-muted-foreground">1.2 MB - Subido el {solicitud.fecha}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Formato_Nombramiento.pdf</p>
              <p className="text-xs text-muted-foreground">0.6 MB - Subido el {solicitud.fecha}</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Detail view ──
function DetalleView({ sol, onBack, onUpdatePeriodo }: { sol: UrgSolicitud; onBack: () => void; onUpdatePeriodo?: (id: string, periodo: string) => void }) {
  const { toast } = useToast()

  const canEdit = sol.estado === "Borrador" || sol.estado === "Devuelta por DO" || sol.estado === "Observada por UEFA"
  const isEmitido = sol.estado === "Emitido"
  const isReadOnly = !canEdit && !isEmitido

  const periodoCheck = isPeriodoVigente(sol.regimen, sol.periodoAplicacion)
  const tipoCompatible = isRegimenTipoCompatible(sol.regimen, sol.tipo)
  const canSend = periodoCheck.vigente && tipoCompatible
  const isBorradorFueraDeTiempo = sol.estado === "Borrador" && !periodoCheck.vigente

  const [editingPeriodo, setEditingPeriodo] = useState(false)
  const [newPeriodo, setNewPeriodo] = useState(sol.periodoAplicacion)

  const regimenLabel =
    sol.regimen === "honorarios" ? "Honorarios" : sol.regimen === "asimilados" ? "Asimilados" : "Nombramiento"

  const periodoOptions =
    sol.regimen === "honorarios"
      ? CAP_3000.map((r) => r.mes)
      : sol.regimen === "asimilados"
        ? CAP_1000.map((r) => r.quincena)
        : NOMBRAMIENTO_TD.map((r) => r.quincena)

  const handleDemoAction = (label: string) => {
    toast({ title: "Demo", description: `Accion "${label}" solo disponible en produccion.` })
  }

  const handleUpdatePeriodo = () => {
    if (onUpdatePeriodo && newPeriodo !== sol.periodoAplicacion) {
      onUpdatePeriodo(sol.id, newPeriodo)
      setEditingPeriodo(false)
      toast({ title: "Periodo actualizado", description: `Periodo de aplicacion cambiado a "${newPeriodo}".` })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-card-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a bandeja
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-semibold text-card-foreground">
            {sol.folioJustificacion || sol.folio}
          </span>
          {estadoBadge(sol.estado)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const enDO = sol.estado === "En proceso DO" || sol.estado === "Devuelta por DO" || sol.estado === "Emitido"
              generateJustificacionPDF({
                folio: sol.folioJustificacion || sol.folio,
                tipo: sol.tipo,
                secretaria: sol.secretaria,
                unidadAdministrativa: sol.unidadAdministrativa,
                denominacion: sol.denominacion,
                vigenciaInicio: sol.vigenciaInicio,
                vigenciaFin: sol.vigenciaFin,
                importeBruto: sol.importeBruto,
                esRenovacion: sol.esRenovacion,
                folioAnterior: sol.folioAnterior,
                fecha: sol.fecha,
                firmadoDigitalmente: enDO,
              })
            }}
          >
            <Download className="h-4 w-4" />
            Justificacion (PDF)
          </Button>
          {canEdit && (
            <>
              <Button
                size="sm"
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-1.5"
                onClick={() => handleDemoAction("Continuar captura")}
              >
                <Edit3 className="h-4 w-4" />
                Continuar Captura
              </Button>
              {sol.estado === "Borrador" && (
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                  disabled={!canSend}
                  onClick={() => handleDemoAction("Enviar a Validacion")}
                  title={!canSend ? "No se puede enviar: periodo fuera de tiempo o regimen incompatible" : ""}
                >
                  <FileCheck className="h-4 w-4" />
                  Enviar a Validacion
                </Button>
              )}
            </>
          )}
          {isEmitido && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDemoAction("Ver dictamen")}>
                <FileCheck className="h-4 w-4" />
                Ver Dictamen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDemoAction("Descargar")}>
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </>
          )}
          {isReadOnly && (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground py-1.5 px-3">
              <Lock className="h-3 w-3" />
              Solo lectura
            </Badge>
          )}
        </div>
      </div>

      {sol.observacionMotivo && sol.estado === "Observada por UEFA" && (
        <Card className="border-2 border-amber-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-amber-700">Observacion de UEFA</span>
              <p className="text-sm text-card-foreground mt-1">{sol.observacionMotivo}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {sol.observacionMotivo && sol.estado === "Devuelta por DO" && (
        <Card className="border-2 border-red-400/40 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-red-700">Motivo de devolucion DO</span>
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
                  El periodo de aplicacion <strong>{sol.periodoAplicacion}</strong> ({regimenLabel}) tiene como limite DO: <strong>{periodoCheck.limiteDO ?? "N/A"}</strong> y ya ha expirado. Actualiza el periodo de aplicacion a uno vigente para poder enviar esta solicitud.
                </p>
              </div>
            </div>
            {!editingPeriodo ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setEditingPeriodo(true)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Cambiar periodo de aplicacion
              </Button>
            ) : (
              <div className="flex items-end gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                  <span className="text-xs font-medium text-muted-foreground">Regimen: {regimenLabel}</span>
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
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={newPeriodo === sol.periodoAplicacion || !isPeriodoVigente(sol.regimen, newPeriodo).vigente}
                  onClick={handleUpdatePeriodo}
                >
                  Actualizar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingPeriodo(false); setNewPeriodo(sol.periodoAplicacion) }}>
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
              <span className="text-sm font-medium text-amber-700">Regimen incompatible con tipo de solicitud</span>
              <p className="text-sm text-card-foreground mt-1">
                El regimen <strong>{regimenLabel}</strong> no corresponde al tipo <strong>{sol.tipo}</strong>. No es posible enviar a validacion hasta corregir esta inconsistencia.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sol.estado === "Borrador" && periodoCheck.vigente && tipoCompatible && (
        <Card className="border-2 border-secondary/30 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <FileCheck className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-secondary">En tiempo para enviar</span>
              <p className="text-xs text-muted-foreground mt-1">
                Periodo: {sol.periodoAplicacion} ({regimenLabel}) - Limite DO: {periodoCheck.limiteDO}
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
                No. {sol.numeroDictamen} - Fecha: {sol.fechaDictamen}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sol.tipo === "Prestacion de Servicios" ? (
            <ExpedientePrestacion solicitud={sol} />
          ) : (
            <ExpedienteNombramiento solicitud={sol} />
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="shadow-sm border-border sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <History className="h-4 w-4 text-secondary" />
                Historial de Estatus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HistorialTimeline historial={sol.historial} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <Info className="h-4 w-4 text-secondary" />
                Bitacora de Captura
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
                          <span className="text-[10px] text-muted-foreground">{ev.fecha} - {ev.usuario}</span>
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

// ══════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════
export function MisSolicitudesPage() {
  const [data, setData] = useState<UrgSolicitud[]>(createMockData)
  const [activeTab, setActiveTab] = useState<UrgTab>("Todas")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const TABS: UrgTab[] = ["Borradores", "Enviadas a UEFA", "Observadas/Devueltas", "En proceso DO", "Emitidas", "Todas"]

  const tabCounts = useMemo(() => {
    const counts: Record<UrgTab, number> = {
      Borradores: 0,
      "Enviadas a UEFA": 0,
      "Observadas/Devueltas": 0,
      "En proceso DO": 0,
      Emitidas: 0,
      Todas: data.length,
    }
    data.forEach((s) => {
      counts[getTab(s.estado)]++
    })
    return counts
  }, [data])

  const filtered = useMemo(() => {
    let items = data
    if (activeTab !== "Todas") {
      items = items.filter((s) => getTab(s.estado) === activeTab)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      items = items.filter(
        (s) =>
          s.folio.toLowerCase().includes(term) ||
          (s.folioJustificacion && s.folioJustificacion.toLowerCase().includes(term)) ||
          (s.folioRecepcion && s.folioRecepcion.toLowerCase().includes(term)) ||
          s.tipo.toLowerCase().includes(term) ||
          s.secretaria.toLowerCase().includes(term) ||
          s.denominacion.toLowerCase().includes(term)
      )
    }
    return items
  }, [data, activeTab, searchTerm])

  const selectedSolicitud = selectedId ? data.find((s) => s.id === selectedId) ?? null : null

  // ── Determine which column layout to use ──
  // For "Todas" we mix both layouts per row, so we render per-row.
  // For specific tabs we use a consistent header.
  const showFolioJustLayout = activeTab === "Borradores" || activeTab === "Enviadas a UEFA"
  const showFolioRecLayout =
    activeTab === "Observadas/Devueltas" ||
    activeTab === "En proceso DO" ||
    activeTab === "Emitidas"
  const showMixed = activeTab === "Todas"

  // Decide per-row which layout a solicitud uses
  function rowUsesFolioJust(sol: UrgSolicitud): boolean {
    const tab = getTab(sol.estado)
    return tab === "Borradores" || tab === "Enviadas a UEFA"
  }

  // Detail view (full-screen)
  if (selectedSolicitud) {
    return (
      <PageLayout noContainer>
        <DetalleView
          sol={selectedSolicitud}
          onBack={() => setSelectedId(null)}
          onUpdatePeriodo={(id, periodo) => {
            setData((prev) =>
              prev.map((s) => (s.id === id ? { ...s, periodoAplicacion: periodo } : s))
            )
          }}
        />
      </PageLayout>
    )
  }

  // ── Table view ──
  return (
    <PageLayout
      title="Bandeja URG - Mis Solicitudes"
      description="Solicitudes capturadas por mi area, con seguimiento de validacion (UEFA) y dictaminacion (DO)."
    >

      <FilterTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as UrgTab)}
        items={TABS.map((tab) => ({ value: tab, label: tab, count: tabCounts[tab] }))}
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio, tipo, secretaria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            {filtered.length} solicitudes encontradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  {/* ── Column 1: Folio — header changes by tab ── */}
                  {showFolioJustLayout && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Folio de Justificación
                    </th>
                  )}
                  {showFolioRecLayout && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Folio de Recepción
                    </th>
                  )}
                  {showMixed && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Folio
                    </th>
                  )}

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
                  <th className="px-4 py-3 text-left font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sol) => {
                  // Determine which folio cell to render for this row
                  const useJust = showMixed ? rowUsesFolioJust(sol) : showFolioJustLayout

                  return (
                    <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      {/* ── Folio cell ── */}
                      <td className="px-4 py-3 font-medium text-card-foreground">
                        {useJust ? (
                          // Borradores / Enviadas a UEFA: show Folio Justificacion
                          sol.folioJustificacion
                            ? sol.folioJustificacion
                            : <span className="text-muted-foreground italic">{sol.folio} (borrador)</span>
                        ) : (
                          // Observadas/Devueltas / En proceso DO / Emitidas: show Folio Recepcion
                          sol.folioRecepcion
                            ? sol.folioRecepcion
                            : <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>

                      {/* Régimen de Contratación */}
                      <td className="px-4 py-3 text-muted-foreground">{sol.tipo}</td>

                      {/* Fecha de Creación */}
                      <td className="px-4 py-3 text-muted-foreground">{sol.fecha}</td>

                      {/* Fecha de Recepción — populated once approved by UEFA */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {sol.folioRecepcion
                          ? sol.historial.find((h) => h.accion.toLowerCase().includes("filtro 1"))?.fecha.split(" ")[0] ?? "—"
                          : <span className="italic text-muted-foreground/60">—</span>
                        }
                      </td>

                      {/* Estatus */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {estadoBadge(sol.estado)}
                          {sol.estado === "Observada por UEFA" && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-[10px] px-1.5">
                              UEFA
                            </Badge>
                          )}
                          {sol.estado === "Devuelta por DO" && (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0 text-[10px] px-1.5">
                              DO
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(sol.id)}
                          className="text-secondary hover:text-primary gap-1.5"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
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