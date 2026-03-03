"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  History,
  MessageSquare,
  ClipboardCheck,
  Eye,
  Info,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  Send,
  Download,
  Upload,
  Lock,
  Stamp,
  Users,
  Printer,
  Shield,
  X,
} from "lucide-react"
import {
  useSolicitudes,
  getSlaColor,
  getSlaBackground,
  getSlaLabel,
  getEstadoVariant,
  getChecklistItems,
  type Estado,
  type ChecklistValor,
  type Solicitud,
} from "@/lib/solicitudes-store"
import { useAuth } from "@/lib/auth-context"
import { generateJustificacionPDF } from "@/lib/generate-justificacion-pdf"

interface RevisionDOPageProps {
  solicitudId: string
  filtro: 1 | 2 | 3
  onBack: (filtro: 1 | 2 | 3) => void
}

// ── SLA indicator ──
function SlaIndicatorLarge({ diasRestantes }: { diasRestantes: number | null }) {
  const color = getSlaColor(diasRestantes)
  const bg = getSlaBackground(diasRestantes)
  const label = getSlaLabel(diasRestantes)

  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 ${bg}`}>
      <Clock className={`h-5 w-5 ${color}`} />
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
        <span className="text-[10px] text-muted-foreground">SLA (15 dias habiles)</span>
      </div>
    </div>
  )
}

// ── Historial timeline ──
function HistorialTimeline({ historial }: { historial: { fecha: string; usuario: string; accion: string; estadoAnterior: Estado | null; estadoNuevo: Estado; visibilidadDO?: boolean }[] }) {
  return (
    <div className="flex flex-col gap-0">
      {historial.map((entry, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-card">
              <div className="h-2 w-2 rounded-full bg-secondary" />
            </div>
            {index < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex flex-col gap-0.5 pb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-card-foreground">{entry.accion}</span>
              {entry.visibilidadDO && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">
                  Solo DO
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {entry.fecha} - {entry.usuario}
            </span>
            {entry.estadoAnterior && (
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.estadoAnterior}</Badge>
                <span className="text-[10px] text-muted-foreground">{"→"}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.estadoNuevo}</Badge>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Radio option for checklist tri-state ──
function RadioOption({
  value,
  selected,
  onChange,
  label,
  colorClass,
}: {
  value: ChecklistValor
  selected: boolean
  onChange: () => void
  label: string
  colorClass: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
        selected
          ? `${colorClass} border-current`
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-card-foreground"
      }`}
    >
      {value === "si" && <CheckCircle2 className="h-3.5 w-3.5" />}
      {value === "no" && <XCircle className="h-3.5 w-3.5" />}
      {value === "noAplica" && <MinusCircle className="h-3.5 w-3.5" />}
      {label}
    </button>
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

