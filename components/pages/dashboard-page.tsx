"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/page-layout"
import { PageHeader } from '@/components/page-header';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  FileText, Briefcase, FileQuestion, UserCheck,
  FileOutput, Users, Clock, RefreshCw, Loader2,
  BarChart2, TrendingUp, FileSpreadsheet, ChevronRight,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList, Label,
} from "recharts"
import * as XLSX from "xlsx"

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
const C_MORA10       = "#3c0126"
const C_MORA50       = "#ab5e84"
const C_MORA90       = "#ffd8e7"
const C_PIEDRA40    = "#3f80ff"
const C_PIEDRA70    = "#79a6ff"
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

const ANIOS = [ "2026"]
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
          <CardTitle className="ds-label-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="ds-label-md text-[var(--color-core-piedra-40)] py-8 text-center">{emptyMsg ?? "Sin datos para el periodo seleccionado."}</p>
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
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#ECEBE7" />
            <XAxis
              dataKey={nameKey}
              tick={false}
              interval={0}
              tickFormatter={(v) => truncate(v)}
              angle={-38}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: "#d6d5cf" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#8D8A84" }}
              allowDecimals={false}
              width={30}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxVal * 1.18)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(40,60,42,0.05)" }} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 4, 4]} barSize={12} maxBarSize={14} name="Solicitudes">
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

function GraficaEmisiones({ data, title, barKey, color }: {
  data: { secretaria: string; dictamenes: number; opiniones: number }[]
  title: string
  barKey: "dictamenes" | "opiniones"
  color: string
}) {
  const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + "…" : s
  const maxVal = Math.max(...data.map(d => d[barKey] ?? 0), 0)
  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="ds-label-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="ds-label-md text-[var(--color-core-piedra-40)] py-8 text-center">Sin emisiones en el periodo seleccionado.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-1">
        
      </CardHeader>

      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 12, left: -4, bottom: 64 }}
            barGap={3}
          >
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#ECEBE7" />
            <XAxis
              dataKey="secretaria"

              tick={false}
              interval={0}
              tickFormatter={(v) => truncate(v)}
              angle={-38}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: "#d6d5cf" }}
               />
               <YAxis
               tick={{ fontSize: 11, fill: "#8D8A84" }}
               allowDecimals={false}
               width={30}
               tickLine={false}
               axisLine={false}
                domain={[0, Math.ceil(maxVal * 1.18)]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(40,60,42,0.05)" }} />
                  <Legend
                    verticalAlign="bottom"
                    align="left"
                    iconType="circle"
                    iconSize={8}
                      formatter={(value) => (
                        <span className="text-black font-medium">{value}</span>
                      )}
                    wrapperStyle={{
                      fontSize: "12px",
                      paddingTop: "10px",
                      paddingLeft: "12px",
                    }}
                  />
                <Bar dataKey={barKey} name={barKey === "dictamenes" ? "Dictámenes" : "Opiniones"} fill={color} radius={[4, 4, 4, 4]} barSize={12} maxBarSize={14}>
                <LabelList
                dataKey={barKey}
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
  Centralizada: C_MORA10,

  Paraestatal:  C_MORA50,
}
const DONUT_INNER_RADIUS = 80
const DONUT_OUTER_RADIUS = 110
const DONUT_PADDING_ANGLE = 1
const RADIAN = Math.PI / 180

