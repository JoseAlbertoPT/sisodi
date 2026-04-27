"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/page-layout"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import {
  FileText, Briefcase, FileQuestion, UserCheck,
  FileOutput, Users, Clock, RefreshCw, Loader2,
  BarChart2, TrendingUp,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList, Label,
} from "recharts"

interface DashboardData {
  totalRecibidas:            number
  honorarios:                number
  asimilados:                number
  nombramiento:              number
  emitidas:                  number
  prestadores:               number
  enProceso:                 number
  porSecretariaCentralizada: { secretaria: string; count: number }[]
  porSecretariaParaestatal:  { secretaria: string; count: number }[]
  emisionesPorSecretaria:    { secretaria: string; dictamenes: number; opiniones: number }[]
  prestadoresPorSecretaria:  { secretaria: string; prestadores: number; tipo: "Centralizada" | "Paraestatal" }[]
  prestadoresPorTipo:        { tipo: string; prestadores: number }[]
  prestadoresPorRegimen:     { regimen: string; prestadores: number }[]
}

const C_VERDE_OSCURO  = "#283c2a"
const C_OLIVA         = "#6e795a"
const C_DORADO        = "#b5883a"
const C_VERDE_MEDIO   = "#3a5c3a"
const C_AMBAR         = "#c57a2a"
const C_GRIS_VERDE    = "#5a5c4a"
const C_BURDEOS       = "#832b56"
const MESES = [

  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
   { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

const ANIOS = ["2024", "2025", "2026"]
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #d6d5cf",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
}
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle} className="px-3.5 py-2.5 min-w-[140px]">
      {label && <p className="text-xs font-semibold text-foreground mb-2 max-w-[320px] whitespace-normal break-words border-b border-border pb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs mt-1">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color ?? p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground ml-auto pl-3">{Number(p.value).toLocaleString("es-MX")}</span>
        </div>
      ))}
    </div>
  )
}

function GraficaBarrasVertical({
  title, data, color, dataKey = "count", nameKey = "secretaria", emptyMsg,
}: {
  title: string
  data: any[]
  color: string
  dataKey?: string
  nameKey?: string
  emptyMsg?: string
}) {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyMsg ?? "Sin datos para el periodo seleccionado."}</p>
        </CardContent>
      </Card>
    )
  }

  const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + "…" : s
  const maxVal = Math.max(...data.map((d) => d[dataKey] ?? 0))
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 12, left: -4, bottom: 64 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e7e2" />
            <XAxis
              dataKey={nameKey}
              tick={{ fontSize: 10, fill: "#6b6960" }}
              interval={0}
              tickFormatter={(v) => truncate(v)}
              angle={-38}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: "#d6d5cf" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9a9890" }}
              allowDecimals={false}
              width={30}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxVal * 1.18)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} barSize={24} name="Solicitudes">
              <LabelList
                dataKey={dataKey}
                position="top"
                style={{ fontSize: 10, fontWeight: 600, fill: color }}
                formatter={(v: number) => v > 0 ? v : ""}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function GraficaEmisiones({ data, title, barKey, barColor }: {
  data: { secretaria: string; dictamenes: number; opiniones: number }[]
  title: string
  barKey: "dictamenes" | "opiniones"
  barColor: string
}) {
  const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + "…" : s
  const maxVal = Math.max(...data.map(d => d[barKey] ?? 0), 0)
  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">Sin emisiones en el periodo seleccionado.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: barColor }} />
            {barKey === "dictamenes" ? "Dictámenes" : "Opiniones"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 12, left: -4, bottom: 64 }}
            barGap={3}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e7e2" />
            <XAxis
              dataKey="secretaria"
              tick={{ fontSize: 10, fill: "#6b6960" }}
              interval={0}
              tickFormatter={(v) => truncate(v)}
              angle={-38}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: "#d6d5cf" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9a9890" }}
              allowDecimals={false}
              width={30}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxVal * 1.18)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey={barKey} name={barKey === "dictamenes" ? "Dictámenes" : "Opiniones"} fill={barColor} radius={[5, 5, 0, 0]} barSize={24}>
              <LabelList
                dataKey={barKey}
                position="top"
                style={{ fontSize: 10, fontWeight: 600, fill: barColor }}
                formatter={(v: number) => v > 0 ? v : ""}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function CenterLabel({ viewBox, total, label }: { viewBox?: any; total: number; label: string }) {
  const { cx, cy } = viewBox ?? { cx: 0, cy: 0 }
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 26, fontWeight: 700, fill: "#283c2a" }}>
        {total.toLocaleString("es-MX")}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#86857e" }}>
        {label}
      </text>
    </g>
  )
}

