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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  FileText, Briefcase, FileQuestion, UserCheck,
  FileOutput, Users, Clock, RefreshCw, Loader2,
  BarChart2, TrendingUp, FileSpreadsheet, ChevronRight,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
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

const C_VERDE_OSCURO  = "var(--color-core-bosque-20)"
const C_OLIVA         = "#6e795a"
const C_DORADO        = "#b5883a"
const C_VERDE_MEDIO   = "#3a5c3a"
const C_AMBAR         = "#c57a2a"
const C_GRIS_VERDE    = "#5a5c4a"
const C_BURDEOS       = "var(--color-core-mora-20)"
const C_MORA10       = "#3c0126"
const C_MORA50       = "#ab5e84"
const C_MORA90       = "#ffd8e7"
const C_PIEDRA40    = "#3f80ff"
const C_PIEDRA70    = "#79a6ff"

// ── Paleta de gráficas (vino) ──────────────────────────────────────────
const C_VINO_HOVER  = "#6F2C4F"
const C_ROSA_BASE   = "#C9A3B6"
const DONUT_PALETTE = ["#4F1E37", "#8A4A6A", "#A56A86", "#C9A3B6"]
const donutColor = (i: number) => DONUT_PALETTE[i % DONUT_PALETTE.length]

// Ordena de mayor a menor y asigna la paleta en ese orden (rota si hay más categorías que colores)
function buildDonutItems(raw: { name: string; value: number }[]): { name: string; value: number; color: string }[] {
  return [...raw]
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((d, i) => ({ ...d, color: donutColor(i) }))
}
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
  backgroundColor: "var(--card)",
  border: "1px solid #6F2C4F",
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
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#6F2C4F" }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold ml-auto pl-3" style={{ color: "#6F2C4F" }}>{Number(p.value).toLocaleString("es-MX")}</span>
        </div>
      ))}
    </div>
  )
}

function GraficaBarrasVertical({
  title, subtitle, data, dataKey = "count", nameKey = "secretaria", emptyMsg,
}: {
  title: string
  subtitle?: string
  data: any[]
  dataKey?: string
  nameKey?: string
  emptyMsg?: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-card-foreground">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
            <Bar
              dataKey={dataKey}
              radius={[4, 4, 4, 4]}
              barSize={12}
              maxBarSize={14}
              name="Solicitudes"
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={activeIndex === i ? C_VINO_HOVER : C_ROSA_BASE}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                  className="transition-colors duration-200"
                />
              ))}
              <LabelList
                dataKey={dataKey}
                position="top"
                style={{ fontSize: 10, fontWeight: 600, fill: C_VINO_HOVER }}
                formatter={(v: number) => v > 0 ? v : ""}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function GraficaEmisiones({ data, title, barKey }: {
  data: { secretaria: string; dictamenes: number; opiniones: number }[]
  title: string
  barKey: "dictamenes" | "opiniones"
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + "…" : s
  const maxVal = Math.max(...data.map(d => d[barKey] ?? 0), 0)
  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-card-foreground">{title}</CardTitle>
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
        <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
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
                <Bar
                  dataKey={barKey}
                  name={barKey === "dictamenes" ? "Dictámenes" : "Opiniones"}
                  fill={C_ROSA_BASE}
                  radius={[4, 4, 4, 4]}
                  barSize={12}
                  maxBarSize={14}
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={activeIndex === i ? C_VINO_HOVER : C_ROSA_BASE}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                    className="transition-colors duration-200"
                  />
                ))}
                <LabelList
                dataKey={barKey}
                position="top"
                style={{ fontSize: 10, fontWeight: 600, fill: C_VINO_HOVER }}
                formatter={(v: number) => v > 0 ? v : ""}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
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
const DONUT_INNER_RADIUS = 86
const DONUT_OUTER_RADIUS = 130
const DONUT_PADDING_ANGLE = 1
const DONUT_START_ANGLE = 90 // 12 en punto
const DONUT_SIZE = 290
const RADIAN = Math.PI / 180