function DonutSimple({ items, subLabel }: {
  items: { name: string; value: number; color: string }[]
  subLabel: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = items.reduce((s, d) => s + d.value, 0)

  const activeMidAngle = useMemo(() => {
    if (activeIndex === null || total <= 0) return null
    const realTotalAngle = 360 - items.length * DONUT_PADDING_ANGLE
    let cur = 0
    for (let i = 0; i < items.length; i++) {
      const start = i === 0 ? 0 : cur + DONUT_PADDING_ANGLE
      const end = start + (items[i].value / total) * realTotalAngle
      if (i === activeIndex) return (start + end) / 2
      cur = end
    }
    return null
  }, [activeIndex, items, total])

  const tooltipOffset = useMemo(() => {
    if (activeMidAngle === null) return null
    const radius = DONUT_OUTER_RADIUS + 20
    return {
      dx: radius * Math.cos(-activeMidAngle * RADIAN),
      dy: radius * Math.sin(-activeMidAngle * RADIAN),
    }
  }, [activeMidAngle])

  return (
    <div className="mx-auto grid min-h-[250px] max-w-[720px] items-center gap-4 md:grid-cols-[300px_260px]">
      <div className="relative flex h-[230px] w-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              cx="50%"
              cy="50%"
              innerRadius={DONUT_INNER_RADIUS}
              outerRadius={DONUT_OUTER_RADIUS}
              cornerRadius={7}
              paddingAngle={DONUT_PADDING_ANGLE}
              dataKey="value"
              stroke="#fff"
              strokeWidth={3}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {items.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.18}
                  className="transition-opacity duration-200"
                />
              ))}
            </Pie>

            <Label
              content={<CenterLabel total={total} label={subLabel} />}
              position="center"
            />

           
          </PieChart>
        </ResponsiveContainer>

        {activeIndex !== null && total > 0 && tooltipOffset && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-semibold shadow-md"
            style={{
              left: `calc(50% + ${tooltipOffset.dx}px)`,
              top: `calc(50% + ${tooltipOffset.dy}px)`,
              color: items[activeIndex].color,
            }}
          >
            {((items[activeIndex].value / total) * 100).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-1.5">
        {items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            className={[
              "flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
              activeIndex === index ? "bg-muted" : "hover:bg-muted/70",
            ].join(" ")}
          >
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-medium leading-tight text-card-foreground">
                {item.name}
              </span>
              <span className="text-xs font-bold text-card-foreground">
                {item.value.toLocaleString("es-MX")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
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
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#ECEBE7" />
          <XAxis
            dataKey="secretaria"
            //tick={{ fontSize: 11, fill: "#6b6960" }}
            tick={false}
            interval={0}
            tickFormatter={(v) => truncate(v)}
            angle={-38}
            textAnchor="end"
            tickLine={false}
            axisLine={{ stroke: "#d6d5cf" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8D8A84" }}
            allowDecimals={false}
            width={30}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.ceil(maxVal * 1.18)]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(40,60,42,0.05)" }} />
          <Bar dataKey="prestadores" name="Prestadores" fill={color} radius={[4, 4, 4, 4]} barSize={12} maxBarSize={14} isAnimationActive={false}>
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
  "Honorarios":           C_MORA90,
  "Honorarios Asimilados": C_MORA50,
  "Nombramiento":         C_MORA10,
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
        <CardTitle className="ds-label-lg">Prestadores por Régimen</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="ds-label-md text-[var(--color-core-piedra-40)] py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <DonutSimple items={items} subLabel="prestadores" />
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
        <CardTitle className="ds-label-lg">Número de Prestadores de Servicio</CardTitle>
      </CardHeader>
      <CardContent>
        {sinDatos ? (
          <p className="ds-label-md text-[var(--color-core-piedra-40)] py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BarrasPrestadoresPorTipo
              title="Secretarías de  Administración Centralizada"
              items={centralizadas}
              color={C_MORA10}
            />
            <BarrasPrestadoresPorTipo
              title="Secretarías de  Administración Paraestatal"
              items={paraestatales}
              color={C_MORA50}
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
    { name: "Centralizada", value: totalC, color: C_MORA10 },
    { name: "Paraestatal",  value: totalP, color: C_MORA50       },
  ].filter(d => d.value > 0)
  const total = items.reduce((s, d) => s + d.value, 0)
  return (

    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="ds-label-lg">Solicitudes por Administración</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="ds-label-md text-[var(--color-core-piedra-40)] py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <DonutSimple items={items} subLabel="solicitudes" />
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
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardContent className="relative h-[96px]">
        <div
          className="absolute right-4 flex h-5 w-5 items-center font-light justify-center rounded-lg"
        >
          <Icon  strokeWidth={1.2}/>
        </div>

        <div className="pr-10">
          <p className="ds-label-sm">
            {label}
          </p>

          {loading ? (
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-3 text-5xl font-bold leading-none text-card-foreground tabular-nums">
              {value.toLocaleString("es-MX")}
            </p>
          )}

        </div>
      </CardContent>
    </Card>
  )
}

function styleSheet(ws: XLSX.WorkSheet) {
  if (!ws["!ref"]) return ws
  const range = XLSX.utils.decode_range(ws["!ref"])
  for (let C = range.s.c; C <= range.e.c; C++) {
    const hAddr = XLSX.utils.encode_cell({ r: 0, c: C })
    if (ws[hAddr]) {
      ws[hAddr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "283C2A" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: { bottom: { style: "thin", color: { rgb: "CCCCCC" } } },
      }
    }
    for (let R = 1; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[addr]) {
        ws[addr].s = {
          alignment: { vertical: "center", wrapText: true },
          fill: { fgColor: { rgb: R % 2 === 0 ? "F4F4F0" : "FFFFFF" } },
          border: { bottom: { style: "hair", color: { rgb: "E0E0D8" } } },
        }
      }
    }
  }
  return ws
}

function autoColWidths(ws: XLSX.WorkSheet, data: any[][]): XLSX.WorkSheet {
  if (!data.length) return ws
  ws["!cols"] = data[0].map((_, c) =>
    ({ wch: Math.min(50, Math.max(12, ...data.map(r => String(r[c] ?? "").length))) })
  )
  return ws
}

function makeSheet(rows: any[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoColWidths(ws, rows)
  styleSheet(ws)
  return ws
}

function descargarExcel(wb: XLSX.WorkBook, nombre: string) {
  XLSX.writeFile(wb, nombre, { bookType: "xlsx", type: "binary", cellStyles: true })
}

function generarIndicadores(data: DashboardData, periodo: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const rows = [
    ["Indicador", "Valor"],
    ["Total de solicitudes recibidas",                          data.totalRecibidas],
    ["Justificaciones por Honorarios",                          data.honorarios],
    ["Justificaciones por Honorarios asimilados a salarios",    data.asimilados],
    ["Justificaciones por Nombramiento por tiempo determinado", data.nombramiento],
    ["Justificaciones emitidas",                                data.emitidas],
    ["Número total de prestadores de servicio",                 data.prestadores],
    ["Justificaciones en proceso",                              data.enProceso],
  ]
  const ws = makeSheet(rows)
  ws["A1"] = { v: `Indicadores Generales — ${periodo}`, t: "s", s: { font: { bold: true, sz: 13 } } }
  XLSX.utils.book_append_sheet(wb, ws, "Indicadores")
  return wb
}

function generarSolicitudesPorSecretaria(data: DashboardData, periodo: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const rowsC = [
    ["Secretaría", "Solicitudes"],
    ...data.porSecretariaCentralizada.map(r => [r.secretaria, r.count]),
    ["TOTAL", data.porSecretariaCentralizada.reduce((s, r) => s + r.count, 0)],
  ]
  const rowsP = [
    ["Secretaría", "Solicitudes"],
    ...data.porSecretariaParaestatal.map(r => [r.secretaria, r.count]),
    ["TOTAL", data.porSecretariaParaestatal.reduce((s, r) => s + r.count, 0)],
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsC), "Centralizada")
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsP), "Paraestatal")
  return wb
}

function generarEmisiones(data: DashboardData, periodo: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const rowsC = [
    ["Secretaría", "Dictámenes"],
    ...data.emisionesPorSecretaria.filter(e => e.dictamenes > 0).map(r => [r.secretaria, r.dictamenes]),
  ]
  const rowsP = [
    ["Secretaría", "Opiniones"],
    ...data.emisionesPorSecretaria.filter(e => e.opiniones > 0).map(r => [r.secretaria, r.opiniones]),
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsC), "Centralizada")
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsP), "Paraestatal")
  return wb
}