const COLORES_SECRETARIA = [
  C_VERDE_OSCURO, C_OLIVA, C_DORADO, C_VERDE_MEDIO, C_AMBAR,
  C_GRIS_VERDE, C_BURDEOS, "#4a7a6a", "#8a6a3a", "#3a5a7a",
  "#6a3a5a", "#5a7a4a", "#7a5a3a", "#3a6a5a", "#6a4a7a",
]
const COLORES_TIPO: Record<string, string> = {
  Centralizada: C_VERDE_OSCURO,

  Paraestatal:  C_DORADO,
}

function DonutSimple({ items, subLabel }: {
  items: { name: string; value: number; color: string }[]
  subLabel: string
}) {
  const total = items.reduce((s, d) => s + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={380}>
      <PieChart>
        <Pie
          data={items}
          cx="50%"
          cy="44%"
          innerRadius={72}
          outerRadius={118}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {items.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
          <Label content={<CenterLabel total={total} label={subLabel} />} position="center" />
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          iconSize={9}
          iconType="circle"
          wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#52504a" }}
          formatter={(v, entry: any) => (
            <span style={{ color: "#52504a" }}>
              {v} <strong style={{ color: entry.color }}>({entry.payload.value})</strong>
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function BarrasPrestadoresPorTipo({
  title, items, color,
}: {
  title: string
  items: { name: string; value: number }[]
  color: string
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <p className="text-xs font-medium text-muted-foreground text-center mb-1">{title}</p>
        <p className="text-sm text-muted-foreground py-8 text-center">Sin datos.</p>
      </div>
    )
  }
  const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + "…" : s
  const maxVal = Math.max(...items.map(d => d.value))
  const barData = items.map(d => ({ secretaria: d.name, prestadores: d.value }))
  return (
    <div className="flex flex-col">
      <p className="text-xs font-medium text-muted-foreground text-center mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={barData} margin={{ top: 20, right: 8, left: -4, bottom: 72 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e7e2" />
          <XAxis
            dataKey="secretaria"
            tick={{ fontSize: 10, fill: "#6b6960" }}
            interval={0}
            tickFormatter={(v) => truncate(v)}
            angle={-38}
            textAnchor="end"
            tickLine={false}
            axisLine={{ stroke: "#d6d5cf" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9a9890" }}
            allowDecimals={false}
            width={30}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.ceil(maxVal * 1.18)]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="prestadores" name="Prestadores" fill={color} radius={[5, 5, 0, 0]} barSize={22} isAnimationActive={false}>
            <LabelList
              dataKey="prestadores"
              position="top"
              style={{ fontSize: 10, fontWeight: 600, fill: color }}
              formatter={(v: number) => v > 0 ? v : ""}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const COLORES_REGIMEN: Record<string, string> = {
  "Honorarios":           C_VERDE_OSCURO,
  "Honorarios Asimilados": C_DORADO,
  "Nombramiento":         C_BURDEOS,
}

function GraficaPrestadoresPorRegimen({ data }: { data: { regimen: string; prestadores: number }[] }) {
  const items = data.map(d => ({
    name:  d.regimen,
    value: d.prestadores,
    color: COLORES_REGIMEN[d.regimen] ?? C_GRIS_VERDE,
  }))
  const total = items.reduce((s, d) => s + d.value, 0)
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-card-foreground">Prestadores por Régimen</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={272}>
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {items.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
                <Label content={<CenterLabel total={total} label="prestadores" />} position="center" />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconSize={9}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#52504a" }}
                formatter={(v, entry: any) => (
                  <span style={{ color: "#52504a" }}>
                    {v} <strong style={{ color: entry.color }}>({entry.payload.value})</strong>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function GraficaPrestadores({
  porSecretaria,
}: {
  porSecretaria: { secretaria: string; prestadores: number; tipo: "Centralizada" | "Paraestatal" }[]
  porTipo?:      { tipo: string; prestadores: number }[]
}) {
  const centralizadas = porSecretaria
    .filter(d => d.tipo === "Centralizada" && d.prestadores > 0)
    .map(d => ({ name: d.secretaria, value: d.prestadores }))
  const paraestatales = porSecretaria
    .filter(d => d.tipo === "Paraestatal" && d.prestadores > 0)
    .map(d => ({ name: d.secretaria, value: d.prestadores }))
  const sinDatos = centralizadas.length === 0 && paraestatales.length === 0
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-card-foreground">Número de Prestadores de Servicio</CardTitle>
      </CardHeader>
      <CardContent>
        {sinDatos ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BarrasPrestadoresPorTipo
              title="Secretarías de  Administración Centralizada"
              items={centralizadas}
              color={C_VERDE_OSCURO}
            />
            <BarrasPrestadoresPorTipo
              title="Secretarías de  Administración Paraestatal"
              items={paraestatales}
              color={C_DORADO}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
function GraficaSolicitudesTipo({
  centralizada, paraestatal,
}: {
  centralizada: { count: number }[]
  paraestatal:  { count: number }[]
}) {
  const totalC = centralizada.reduce((s, d) => s + d.count, 0)
  const totalP = paraestatal.reduce((s, d)  => s + d.count, 0)
  const items = [
    { name: "Centralizada", value: totalC, color: C_VERDE_OSCURO },
    { name: "Paraestatal",  value: totalP, color: C_DORADO       },
  ].filter(d => d.value > 0)
  const total = items.reduce((s, d) => s + d.value, 0)
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-card-foreground">Solicitudes por Administración</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={272}>
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {items.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
                <Label content={<CenterLabel total={total} label="solicitudes" />} position="center" />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconSize={9}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#52504a" }}
                formatter={(v, entry: any) => (
                  <span style={{ color: "#52504a" }}>
                    {v} <strong style={{ color: entry.color }}>({entry.payload.value})</strong>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function KpiCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string; value: number; icon: React.ElementType; color: string; loading: boolean
}) {
  return (
    <Card className="shadow-sm border-border">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          {loading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-muted mb-1" />
          ) : (
            <span className="text-2xl font-bold text-card-foreground tabular-nums">{value.toLocaleString("es-MX")}</span>
          )}
          <span className="text-xs text-muted-foreground leading-snug">{label}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage(_props?: { onNavigate?: (page: any) => void; onOpenReview?: (...args: any[]) => void }) {
  const [anio,    setAnio]    = useState(String(new Date().getFullYear()))
  const [mes,     setMes]     = useState("todos")
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ anio })
      if (mes !== "todos") params.set("mes", mes)
      const res  = await fetch(`/api/dashboard?${params}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar datos"); return }
      setData(json.data)
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [anio, mes])
  useEffect(() => { fetchData() }, [fetchData])
  const kpis = [
    { label: "Total de solicitudes Recibidas",                           value: data?.totalRecibidas ?? 0, icon: FileText,    color: C_VERDE_OSCURO },
    { label: "Justificaciones por Honorarios",                           value: data?.honorarios    ?? 0, icon: Briefcase,   color: C_OLIVA       },
    { label: "Justificaciones por Honorarios asimilados a salarios",     value: data?.asimilados    ?? 0, icon: FileQuestion,color: C_DORADO      },
    { label: "Justificaciones por Nombramiento por tiempo determinado",  value: data?.nombramiento  ?? 0, icon: UserCheck,   color: C_VERDE_MEDIO },
    { label: "Justificaciones Emitidas",                                 value: data?.emitidas      ?? 0, icon: FileOutput,  color: C_AMBAR       },
    { label: "Número total de Prestadores de Servicio",                  value: data?.prestadores   ?? 0, icon: Users,       color: C_BURDEOS     },
    { label: "Justificaciones en Proceso",                               value: data?.enProceso     ?? 0, icon: Clock,       color: C_GRIS_VERDE  },
  ]
  const { emisionesCentralizada, emisionesParaestatal } = (() => {
    if (!data) return { emisionesCentralizada: [], emisionesParaestatal: [] }
    const centralizada = data.emisionesPorSecretaria.filter(e => e.dictamenes > 0)
    const paraestatal  = data.emisionesPorSecretaria.filter(e => e.opiniones > 0)
    return { emisionesCentralizada: centralizada, emisionesParaestatal: paraestatal }
  })()
  const mesFiltroLabel = mes === "todos"
    ? "todos los meses"
    : MESES.find(m => m.value === mes)?.label ?? mes
  return (
    <PageLayout
      title="Tablero Informativo"
      description={`Indicadores y Gráficas del Sistema · ${anio}${mes !== "Todos" ? ` — ${mesFiltroLabel}` : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-28 bg-card">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {ANIOS.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>

        {error && (
          <Badge variant="destructive" className="text-xs gap-1">
            {error}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} loading={loading} />
        ))}
      </div>

      <Accordion type="multiple" defaultValue={["solicitudes", "Emisiones", "Prestadores"]} className="flex flex-col gap-3">

        <AccordionItem value="solicitudes" className="rounded-lg border border-border bg-card shadow-sm px-4">
          <AccordionTrigger className="text-sm font-semibold text-card-foreground hover:no-underline py-4">
            <span className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-secondary" />
              Solicitudes por Secretaría
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex flex-col gap-4">
              <GraficaSolicitudesTipo
                centralizada={data?.porSecretariaCentralizada ?? []}
                paraestatal={data?.porSecretariaParaestatal ?? []}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <GraficaBarrasVertical
                  title="Administración Centralizada"
                  data={data?.porSecretariaCentralizada ?? []}
                  color={C_VERDE_OSCURO}
                  emptyMsg="Sin solicitudes centralizadas en el periodo."
                />
                <GraficaBarrasVertical
                  title="Administración Paraestatal"
                  data={data?.porSecretariaParaestatal ?? []}
                  color={C_DORADO}
                  emptyMsg="Sin solicitudes paraestatales en el periodo."
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="Emisiones" className="rounded-lg border border-border bg-card shadow-sm px-4">
          <AccordionTrigger className="text-sm font-semibold text-card-foreground hover:no-underline py-4">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" />
              Emisiones por Administración
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <GraficaEmisiones
                title="Administración Centralizada — Dictámenes"
                data={emisionesCentralizada}
                barKey="dictamenes"
                barColor={C_VERDE_OSCURO}
              />
              <GraficaEmisiones
                title="Administración Paraestatal — Opiniones"
                data={emisionesParaestatal}
                barKey="opiniones"
                barColor={C_AMBAR}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Prestadores" className="rounded-lg border border-border bg-card shadow-sm px-4">
          <AccordionTrigger className="text-sm font-semibold text-card-foreground hover:no-underline py-4">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-secondary" />
              Número de Prestadores de Servicio
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex flex-col gap-4">
              <GraficaPrestadoresPorRegimen data={data?.prestadoresPorRegimen ?? []} />
              <GraficaPrestadores
                porSecretaria={data?.prestadoresPorSecretaria ?? []}
                porTipo={data?.prestadoresPorTipo ?? []}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </PageLayout>
  )
}
