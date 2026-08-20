"use client"

import { History, Info, AlertTriangle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HistorialTimeline, type HistorialEntryData } from "@/components/historial-timeline"

export interface BitacoraEntry {
  seccion: string
  eventos: { fecha: string; usuario: string; descripcion: string }[]
}

export interface ObservacionItem {
  estado: string
  fecha: string
  usuario: string
  comentario: string
}

export type StatusTabKey = "historial" | "bitacora" | "observaciones"

/** Parsea comentarios de observación/devolución con formato "1. Título:: detalle" en un timeline legible. */
export function DevolucionObs({ comentario }: { comentario: string }) {
  const lineas = comentario.split("\n").filter(Boolean)
  const itemsChecklist = lineas.filter(l => /^\d+\.\s.+::/.test(l))
  const comentarioGeneral = lineas.filter(l => !/^\d+\.\s.+::/.test(l)).join("\n").trim()
  const tieneChecks  = itemsChecklist.length > 0
  const tieneGeneral = comentarioGeneral.length > 0
  return (
    <div className="flex flex-col gap-0">
      {tieneChecks && (
        <div className="flex flex-col gap-0">
          {itemsChecklist.map((linea, idx) => {
            const [titulo, obs] = linea.split("::")
            const numMatch = titulo.match(/^(\d+)\./)
            const num   = numMatch ? numMatch[1] : String(idx + 1)
            const label = titulo.replace(/^\d+\.\s*/, "").trim()
            const isLast = idx === itemsChecklist.length - 1
            return (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sem-support-on-error-low)]/50 bg-[var(--sem-support-on-error-low)]/5 text-[10px] font-bold text-[var(--sem-support-on-error-low)]">
                    {num}
                  </div>
                  {(!isLast || tieneGeneral) && <div className="w-px flex-1 bg-[var(--sem-support-on-error-low)]/15 my-0.5" />}
                </div>
                <div className={`flex flex-col gap-1 flex-1 ${(!isLast || tieneGeneral) ? "pb-2.5" : "pb-0"}`}>
                  <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)] leading-snug">{label}</span>
                  {obs?.trim() && (
                    <span className="text-xs text-[var(--sem-support-on-error-low)]/80 bg-[var(--sem-support-on-error-low)]/5 rounded px-2 py-1 border border-[var(--sem-support-on-error-low)]/15 leading-relaxed">
                      {obs.trim()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tieneChecks && tieneGeneral && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sem-support-on-error-low)]/30 bg-white text-[10px] text-[var(--sem-support-on-error-low)]/50">
              <span className="text-[8px]">✎</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 pb-0">
            <span className="text-[10px] font-semibold text-[var(--sem-support-on-error-low)]/60 uppercase tracking-wide">Observación general</span>
            <p className="text-xs text-[var(--sem-support-on-error-low)]/90 leading-relaxed whitespace-pre-line">{comentarioGeneral}</p>
          </div>
        </div>
      )}
      {!tieneChecks && tieneGeneral && (
        <p className="text-sm text-[var(--sem-support-on-error-low)] leading-relaxed whitespace-pre-line">{comentarioGeneral}</p>
      )}
    </div>
  )
}

function PanelHeader({
  iconBg, icon, title, subtitle, countLabel,
}: {
  iconBg: string; icon: React.ReactNode; title: React.ReactNode; subtitle: string; countLabel: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-border">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-content-high">{title}</span>
        <span className="text-[10px] text-content-low">{subtitle}</span>
      </div>
      <div className="ml-auto flex h-7 items-center rounded-full bg-[#e4e3d6] px-3">
        <span className="text-[11px] font-semibold text-content-medium">{countLabel}</span>
      </div>
    </div>
  )
}

/** Pestañas Historial / Bitácora / Observaciones con el diseño de "Mis Solicitudes". */
export function StatusTabsList({
  value, onChange, obsCount,
}: {
  value: StatusTabKey
  onChange: (v: StatusTabKey) => void
  obsCount: number
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatusTabKey)}>
      <TabsList className="w-full">
        <TabsTrigger value="historial" className="flex-1">
          <History className="h-4 w-4" />Historial
        </TabsTrigger>
        <TabsTrigger value="bitacora" className="flex-1">
          <Info className="h-4 w-4" />Bitácora
        </TabsTrigger>
        <TabsTrigger value="observaciones" className="flex-1 relative">
          <AlertTriangle className="h-4 w-4" />Observaciones
          {obsCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sem-support-error)] px-1 text-[11px] font-normal text-white">
              {obsCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export function HistorialPanel({
  entries, title = "Historial de Solicitud",
}: { entries: HistorialEntryData[]; title?: string }) {
  const n = entries.length
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-md">
      <PanelHeader
        iconBg="bg-[#dfe6c3]"
        icon={<History className="h-5 w-5 text-[#2d331b]" />}
        title={title}
        subtitle={`${n} evento${n !== 1 ? "s" : ""} registrado${n !== 1 ? "s" : ""}`}
        countLabel={`${n} evento${n !== 1 ? "s" : ""}`}
      />
      <div className="bg-card px-4 py-3">
        <HistorialTimeline entries={entries} />
      </div>
    </div>
  )
}