function generarPrestadores(data: DashboardData, periodo: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const rowsR = [
    ["Régimen", "Prestadores"],
    ...data.prestadoresPorRegimen.map(r => [r.regimen, r.prestadores]),
  ]
  const rowsS = [
    ["Secretaría", "Tipo de Administración", "Prestadores"],
    ...data.prestadoresPorSecretaria.map(r => [r.secretaria, r.tipo, r.prestadores]),
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsR), "Por Régimen")
  XLSX.utils.book_append_sheet(wb, makeSheet(rowsS), "Por Secretaría")
  return wb
}

function generarReporteCompleto(data: DashboardData, periodo: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Indicador", "Valor"],
    ["Total de solicitudes recibidas",                          data.totalRecibidas],
    ["Justificaciones por Honorarios",                          data.honorarios],
    ["Justificaciones por Honorarios asimilados a salarios",    data.asimilados],
    ["Justificaciones por Nombramiento por tiempo determinado", data.nombramiento],
    ["Justificaciones emitidas",                                data.emitidas],
    ["Número total de prestadores de servicio",                 data.prestadores],
    ["Justificaciones en proceso",                              data.enProceso],
  ]), "Indicadores")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Secretaría", "Solicitudes"],
    ...data.porSecretariaCentralizada.map(r => [r.secretaria, r.count]),
  ]), "Solicitudes Centralizada")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Secretaría", "Solicitudes"],
    ...data.porSecretariaParaestatal.map(r => [r.secretaria, r.count]),
  ]), "Solicitudes Paraestatal")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Secretaría", "Dictámenes"],
    ...data.emisionesPorSecretaria.filter(e => e.dictamenes > 0).map(r => [r.secretaria, r.dictamenes]),
  ]), "Dictámenes")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Secretaría", "Opiniones"],
    ...data.emisionesPorSecretaria.filter(e => e.opiniones > 0).map(r => [r.secretaria, r.opiniones]),
  ]), "Opiniones")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Régimen", "Prestadores"],
    ...data.prestadoresPorRegimen.map(r => [r.regimen, r.prestadores]),
  ]), "Prestadores por Régimen")

  XLSX.utils.book_append_sheet(wb, makeSheet([
    ["Secretaría", "Tipo de Administración", "Prestadores"],
    ...data.prestadoresPorSecretaria.map(r => [r.secretaria, r.tipo, r.prestadores]),
  ]), "Prestadores por Secretaría")

  return wb
}

