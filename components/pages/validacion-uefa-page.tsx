"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Eye,
  CheckCircle2,
  RotateCcw,
  Download,
  History,
  FileText,
  Inbox,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  FileCheck,
  Info,
} from "lucide-react"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"

// ── Types ──
type UefaEstado =
  | "Enviada a Validacion (UEFA)"
  | "En revision DO Filtro 1"
  | "En revision DO Filtro 2"
  | "En revision DO Filtro 3"
  | "Observado por UEFA"
  | "Observado DO Filtro 1"
  | "Observado DO Filtro 2"
  | "Emitido"

type UefaTab = "Nuevas" | "En proceso DO" | "Observadas por UEFA" | "Devueltas por DO" | "Emitidas" | "Todas"

interface HistorialEntry {
  fecha: string
  usuario: string
  accion: string
}

interface UefaSolicitud {
  id: string
  folio: string                         // Internal ID (SOL-xxxx)
  folioJustificacion: string            // JUST-AAAA-NNNN - assigned when sent to UEFA
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Determinado"
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
}

// ── Initial mock data ──
function createInitialData(): UefaSolicitud[] {
  return [
    // ── 2 en "Nuevas" ──
    {
      id: "u1",
      folio: "SOL-2026-0045",
      folioJustificacion: "JUST-2026-0021",
      tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Administracion",
      fecha: "2026-02-10",
      estado: "Enviada a Validacion (UEFA)",
      denominacion: "Analista de Sistemas",
      unidadAdministrativa: "Dir. Gral. de Tecnologia",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-12-31",
      importeBruto: "$25,000.00",
      esRenovacion: false,
      historial: [
        { fecha: "2026-02-10 09:30", usuario: "Maria Lopez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-10 09:35", usuario: "Maria Lopez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0021" },
      ],
      observacionesUefa: "",
    },
    {
      id: "u2",
      folio: "SOL-2026-0046",
      folioJustificacion: "JUST-2026-0022",
      tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Educacion",
      fecha: "2026-02-11",
      estado: "Enviada a Validacion (UEFA)",
      denominacion: "Coordinador de Programas",
      unidadAdministrativa: "Dir. de Planeacion Educativa",
      vigenciaInicio: "2026-03-15",
      vigenciaFin: "2026-09-30",
      importeBruto: "$32,500.00",
      esRenovacion: true,
      folioAnterior: "DICT-2025-0089",
      historial: [
        { fecha: "2026-02-11 11:00", usuario: "Carlos Ruiz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-11 11:05", usuario: "Carlos Ruiz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0022" },
      ],
      observacionesUefa: "",
    },
    // ── 1 en "Observadas por UEFA" ──
    {
      id: "u3",
      folio: "SOL-2026-0032",
      folioJustificacion: "JUST-2026-0023",
      tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Obras Publicas",
      fecha: "2026-01-28",
      estado: "Observado por UEFA",
      denominacion: "Ingeniero de Proyectos",
      unidadAdministrativa: "Dir. de Infraestructura",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-12-31",
      importeBruto: "$35,000.00",
      esRenovacion: false,
      historial: [
        { fecha: "2026-01-28 09:00", usuario: "Jorge Mendez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-01-28 09:05", usuario: "Jorge Mendez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0023" },
        { fecha: "2026-01-29 10:00", usuario: "Laura Vega (UEFA)", accion: "Tomada para revision" },
        { fecha: "2026-01-30 14:00", usuario: "Laura Vega (UEFA)", accion: "Observada por UEFA - Falta suficiencia presupuestal" },
      ],
      observacionesUefa: "Se requiere adjuntar oficio de suficiencia presupuestal actualizado con partida 1211.",
    },
    // ── 1 en "En proceso DO" ──
    {
      id: "u4",
      folio: "SOL-2026-0038",
      folioJustificacion: "JUST-2026-0024",
      tipo: "Nombramiento Tiempo Determinado",
      secretaria: "Sec. de Finanzas",
      fecha: "2026-02-05",
      estado: "En revision DO Filtro 2",
      denominacion: "Auditor Interno",
      unidadAdministrativa: "Dir. de Auditoria",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-08-31",
      importeBruto: "$30,000.00",
      esRenovacion: false,
      historial: [
        { fecha: "2026-02-05 10:00", usuario: "Pedro Gomez (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-05 10:05", usuario: "Pedro Gomez (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0024" },
        { fecha: "2026-02-06 09:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-07 10:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada en Filtro 1" },
        { fecha: "2026-02-08 09:30", usuario: "Roberto Diaz (DO F2)", accion: "Recibida en Filtro 2" },
      ],
      observacionesUefa: "",
    },
    // ── 1 en "Devueltas por DO" ──
    {
      id: "u5",
      folio: "SOL-2026-0039",
      folioJustificacion: "JUST-2026-0025",
      tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Desarrollo Social",
      fecha: "2026-02-04",
      estado: "Observado DO Filtro 1",
      denominacion: "Trabajador Social",
      unidadAdministrativa: "Dir. de Programas Sociales",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-11-30",
      importeBruto: "$22,000.00",
      esRenovacion: true,
      folioAnterior: "DICT-2025-0112",
      historial: [
        { fecha: "2026-02-04 08:30", usuario: "Rosa Diaz (URG)", accion: "Solicitud creada" },
        { fecha: "2026-02-04 08:35", usuario: "Rosa Diaz (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0025" },
        { fecha: "2026-02-05 11:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-02-06 09:00", usuario: "Ana Rivera (DO F1)", accion: "Observada en Filtro 1 - Inconsistencia en datos" },
      ],
      observacionesUefa: "",
    },
    // ── 1 en "Emitidas" ──
    {
      id: "u6",
      folio: "SOL-2026-0020",
      folioJustificacion: "JUST-2026-0026",
      tipo: "Prestacion de Servicios",
      secretaria: "Sec. de Administracion",
      fecha: "2026-01-20",
      estado: "Emitido",
      denominacion: "Asesor Juridico",
      unidadAdministrativa: "Dir. Juridica",
      vigenciaInicio: "2026-02-01",
      vigenciaFin: "2026-12-31",
      importeBruto: "$40,000.00",
      esRenovacion: false,
      numeroDictamen: "DICT-2026-0015",
      fechaDictamen: "2026-02-15",
      historial: [
        { fecha: "2026-01-20 08:00", usuario: "Luis Herrera (URG)", accion: "Solicitud creada" },
        { fecha: "2026-01-20 08:05", usuario: "Luis Herrera (URG)", accion: "Enviada a validacion UEFA - Folio de Justificacion: JUST-2026-0026" },
        { fecha: "2026-01-21 09:00", usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
        { fecha: "2026-01-22 10:00", usuario: "Ana Rivera (DO F1)", accion: "Aprobada en Filtro 1" },
        { fecha: "2026-01-24 11:00", usuario: "Roberto Diaz (DO F2)", accion: "Aprobada en Filtro 2" },
        { fecha: "2026-01-28 14:00", usuario: "Dir. General (DO F3)", accion: "Aprobada en Filtro 3" },
        { fecha: "2026-02-15 09:00", usuario: "Sistema", accion: "Dictamen emitido: DICT-2026-0015" },
      ],
      observacionesUefa: "",
    },
  ]
}

// ── Tab helpers ──
function getTabForEstado(estado: UefaEstado): UefaTab {
  switch (estado) {
    case "Enviada a Validacion (UEFA)":
      return "Nuevas"
    case "En revision DO Filtro 1":
    case "En revision DO Filtro 2":
    case "En revision DO Filtro 3":
      return "En proceso DO"
    case "Observado por UEFA":
      return "Observadas por UEFA"
    case "Observado DO Filtro 1":
    case "Observado DO Filtro 2":
      return "Devueltas por DO"
    case "Emitido":
      return "Emitidas"
  }
}

// ── Estado badge ──
function UefaEstadoBadge({ estado }: { estado: UefaEstado }) {
  const variants: Record<UefaEstado, { bg: string; text: string }> = {
    "Enviada a Validacion (UEFA)": { bg: "bg-secondary/15", text: "text-secondary" },
    "En revision DO Filtro 1": { bg: "bg-accent/15", text: "text-accent-foreground" },
    "En revision DO Filtro 2": { bg: "bg-accent/15", text: "text-accent-foreground" },
    "En revision DO Filtro 3": { bg: "bg-accent/15", text: "text-accent-foreground" },
    "Observado por UEFA": { bg: "bg-destructive/15", text: "text-destructive" },
    "Observado DO Filtro 1": { bg: "bg-orange-500/15", text: "text-orange-600" },
    "Observado DO Filtro 2": { bg: "bg-orange-500/15", text: "text-orange-600" },
    "Emitido": { bg: "bg-primary/15", text: "text-primary" },
  }
  const v = variants[estado]
  return (
    <Badge className={`${v.bg} ${v.text} hover:${v.bg} border-0 text-xs whitespace-nowrap`}>
      {estado}
    </Badge>
  )
}

// ── Historial timeline ──
function UefaHistorialTimeline({ historial }: { historial: HistorialEntry[] }) {
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
              {entry.fecha} - {entry.usuario}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Collapsible section card (read-only, replicating revision-do pattern) ──
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

// ── Read-only field ──
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-card-foreground">{value}</span>
    </div>
  )
}

