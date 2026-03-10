"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  FilePlus, Upload, ArrowLeft, ArrowRight, Plus, Trash2,
  FileText, ClipboardList, Save, SendHorizonal, AlertCircle, Info,
  ShieldAlert, CheckCircle2, Clock, Calendar,
} from "lucide-react"
import { useSolicitudes, type TipoAdministracion } from "@/lib/solicitudes-store"
import { useAutorizaciones } from "@/lib/autorizaciones-store"
import { useAuth } from "@/lib/auth-context"
import { CAP_3000, CAP_1000, NOMBRAMIENTO_TD, parseDateDMY, isPeriodoVigente } from "@/lib/calendario-recepcion-mock"

// ── Rangos tabulador (informativo) ──
const RANGOS_TABULADOR = [
  { min: 32124.36, max: 49846.50, nivel: "105", puesto: "Director General" },
  { min: 24380.00, max: 32123.30, nivel: "106", puesto: "Coordinador de area" },
  { min: 19080.00, max: 24369.40, nivel: "107", puesto: "Director de area" },
  { min: 0.00,     max: 18830.90, nivel: "108", puesto: "Subdirector de area" },
  { min: 0.00,     max: 13292.40, nivel: "109", puesto: "Jefe de departamento" },
  { min: 11600.00, max: 15898.94, nivel: "301", puesto: "Especialista" },
  { min: 10554.00, max: 11658.94, nivel: "302", puesto: "Tecnico especializado" },
  { min: 0.00,     max: 10553.36, nivel: "303", puesto: "Tecnico operativo / Registrador" },
]

function parseMoney(str: string): number {
  if (!str) return -1
  const clean = str.replace(/[$,\s]/g, "")
  const n = parseFloat(clean)
  return isNaN(n) ? -1 : n
}

const MOCK_FOLIOS = [
  { id: "DICT-2026-001", fecha: "02/02/2026", vigencia: "01/01/2026 – 30/06/2026", vencimiento: "30/06/2026" },
  { id: "DICT-2026-002", fecha: "05/03/2026", vigencia: "01/03/2026 – 31/08/2026", vencimiento: "31/08/2026" },
  { id: "DICT-2025-015", fecha: "01/04/2025", vigencia: "01/04/2025 – 30/09/2025", vencimiento: "30/09/2025" },
]

type TipoSolicitud = "" | "prestacion" | "nombramiento"
type Step = "tipo" | "renovacion" | "formulario"

// ── Dynamic list helper ──
function DynamicList({ label, items, onChange, max = 5 }: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  max?: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium text-card-foreground">{label}</Label>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
            {idx + 1}
          </span>
          <Input
            value={item}
            onChange={(e) => {
              const copy = [...items]
              copy[idx] = e.target.value
              onChange(copy)
            }}
            placeholder={`${label} ${idx + 1}`}
            className="bg-background"
          />
          {items.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {items.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Agregar
        </Button>
      )}
    </div>
  )
}