const REPORTES = [
  {
    id:          "completo",
    titulo:      "Reporte completo",
    descripcion: "Todos los indicadores y gráficas en un solo archivo (7 hojas)",
    generar:     generarReporteCompleto,
    archivo:     (p: string) => `reporte-completo-${p}.xlsx`,
  },
  {
    id:          "indicadores",
    titulo:      "Indicadores generales",
    descripcion: "Resumen de los 7 KPIs del tablero",
    generar:     generarIndicadores,
    archivo:     (p: string) => `indicadores-${p}.xlsx`,
  },
  {
    id:          "solicitudes",
    titulo:      "Solicitudes por Secretaría",
    descripcion: "Desglose de solicitudes recibidas: Centralizada y Paraestatal",
    generar:     generarSolicitudesPorSecretaria,
    archivo:     (p: string) => `solicitudes-por-secretaria-${p}.xlsx`,
  },
  {
    id:          "emisiones",
    titulo:      "Emisiones por Administración",
    descripcion: "Dictámenes (Centralizada) y Opiniones (Paraestatal) por secretaría",
    generar:     generarEmisiones,
    archivo:     (p: string) => `emisiones-${p}.xlsx`,
  },
  {
    id:          "prestadores",
    titulo:      "Prestadores de Servicio",
    descripcion: "Prestadores por régimen y por secretaría",
    generar:     generarPrestadores,
    archivo:     (p: string) => `prestadores-${p}.xlsx`,
  },
]