// ── Read-only list ──
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

// ── Full form: Prestacion de Servicios (read-only) ──
function ExpedientePrestacion({ solicitud }: { solicitud: UefaSolicitud }) {
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
function ExpedienteNombramiento({ solicitud }: { solicitud: UefaSolicitud }) {
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

// ── Observe Modal ──
function ObservarModal({
  open,
  onClose,
  onConfirm,
  folio,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (obs: string) => void
  folio: string
}) {
  const [obs, setObs] = useState("")

  const handleConfirm = () => {
    if (!obs.trim()) return
    onConfirm(obs.trim())
    setObs("")
  }

  const handleClose = () => {
    setObs("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Observar Solicitud - {folio}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Escriba las observaciones que se enviaran a la URG para correccion.
          </p>
          <Textarea
            placeholder="Describa las observaciones..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="min-h-[120px] bg-card"
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!obs.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Confirmar observacion
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Detail view (full-screen style like revision-do) ──
function DetalleView({
  solicitud,
  onBack,
  onAprobar,
  onObservar,
  currentTab,
}: {
  solicitud: UefaSolicitud
  onBack: () => void
  onAprobar: (id: string) => void
  onObservar: (id: string) => void
  currentTab: UefaTab
}) {
  const [showObservarModal, setShowObservarModal] = useState(false)
  const isNueva = solicitud.estado === "Enviada a Validacion (UEFA)"
  const isEmitida = solicitud.estado === "Emitido"
  const isDevuelta = currentTab === "Devueltas por DO"

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
          <span className="text-sm font-semibold text-card-foreground">{solicitud.folioJustificacion}</span>
          <UefaEstadoBadge estado={solicitud.estado} />
        </div>
        <div className="flex items-center gap-2">
          {/* Descargar Justificacion PDF — always available */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const enDO = solicitud.estado.includes("DO") || solicitud.estado === "Emitido"
              generateJustificacionPDF({
                folio: solicitud.folioJustificacion,
                tipo: solicitud.tipo,
                secretaria: solicitud.secretaria,
                unidadAdministrativa: solicitud.unidadAdministrativa,
                denominacion: solicitud.denominacion,
                vigenciaInicio: solicitud.vigenciaInicio,
                vigenciaFin: solicitud.vigenciaFin,
                importeBruto: solicitud.importeBruto,
                esRenovacion: solicitud.esRenovacion,
                folioAnterior: solicitud.folioAnterior,
                fecha: solicitud.fecha,
                firmadoDigitalmente: enDO,
              })
            }}
          >
            <Download className="h-4 w-4" />
            Justificacion (PDF)
          </Button>
          {isNueva && (
            <>
              <Button
                onClick={() => onAprobar(solicitud.id)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowObservarModal(true)}
                className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <RotateCcw className="h-4 w-4" />
                Observar
              </Button>
            </>
          )}
          {isEmitida && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileCheck className="h-4 w-4" />
                Ver Dictamen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Devuelta por DO banner */}
      {isDevuelta && (
        <Card className="border-2 border-orange-500/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <span className="text-sm font-medium text-orange-600">Devuelta por DO</span>
              <p className="text-xs text-muted-foreground">
                Esta solicitud fue aprobada por UEFA pero fue observada/devuelta por DO. Se encuentra pendiente de correccion por la URG.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observaciones UEFA previas */}
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

      {/* Emitida info */}
      {isEmitida && solicitud.numeroDictamen && (
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <FileCheck className="h-5 w-5 text-primary" />
            <div>
              <span className="text-sm font-medium text-primary">Dictamen Emitido</span>
              <p className="text-xs text-muted-foreground">
                No. {solicitud.numeroDictamen} - Fecha: {solicitud.fechaDictamen}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout: form left, historial right */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Full form (2/3) */}
        <div className="lg:col-span-2">
          {solicitud.tipo === "Prestacion de Servicios" ? (
            <ExpedientePrestacion solicitud={solicitud} />
          ) : (
            <ExpedienteNombramiento solicitud={solicitud} />
          )}
        </div>

        {/* Right: Historial (1/3) */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <History className="h-4 w-4 text-secondary" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UefaHistorialTimeline historial={solicitud.historial} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Observar modal */}
      <ObservarModal
        open={showObservarModal}
        onClose={() => setShowObservarModal(false)}
        onConfirm={(obs) => {
          setShowObservarModal(false)
          onObservar(solicitud.id)
          // The parent handles the actual state change via onObservar; 
          // we pass obs up through the parent's callback
        }}
        folio={solicitud.folioJustificacion}
      />
    </div>
  )
}

// ══════════════════════════════���═══════
// MAIN PAGE
// ══════════════════════════════════════
export function ValidacionUefaPage() {
  const [solicitudes, setSolicitudes] = useState<UefaSolicitud[]>(createInitialData)
  const [activeTab, setActiveTab] = useState<UefaTab>("Nuevas")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [observarTargetId, setObservarTargetId] = useState<string | null>(null)

  // Tab counts
  const tabDefs: { key: UefaTab; label: string }[] = [
    { key: "Nuevas", label: "Nuevas" },
    { key: "En proceso DO", label: "En proceso DO" },
    { key: "Observadas por UEFA", label: "Observadas por UEFA" },
    { key: "Devueltas por DO", label: "Devueltas por DO" },
    { key: "Emitidas", label: "Emitidas" },
    { key: "Todas", label: "Todas" },
  ]

  const tabCounts = useMemo(() => {
    const counts: Record<UefaTab, number> = {
      "Nuevas": 0,
      "En proceso DO": 0,
      "Observadas por UEFA": 0,
      "Devueltas por DO": 0,
      "Emitidas": 0,
      "Todas": solicitudes.length,
    }
    for (const s of solicitudes) {
      const t = getTabForEstado(s.estado)
      counts[t]++
    }
    return counts
  }, [solicitudes])

  const filtered = useMemo(() => {
    if (activeTab === "Todas") return solicitudes
    return solicitudes.filter((s) => getTabForEstado(s.estado) === activeTab)
  }, [solicitudes, activeTab])

  const selectedSolicitud = selectedId ? solicitudes.find((s) => s.id === selectedId) ?? null : null

  // ── Actions ──
  const now = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const handleAprobar = (id: string) => {
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              estado: "En revision DO Filtro 1" as UefaEstado,
              historial: [
                ...s.historial,
                { fecha: now(), usuario: "Laura Vega (UEFA)", accion: "Aprobada por UEFA" },
              ],
            }
          : s
      )
    )
    setSelectedId(null)
  }

  const handleObservarFromTable = (id: string) => {
    setObservarTargetId(id)
  }

  const handleObservarConfirm = (obs: string) => {
    if (!observarTargetId) return
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === observarTargetId
          ? {
              ...s,
              estado: "Observado por UEFA" as UefaEstado,
              observacionesUefa: obs,
              historial: [
                ...s.historial,
                { fecha: now(), usuario: "Laura Vega (UEFA)", accion: `Observada por UEFA - ${obs.substring(0, 60)}${obs.length > 60 ? "..." : ""}` },
              ],
            }
          : s
      )
    )
    setObservarTargetId(null)
    setSelectedId(null)
  }

  const handleObservarFromDetail = (id: string) => {
    setObservarTargetId(id)
  }

  // ── If viewing detail ──
  if (selectedSolicitud) {
    return (
      <div className="flex flex-col gap-6">
        <DetalleView
          solicitud={selectedSolicitud}
          onBack={() => setSelectedId(null)}
          onAprobar={handleAprobar}
          onObservar={handleObservarFromDetail}
          currentTab={activeTab}
        />
        {/* Observar modal from detail is handled inside DetalleView;
            but table-level observar modal also here for completeness */}
        <ObservarModal
          open={!!observarTargetId}
          onClose={() => setObservarTargetId(null)}
          onConfirm={handleObservarConfirm}
          folio={solicitudes.find((s) => s.id === observarTargetId)?.folioJustificacion ?? ""}
        />
      </div>
    )
  }

  // ── Table view ──
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Bandeja de Validacion UEFA</h2>
        <p className="text-sm text-muted-foreground">
          Solicitudes enviadas por las URG para validacion y seguimiento
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {tabDefs.map((tab) => (
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
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Inbox className="h-4 w-4 text-secondary" />
            {filtered.length} solicitud{filtered.length !== 1 ? "es" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Folio de Justificacion</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Secretaria</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado actual</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sol) => {
                  const tab = getTabForEstado(sol.estado)
                  return (
                    <tr key={sol.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-card-foreground">{sol.folioJustificacion}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sol.tipo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sol.secretaria}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sol.fecha}</td>
                      <td className="px-4 py-3">
                        <UefaEstadoBadge estado={sol.estado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId(sol.id)}
                            className="text-secondary hover:text-primary gap-1.5"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                          {tab === "Nuevas" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAprobar(sol.id)}
                                className="text-primary hover:text-primary/80 gap-1.5"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Aprobar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleObservarFromTable(sol.id)}
                                className="text-destructive hover:text-destructive/80 gap-1.5"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Observar
                              </Button>
                            </>
                          )}
                          {tab === "Emitidas" && (
                            <>
                              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-card-foreground">
                                <FileCheck className="h-4 w-4" />
                                Ver Dictamen
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-card-foreground">
                                <Download className="h-4 w-4" />
                                Descargar
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
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No hay solicitudes en esta categoria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Observar modal (from table action) */}
      <ObservarModal
        open={!!observarTargetId}
        onClose={() => setObservarTargetId(null)}
        onConfirm={handleObservarConfirm}
        folio={solicitudes.find((s) => s.id === observarTargetId)?.folioJustificacion ?? ""}
      />
    </div>
  )
}