function DonutSimple({ items: rawItems, subLabel }: {
  items: { name: string; value: number; color: string }[]
  subLabel: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const items = rawItems.filter(d => d.value > 0)
  const total = items.reduce((s, d) => s + d.value, 0)
  const isSingle = items.length === 1

  const activeMidAngle = useMemo(() => {
    if (activeIndex === null || total <= 0 || items.length < 2) return null
    const realTotalAngle = 360 - items.length * DONUT_PADDING_ANGLE
    let cur = 0
    for (let i = 0; i < items.length; i++) {
      const start = i === 0 ? 0 : cur + DONUT_PADDING_ANGLE
      const end = start + (items[i].value / total) * realTotalAngle
      // recharts avanza en sentido horario desde DONUT_START_ANGLE
      if (i === activeIndex) return DONUT_START_ANGLE - (start + end) / 2
      cur = end
    }
    return null
  }, [activeIndex, items, total])

  const tooltipOffset = useMemo(() => {
    if (activeIndex === null) return null
    const angle = isSingle ? DONUT_START_ANGLE : activeMidAngle
    if (angle === null) return null
    const radius = DONUT_OUTER_RADIUS + 24
    return {
      dx: radius * Math.cos(-angle * RADIAN),
      dy: radius * Math.sin(-angle * RADIAN),
    }
  }, [activeIndex, activeMidAngle, isSingle])

  if (items.length === 0) {
    return (
      <div className="flex h-[290px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[320px] flex-col items-center gap-4">
      <div className="relative h-[290px] w-[290px]">
        {isSingle ? (
          <svg
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
            className="cursor-pointer"
            onMouseEnter={() => setActiveIndex(0)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={(DONUT_OUTER_RADIUS + DONUT_INNER_RADIUS) / 2}
              fill="none"
              stroke={items[0].color}
              strokeWidth={DONUT_OUTER_RADIUS - DONUT_INNER_RADIUS}
              className="transition-opacity duration-200"
            />
          </svg>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="50%"
                startAngle={DONUT_START_ANGLE}
                endAngle={DONUT_START_ANGLE - 360}
                innerRadius={DONUT_INNER_RADIUS}
                outerRadius={DONUT_OUTER_RADIUS}
                cornerRadius={4}
                paddingAngle={DONUT_PADDING_ANGLE}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {items.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.25}
                    className="cursor-pointer transition-opacity duration-200"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {activeIndex === null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] font-bold text-card-foreground">{total.toLocaleString("es-MX")}</span>
            <span className="text-[11px] text-muted-foreground">{subLabel}</span>
          </div>
        ) : tooltipOffset && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] shadow-md"
            style={{
              left: `calc(50% + ${tooltipOffset.dx}px)`,
              top: `calc(50% + ${tooltipOffset.dy}px)`,
              backgroundColor: "var(--card)",
              borderColor: items[activeIndex].color,
            }}
          >
            <span className="font-bold" style={{ color: items[activeIndex].color }}>
              {((items[activeIndex].value / total) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-1">
        {items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left transition-opacity duration-200"
            style={{ opacity: activeIndex === null || activeIndex === index ? 1 : 0.4 }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className={`min-w-0 flex-1 truncate text-xs text-card-foreground ${activeIndex === index ? "font-bold" : "font-medium"}`}>
              {item.name}
            </span>
            <span className="text-xs font-bold text-card-foreground">
              {item.value.toLocaleString("es-MX")}
            </span>
            <span
              className="w-12 shrink-0 text-right text-[11px] font-medium text-muted-foreground transition-opacity duration-200"
              style={{ opacity: activeIndex === index ? 1 : 0 }}
            >
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BarrasPrestadoresPorTipo({
  title, items,
}: {
  title: string
  items: { name: string; value: number }[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
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
          <Bar
            dataKey="prestadores"
            name="Prestadores"
            fill={C_ROSA_BASE}
            radius={[4, 4, 4, 4]}
            barSize={12}
            maxBarSize={14}
            isAnimationActive={false}
            onMouseEnter={(_, i) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {barData.map((_, i) => (
              <Cell
                key={i}
                fill={activeIndex === i ? C_VINO_HOVER : C_ROSA_BASE}
                opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                className="transition-colors duration-200"
              />
            ))}
            <LabelList
              dataKey="prestadores"
              position="top"
              style={{ fontSize: 10, fontWeight: 600, fill: C_VINO_HOVER }}
              formatter={(v: number) => v > 0 ? v : ""}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GraficaPrestadoresPorRegimen({ data }: { data: { regimen: string; prestadores: number }[] }) {
  const items = buildDonutItems(data.map(d => ({ name: d.regimen, value: d.prestadores })))
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-light text-card-foreground">Prestadores por Régimen</CardTitle>
        <p className="text-xs text-muted-foreground">Distribución de prestadores por tipo de régimen</p>
      </CardHeader>
      <CardContent>
        <DonutSimple items={items} subLabel="prestadores" />
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
        <CardTitle className="text-sm text-card-foreground">Número de Prestadores de Servicio</CardTitle>
      </CardHeader>
      <CardContent>
        {sinDatos ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para el periodo seleccionado.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BarrasPrestadoresPorTipo
              title="Secretarías / Dependencias de la Administración Pública Centralizada"
              items={centralizadas}
            />
            <BarrasPrestadoresPorTipo
              title="Organismos Auxiliares de la Administración Pública Estatal"
              items={paraestatales}
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
  const items = buildDonutItems([
    { name: "Centralizada", value: totalC },
    { name: "Paraestatal",  value: totalP },
  ])
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-card-foreground">Solicitudes por Tipo de Administración</CardTitle>
        <p className="text-xs text-muted-foreground">Distribución de solicitudes por tipo de Administración</p>
      </CardHeader>
      <CardContent>
        <DonutSimple items={items} subLabel="solicitudes" />
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
      <CardContent className="relative h-[78px] px-4 py-2.5">
        <div
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-lg"
        >
          <Icon strokeWidth={1.2} className="h-4 w-4" />
        </div>

        <div className="pr-8">
          <p className="text-xs font-light leading-tight text-card-foreground truncate">
            {label}
          </p>

          {loading ? (
            <div className="mt-2 h-6 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold leading-none text-card-foreground tabular-nums">
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
    ["Justificaciones por honorarios",                          data.honorarios],
    ["Justificaciones por honorarios asimilados a salarios",    data.asimilados],
    ["Justificaciones por nombramiento por tiempo determinado", data.nombramiento],
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
    ["Justificaciones por honorarios",                          data.honorarios],
    ["Justificaciones por honorarios asimilados a salarios",    data.asimilados],
    ["Justificaciones por nombramiento por tiempo determinado", data.nombramiento],
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
    titulo:      "Reporte Completo",
    descripcion: "Todos los indicadores y gráficas en un solo archivo (7 hojas)",
    generar:     generarReporteCompleto,
    archivo:     (p: string) => `reporte-completo-${p}.xlsx`,
  },
  {
    id:          "indicadores",
    titulo:      "Indicadores Generales",
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
    { label: "Total de Solicitudes Recibidas",                           value: data?.totalRecibidas ?? 0, icon: FileText,    color: C_VERDE_OSCURO },
    { label: "Justificaciones de Prestación de Servicios Profesionales por Honorarios",                           value: data?.honorarios    ?? 0, icon: Briefcase,   color: C_OLIVA       },
    { label: "Justificaciones de Prestación de Servicios por Honorarios Asimilados a Salarios",     value: data?.asimilados    ?? 0, icon: FileQuestion,color: C_DORADO      },
    { label: "Justificaciones para Nombramiento por Tiempo Determinado",  value: data?.nombramiento  ?? 0, icon: UserCheck,   color: C_VERDE_MEDIO },
    { label: "Dictaminaciones Emitidas",                                 value: data?.emitidas      ?? 0, icon: FileOutput,  color: C_AMBAR       },
    { label: "Total de Prestadores de Servicio",                  value: data?.prestadores   ?? 0, icon: Users,       color: C_BURDEOS     },
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
      subtitle={`Indicadores y Gráficas del Sistema · Periodo ${anio}${mes !== "todos" ? ` — ${mesFiltroLabel}` : ""}`}
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
          variant="primary"
          className="gap-2 ml-auto"
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
            <DialogTitle className="flex items-center gap-2 ds-title-md">
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
      <ConfirmDialog
        open={confirmarDescarga}
        onClose={() => setConfirmarDescarga(false)}
        onConfirm={() => {
          if (!reporteSeleccionado) return
          handleDescargar(reporteSeleccionado)
          setConfirmarDescarga(false)
          setModalAbierto(false)
        }}
        title="Confirmar descarga"
        description={<>¿Está seguro de descargar el reporte <strong className="font-normal text-content-high">{reporteSeleccionado?.titulo}</strong>?</>}
        confirmLabel="Descargar"
        cancelVariant="default"
      />
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
              <div className="flex flex-col gap-4">
                <GraficaPrestadoresPorRegimen data={data?.prestadoresPorRegimen ?? []} />
              </div>
            </div>
            <GraficaPrestadores
              porSecretaria={data?.prestadoresPorSecretaria ?? []}
              porTipo={data?.prestadoresPorTipo ?? []}
            />
              <div className="grid gap-4 lg:grid-cols-2">
                <GraficaBarrasVertical
                  title="Administración Pública Centralizada"
                  subtitle="Solicitudes recibidas por Secretaría/Dependencia"
                  data={data?.porSecretariaCentralizada ?? []}
                  emptyMsg="Sin solicitudes en el periodo seleccionado."
                />
                <GraficaBarrasVertical
                  title="Administración Pública Paraestatal"
                  subtitle="Solicitudes recibidas por Organismos Auxiliares"
                  data={data?.porSecretariaParaestatal ?? []}
                  emptyMsg="Sin solicitudes en el periodo seleccionado."
                />
              </div>


            <div className="grid gap-4 lg:grid-cols-2">
              <GraficaEmisiones
                title="Administración Pública Centralizada — Dictámenes Técnicos Funcionales"
                data={emisionesCentralizada}
                barKey="dictamenes"
              />
              <GraficaEmisiones
                title="Administración Pública Paraestatal — Opiniones Técnicas Funcionales"
                data={emisionesParaestatal}
                barKey="opiniones"
              />
            </div>

    </div>
    </div>
  )
}