// ── Read-only table for condiciones ──
function CondicionesTable({ rows }: { rows: { label: string; valor: string }[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-card-foreground">Condicion</th>
            <th className="px-4 py-2 text-center font-medium text-card-foreground">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="px-4 py-2 text-card-foreground">{row.label}</td>
              <td className="px-4 py-2 text-center text-muted-foreground">{row.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Read-only table for riesgos ──
function RiesgosTable({ rows }: { rows: { label: string; nivel: string }[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-card-foreground">Riesgo</th>
            <th className="px-4 py-2 text-center font-medium text-card-foreground">Nivel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="px-4 py-2 text-card-foreground">{row.label}</td>
              <td className="px-4 py-2 text-center">
                <Badge variant="outline" className="text-[10px]">{row.nivel}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Collapsible section card ��─
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
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}

// ══════════════════════════════════════════════════
// EXPEDIENTE VIEWS (LEFT)
// ══════════════════════════════════════════════════

// Prestacion de Servicios - complete read-only expediente
function ExpedientePrestacion({ solicitud }: { solicitud: Solicitud }) {
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
              <p className="text-xs text-muted-foreground">1.2 MB - Subido el {solicitud.fechaCreacion}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Oficio_Suficiencia_Presupuestal.pdf</p>
              <p className="text-xs text-muted-foreground">0.8 MB - Subido el {solicitud.fechaCreacion}</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// Nombramiento por Tiempo Determinado
function ExpedienteNombramiento({ solicitud }: { solicitud: Solicitud }) {
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

      <SectionCard title="I.5 Condiciones y Riesgos">
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Disponibilidad</span>
            <CondicionesTable rows={[
              { label: "Cambio de domicilio", valor: "No" },
              { label: "Horario especial", valor: "No" },
              { label: "Viajar", valor: "Si" },
            ]} />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">Tabla de Riesgos</span>
            <RiesgosTable rows={[
              { label: "Lesiones", nivel: "Bajo" },
              { label: "Caidas", nivel: "Bajo" },
              { label: "Mutilaciones", nivel: "Bajo" },
              { label: "Golpes", nivel: "Bajo" },
              { label: "Otros", nivel: "Bajo" },
            ]} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="I.6 Resguardo Personalizado de Activos">
        <ReadOnlyField label="Resguardo Personalizado" value="No" />
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
              <p className="text-xs text-muted-foreground">1.5 MB - Subido el {solicitud.fechaCreacion}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <FileText className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Oficio_Suficiencia_Presupuestal.pdf</p>
              <p className="text-xs text-muted-foreground">0.9 MB - Subido el {solicitud.fechaCreacion}</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ══════════════════════════════════════════════════
// DICTAMEN PREVIEW MODAL
// ══════════════════════════════════════════════════
function DictamenPreviewModal({
  solicitud,
  numeroDictamenPreview,
  fechaDictaminacion,
  destinatarios,
  modalidadFirma,
  onClose,
}: {
  solicitud: Solicitud
  numeroDictamenPreview: string
  fechaDictaminacion: string
  destinatarios: string[]
  modalidadFirma?: "electronica" | "autografa"
  onClose: () => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const titulo = solicitud.tipoAdministracion === "centralizada"
    ? "DICTAMEN TECNICO FUNCIONAL"
    : "OPINION TECNICA FUNCIONAL"

  const handlePrint = () => {
    const content = previewRef.current
    if (!content) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${titulo} - ${numeroDictamenPreview}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; font-size: 14pt; margin-bottom: 4px; letter-spacing: 1px; }
          h2 { font-size: 12pt; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          h3 { font-size: 11pt; margin-top: 16px; }
          .header { text-align: center; border-bottom: 2px solid #283c2a; padding-bottom: 16px; margin-bottom: 20px; }
          .header p { margin: 2px 0; font-size: 9pt; color: #555; }
          .meta { display: flex; gap: 40px; margin-bottom: 20px; }
          .meta-item { }
          .meta-label { font-size: 9pt; color: #666; }
          .meta-value { font-size: 10pt; font-weight: 600; }
          .section { margin-bottom: 16px; }
          .field { margin-bottom: 8px; }
          .field-label { font-size: 9pt; color: #666; }
          .field-value { font-size: 10pt; }
          ul { padding-left: 20px; }
          li { margin-bottom: 4px; }
          .firmas { display: flex; justify-content: space-between; margin-top: 60px; }
          .firma-block { text-align: center; width: 200px; }
          .firma-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 4px; }
          .firma-role { font-size: 9pt; color: #666; }
          .sello { text-align: center; margin-top: 30px; padding: 12px; border: 2px solid #283c2a; color: #283c2a; font-weight: bold; letter-spacing: 3px; font-size: 14pt; }
          .sello-autografa { text-align: center; margin-top: 30px; padding: 10px; border: 1px dashed #888; color: #888; font-size: 10pt; }
          .destinatarios { margin-top: 16px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 500)
  }

  // Build firma names from historial
  const revisoEntry = solicitud.historial.find(h => h.accion.includes("Aprobada en Filtro 1"))
  const validoEntry = solicitud.historial.find(h => h.accion.includes("Aprobada en Filtro 2"))
  const emisionEntry = solicitud.emisionData

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
          <div>
            <CardTitle className="text-base font-semibold text-card-foreground">Vista Previa del {titulo}</CardTitle>
            <CardDescription>Numero: {numeroDictamenPreview}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div ref={previewRef} className="bg-card rounded-lg p-8 border border-border">
            {/* Header Institucional */}
            <div className="header" style={{ textAlign: "center", borderBottom: "2px solid #283c2a", paddingBottom: "16px", marginBottom: "20px" }}>
              <p style={{ fontSize: "10pt", color: "#555", margin: "2px 0" }}>GOBIERNO DEL ESTADO</p>
              <p style={{ fontSize: "10pt", color: "#555", margin: "2px 0" }}>SECRETARIA DE ADMINISTRACION</p>
              <p style={{ fontSize: "10pt", color: "#555", margin: "2px 0" }}>DIRECCION DE ORGANIZACION</p>
              <h1 style={{ fontSize: "14pt", margin: "12px 0 4px", letterSpacing: "1px" }}>{titulo}</h1>
            </div>

            {/* Meta */}
            <div style={{ display: "flex", gap: "30px", marginBottom: "20px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "9pt", color: "#666" }}>Folio Recepcion</div>
                <div style={{ fontSize: "11pt", fontWeight: 600 }}>{solicitud.folioRecepcion}</div>
              </div>
              <div>
                <div style={{ fontSize: "9pt", color: "#666" }}>Numero de {solicitud.tipoAdministracion === "centralizada" ? "Dictamen" : "Opinion"}</div>
                <div style={{ fontSize: "11pt", fontWeight: 600 }}>{numeroDictamenPreview}</div>
              </div>
              <div>
                <div style={{ fontSize: "9pt", color: "#666" }}>Fecha de Dictaminacion</div>
                <div style={{ fontSize: "11pt", fontWeight: 600 }}>{fechaDictaminacion}</div>
              </div>
              <div>
                <div style={{ fontSize: "9pt", color: "#666" }}>Tipo de Solicitud</div>
                <div style={{ fontSize: "11pt", fontWeight: 600 }}>{solicitud.tipo}</div>
              </div>
            </div>

            {/* Destinatarios */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Destinatarios</h2>
              <ul style={{ paddingLeft: "20px" }}>
                {destinatarios.map((d, i) => (
                  <li key={i} style={{ marginBottom: "4px" }}>{d}</li>
                ))}
              </ul>
            </div>

            {/* Datos del Solicitante */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Datos del Solicitante</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                <div><span style={{ fontSize: "9pt", color: "#666" }}>Secretaria: </span><span>{solicitud.secretaria}</span></div>
                <div><span style={{ fontSize: "9pt", color: "#666" }}>Unidad Administrativa: </span><span>{solicitud.unidadAdministrativa}</span></div>
                <div><span style={{ fontSize: "9pt", color: "#666" }}>Denominacion: </span><span>{solicitud.denominacion}</span></div>
                <div><span style={{ fontSize: "9pt", color: "#666" }}>Importe: </span><span>{solicitud.importeBruto}</span></div>
              </div>
            </div>

            {/* Vigencia */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Vigencia</h2>
              <p>Del {solicitud.vigenciaInicio} al {solicitud.vigenciaFin}</p>
            </div>

            {/* Objeto */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Objeto</h2>
              <p>{solicitud.tipo === "Prestacion de Servicios"
                ? "Prestacion de servicios profesionales para el desarrollo, implementacion y seguimiento de actividades especializadas en el marco del programa institucional correspondiente."
                : "Nombramiento por tiempo determinado para cubrir necesidades operativas y administrativas del area solicitante, conforme al tabulador autorizado."}</p>
            </div>

            {/* Actividades / Funciones */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
                {solicitud.tipo === "Prestacion de Servicios" ? "Actividades a Realizar" : "Funciones Principales"}
              </h2>
              <ul style={{ paddingLeft: "20px" }}>
                {(solicitud.tipo === "Prestacion de Servicios"
                  ? ["Coordinar y ejecutar actividades del programa", "Elaborar informes periodicos de avance", "Supervisar el cumplimiento de metas"]
                  : ["Coordinar procesos administrativos del area", "Supervisar personal operativo", "Elaborar reportes de gestion"]
                ).map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>

            {/* Responsabilidades */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Responsabilidades</h2>
              <ul style={{ paddingLeft: "20px" }}>
                <li>Cumplir con los plazos establecidos</li>
                <li>Reportar avances al superior jerarquico</li>
              </ul>
            </div>

            {/* Perfil */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Perfil Requerido</h2>
              <p><strong>Escolaridad Minima:</strong> Licenciatura</p>
            </div>

            {/* Tabulador (if tiempo determinado) */}
            {solicitud.tipo === "Nombramiento Tiempo Det." && (
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Tabulador</h2>
                <p><strong>Nivel:</strong> 104 | <strong>Categoria:</strong> B</p>
              </div>
            )}

            {/* Marco Normativo (if nombramiento) */}
            {solicitud.tipo === "Nombramiento Tiempo Det." && (
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>Marco Normativo</h2>
                <ul style={{ paddingLeft: "20px" }}>
                  <li>Ley Organica de la Administracion Publica</li>
                  <li>Reglamento Interior de la Secretaria</li>
                  <li>Lineamientos de Contratacion vigentes</li>
                </ul>
              </div>
            )}

            {/* Firmas */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px" }}>
              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ borderTop: "1px solid #333", marginTop: "60px", paddingTop: "4px" }}>
                  <p style={{ fontWeight: 600, fontSize: "10pt" }}>{revisoEntry?.usuario || "Revisor Filtro 1"}</p>
                  <p style={{ fontSize: "9pt", color: "#666" }}>Reviso</p>
                </div>
              </div>
              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ borderTop: "1px solid #333", marginTop: "60px", paddingTop: "4px" }}>
                  <p style={{ fontWeight: 600, fontSize: "10pt" }}>{validoEntry?.usuario || "Revisor Filtro 2"}</p>
                  <p style={{ fontSize: "9pt", color: "#666" }}>Valido</p>
                </div>
              </div>
              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ borderTop: "1px solid #333", marginTop: "60px", paddingTop: "4px" }}>
                  <p style={{ fontWeight: 600, fontSize: "10pt" }}>{emisionEntry?.firmadoPor.emitio || "Director General"}</p>
                  <p style={{ fontSize: "9pt", color: "#666" }}>Emitio</p>
                </div>
              </div>
            </div>

            {/* Sello DICTAMINADO - only for electronica */}
            {(!modalidadFirma || modalidadFirma === "electronica") && (
              <div style={{ textAlign: "center", marginTop: "30px", padding: "12px", border: "2px solid #283c2a", color: "#283c2a", fontWeight: "bold", letterSpacing: "3px", fontSize: "14pt" }}>
                DICTAMINADO
              </div>
            )}
            {modalidadFirma === "autografa" && (
              <div style={{ textAlign: "center", marginTop: "30px", padding: "10px", border: "1px dashed #888", color: "#888", fontSize: "10pt" }}>
                Documento con firma autografa - El PDF escaneado firmado es el documento oficial
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════
// EMISSION TAB PANEL (Filtro 3 only)
// ══════════════════════════════════════════════════
const AVAILABLE_DESTINATARIOS = [
  "URG-01 Oficina del Secretario",
  "URG-02 Direccion General",
  "URG-03 Coordinacion Administrativa",
  "UEFA Sec. de Finanzas",
  "UEFA Sec. de Educacion",
  "UEFA Sec. de Salud",
  "UEFA Sec. de Gobierno",
  "UEFA Sec. de Obras",
  "UEFA Sec. de Desarrollo",
  "Dir. Gral. de Administracion y Finanzas",
  "Dir. Gral. de Profesionalizacion",
  "Dir. Gral. de Recursos Humanos",
]

function EmisionPanel({
  solicitud,
  onEmitir,
  onPreview,
}: {
  solicitud: Solicitud
  onEmitir: (fechaDictaminacion: string, modalidadFirma: "electronica" | "autografa", destinatarios: string[], archivoFirmado?: string) => void
  onPreview: (fechaDictaminacion: string, destinatarios: string[], modalidad?: "electronica" | "autografa") => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [fechaDictaminacion, setFechaDictaminacion] = useState(today)
  const [modalidadFirma, setModalidadFirma] = useState<"electronica" | "autografa">("electronica")
  const [selectedDestinatarios, setSelectedDestinatarios] = useState<string[]>(() => {
    // Preload URG solicitante + UEFA if not excepcion
    if (!solicitud.esExcepcionDO) {
      const urgDefault = "URG-01 Oficina del Secretario"
      const uefaMatch = AVAILABLE_DESTINATARIOS.find(d => d.includes(solicitud.secretaria.replace("Sec. de ", "")))
      return [urgDefault, ...(uefaMatch ? [uefaMatch] : [])]
    }
    return []
  })
  const [archivoSubido, setArchivoSubido] = useState(false)
  const [autografaDescargado, setAutografaDescargado] = useState(false)

  const titulo = solicitud.tipoAdministracion === "centralizada"
    ? "DICTAMEN TECNICO FUNCIONAL"
    : "OPINION TECNICA FUNCIONAL"

  const canEmit = selectedDestinatarios.length > 0 &&
    fechaDictaminacion &&
    (modalidadFirma === "electronica" || (autografaDescargado && archivoSubido))

  const toggleDestinatario = (d: string) => {
    setSelectedDestinatarios(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title badge */}
      <Card className="shadow-sm border-primary/30 border-2 bg-primary/[0.03]">
        <CardContent className="flex items-center gap-3 p-4">
          <Stamp className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold text-card-foreground">{titulo}</p>
            <p className="text-xs text-muted-foreground">
              {solicitud.tipoAdministracion === "centralizada" ? "Administracion Centralizada" : "Administracion Paraestatal"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pre-assigned folio de dictamen */}
      {solicitud.folioDictamen && (
        <Card className="shadow-sm border-secondary/30 bg-secondary/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <Stamp className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Folio de dictamen (asignado en Filtro 2)</p>
              <p className="text-base font-bold text-card-foreground">{solicitud.folioDictamen}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fecha de dictaminacion */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">Fecha de Dictaminacion</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={fechaDictaminacion}
            onChange={(e) => setFechaDictaminacion(e.target.value)}
            className="bg-background w-48"
          />
          <p className="text-xs text-muted-foreground mt-1">Obligatorio. Por defecto: hoy</p>
        </CardContent>
      </Card>

      {/* Modalidad de firma */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">Modalidad de Firma</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={modalidadFirma}
            onValueChange={(v) => {
              setModalidadFirma(v as "electronica" | "autografa")
              if (v === "electronica") {
                setAutografaDescargado(false)
                setArchivoSubido(false)
              }
            }}
            className="flex flex-col gap-3"
          >
            <label
              htmlFor="firma-electronica"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                modalidadFirma === "electronica" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"
              }`}
            >
              <RadioGroupItem value="electronica" id="firma-electronica" className="mt-0.5" />
              <div>
                <span className="text-sm font-medium text-card-foreground">Firma Electronica</span>
                <p className="text-xs text-muted-foreground">Se firmara digitalmente al emitir</p>
              </div>
            </label>
            <label
              htmlFor="firma-autografa"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                modalidadFirma === "autografa" ? "border-secondary bg-secondary/5" : "border-border hover:border-secondary/50"
              }`}
            >
              <RadioGroupItem value="autografa" id="firma-autografa" className="mt-0.5" />
              <div>
                <span className="text-sm font-medium text-card-foreground">Firma Autografa</span>
                <p className="text-xs text-muted-foreground">Descargue, firme y suba el documento</p>
              </div>
            </label>
          </RadioGroup>

          {/* 2-step autografa workflow */}
          {modalidadFirma === "autografa" && (
            <div className="mt-4 flex flex-col gap-4">
              {/* Step 1: Download for signing */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    autografaDescargado ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                  }`}>1</span>
                  Descargar formato para firma autografa
                </Label>
                <div className={`flex items-center gap-3 rounded-lg border p-3 ${
                  autografaDescargado ? "border-secondary/40 bg-secondary/5" : "border-border"
                }`}>
                  <FileText className={`h-6 w-6 ${autografaDescargado ? "text-secondary" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">{titulo.replace(/\s+/g, "_")}.pdf</p>
                    <p className="text-xs text-muted-foreground">
                      {autografaDescargado ? "Formato descargado" : "Descargue el formato, imprima, firme y digitalice"}
                    </p>
                  </div>
                  {autografaDescargado ? (
                    <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => {
                        setAutografaDescargado(true)
                        // Simulate download using print preview
                        onPreview(fechaDictaminacion, selectedDestinatarios)
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar para firma
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 2: Upload scanned signed PDF */}
              <div className="flex flex-col gap-2">
                <Label className={`text-sm font-medium flex items-center gap-2 ${
                  !autografaDescargado ? "opacity-50" : ""
                }`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    archivoSubido ? "bg-secondary text-secondary-foreground" : autografaDescargado ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>2</span>
                  Subir documento firmado escaneado
                </Label>
                {archivoSubido ? (
                  <div className="flex items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/5 p-3">
                    <FileText className="h-6 w-6 text-secondary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-card-foreground">Dictamen_firmado.pdf</p>
                      <p className="text-xs text-muted-foreground">PDF escaneado con firma autografa</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-card-foreground"
                        onClick={() => setArchivoSubido(false)}
                      >
                        Quitar archivo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-card-foreground"
                        onClick={() => {
                          setArchivoSubido(false)
                          setTimeout(() => setArchivoSubido(true), 100)
                        }}
                      >
                        Reemplazar archivo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
                      autografaDescargado
                        ? "border-border bg-background hover:border-secondary cursor-pointer"
                        : "border-muted bg-muted/30 cursor-not-allowed opacity-50"
                    }`}
                    onClick={() => {
                      if (autografaDescargado) setArchivoSubido(true)
                    }}
                  >
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs font-medium text-card-foreground">
                        {autografaDescargado ? "Click para simular carga del PDF firmado" : "Primero descargue el formato"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">PDF escaneado con firma autografa (obligatorio)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status summary */}
              {!autografaDescargado && (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                  <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Primero debe descargar el formato para firma. Despues podra subir el documento escaneado firmado.
                  </p>
                </div>
              )}
              {autografaDescargado && !archivoSubido && (
                <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3">
                  <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Formato descargado. Ahora suba el PDF escaneado con la firma autografa para poder emitir.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Destinatarios */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Users className="h-4 w-4 text-secondary" />
            Destinatarios
            <Badge variant="outline" className="text-[10px] ml-1">{selectedDestinatarios.length} seleccionados</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Seleccione al menos un destinatario. Obligatorio para emitir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {AVAILABLE_DESTINATARIOS.map((d) => (
              <label key={d} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={selectedDestinatarios.includes(d)}
                  onCheckedChange={() => toggleDestinatario(d)}
                />
                <span className="text-sm text-card-foreground">{d}</span>
              </label>
            ))}
          </div>
          {selectedDestinatarios.length === 0 && (
            <p className="text-xs text-destructive mt-2 font-medium">Debe seleccionar al menos un destinatario</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="shadow-sm border-border sticky bottom-0">
        <CardContent className="flex items-center justify-between p-4">
          <Button
            variant="outline"
            onClick={() => onPreview(fechaDictaminacion, selectedDestinatarios, modalidadFirma)}
            disabled={selectedDestinatarios.length === 0}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            Vista Previa
          </Button>
          <Button
            onClick={() => onEmitir(fechaDictaminacion, modalidadFirma, selectedDestinatarios, archivoSubido ? "Dictamen_firmado.pdf" : undefined)}
            disabled={!canEmit}
            className={`gap-1.5 ${
              canEmit
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Send className="h-4 w-4" />
            Emitir {solicitud.tipoAdministracion === "centralizada" ? "Dictamen" : "Opinion"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════
// POST-EMISSION LOCKED VIEW
// ══════════════════════════════════════════════════
function EmitidoLockedView({
  solicitud,
  onViewDictamen,
}: {
  solicitud: Solicitud
  onViewDictamen: () => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const titulo = solicitud.tipoAdministracion === "centralizada"
    ? "DICTAMEN TECNICO FUNCIONAL"
    : "OPINION TECNICA FUNCIONAL"

  const handleDownload = () => {
    if (!solicitud.emisionData) return
    const ed = solicitud.emisionData

    // For autografa, simulate downloading the uploaded scanned PDF
    if (ed.modalidadFirma === "autografa" && ed.archivoFirmado) {
      const alertMsg = `Descargando: ${ed.archivoFirmado}\n\n(En produccion, este boton descargaria el PDF escaneado con firma autografa que fue subido al emitir.)`
      window.alert(alertMsg)
      return
    }

    // For electronica, generate the digitally sealed document
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${titulo}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{text-align:center;font-size:16pt}
      .sello{text-align:center;margin-top:30px;padding:12px;border:2px solid #283c2a;color:#283c2a;font-weight:bold;letter-spacing:3px;font-size:14pt}</style>
      </head><body>
      <div style="text-align:center;border-bottom:2px solid #283c2a;padding-bottom:16px;margin-bottom:20px">
        <p>GOBIERNO DEL ESTADO</p><p>SECRETARIA DE ADMINISTRACION</p><p>DIRECCION DE ORGANIZACION</p>
        <h1>${titulo}</h1>
      </div>
      <p><strong>Numero:</strong> ${ed.numeroDictamen}</p>
      <p><strong>Folio Recepcion:</strong> ${solicitud.folioRecepcion}</p>
      <p><strong>Fecha:</strong> ${ed.fechaDictaminacion}</p>
      <p><strong>Modalidad:</strong> Firma Electronica</p>
      <p><strong>Destinatarios:</strong> ${ed.destinatarios.join(", ")}</p>
      <hr/>
      <p><strong>Secretaria:</strong> ${solicitud.secretaria}</p>
      <p><strong>Denominacion:</strong> ${solicitud.denominacion}</p>
      <p><strong>Vigencia:</strong> ${solicitud.vigenciaInicio} - ${solicitud.vigenciaFin}</p>
      <p><strong>Importe:</strong> ${solicitud.importeBruto}</p>
      <div class="sello">DICTAMINADO</div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  if (!solicitud.emisionData) return null
  const ed = solicitud.emisionData

  return (
    <div className="flex flex-col gap-4">
      {/* Locked banner */}
      <Card className="shadow-sm border-primary border-2 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Lock className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold text-card-foreground">Expediente Bloqueado Post-Emision</p>
            <p className="text-xs text-muted-foreground">
              Este expediente fue emitido y no puede ser editado, revisado ni observado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Emission details */}
      <Card className="shadow-sm border-secondary/30 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Stamp className="h-4 w-4 text-secondary" />
            {titulo}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <ReadOnlyField label="Numero de Dictamen" value={ed.numeroDictamen} />
            <ReadOnlyField label="Fecha de Dictaminacion" value={ed.fechaDictaminacion} />
            <ReadOnlyField label="Modalidad de Firma" value={ed.modalidadFirma === "electronica" ? "Firma Electronica" : "Firma Autografa"} />
            <ReadOnlyField label="Fecha de Emision" value={ed.fechaEmision} />
          </div>

          <Separator />

          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Destinatarios</span>
            <div className="flex flex-wrap gap-1.5">
              {ed.destinatarios.map((d, i) => (
                <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Firmas</span>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Reviso</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.reviso}</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Valido</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.valido}</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
                <span className="text-[10px] text-muted-foreground">Emitio</span>
                <span className="text-xs font-medium text-card-foreground">{ed.firmadoPor.emitio}</span>
              </div>
            </div>
          </div>

          {ed.archivoFirmado && (
            <>
              <Separator />
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <FileText className="h-6 w-6 text-secondary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-card-foreground">{ed.archivoFirmado}</p>
                  <p className="text-xs text-muted-foreground">Documento firmado cargado</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions (only view/download) */}
      <Card className="shadow-sm border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <Button variant="outline" onClick={onViewDictamen} className="gap-1.5">
            <Eye className="h-4 w-4" />
            Ver Dictamen
          </Button>
          <Button variant="outline" onClick={handleDownload} className="gap-1.5">
            <Download className="h-4 w-4" />
            {ed.modalidadFirma === "autografa" ? "Descargar PDF Firmado" : "Descargar Dictamen"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════

export function RevisionDOPage({ solicitudId, filtro, onBack }: RevisionDOPageProps) {
  const { solicitudes, getSolicitud, updateChecklist, observarSolicitud, aprobarFiltro, markOpenedInFiltro, emitirDictamen, oficializarFolio, asignarFolioDictamen, getNextDictamenConsecutivo } = useSolicitudes()
  const { user } = useAuth()
  const solicitud = getSolicitud(solicitudId)

  // Mark as opened in this filtro on mount
  useEffect(() => {
    markOpenedInFiltro(solicitudId, filtro)
  }, [solicitudId, filtro, markOpenedInFiltro])

  const [observacionGeneral, setObservacionGeneral] = useState("")
  const [sinObservacion, setSinObservacion] = useState(false)
  const [observacionError, setObservacionError] = useState("")
  const [showEmitConfirm, setShowEmitConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<"review" | "emision" | "historial">(
    solicitud?.estado === "Aprobado" && filtro === 3 ? "emision" : "review"
  )
  const [showConfirmacion, setShowConfirmacion] = useState<string | null>(null)
  const [checklistErrors, setChecklistErrors] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [previewFecha, setPreviewFecha] = useState("")
  const [previewDestinatarios, setPreviewDestinatarios] = useState<string[]>([])
  const [previewModalidad, setPreviewModalidad] = useState<"electronica" | "autografa">("electronica")

  // Oficializacion state
  const [oficMes, setOficMes] = useState("")
  const [oficAnio, setOficAnio] = useState(String(new Date().getFullYear()))
  const [oficConsecutivo, setOficConsecutivo] = useState("")
  const [oficFechaRecepcion, setOficFechaRecepcion] = useState("")
  const [oficError, setOficError] = useState<string | null>(null)
  const [oficSuccess, setOficSuccess] = useState(false)

  // Folio Dictamen state (Filtro 2)
  const [dictMes, setDictMes] = useState(() => new Date().getMonth() + 1)
  const [dictAnio, setDictAnio] = useState(() => new Date().getFullYear())
  const [dictError, setDictError] = useState<string | null>(null)
  const [dictSuccess, setDictSuccess] = useState(false)

  // Auto-compute next consecutivo for a given month code
  const computeNextConsecutivo = useCallback((mesCode: string) => {
    if (!mesCode) return
    const regex = new RegExp(`^${mesCode}-(\\d{3})$`)
    let maxNum = 0
    for (const s of solicitudes) {
      if (s.id === solicitudId) continue
      const match = s.folioRecepcion?.match(regex)
      if (match) {
        const num = Number(match[1])
        if (num > maxNum) maxNum = num
      }
    }
    setOficConsecutivo(String(maxNum + 1))
  }, [solicitudes, solicitudId])

  const checklistItems = useMemo(() => {
    if (!solicitud) return []
    return getChecklistItems(solicitud.tipo)
  }, [solicitud])

  const checklistStats = useMemo(() => {
    if (!solicitud) return { completed: 0, total: 0, hasNo: false, noCount: 0, allDone: false, noWithoutObs: 0 }
    const total = checklistItems.length
    let completed = 0
    let noCount = 0
    let noWithoutObs = 0
    checklistItems.forEach((item) => {
      const state = solicitud.checklistDO[item.key]
      if (state && state.valor !== null) completed++
      if (state && state.valor === "no") {
        noCount++
        if (!state.observacion.trim()) noWithoutObs++
      }
    })
    return { completed, total, hasNo: noCount > 0, noCount, allDone: completed === total, noWithoutObs }
  }, [solicitud, checklistItems])

  if (!solicitud) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Solicitud no encontrada</p>
        <Button variant="outline" onClick={() => onBack(filtro)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Regresar a bandeja
        </Button>
      </div>
    )
  }

  const isEmitido = solicitud.estado === "Emitido"
  const isAprobado = solicitud.estado === "Aprobado"
  const showEmisionTab = filtro === 3 && (isAprobado || isEmitido)
  const estadoVariant = getEstadoVariant(solicitud.estado)

  // Aprobar / Observar logic differs by filtro
  const canApproveChecklist = checklistStats.allDone && !checklistStats.hasNo && !isEmitido
  const canObservarChecklist = checklistStats.hasNo && !isEmitido
  const observarBlockedChecklist = checklistStats.noWithoutObs > 0

  // Filtro 2: also requires folio dictamen to be assigned
  const hasFolioDictamen = !!solicitud.folioDictamen || dictSuccess
  // Filtro 3 (DG): no checklist, only checkbox + observation
  const canApprove = filtro === 3 ? (sinObservacion && !isEmitido) : filtro === 2 ? (canApproveChecklist && hasFolioDictamen) : canApproveChecklist
  const canObservar = filtro === 3 ? (!sinObservacion && !isEmitido) : canObservarChecklist
  const observarBlocked = filtro === 3 ? false : observarBlockedChecklist

  const handleChecklistChange = (key: string, valor: ChecklistValor) => {
    if (isEmitido) return
    updateChecklist(solicitud.id, key, valor, undefined, user?.name || "Revisor")
    if (checklistErrors[key]) {
      setChecklistErrors((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleChecklistObservacion = (key: string, observacion: string) => {
    if (isEmitido) return
    const currentState = solicitud.checklistDO[key]
    updateChecklist(solicitud.id, key, currentState?.valor ?? null, observacion, user?.name || "Revisor")
    if (observacion.trim() && checklistErrors[key]) {
      setChecklistErrors((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleObservar = () => {
    // Filtro 3: only require observacionGeneral text
    if (filtro === 3) {
      if (!observacionGeneral.trim()) {
        setObservacionError("Escribe una observacion para poder devolver el expediente.")
        return
      }
      setObservacionError("")
      observarSolicitud(solicitud.id, [observacionGeneral.trim()], [], user?.name || "Director General", filtro)
      setObservacionGeneral("")
      setShowConfirmacion("Solicitud observada y regresada a URG.")
      return
    }

    // Filtro 1/2: existing checklist-based flow
    const errors: Record<string, boolean> = {}
    let hasErrors = false
    checklistItems.forEach((item) => {
      const state = solicitud.checklistDO[item.key]
      if (state?.valor === "no" && !state.observacion.trim()) {
        errors[item.key] = true
        hasErrors = true
      }
    })

    if (hasErrors) {
      setChecklistErrors(errors)
      return
    }

    const resumenItems: string[] = []
    checklistItems.forEach((item) => {
      const state = solicitud.checklistDO[item.key]
      if (state?.valor === "no") {
        resumenItems.push(`${item.num}. ${item.label}: ${state.observacion}`)
      }
    })

    const resumenTexto = resumenItems.join("\n")
    const obsGenerales = [
      ...(observacionGeneral.trim() ? [observacionGeneral.trim()] : []),
      `Resumen de Observaciones del Checklist:\n${resumenTexto}`,
    ]

    observarSolicitud(solicitud.id, obsGenerales, [], user?.name || "Revisor", filtro)
    setObservacionGeneral("")
    setChecklistErrors({})
    setShowConfirmacion("Solicitud observada y regresada a URG.")
  }

  const handleAprobar = () => {
    // Filtro 3: show confirmation modal before approving
    if (filtro === 3) {
      setShowEmitConfirm(true)
      return
    }
    aprobarFiltro(solicitud.id, user?.name || "Revisor", filtro)
    setShowConfirmacion(`Solicitud aprobada y enviada a Filtro ${filtro + 1}.`)
  }

  const handleConfirmEmit = () => {
    setShowEmitConfirm(false)
    aprobarFiltro(solicitud.id, user?.name || "Director General", filtro)
    setActiveTab("emision")
    setShowConfirmacion("Solicitud aprobada por la Direccion General. Proceda a la emision del dictamen.")
  }

  const handleEmitir = (fechaDictaminacion: string, modalidadFirma: "electronica" | "autografa", destinatarios: string[], archivoFirmado?: string) => {
    emitirDictamen(solicitud.id, fechaDictaminacion, modalidadFirma, destinatarios, user?.name || "Director General", archivoFirmado)
    setShowConfirmacion(
      modalidadFirma === "electronica"
        ? "Dictamen emitido y firmado electronicamente. Expediente bloqueado."
        : "Dictamen emitido con firma autografa. Expediente bloqueado."
    )
  }

  const handleShowPreview = (fecha: string, destinatarios: string[], modalidad?: "electronica" | "autografa") => {
    setPreviewFecha(fecha)
    setPreviewDestinatarios(destinatarios)
    if (modalidad) setPreviewModalidad(modalidad)
    setShowPreview(true)
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Preview modal - show real data if emitido, preview data otherwise */}
      {showPreview && (
        <DictamenPreviewModal
          solicitud={solicitud}
          numeroDictamenPreview={
            isEmitido && solicitud.emisionData
              ? solicitud.emisionData.numeroDictamen
              : solicitud.folioDictamen
                ? solicitud.folioDictamen
                : "(Generado al emitir)"
          }
          fechaDictaminacion={
            isEmitido && solicitud.emisionData
              ? solicitud.emisionData.fechaDictaminacion
              : previewFecha
          }
          destinatarios={
            isEmitido && solicitud.emisionData
              ? solicitud.emisionData.destinatarios
              : previewDestinatarios
          }
          modalidadFirma={
            isEmitido && solicitud.emisionData
              ? solicitud.emisionData.modalidadFirma
              : previewModalidad
          }
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Confirmacion overlay */}
      {showConfirmacion && !isEmitido && activeTab !== "emision" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-secondary/30 border-2">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <CheckCircle2 className="h-12 w-12 text-secondary" />
              <p className="text-base font-semibold text-card-foreground text-center">{showConfirmacion}</p>
              <Button onClick={() => onBack(filtro)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Regresar a bandeja
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtro 3 - Emit confirmation modal */}
      {showEmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-primary/30 border-2">
            <CardContent className="flex flex-col items-center gap-5 p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-card-foreground">Confirmacion</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Estas a punto de emitir el dictamen. Deseas continuar?
                </p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEmitConfirm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleConfirmEmit}
                >
                  Si, emitir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Emission confirmation (stays on page for F3) */}
      {showConfirmacion && filtro === 3 && activeTab === "emision" && !isEmitido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-secondary/30 border-2">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <CheckCircle2 className="h-12 w-12 text-secondary" />
              <p className="text-base font-semibold text-card-foreground text-center">{showConfirmacion}</p>
              <Button onClick={() => setShowConfirmacion(null)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Continuar a Emision
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Emitido confirmation */}
      {showConfirmacion && isEmitido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="w-full max-w-md shadow-lg border-primary/30 border-2">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="h-12 w-12 text-primary" />
              <p className="text-base font-semibold text-card-foreground text-center">{showConfirmacion}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowConfirmacion(null)}>
                  Ver Expediente
                </Button>
                <Button onClick={() => onBack(filtro)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Regresar a bandeja
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onBack(filtro)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Regresar
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Expediente {solicitud.folioRecepcion}</h2>
              <Badge className={`${estadoVariant.bg} ${estadoVariant.text} border-0 text-xs`}>
                {solicitud.estado}
              </Badge>
              {isEmitido && (
                <Badge className="bg-primary text-primary-foreground border-0 text-xs gap-1">
                  <Lock className="h-3 w-3" />
                  Emitido
                </Badge>
              )}
              {solicitud.esExcepcionDO && (
                <Badge className="bg-accent/20 text-accent-foreground border-0 text-xs">
                  Excepcion DO
                </Badge>
              )}
              {solicitud.esRegularizacion && (
                <Badge className="bg-primary/15 text-primary border-0 text-xs">
                  Regularizacion
                </Badge>
              )}
              {solicitud.folioDictamen && (
                <Badge className="bg-secondary/15 text-secondary border-0 text-xs gap-1">
                  <Stamp className="h-3 w-3" />
                  Dict. {solicitud.folioDictamen}
                </Badge>
              )}
              {solicitud.folioTemporal && (
                <Badge className="bg-destructive/10 text-destructive border-0 text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  Folio temporal
                </Badge>
              )}
              {solicitud.reingresoCount > 0 && (
                <Badge className="bg-accent/10 text-accent-foreground border-0 text-xs gap-1">
                  Reingreso #{solicitud.reingresoCount}
                </Badge>
              )}
              {solicitud.lastObservedStage && solicitud.lastObservedStage !== filtro && solicitud.reingresoCount > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Devuelta por Filtro {solicitud.lastObservedStage}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {solicitud.folioSolicitud} - {solicitud.tipo} - {solicitud.secretaria}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              generateJustificacionPDF({
                folio: solicitud.folioSolicitud,
                tipo: solicitud.tipo,
                secretaria: solicitud.secretaria,
                unidadAdministrativa: solicitud.unidadAdministrativa,
                denominacion: solicitud.denominacion,
                vigenciaInicio: solicitud.vigenciaInicio,
                vigenciaFin: solicitud.vigenciaFin,
                importeBruto: solicitud.importeBruto,
                esRenovacion: solicitud.esRenovacion,
                folioAnterior: solicitud.folioAnterior ?? undefined,
                fecha: solicitud.fechaCreacion,
                firmadoDigitalmente: true,
              })
            }}
          >
            <Download className="h-4 w-4" />
            Justificacion (PDF)
          </Button>
          {!isEmitido && <SlaIndicatorLarge diasRestantes={solicitud.slaRestante} />}
        </div>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 flex-1 min-h-0">
        {/* LEFT - Full read-only expediente */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            {solicitud.observaciones.length > 0 && (
              <Card className="shadow-sm border-destructive/30 border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Observaciones Previas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {solicitud.observaciones.map((obs, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-card-foreground whitespace-pre-line">
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        {obs}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {solicitud.tipo === "Prestacion de Servicios" ? (
              <ExpedientePrestacion solicitud={solicitud} />
            ) : (
              <ExpedienteNombramiento solicitud={solicitud} />
            )}
          </div>
        </ScrollArea>

        {/* RIGHT - Review panel */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-4 pr-4">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {!isEmitido && (
                <button
                  onClick={() => setActiveTab("review")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === "review"
                      ? "bg-card text-card-foreground shadow-sm"
                      : "text-muted-foreground hover:text-card-foreground"
                  }`}
                >
                  <ClipboardCheck className="mr-1.5 inline h-4 w-4" />
                  Revision
                </button>
              )}
              {showEmisionTab && (
                <button
                  onClick={() => setActiveTab("emision")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === "emision"
                      ? "bg-card text-card-foreground shadow-sm"
                      : "text-muted-foreground hover:text-card-foreground"
                  }`}
                >
                  <Stamp className="mr-1.5 inline h-4 w-4" />
                  Emision
                </button>
              )}
              <button
                onClick={() => setActiveTab("historial")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "historial"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-card-foreground"
                }`}
              >
                <History className="mr-1.5 inline h-4 w-4" />
                Historial
              </button>
            </div>

            {activeTab === "review" && !isEmitido ? (
              <>
                {/* Oficializar folio panel - only for Filtro 1 with temp folio */}
                {filtro === 1 && solicitud.folioTemporal && !oficSuccess && (
                  <Card className="shadow-sm border-2 border-primary/40 bg-primary/[0.03]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Clock className="h-4 w-4" />
                        Oficializar Recepcion
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Este expediente tiene un folio temporal ({solicitud.folioRecepcion}).
                        Asigne el folio oficial y la fecha de recepcion antes de continuar con la revision.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="grid gap-4 grid-cols-3">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-medium">Mes oficial *</Label>
                          <Select value={oficMes} onValueChange={(v) => { setOficMes(v); setOficError(null); computeNextConsecutivo(v) }}>
                            <SelectTrigger className="bg-background text-xs h-9">
                              <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { code: "EN", label: "Enero" },
                                { code: "FE", label: "Febrero" },
                                { code: "MR", label: "Marzo" },
                                { code: "AB", label: "Abril" },
                                { code: "MY", label: "Mayo" },
                                { code: "JN", label: "Junio" },
                                { code: "JL", label: "Julio" },
                                { code: "AG", label: "Agosto" },
                                { code: "SE", label: "Septiembre" },
                                { code: "OC", label: "Octubre" },
                                { code: "NV", label: "Noviembre" },
                                { code: "DI", label: "Diciembre" },
                              ].map((m) => (
                                <SelectItem key={m.code} value={m.code}>{m.code} - {m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-medium">Ano *</Label>
                          <Input
                            type="number"
                            value={oficAnio}
                            onChange={(e) => { setOficAnio(e.target.value); setOficError(null) }}
                            className="bg-background text-xs h-9"
                            min={2020}
                            max={2030}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-medium">Consecutivo *</Label>
                          <Input
                            type="number"
                            value={oficConsecutivo}
                            onChange={(e) => { setOficConsecutivo(e.target.value); setOficError(null) }}
                            placeholder="Ej. 121"
                            className="bg-background text-xs h-9"
                            min={1}
                          />
                          {oficMes && oficConsecutivo && (
                            <p className="text-[10px] text-muted-foreground">Auto-calculado, editable</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium">Fecha oficial de recepcion *</Label>
                        <Input
                          type="date"
                          value={oficFechaRecepcion}
                          onChange={(e) => { setOficFechaRecepcion(e.target.value); setOficError(null) }}
                          className="bg-background text-xs h-9"
                        />
                      </div>

                      {oficMes && oficConsecutivo && (
                        <div className="rounded-lg bg-muted/60 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Folio oficial: </span>
                          <span className="text-sm font-semibold text-card-foreground">
                            {oficMes}-{String(Number(oficConsecutivo) || 0).padStart(3, "0")}
                          </span>
                        </div>
                      )}

                      {oficError && (
                        <div className="rounded-lg bg-destructive/10 px-3 py-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="text-xs text-destructive">{oficError}</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        disabled={!oficMes || !oficAnio || !oficConsecutivo || !oficFechaRecepcion}
                        onClick={() => {
                          const error = oficializarFolio(
                            solicitud.id,
                            oficMes,
                            Number(oficAnio),
                            Number(oficConsecutivo),
                            oficFechaRecepcion,
                            user?.name || "Revisor Filtro 1"
                          )
                          if (error) {
                            setOficError(error)
                          } else {
                            setOficSuccess(true)
                          }
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Oficializar Folio
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Oficializacion success */}
                {filtro === 1 && oficSuccess && (
                  <Card className="shadow-sm border-2 border-secondary/40 bg-secondary/[0.03]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-card-foreground">Folio oficializado exitosamente</span>
                        <span className="text-xs text-muted-foreground">
                          El folio temporal fue reemplazado por el folio oficial. Puede continuar con la revision normativa.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Regularizacion info tooltip */}
                {solicitud.esRegularizacion && !solicitud.folioTemporal && (
                  <Card className="shadow-sm border-border bg-muted/30">
                    <CardContent className="flex items-center gap-3 p-3">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Este expediente es una regularizacion. La fecha de recepcion fue ajustada al oficializar el folio.
                        {solicitud.folioTemporalOriginal && ` (folio temporal original: ${solicitud.folioTemporalOriginal})`}
                      </span>
                    </CardContent>
                  </Card>
                )}

                {/* Folio Dictamen panel - only for Filtro 2 */}
                {filtro === 2 && !solicitud.folioDictamen && !dictSuccess && (
                  <Card className="shadow-sm border-2 border-primary/40 bg-primary/[0.03]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Stamp className="h-4 w-4" />
                        Asignar Folio de Dictamen
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {solicitud.esRegularizacion || solicitud.esExcepcionDO
                          ? "Este expediente requiere oficializar el folio de dictamen. Seleccione el mes y ano correspondiente."
                          : "Asigne el numero secuencial de dictamen antes de aprobar."
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      {solicitud.esRegularizacion || solicitud.esExcepcionDO ? (
                        <div className="grid gap-4 grid-cols-3">
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Mes *</Label>
                            <Select
                              value={String(dictMes)}
                              onValueChange={(v) => { setDictMes(Number(v)); setDictError(null) }}
                            >
                              <SelectTrigger className="bg-background text-xs h-9">
                                <SelectValue placeholder="Mes" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  { value: 1, label: "Enero" },
                                  { value: 2, label: "Febrero" },
                                  { value: 3, label: "Marzo" },
                                  { value: 4, label: "Abril" },
                                  { value: 5, label: "Mayo" },
                                  { value: 6, label: "Junio" },
                                  { value: 7, label: "Julio" },
                                  { value: 8, label: "Agosto" },
                                  { value: 9, label: "Septiembre" },
                                  { value: 10, label: "Octubre" },
                                  { value: 11, label: "Noviembre" },
                                  { value: 12, label: "Diciembre" },
                                ].map((m) => (
                                  <SelectItem key={m.value} value={String(m.value)}>
                                    {String(m.value).padStart(2, "0")} - {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Ano *</Label>
                            <Input
                              type="number"
                              value={dictAnio}
                              onChange={(e) => { setDictAnio(Number(e.target.value)); setDictError(null) }}
                              className="bg-background text-xs h-9"
                              min={2020}
                              max={2030}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Consecutivo</Label>
                            <Input
                              type="number"
                              value={getNextDictamenConsecutivo(dictMes, dictAnio, solicitud.id)}
                              readOnly
                              className="bg-muted text-xs h-9"
                            />
                            <p className="text-[10px] text-muted-foreground">Auto-calculado</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-4 grid-cols-3">
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Mes</Label>
                            <Input
                              type="text"
                              value={String(dictMes).padStart(2, "0")}
                              readOnly
                              className="bg-muted text-xs h-9"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Ano</Label>
                            <Input
                              type="text"
                              value={String(dictAnio)}
                              readOnly
                              className="bg-muted text-xs h-9"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium">Consecutivo</Label>
                            <Input
                              type="number"
                              value={getNextDictamenConsecutivo(dictMes, dictAnio, solicitud.id)}
                              readOnly
                              className="bg-muted text-xs h-9"
                            />
                            <p className="text-[10px] text-muted-foreground">Auto-calculado</p>
                          </div>
                        </div>
                      )}

                      {/* Preview */}
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Folio de dictamen: </span>
                        <span className="text-sm font-semibold text-card-foreground">
                          {String(getNextDictamenConsecutivo(dictMes, dictAnio, solicitud.id)).padStart(2, "0")}/{String(dictMes).padStart(2, "0")}/{dictAnio}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Formato NN/MM/AAAA: numero secuencial / mes / ano. No es una fecha.
                        </p>
                      </div>

                      {dictError && (
                        <div className="rounded-lg bg-destructive/10 px-3 py-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="text-xs text-destructive">{dictError}</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        onClick={() => {
                          const consecutivo = getNextDictamenConsecutivo(dictMes, dictAnio, solicitud.id)
                          const error = asignarFolioDictamen(
                            solicitud.id,
                            dictMes,
                            dictAnio,
                            consecutivo,
                            user?.name || "Revisor Filtro 2"
                          )
                          if (error) {
                            setDictError(error)
                          } else {
                            setDictSuccess(true)
                          }
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Asignar Folio de Dictamen
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Folio dictamen success */}
                {filtro === 2 && (solicitud.folioDictamen || dictSuccess) && (
                  <Card className="shadow-sm border-2 border-secondary/40 bg-secondary/[0.03]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-card-foreground">
                          Folio de dictamen asignado: {solicitud.folioDictamen}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          El folio fue asignado correctamente. Puede continuar con la revision normativa y aprobar.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary banner (Filtro 1/2 only) */}
                {filtro !== 3 && (
                <Card className={`shadow-sm border-2 ${
                  checklistStats.hasNo
                    ? "border-destructive/30 bg-destructive/[0.03]"
                    : checklistStats.allDone
                      ? "border-secondary/30 bg-secondary/[0.03]"
                      : "border-border"
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-secondary" />
                        <span className="text-sm font-semibold text-card-foreground">
                          Checklist Normativo - Filtro {filtro}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">
                        {solicitud.tipo === "Nombramiento Tiempo Det." ? "19 items" : "16 items"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-card-foreground">
                        {checklistStats.completed} de {checklistStats.total} verificaciones completas
                      </span>
                      <Badge className={`text-[10px] border-0 ${
                        checklistStats.hasNo
                          ? "bg-destructive/10 text-destructive"
                          : checklistStats.allDone
                            ? "bg-secondary/10 text-secondary"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {checklistStats.hasNo
                          ? `Tiene ${checklistStats.noCount} observacion${checklistStats.noCount > 1 ? "es" : ""}`
                          : checklistStats.allDone
                            ? "Completo"
                            : "En progreso"}
                      </Badge>
                    </div>

                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          checklistStats.hasNo
                            ? "bg-destructive"
                            : checklistStats.allDone
                              ? "bg-secondary"
                              : "bg-primary"
                        }`}
                        style={{ width: `${checklistStats.total > 0 ? (checklistStats.completed / checklistStats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Checklist Items (Filtro 1/2 only) */}
                {filtro !== 3 && (
                <Card className="shadow-sm border-border">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {checklistItems.map((item) => {
                        const state = solicitud.checklistDO[item.key]
                        const valor = state?.valor ?? null
                        const itemObs = state?.observacion ?? ""
                        const isTiempoDeterminadoExtra = item.num > 16
                        const hasError = checklistErrors[item.key]

                        return (
                          <div key={item.key}>
                            {item.num === 17 && (
                              <div className="border-t-2 border-primary/20 bg-primary/[0.05] px-4 py-2.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                  Campos adicionales - Tiempo Determinado
                                </span>
                              </div>
                            )}
                            <div
                              className={`flex flex-col gap-3 p-4 ${
                                isTiempoDeterminadoExtra ? "bg-primary/[0.03]" : ""
                              } ${
                                valor === "no" ? "bg-destructive/[0.04]" : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                  valor === "si"
                                    ? "bg-secondary/15 text-secondary"
                                    : valor === "no"
                                      ? "bg-destructive/15 text-destructive"
                                      : valor === "noAplica"
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-border text-muted-foreground"
                                }`}>
                                  {item.num}
                                </span>
                                <div className="flex flex-1 flex-col gap-2">
                                  <span className={`text-sm leading-snug ${
                                    valor === "no" ? "text-destructive font-medium" : "text-card-foreground"
                                  }`}>
                                    {item.label}
                                  </span>

                                  <div className="flex flex-wrap gap-2">
                                    <RadioOption
                                      value="si"
                                      selected={valor === "si"}
                                      onChange={() => handleChecklistChange(item.key, valor === "si" ? null : "si")}
                                      label="Si"
                                      colorClass="text-secondary bg-secondary/10"
                                    />
                                    <RadioOption
                                      value="no"
                                      selected={valor === "no"}
                                      onChange={() => handleChecklistChange(item.key, valor === "no" ? null : "no")}
                                      label="No"
                                      colorClass="text-destructive bg-destructive/10"
                                    />
                                    <RadioOption
                                      value="noAplica"
                                      selected={valor === "noAplica"}
                                      onChange={() => handleChecklistChange(item.key, valor === "noAplica" ? null : "noAplica")}
                                      label="No Aplica"
                                      colorClass="text-muted-foreground bg-muted"
                                    />
                                  </div>

                                  {(valor === "no" || itemObs) && (
                                    <div className="flex flex-col gap-1">
                                      <Textarea
                                        value={itemObs}
                                        onChange={(e) => handleChecklistObservacion(item.key, e.target.value)}
                                        placeholder={valor === "no" ? "Obligatorio: describa la observacion..." : "Observaciones de este punto..."}
                                        className={`bg-background min-h-10 text-xs resize-none ${
                                          hasError ? "border-destructive" : ""
                                        }`}
                                        rows={2}
                                      />
                                      {hasError && (
                                        <span className="text-[10px] text-destructive font-medium">
                                          Debe escribir una observacion para este punto marcado como &quot;No&quot;
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {state?.validadoPor && state?.validadoEn && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Validado por {state.validadoPor} - {state.validadoEn}
                                    </span>
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
                )}

                {/* ── Filtro 3 (DG): simplified observation-only flow ── */}
                {filtro === 3 && (
                  <Card className={`shadow-sm border-2 ${sinObservacion ? "border-secondary/30 bg-secondary/[0.03]" : "border-border"}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                        <Shield className="h-4 w-4 text-primary" />
                        Revision de Direccion General
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Revise el expediente completo y determine si procede la emision o requiere observaciones.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      {/* Checkbox "No hay observacion" */}
                      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <Checkbox
                          id="sin-observacion-dg"
                          checked={sinObservacion}
                          onCheckedChange={(checked) => {
                            setSinObservacion(!!checked)
                            if (checked) {
                              setObservacionGeneral("")
                              setObservacionError("")
                            }
                          }}
                        />
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="sin-observacion-dg" className="text-sm font-medium cursor-pointer">
                            No hay ninguna observacion
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {sinObservacion
                              ? "El expediente esta listo para emision. Puede proceder a aprobar."
                              : "Desmarque para agregar observaciones y devolver el expediente."}
                          </span>
                        </div>
                      </div>

                      {/* Observation textarea (visible when checkbox is unchecked) */}
                      {!sinObservacion && (
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm font-medium text-card-foreground">
                            Observacion
                          </Label>
                          <Textarea
                            value={observacionGeneral}
                            onChange={(e) => {
                              setObservacionGeneral(e.target.value)
                              if (e.target.value.trim()) setObservacionError("")
                            }}
                            placeholder="Describa las observaciones para devolver el expediente..."
                            className={`bg-background min-h-24 ${observacionError ? "border-destructive" : ""}`}
                          />
                          {observacionError && (
                            <span className="text-xs text-destructive">{observacionError}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Observacion general (Filtro 1/2 only) */}
                {filtro !== 3 && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                      <MessageSquare className="h-4 w-4 text-secondary" />
                      Observacion General
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">(opcional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={observacionGeneral}
                      onChange={(e) => setObservacionGeneral(e.target.value)}
                      placeholder="Comentarios adicionales sobre la solicitud..."
                      className="bg-background min-h-20"
                    />
                  </CardContent>
                </Card>
                )}

                {/* Warnings */}
                {canObservar && observarBlocked && (
                  <Card className="shadow-sm border-destructive/40 border-2 bg-destructive/[0.04]">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Info className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-destructive">Observaciones incompletas</span>
                        <span className="text-xs text-muted-foreground">
                          {checklistStats.noWithoutObs} punto{checklistStats.noWithoutObs > 1 ? "s" : ""} marcado{checklistStats.noWithoutObs > 1 ? "s" : ""} como
                          {' "No" requiere'}{checklistStats.noWithoutObs > 1 ? "n" : ""} observacion obligatoria antes de poder observar la solicitud.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Folio dictamen required warning */}
                {filtro === 2 && canApproveChecklist && !hasFolioDictamen && (
                  <Card className="shadow-sm border-primary/40 border-2 bg-primary/[0.04]">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Stamp className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-primary">Folio de dictamen requerido</span>
                        <span className="text-xs text-muted-foreground">
                          Debe asignar el folio de dictamen (arriba) antes de poder aprobar la solicitud.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!canApprove && !canObservar && checklistStats.completed < checklistStats.total && (
                  <Card className="shadow-sm border-border bg-muted/30">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-card-foreground">Verificacion en progreso</span>
                        <span className="text-xs text-muted-foreground">
                          Faltan {checklistStats.total - checklistStats.completed} verificaciones por completar.
                          Complete todos los puntos del checklist para poder aprobar u observar.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action buttons */}
                <Card className="shadow-sm border-border sticky bottom-0">
                  <CardContent className="flex items-center justify-between p-4">
                    <Button
                      variant="outline"
                      onClick={handleObservar}
                      disabled={!canObservar || observarBlocked}
                      className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Observar
                    </Button>
                    <Button
                      onClick={handleAprobar}
                      disabled={!canApprove}
                      className={`gap-1.5 ${
                        canApprove
                          ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {filtro < 3 ? `Aprobar y pasar a Filtro ${filtro + 1}` : "Aprobar (DG)"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : activeTab === "emision" ? (
              isEmitido ? (
                <EmitidoLockedView
                  solicitud={solicitud}
                  onViewDictamen={() => {
                    if (solicitud.emisionData) {
                      setPreviewFecha(solicitud.emisionData.fechaDictaminacion)
                      setPreviewDestinatarios(solicitud.emisionData.destinatarios)
                      setPreviewModalidad(solicitud.emisionData.modalidadFirma)
                      setShowPreview(true)
                    }
                  }}
                />
              ) : (
                <EmisionPanel
                  solicitud={solicitud}
                  onEmitir={handleEmitir}
                  onPreview={handleShowPreview}
                />
              )
            ) : (
              /* Historial tab */
              <Card className="shadow-sm border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <History className="h-4 w-4 text-secondary" />
                    Historial del Expediente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Linea de tiempo de movimientos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HistorialTimeline historial={[...solicitud.historial].reverse()} />
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