// ── Step indicator ──
function StepIndicator({ step, tipo }: { step: Step; tipo: TipoSolicitud }) {
  const steps = [
    { key: "tipo", label: "Tipo de Solicitud" },
    { key: "renovacion", label: "Renovacion" },
    { key: "formulario", label: tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento" },
  ]
  const currentIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${i === currentIndex
            ? "bg-primary text-primary-foreground"
            : i < currentIndex
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground"
            }`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < currentIndex ? "bg-secondary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════
// FORMULARIO 1 – PRESTACION DE SERVICIOS
// ══════════════════════════════════════════════════
function FormularioPrestacion({
  prefilled,
  lockVigenciaOnly = false,
}: {
  prefilled: boolean
  lockVigenciaOnly?: boolean
}) {
  const lock = lockVigenciaOnly
  const [regimen, setRegimen] = useState("")
  const [actividades, setActividades] = useState([""])
  const [responsabilidades, setResponsabilidades] = useState([""])

  return (
    <div className="flex flex-col gap-6">
      {/* I. DATOS GENERALES */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Secretaria</Label>
              <Input
                value={prefilled ? "Secretaria de Administracion" : ""}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Precargada segun usuario</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Unidad Administrativa de Adscripcion</Label>
              <Select defaultValue={prefilled ? "dgpic" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione unidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dgpic">Dir. Gral. de Profesionalizacion e Innovacion</SelectItem>
                  <SelectItem value="dgaf">Dir. Gral. de Administracion y Finanzas</SelectItem>
                  <SelectItem value="dgrh">Dir. Gral. de Recursos Humanos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Unidad Responsable del Gasto</Label>
              <Select defaultValue={prefilled ? "urg-01" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione URG" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urg-01">URG-01 Oficina del Secretario</SelectItem>
                  <SelectItem value="urg-02">URG-02 Direccion General</SelectItem>
                  <SelectItem value="urg-03">URG-03 Coordinacion Administrativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Programa o Proyecto</Label>
              <Input defaultValue={prefilled ? "P-003 Modernizacion Administrativa" : ""} placeholder="Nombre del programa" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Regimen de Contratacion</Label>
              <RadioGroup value={prefilled ? "honorarios" : regimen} onValueChange={setRegimen} className="flex gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="honorarios" id="reg-hon" />
                  <Label htmlFor="reg-hon" className="text-sm font-normal cursor-pointer">Honorarios</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="asimilados" id="reg-asim" />
                  <Label htmlFor="reg-asim" className="text-sm font-normal cursor-pointer">Honorarios Asimilados a Salarios</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Tipo de Actividades</Label>
              <Select defaultValue={prefilled ? "profesional" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Segun unidad administrativa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profesional">Profesionales</SelectItem>
                  <SelectItem value="tecnico">Tecnicas</SelectItem>
                  <SelectItem value="operativo">Operativas</SelectItem>
                  <SelectItem value="asesoria">Asesoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Numero de Prestadores de Servicios</Label>
              <Input type="number" min={1} defaultValue={prefilled ? "3" : ""} placeholder="Ej. 5" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Vigencia</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <Input type="date" defaultValue={prefilled ? "2026-01-01" : ""} className="bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Termino</span>
                  <Input type="date" defaultValue={prefilled ? "2026-06-30" : ""} className="bg-background" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Importe Bruto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text"
                  defaultValue={prefilled ? "45,000.00" : ""}
                  placeholder="0.00"
                  className="bg-background pl-7"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-secondary cursor-pointer">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">PDF, DOC (max. 10 MB)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* I.1 OBJETO DE LA CONTRATACION */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.1 Objeto de la Contratacion</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            defaultValue={prefilled ? "Prestacion de servicios profesionales para el desarrollo, implementacion y seguimiento de sistemas informaticos orientados a la modernizacion administrativa." : ""}
            placeholder="Describa el objeto de la contratacion de manera detallada..."
            className="bg-background min-h-28"
          />
        </CardContent>
      </Card>

      {/* I.2 ACTIVIDADES A REALIZAR */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.2 Actividades a Realizar</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList
            label=""
            items={prefilled ? ["Desarrollo de modulos del sistema institucional", "Pruebas de calidad e integracion", "Documentacion tecnica"] : actividades}
            onChange={setActividades}
          />
        </CardContent>
      </Card>

      {/* I.3 RESPONSABILIDADES */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.3 Responsabilidades</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList
            label=""
            items={prefilled ? ["Cumplir con los plazos establecidos", "Reportar avances semanales"] : responsabilidades}
            onChange={setResponsabilidades}
          />
        </CardContent>
      </Card>

      {/* II. PERFIL */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">II</span>
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Escolaridad Minima</Label>
              <Select defaultValue={prefilled ? "licenciatura" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bachillerato">Bachillerato</SelectItem>
                  <SelectItem value="tecnico">Tecnico Superior</SelectItem>
                  <SelectItem value="licenciatura">Licenciatura</SelectItem>
                  <SelectItem value="maestria">Maestria</SelectItem>
                  <SelectItem value="doctorado">Doctorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Competencias Administrativas</Label>
              <Textarea defaultValue={prefilled ? "Planeacion, organizacion, control de recursos" : ""} placeholder="Describa competencias administrativas" className="bg-background min-h-16" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Competencias Tecnicas</Label>
              <Textarea defaultValue={prefilled ? "Desarrollo de software, bases de datos, redes" : ""} placeholder="Describa competencias tecnicas" className="bg-background min-h-16" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Competencias Sociales</Label>
              <Textarea defaultValue={prefilled ? "Trabajo en equipo, comunicacion efectiva" : ""} placeholder="Describa competencias sociales" className="bg-background min-h-16" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Valores</Label>
              <Textarea defaultValue={prefilled ? "Integridad, responsabilidad, transparencia" : ""} placeholder="Valores requeridos" className="bg-background min-h-16" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Areas de Experiencia</Label>
              <Textarea defaultValue={prefilled ? "Tecnologias de la informacion, administracion publica" : ""} placeholder="Areas de experiencia requeridas" className="bg-background min-h-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════
// FORMULARIO 2 – NOMBRAMIENTO POR TIEMPO DETERMINADO
// ══════════════════════════════════════════════════
function FormularioNombramiento({ prefilled }: { prefilled: boolean }) {
  const [nivel, setNivel] = useState(prefilled ? "104" : "")
  const [importeNeto, setImporteNeto] = useState(prefilled ? "28,500.00" : "")
  const [funciones, setFunciones] = useState(prefilled ? ["Coordinar procesos administrativos", "Supervisar personal operativo"] : [""])
  const [responsabilidades, setResponsabilidades] = useState(prefilled ? ["Cumplimiento normativo del area", "Reportes trimestrales"] : [""])
  const [marcoNormativo, setMarcoNormativo] = useState(prefilled ? ["Ley Organica de la Administracion Publica", "Reglamento Interior"] : [""])

  const coincidencias = useMemo(() => {
    const val = parseMoney(importeNeto)
    if (val < 0) return []
    return RANGOS_TABULADOR.filter((r) => val >= r.min && val <= r.max)
  }, [importeNeto])

  return (
    <div className="flex flex-col gap-6">
      {/* I. DATOS GENERALES */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos Generales
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Secretaria</Label>
              <Input value={prefilled ? "Secretaria de Administracion" : ""} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Unidad Administrativa</Label>
              <Select defaultValue={prefilled ? "dgpic" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dgpic">Dir. Gral. de Profesionalizacion e Innovacion</SelectItem>
                  <SelectItem value="dgaf">Dir. Gral. de Administracion y Finanzas</SelectItem>
                  <SelectItem value="dgrh">Dir. Gral. de Recursos Humanos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Unidad Responsable del Gasto</Label>
              <Select defaultValue={prefilled ? "urg-01" : undefined}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione URG" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urg-01">URG-01 Oficina del Secretario</SelectItem>
                  <SelectItem value="urg-02">URG-02 Direccion General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Programa o Proyecto</Label>
              <Input defaultValue={prefilled ? "P-005 Fortalecimiento Institucional" : ""} placeholder="Nombre del programa" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Denominacion del Nombramiento</Label>
              <Input defaultValue={prefilled ? "Jefe de Departamento" : ""} placeholder="Ej. Subdirector de Area" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Puesto del Jefe Inmediato</Label>
              <Input defaultValue={prefilled ? "Director de Area" : ""} placeholder="Ej. Director General" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Numero de Personas a Contratar</Label>
              <Input type="number" min={1} defaultValue={prefilled ? "2" : ""} placeholder="Ej. 1" className="bg-background" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Importe Neto Mensual</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="text"
                  value={importeNeto}
                  onChange={(e) => setImporteNeto(e.target.value)}
                  placeholder="0.00"
                  className="bg-background pl-7"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-sm font-medium">Adjuntar Oficio de Suficiencia Presupuestal</Label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-secondary cursor-pointer">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">PDF, DOC (max. 10 MB)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABULADOR – NIVEL Y NOMBRAMIENTO (INFORMATIVO) */}
      <Card className="shadow-sm border-secondary/30 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ClipboardList className="h-5 w-5 text-secondary" />
            Tabulador - Nivel y Nombramiento (informativo)
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-xs">
            <Info className="h-3.5 w-3.5" />
            Los niveles se calculan automaticamente a partir del Importe Neto Mensual capturado arriba.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Coincidencias informativas */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Coincidencias por importe</Label>
            {parseMoney(importeNeto) < 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-3">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Capture un Importe Neto Mensual para ver coincidencias.</span>
              </div>
            ) : coincidencias.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Sin coincidencias para el importe capturado.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {coincidencias.map((c) => (
                  <div
                    key={c.nivel + c.puesto}
                    className="flex items-center gap-3 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-2.5"
                  >
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-xs shrink-0">
                      Nivel {c.nivel}
                    </Badge>
                    <span className="text-sm font-medium text-card-foreground">{c.puesto}</span>
                  </div>
                ))}
                {coincidencias.length > 1 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Existen traslapes entre rangos. Se muestran todas las coincidencias (solo informativo).
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vigencia y clave */}
      <Card className="shadow-sm border-border">
        <CardContent className="pt-6 flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Vigencia</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <Input type="date" defaultValue={prefilled ? "2026-03-01" : ""} className="bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Termino</span>
                  <Input type="date" defaultValue={prefilled ? "2026-08-31" : ""} className="bg-background" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Clave Presupuestal</Label>
              <Input defaultValue={prefilled ? "CP-2026-0045" : ""} placeholder="Ej. CP-2026-0001" className="bg-background" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* I.1 OBJETO */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.1 Objeto del Nombramiento</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            defaultValue={prefilled ? "Nombramiento por tiempo determinado para cubrir necesidades de la Direccion General en materia de planeacion y seguimiento de programas institucionales." : ""}
            placeholder="Describa el objeto del nombramiento..."
            className="bg-background min-h-28"
          />
        </CardContent>
      </Card>

      {/* I.2 FUNCIONES */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.2 Funciones Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={funciones} onChange={setFunciones} />
        </CardContent>
      </Card>

      {/* I.3 RESPONSABILIDADES */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.3 Responsabilidades</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={responsabilidades} onChange={setResponsabilidades} />
        </CardContent>
      </Card>

      {/* I.4 MARCO NORMATIVO */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.4 Marco Normativo</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicList label="" items={marcoNormativo} onChange={setMarcoNormativo} />
        </CardContent>
      </Card>

      {/* I.5 CONDICIONES Y RIESGOS */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.5 Condiciones y Riesgos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div>
            <Label className="text-sm font-medium mb-3 block">Condiciones</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-2.5 text-left font-medium text-card-foreground">Condicion</th>
                    <th className="px-4 py-2.5 text-center font-medium text-card-foreground">Si</th>
                    <th className="px-4 py-2.5 text-center font-medium text-card-foreground">No</th>
                  </tr>
                </thead>
                <tbody>
                  {["Cambio de domicilio", "Horario especial", "Viajar"].map((cond) => (
                    <CondicionRow key={cond} label={cond} defaultVal={prefilled ? "no" : ""} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-3 block">Tabla de Riesgos</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-2.5 text-left font-medium text-card-foreground">Riesgo</th>
                    <th className="px-4 py-2.5 text-center font-medium text-card-foreground">Bajo</th>
                    <th className="px-4 py-2.5 text-center font-medium text-card-foreground">Medio</th>
                    <th className="px-4 py-2.5 text-center font-medium text-card-foreground">Alto</th>
                  </tr>
                </thead>
                <tbody>
                  {["Lesiones", "Caidas", "Mutilaciones", "Golpes", "Otros"].map((riesgo) => (
                    <RiesgoRow key={riesgo} label={riesgo} defaultVal={prefilled ? "bajo" : ""} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* I.6 RESGUARDO */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-card-foreground">I.6 Resguardo Personalizado de Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup defaultValue={prefilled ? "no" : undefined} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="si" id="resg-si" />
              <Label htmlFor="resg-si" className="text-sm font-normal cursor-pointer">Si</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="resg-no" />
              <Label htmlFor="resg-no" className="text-sm font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Table row helpers ──
function CondicionRow({ label, defaultVal }: { label: string; defaultVal: string }) {
  const [val, setVal] = useState(defaultVal)
  const id = label.toLowerCase().replace(/\s/g, "-")
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2.5 text-card-foreground">{label}</td>
      <td className="px-4 py-2.5" colSpan={2}>
        <RadioGroup value={val} onValueChange={setVal} className="flex justify-center gap-16">
          <RadioGroupItem value="si" id={`${id}-si`} />
          <RadioGroupItem value="no" id={`${id}-no`} />
        </RadioGroup>
      </td>
    </tr>
  )
}

function RiesgoRow({ label, defaultVal }: { label: string; defaultVal: string }) {
  const [val, setVal] = useState(defaultVal)
  const id = label.toLowerCase().replace(/\s/g, "-")
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2.5 text-card-foreground">{label}</td>
      <td className="px-4 py-2.5" colSpan={3}>
        <RadioGroup value={val} onValueChange={setVal} className="flex justify-center gap-12">
          <RadioGroupItem value="bajo" id={`${id}-bajo`} />
          <RadioGroupItem value="medio" id={`${id}-medio`} />
          <RadioGroupItem value="alto" id={`${id}-alto`} />
        </RadioGroup>
      </td>
    </tr>
  )
}

// ══════════════════════════════════════════════════
// EXCEPCION DO FORM
// ══════════════════════════════════════════════════
const SECRETARIAS_EXCEPCION = [
  "Sec. de Finanzas",
  "Sec. de Educacion",
  "Sec. de Salud",
  "Sec. de Gobierno",
  "Sec. de Obras",
  "Sec. de Desarrollo",
]

const UNIDADES_ADMINISTRATIVAS = [
  "Dir. Gral. de Administracion y Finanzas",
  "Dir. Gral. de Profesionalizacion e Innovacion",
  "Dir. Gral. de Recursos Humanos",
]

function ExcepcionDOForm({ onBack }: { onBack: () => void }) {
  const { crearExcepcionDO, crearRegularizacionDO } = useSolicitudes()

  const [subTipo, setSubTipo] = useState<"captura" | "regularizacion">("captura")
  const [tipoSolicitud, setTipoSolicitud] = useState<"prestacion" | "nombramiento" | "">("")
  const [tipoAdmin, setTipoAdmin] = useState<TipoAdministracion>("centralizada")
  const [secretaria, setSecretaria] = useState("")
  const [unidad, setUnidad] = useState("")
  const [denominacion, setDenominacion] = useState("")
  const [vigenciaInicio, setVigenciaInicio] = useState("")
  const [vigenciaFin, setVigenciaFin] = useState("")
  const [importeBruto, setImporteBruto] = useState("")
  const [folioManual, setFolioManual] = useState("")
  const [fechaRecepcion, setFechaRecepcion] = useState("")
  const [folioSolicitud, setFolioSolicitud] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [assignedFolio, setAssignedFolio] = useState("")

  const canSubmit = tipoSolicitud && secretaria && unidad && denominacion &&
    vigenciaInicio && vigenciaFin && importeBruto && fechaRecepcion && folioSolicitud &&
    (subTipo === "captura" ? folioManual : true)

  const handleSubmit = () => {
    if (!canSubmit) return

    if (subTipo === "regularizacion") {
      const tempFolio = crearRegularizacionDO({
        folioSolicitud,
        tipo: tipoSolicitud === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
        tipoAdministracion: tipoAdmin,
        secretaria,
        unidadAdministrativa: unidad,
        fechaCreacion: fechaRecepcion,
        fechaRecepcionDO: fechaRecepcion,
        slaDiasHabiles: 15,
        denominacion,
        vigenciaInicio,
        vigenciaFin,
        importeBruto: `$${importeBruto}`,
        esRenovacion: false,
        folioAnterior: null,
        esExcepcionDO: true,
        esRegularizacion: true,
      })
      setAssignedFolio(tempFolio)
    } else {
      crearExcepcionDO({
        folioSolicitud,
        folioRecepcion: folioManual,
        tipo: tipoSolicitud === "prestacion" ? "Prestacion de Servicios" : "Nombramiento Tiempo Det.",
        tipoAdministracion: tipoAdmin,
        secretaria,
        unidadAdministrativa: unidad,
        fechaCreacion: fechaRecepcion,
        fechaRecepcionDO: fechaRecepcion,
        slaDiasHabiles: 15,
        denominacion,
        vigenciaInicio,
        vigenciaFin,
        importeBruto: `$${importeBruto}`,
        esRenovacion: false,
        folioAnterior: null,
        esExcepcionDO: true,
        folioRecepcionManual: true,
        folioTemporal: false,
        folioTemporalOriginal: null,
        folioOficializadoPor: null,
        fechaOficializacion: null,
        esRegularizacion: false,
      })
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <Card className={`shadow-sm border-2 ${subTipo === "regularizacion" ? "border-primary/30" : "border-secondary/30"}`}>
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
            <p className="text-base font-semibold text-card-foreground text-center">
              {subTipo === "regularizacion"
                ? "Regularizacion registrada exitosamente"
                : "Excepcion DO registrada exitosamente"}
            </p>
            {subTipo === "regularizacion" ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0 text-sm px-3 py-1">
                    Folio temporal: {assignedFolio}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Folio solicitud: {folioSolicitud}
                </p>
                <p className="text-xs text-muted-foreground text-center max-w-md">
                  La solicitud fue ingresada a la Bandeja DO Filtro 1 con un folio temporal.
                  El revisor de Filtro 1 debera oficializar el folio antes de continuar con la revision.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Folio manual: {folioManual} | Folio solicitud: {folioSolicitud}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  La solicitud fue ingresada directamente a la Bandeja DO Filtro 1 para su revision.
                </p>
              </>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Volver
              </Button>
              <Button
                onClick={() => {
                  setSubmitted(false)
                  setTipoSolicitud("")
                  setSecretaria("")
                  setUnidad("")
                  setDenominacion("")
                  setVigenciaInicio("")
                  setVigenciaFin("")
                  setImporteBruto("")
                  setFolioManual("")
                  setFechaRecepcion("")
                  setFolioSolicitud("")
                  setAssignedFolio("")
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Registrar Otra
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Excepcion DO</h2>
          <p className="text-sm text-muted-foreground">
            Captura directa por la Direccion de Organizacion
          </p>
        </div>
      </div>

      {/* Subtype selector */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ShieldAlert className="h-5 w-5 text-accent-foreground" />
            Tipo de Excepcion
          </CardTitle>
          <CardDescription>Seleccione el tipo de ingreso excepcional</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={subTipo}
            onValueChange={(v) => setSubTipo(v as "captura" | "regularizacion")}
            className="flex flex-col gap-3"
          >
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "captura" ? "border-accent bg-accent/5" : "border-border hover:border-secondary/50"
              }`}>
              <RadioGroupItem value="captura" id="sub-captura" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Captura DO</span>
                <span className="text-xs text-muted-foreground">
                  Ingreso directo con folio de recepcion y fecha asignados manualmente por la DO.
                </span>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${subTipo === "regularizacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
              }`}>
              <RadioGroupItem value="regularizacion" id="sub-regularizacion" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-card-foreground">Regularizacion</span>
                <span className="text-xs text-muted-foreground">
                  Ingreso con folio temporal generado automaticamente. El revisor de Filtro 1 oficializara el folio.
                </span>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Info banner */}
      {subTipo === "captura" ? (
        <Card className="shadow-sm border-accent/30 border-2 bg-accent/[0.05]">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldAlert className="h-5 w-5 shrink-0 text-accent-foreground mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-card-foreground">Captura de Excepcion</span>
              <span className="text-xs text-muted-foreground">
                Esta solicitud sera ingresada directamente al flujo de la DO (Filtro 1) sin pasar por la validacion de la UEFA.
                Requiere folio de recepcion y fecha de recepcion asignados manualmente.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-primary/30 border-2 bg-primary/[0.03]">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-card-foreground">Regularizacion</span>
              <span className="text-xs text-muted-foreground">
                Esta solicitud sera ingresada con un folio temporal (ej. FE-009-1). El revisor de Filtro 1
                debera oficializar el folio asignando el folio definitivo y la fecha de recepcion oficial
                antes de que el expediente avance al siguiente filtro.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folio / Fecha Recepcion */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ClipboardList className="h-5 w-5 text-secondary" />
            {subTipo === "captura" ? "Datos de Recepcion (Manual)" : "Datos de Recepcion"}
          </CardTitle>
          <CardDescription>
            {subTipo === "captura"
              ? "Asigne el folio de recepcion y la fecha de recepcion manualmente"
              : "El folio de recepcion sera asignado automaticamente como folio temporal"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Folio de Solicitud *</Label>
              <Input
                value={folioSolicitud}
                onChange={(e) => setFolioSolicitud(e.target.value)}
                placeholder={subTipo === "captura" ? "Ej. SDTF-2026-EX001" : "Ej. SDTF-2026-REG001"}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Identificador unico de la solicitud</p>
            </div>
            {subTipo === "captura" && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Folio de Recepcion (Manual) *</Label>
                <Input
                  value={folioManual}
                  onChange={(e) => setFolioManual(e.target.value)}
                  placeholder="Ej. FE-EX001"
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">Folio asignado manualmente por DO</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Fecha de Recepcion *</Label>
              <Input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
                className="bg-background"
              />
              {subTipo === "regularizacion" && (
                <p className="text-xs text-muted-foreground">Sera ajustada al oficializar el folio</p>
              )}
            </div>
          </div>
          {subTipo === "regularizacion" && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  El folio temporal se generara automaticamente al registrar (formato: MES-NNN-1)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo + Administracion */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">Tipo de Solicitud</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Tipo de Solicitud *</Label>
              <RadioGroup
                value={tipoSolicitud}
                onValueChange={(v) => setTipoSolicitud(v as "prestacion" | "nombramiento")}
                className="flex flex-col gap-2"
              >
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${tipoSolicitud === "prestacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                  }`}>
                  <RadioGroupItem value="prestacion" id="exc-prestacion" />
                  <span className="text-sm text-card-foreground">Prestacion de Servicios</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${tipoSolicitud === "nombramiento" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                  }`}>
                  <RadioGroupItem value="nombramiento" id="exc-nombramiento" />
                  <span className="text-sm text-card-foreground">Nombramiento por Tiempo Determinado</span>
                </label>
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Tipo de Administracion *</Label>
              <RadioGroup
                value={tipoAdmin}
                onValueChange={(v) => setTipoAdmin(v as TipoAdministracion)}
                className="flex flex-col gap-2"
              >
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${tipoAdmin === "centralizada" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                  }`}>
                  <RadioGroupItem value="centralizada" id="exc-centralizada" />
                  <div>
                    <span className="text-sm text-card-foreground">Centralizada</span>
                    <p className="text-xs text-muted-foreground">Genera Dictamen Tecnico Funcional</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${tipoAdmin === "paraestatal" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                  }`}>
                  <RadioGroupItem value="paraestatal" id="exc-paraestatal" />
                  <div>
                    <span className="text-sm text-card-foreground">Paraestatal</span>
                    <p className="text-xs text-muted-foreground">Genera Opinion Tecnica Funcional</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos del Solicitante */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">I</span>
            Datos del Solicitante
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Secretaria *</Label>
              <Select value={secretaria} onValueChange={setSecretaria}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {SECRETARIAS_EXCEPCION.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Unidad Administrativa *</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_ADMINISTRATIVAS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Denominacion *</Label>
              <Input
                value={denominacion}
                onChange={(e) => setDenominacion(e.target.value)}
                placeholder="Ej. Analista de Sistemas"
                className="bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Importe Bruto *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  value={importeBruto}
                  onChange={(e) => setImporteBruto(e.target.value)}
                  placeholder="0.00"
                  className="bg-background pl-7"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Vigencia *</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} className="bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Termino</span>
                  <Input type="date" value={vigenciaFin} onChange={(e) => setVigenciaFin(e.target.value)} className="bg-background" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document upload placeholder */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <FileText className="h-4 w-4 text-secondary" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-secondary cursor-pointer">
            <div className="flex flex-col items-center gap-1 text-center">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Adjuntar documentacion de soporte (PDF, DOC)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
        >
          {subTipo === "regularizacion" ? <Clock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {subTipo === "regularizacion" ? "Registrar Regularizacion" : "Registrar Excepcion DO"}
        </Button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════
export function NuevaSolicitudPage() {
  const [step, setStep] = useState<Step>("tipo")
  const [tipo, setTipo] = useState<TipoSolicitud>("")
  const [esRenovacion, setEsRenovacion] = useState<string>("")
  const [folioSeleccionado, setFolioSeleccionado] = useState<string>("")
  const [condicionRenovacion, setCondicionRenovacion] = useState<string>("")
  const [prefilled, setPrefilled] = useState(false)
  const [lockVigenciaOnly, setLockVigenciaOnly] = useState(false)

  // Silent permission check
  const { getPermisoActivo, consumirPermiso } = useAutorizaciones()
  const { user } = useAuth()

  // Periodo de aplicacion
  const [regimenPeriodo, setRegimenPeriodo] = useState<"" | "honorarios" | "asimilados" | "nombramiento">("")
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("")

  const handleContinueToRenovacion = () => {
    if (tipo) setStep("renovacion")
  }

  const handleContinueToFormulario = () => {
    if (esRenovacion === "si" && folioSeleccionado) {
      setPrefilled(true)
      setLockVigenciaOnly(condicionRenovacion === "mismas")
    } else {
      setPrefilled(false)
      setLockVigenciaOnly(false)
    }
    setStep("formulario")
  }

  const handleBack = useCallback(() => {
    if (step === "formulario") setStep("renovacion")
    else if (step === "renovacion") setStep("tipo")
  }, [step])

  // Silent: check if user has an active permission for current regimen+periodo
  const permisoActivo = regimenPeriodo && periodoSeleccionado && user?.name
    ? getPermisoActivo(user.name, regimenPeriodo, periodoSeleccionado)
    : null

  const folio = folioSeleccionado ? MOCK_FOLIOS.find((f) => f.id === folioSeleccionado) : null


  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Nueva Solicitud</h2>
              <p className="text-sm text-muted-foreground">
                Registre una nueva solicitud de dictaminacion tecnica funcional
              </p>
            </div>
          </div>
        </div>
        <StepIndicator step={step} tipo={tipo} />
      </div>

      {/* ── STEP 1: TIPO ── */}
      {step === "tipo" && (
        <>
          {/* Periodo de aplicacion */}
          <Card className="shadow-sm border-secondary/30 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <Calendar className="h-5 w-5 text-secondary" />
                Periodo de aplicacion
              </CardTitle>
              <CardDescription>
                Seleccione el regimen y periodo para consultar las fechas limite de recepcion
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-5 md:grid-cols-2">

                {/* Regimen selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Regimen</Label>
                  <Select
                    value={regimenPeriodo}
                    onValueChange={(v) => {
                      const nuevo = v as "honorarios" | "asimilados" | "nombramiento"
                      setRegimenPeriodo(nuevo)
                      setPeriodoSeleccionado("")

                      // Forzar Tipo de Solicitud compatible
                      if (nuevo === "nombramiento") setTipo("nombramiento")
                      else setTipo("prestacion")
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Seleccione regimen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorarios">Honorarios</SelectItem>
                      <SelectItem value="asimilados">Honorarios asimilados a salarios</SelectItem>
                      <SelectItem value="nombramiento">Nombramiento por tiempo determinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Period selector */}
                {regimenPeriodo === "honorarios" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Mes de aplicacion</Label>
                    <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Seleccione mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAP_3000.map((r) => (
                          <SelectItem key={r.mes} value={r.mes}>{r.mes}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {regimenPeriodo === "asimilados" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Quincena de aplicacion</Label>
                    <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Seleccione quincena" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAP_1000.map((r) => (
                          <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {regimenPeriodo === "nombramiento" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Quincena de aplicacion</Label>
                    <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Seleccione quincena" />
                      </SelectTrigger>
                      <SelectContent>
                        {NOMBRAMIENTO_TD.map((r) => (
                          <SelectItem key={r.quincena} value={r.quincena}>{r.quincena}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Info panel with limits */}
              {periodoSeleccionado && (() => {
                const row =
                  regimenPeriodo === "honorarios"
                    ? CAP_3000.find((r) => r.mes === periodoSeleccionado)
                    : regimenPeriodo === "asimilados"
                      ? CAP_1000.find((r) => r.quincena === periodoSeleccionado)
                      : NOMBRAMIENTO_TD.find((r) => r.quincena === periodoSeleccionado)
                if (!row) return null
                const limiteDODate = parseDateDMY(row.limiteDO)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const enTiempo = today <= limiteDODate
                return (
                  <div className={`rounded-lg border-2 p-4 flex flex-col gap-3 ${enTiempo ? "border-secondary/30 bg-secondary/5" : "border-border bg-muted/30"
                    }`}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Limite DO (Dictamen)</span>
                        <span className="text-sm font-semibold text-card-foreground">{row.limiteDO}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Limite DGRH (Alta)</span>
                        <span className="text-sm font-semibold text-card-foreground">{row.limiteDGRH}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {enTiempo ? (
                        <Badge className="bg-secondary/15 text-secondary border-0 gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          En tiempo
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          El periodo seleccionado no esta disponible para registro.
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <FilePlus className="h-5 w-5 text-secondary" />
                Seleccione Tipo de Solicitud
              </CardTitle>
              <CardDescription>Elija el tipo de justificacion que desea registrar</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RadioGroup
                value={tipo}
                onValueChange={(v) => {
                  const next = v as TipoSolicitud
                  const allowPrestacion = regimenPeriodo !== "nombramiento"
                  const allowNombramiento = regimenPeriodo === "nombramiento"

                  if (next === "prestacion" && !allowPrestacion) return
                  if (next === "nombramiento" && !allowNombramiento) return
                  setTipo(next)
                }}
                className="flex flex-col gap-3"
              >
                <label
                  htmlFor="tipo-prestacion"
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors ${tipo === "prestacion" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                    }`}
                >
                  <RadioGroupItem
                    value="prestacion"
                    id="tipo-prestacion"
                    className="mt-0.5"
                    disabled={regimenPeriodo === "nombramiento"}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-card-foreground">
                      Justificacion de Prestacion de Servicios
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Honorarios / Honorarios Asimilados a Salarios
                    </span>
                  </div>
                </label>
                <label
                  htmlFor="tipo-nombramiento"
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors ${tipo === "nombramiento" ? "border-primary bg-primary/5" : "border-border hover:border-secondary/50"
                    }`}
                >
                  <RadioGroupItem
                    value="nombramiento"
                    id="tipo-nombramiento"
                    className="mt-0.5"
                    disabled={regimenPeriodo !== "nombramiento"}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-card-foreground">
                      Justificacion para Nombramiento por Tiempo Determinado
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Contratacion temporal con nivel y nombramiento del tabulador
                    </span>
                  </div>
                </label>
              </RadioGroup>
              <div className="flex justify-end pt-2">
                <Button onClick={handleContinueToRenovacion} disabled={!tipo} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Continuar
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── STEP 2: RENOVACION ── */}
      {step === "renovacion" && (
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              <FileText className="h-5 w-5 text-secondary" />
              Renovacion
            </CardTitle>
            <CardDescription>Indique si esta solicitud es una renovacion de un dictamen anterior</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Es renovacion? *</Label>
              <RadioGroup value={esRenovacion} onValueChange={setEsRenovacion} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="si" id="ren-si" />
                  <Label htmlFor="ren-si" className="text-sm font-normal cursor-pointer">Si</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="ren-no" />
                  <Label htmlFor="ren-no" className="text-sm font-normal cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {esRenovacion === "si" && (
              <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Folio del Dictamen/Opinion Anterior</Label>
                  <Select value={folioSeleccionado} onValueChange={setFolioSeleccionado}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Seleccione folio anterior" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_FOLIOS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.id} — Emitido: {f.fecha}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {folio && (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Fecha de Emision</span>
                        <span className="text-sm font-medium text-card-foreground">{folio.fecha}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Vigencia Anterior</span>
                        <span className="text-sm font-medium text-card-foreground">{folio.vigencia}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Fecha de Vencimiento</span>
                        <span className="text-sm font-medium text-card-foreground">{folio.vencimiento}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <Label className="text-sm font-medium">Condicion de Renovacion</Label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={condicionRenovacion === "mismas"}
                            onCheckedChange={() => setCondicionRenovacion("mismas")}
                          />
                          <span className="text-sm">Se solicita bajo mismas condiciones tecnicas y funcionales</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">

                        </label>
                      </div>
                      {condicionRenovacion === "mismas" && (
                        <div className="flex items-center gap-2 rounded-md bg-secondary/10 px-3 py-2">
                          <AlertCircle className="h-4 w-4 text-secondary" />
                          <span className="text-xs text-secondary">Se precargaran automaticamente los datos del dictamen anterior</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Anterior
              </Button>
              <Button
                onClick={handleContinueToFormulario}
                disabled={!esRenovacion || (esRenovacion === "si" && !folioSeleccionado)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continuar
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: FORMULARIO ── */}
      {step === "formulario" && (
        <>
          {/* Tipo badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-primary text-primary-foreground">
              {tipo === "prestacion" ? "Prestacion de Servicios" : "Nombramiento por Tiempo Determinado"}
            </Badge>
            {prefilled && (
              <Badge variant="outline" className="border-secondary text-secondary">
                Renovacion — Datos precargados
              </Badge>
            )}
          </div>

          {tipo === "prestacion" ? (
            <FormularioPrestacion prefilled={prefilled} lockVigenciaOnly={lockVigenciaOnly} />
          ) : (
            <FormularioNombramiento prefilled={prefilled} />
          )}

          {/* Action buttons */}
          {(() => {
            // Check periodo validity
            const periodoStillValid =
              regimenPeriodo && periodoSeleccionado
                ? isPeriodoVigente(regimenPeriodo, periodoSeleccionado).vigente
                : false

            // Silent: if periodo expired but user has permission, allow as extemporanea
            const hasPermiso = !!permisoActivo
            const canSend = periodoStillValid || hasPermiso

            return (
              <div className="flex flex-col gap-3">
                {!canSend && regimenPeriodo && periodoSeleccionado && (
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-xs text-muted-foreground">
                      El periodo seleccionado no esta disponible para registro.
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button variant="outline">
                      <Save className="mr-1.5 h-4 w-4" />
                      Guardar Borrador
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={!canSend}
                      onClick={() => {
                        // When sending with a permission (extemporanea), consume it
                        if (!periodoStillValid && hasPermiso && user?.name && regimenPeriodo && periodoSeleccionado) {
                          consumirPermiso(user.name, regimenPeriodo, periodoSeleccionado)
                        }
                      }}
                    >
                      <SendHorizonal className="mr-1.5 h-4 w-4" />
                      Enviar a Validacion
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