export function DashboardPage(_props?: { onNavigate?: (page: any) => void; onOpenReview?: (...args: any[]) => void }) {
  const [anio,          setAnio]          = useState(String(new Date().getFullYear()))
  const [mes,           setMes]           = useState("todos")
  const [modalAbierto,  setModalAbierto]  = useState(false)
  const [descargando,   setDescargando]   = useState<string | null>(null)
  const hasDataRef                        = useRef(false)
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const fetchData = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ anio })
      if (mes !== "todos") params.set("mes", mes)
      const res  = await fetch(`/api/dashboard?${params}`)
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? "Error al cargar datos"); return }
      setData(json.data)
      hasDataRef.current = true
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setLoading(false)
    }
  }, [anio, mes])
  useEffect(() => { fetchData() }, [fetchData])
  useRealtime(["dashboard"], fetchData)
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
  const periodoLabel = mes === "todos" ? anio : `${mesFiltroLabel}-${anio}`
  const periodoSlug  = mes === "todos" ? anio : `${anio}-${mes}`
  const [reporteSeleccionado, setReporteSeleccionado] =useState<typeof REPORTES[number] | null>(null)

  const [confirmarDescarga, setConfirmarDescarga] = useState(false)
  

  const handleDescargar = (reporte: typeof REPORTES[number]) => {
    if (!data) return
    setDescargando(reporte.id)
    try {
      const wb = reporte.generar(data, periodoLabel)
      descargarExcel(wb, reporte.archivo(periodoSlug))
    } finally {
      setDescargando(null)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-bg-base">
    <PageHeader
      title="Tablero Informativo"
      subtitle={`Indicadores y Gráficas del Sistema · Periodo  ${anio}${mes !== "Todos" ? ` — ${mesFiltroLabel}` : ""}`}
    />
      <div className="p-8 flex flex-col flex-1 gap-4">
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
          <SelectTrigger className="w-50 bg-card">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="gap-2 ml-auto rounded-full bg-[#773357] hover:bg-[#773357] active:bg-[#773357] text-white active:text-white border-0"
          disabled={!data || loading}
          onClick={() => setModalAbierto(true)}
        >
          Descargar reportes
        </Button>

        {error && (
          <Badge variant="destructive" className="text-xs gap-1">
            {error}
          </Badge>
        )}
      </div>

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-6 w-6 text-secondary" />
              Reportes disponibles
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-0.5">
              Periodo: <strong>{periodoLabel}</strong>
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1 px-6">
            {REPORTES.map(r => (
              <button
                key={r.id}
                onClick={() => {
                     setReporteSeleccionado(r)
                      setConfirmarDescarga(true)
                }}
                disabled={descargando === r.id}
                className="group flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 text-left hover:bg-accent/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary/10">
                  {descargando === r.id
                    ? <Loader2 className="h-5 w-5 text-secondary animate-spin" />
                    : <FileSpreadsheet className="h-5 w-5 text-secondary" />
                  }
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-base font-medium text-card-foreground">{r.titulo}</span>
                  <span className="text-sm text-muted-foreground leading-snug transition-colors group-hover:text-[#5C4A2E] group-active:text-[#5C4A2E] dark:group-hover:text-[#F0DCC0] dark:group-active:text-[#F0DCC0]">
                    {r.descripcion}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground px-6 pt-1 pb-6">
            Los archivos se generan con los datos del periodo seleccionado en el tablero.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmarDescarga} onOpenChange={setConfirmarDescarga}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-lg">
        <FileSpreadsheet className="h-6 w-6 text-secondary" />
        Confirmar descarga
      </DialogTitle>
      <p className="text-sm text-muted-foreground pt-1">
        ¿Está seguro de descargar el reporte{" "}
        <strong className="text-card-foreground">
          {reporteSeleccionado?.titulo}
        </strong>
        ?
      </p>
    </DialogHeader>

    <DialogFooter className="gap-3 pt-6 pb-1 mt-2 border-t border-[#e4e3dc]">
      <Button
        type="button"
        className="rounded-full h-10 px-6 font-medium border-[1.5px] border-[#773357] shadow-sm bg-[#fce4f0] text-[#773357] hover:bg-[#f7cde5] hover:text-[#773357] active:bg-[#fce4f0] active:text-[#773357] focus:bg-[#fce4f0] focus:text-[#773357]"
        onClick={() => setConfirmarDescarga(false)} >
        Cancelar
      </Button>
      <Button
        type="button"
        className="rounded-full h-10 px-6 font-medium shadow-sm bg-[#773357] hover:bg-[#773357] active:bg-[#773357] text-white active:text-white border-0"
        disabled={!reporteSeleccionado || descargando === reporteSeleccionado.id}
        onClick={() => {
          if (!reporteSeleccionado) return

          handleDescargar(reporteSeleccionado)
          setConfirmarDescarga(false)
          setModalAbierto(false)
        }}
      >
        {reporteSeleccionado && descargando === reporteSeleccionado.id
          ? "Descargando..."
          : "Descargar"}
      </Button>
    </DialogFooter>
  </DialogContent>
       </Dialog>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} loading={loading} />
        ))}
      </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <GraficaSolicitudesTipo
                centralizada={data?.porSecretariaCentralizada ?? []}
                paraestatal={data?.porSecretariaParaestatal ?? []}
              />
              <GraficaPrestadores
                porSecretaria={data?.prestadoresPorSecretaria ?? []}
                porTipo={data?.prestadoresPorTipo ?? []}
              />
            </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <GraficaBarrasVertical
                  title="Administración Centralizada"
                  data={data?.porSecretariaCentralizada ?? []}
                  color={C_MORA10}
                  emptyMsg="Sin solicitudes centralizadas en el periodo."
                />
                <GraficaBarrasVertical
                  title="Administración Paraestatal"
                  data={data?.porSecretariaParaestatal ?? []}
                  color={C_MORA50}
                  emptyMsg="Sin solicitudes paraestatales en el periodo."
                />
              </div>
             

            <div className="grid gap-4 lg:grid-cols-2">
              <GraficaEmisiones
                title="Administración Centralizada — Dictámenes"
                data={emisionesCentralizada}
                barKey="dictamenes"
                color={C_MORA10}
              />
              <GraficaEmisiones
                title="Administración Paraestatal — Opiniones"
                data={emisionesParaestatal}
                barKey="opiniones"
                color={C_MORA50}
              />
            </div>

            <div className="flex flex-col gap-4">
              <GraficaPrestadoresPorRegimen data={data?.prestadoresPorRegimen ?? []} />
              
            </div> 
    </div>
    </div>
  )
}