export function BitacoraPanel({
  bitacora, title = "Bitácora de Captura",
}: { bitacora: BitacoraEntry[]; title?: string }) {
  const total = bitacora.reduce((acc, e) => acc + e.eventos.length, 0)
  const entries: HistorialEntryData[] = bitacora.flatMap((entry) =>
    entry.eventos.map((ev) => ({
      fecha: ev.fecha,
      usuario: ev.usuario,
      estadoAnterior: null,
      estadoNuevo: ev.descripcion,
      comentario: null,
    }))
  )
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-md">
      <PanelHeader
        iconBg="bg-[#ffefb6]"
        icon={<Info className="h-5 w-5 text-[#936901]" />}
        title={title}
        subtitle={`${total} evento${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`}
        countLabel={`${total} evento${total !== 1 ? "s" : ""}`}
      />
      <div className="bg-card px-5 pt-4 pb-2">
        {entries.length > 0
          ? <HistorialTimeline entries={entries} />
          : <p className="text-sm text-muted-foreground pb-2">Sin eventos registrados.</p>}
      </div>
    </div>
  )
}

export function ObservacionesPanel({
  title, todasObservaciones, single,
}: {
  title: React.ReactNode
  todasObservaciones: ObservacionItem[]
  single?: { motivo: string; fecha?: string; usuario?: string } | null
}) {
  const count = todasObservaciones.length > 0 ? todasObservaciones.length : single ? 1 : 0
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-md">
      <PanelHeader
        iconBg="bg-[var(--sem-support-error-low)]"
        icon={<AlertTriangle className="h-5 w-5 text-[var(--sem-support-on-error-low)]" />}
        title={title}
        subtitle={count > 0 ? `${count} observación${count !== 1 ? "es" : ""}` : "Sin observaciones"}
        countLabel={`${count} obs.`}
      />
      <div className="bg-card p-4">
        {todasObservaciones.length > 0 ? (
          <div className="flex flex-col gap-2">
            {todasObservaciones.map((obs, i) => (
              <div key={i} className="rounded-lg border border-[var(--sem-support-on-error-low)]/20 bg-[var(--sem-support-on-error-low)]/[0.03] p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--sem-support-on-error-low)]">{obs.estado.replace(/Verificacion Final/i, "Verificación DGDO")}</span>
                  <span className="text-[10px] text-muted-foreground">{obs.fecha} — {obs.usuario}</span>
                </div>
                <DevolucionObs comentario={obs.comentario} />
              </div>
            ))}
          </div>
        ) : single ? (
          <div className="rounded-lg border border-[var(--sem-support-on-error-low)]/20 bg-[var(--sem-support-on-error-low)]/[0.03] p-3 flex flex-col gap-1">
            {single.fecha && <span className="text-[10px] text-muted-foreground">{single.fecha}</span>}
            {single.usuario && <span className="text-[10px] text-muted-foreground">Por: {single.usuario}</span>}
            <DevolucionObs comentario={single.motivo} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>
        )}
      </div>
    </div>
  )
}
