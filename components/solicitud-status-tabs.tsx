"use client"

import { History, Info, AlertTriangle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HistorialTimeline, ROLES_OCULTAN_OBSERVACIONES, type HistorialEntryData } from "@/components/historial-timeline"
import { useAuth } from "@/lib/auth-context"

const ROLES_VEN_AVANCE = ["Administrador", "Capturista", "UEFA"]

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
      {countLabel && (
        <div className="ml-auto flex h-7 items-center rounded-full bg-[#e4e3d6] px-3">
          <span className="text-[11px] font-semibold text-content-medium">{countLabel}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Porcentajes de avance definidos por Eduardo Varela (27/08/2026) para la
 * barra "Avance hacia el dictamen". El tramo de firmas sigue el orden real
 * de firmantes de lib/firma-plantillas.ts (persona externa → UEFA → revisor
 * → verificador → Emisión; Nombramiento Tiempo Determinado tiene dos
 * firmantes externos en vez de uno, de ahí la etapa extra y que los
 * porcentajes no caigan en múltiplos de 10).
 */
const AVANCE_SERVICIOS = [
  { label: "Enviada a UEFA",               percent: 10 },
  { label: "En revisión",                  percent: 20 },
  { label: "En verificación",              percent: 30 },
  { label: "En emisión",                   percent: 40 },
  { label: "En firma por persona externa", percent: 50 },
  { label: "En firma por UEFA",            percent: 60 },
  { label: "En firma por revisor",         percent: 70 },
  { label: "En firma por verificador",     percent: 80 },
  { label: "En firma por Emisión",         percent: 90 },
  { label: "Emitido",                      percent: 100 },
] as const

const AVANCE_TIEMPO_DETERMINADO = [
  { label: "Enviada a UEFA",                   percent: 9 },
  { label: "En revisión",                      percent: 18 },
  { label: "En verificación",                  percent: 27 },
  { label: "En emisión",                       percent: 36 },
  { label: "En firma por persona externa",     percent: 45 },
  { label: "En firma por persona externa dos", percent: 55 },
  { label: "En firma por UEFA",                percent: 64 },
  { label: "En firma por revisor",             percent: 73 },
  { label: "En firma por verificador",         percent: 82 },
  { label: "En firma por Emisión",             percent: 91 },
  { label: "Emitido",                          percent: 100 },
] as const

function esTipoTiempoDeterminado(tipo: string | null | undefined): boolean {
  return (tipo ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("nombramiento")
}

/**
 * Ubica el estado actual de la solicitud dentro del embudo de firma.
 * Nota: mientras el o los firmantes externos no han firmado, el estado ya
 * está en "Pendiente Firma Justificacion" — igual que cuando le toca a UEFA
 * (ver ESTADO_POR_BANDEJA_PENDIENTE en lib/firma-plantillas.ts) — así que
 * ese estado no distingue "persona externa" de "UEFA" sin consultar
 * firma_proceso.firmantes; por eso se ubica en el punto más temprano de ese
 * tramo (persona externa) en vez de asumir que ya firmó.
 */
function avanceEtapaIndex(estado: string | null | undefined, esTD: boolean): number {
  const n = (estado ?? "").toLowerCase().trim()

  if (n === "emitido" || n === "rechazado") return esTD ? 10 : 9

  if (
    n === "en validacion justificaciones" || n === "enviada a validacion" ||
    n === "enviada a validacion (uefa)" || n === "enviada a validacion uefa" ||
    n === "observado por validacion" || n === "observada por validacion" ||
    n === "observada por uefa" || n === "observado por uefa"
  ) return 0 // Enviada a UEFA

  if (
    n === "pendiente do" || n === "enviado a do (recepcion)" ||
    n === "en revision revisor" || n === "observado por revisor" || n === "observado do filtro 1" ||
    n === "aceptado por revisor" || n === "aprobado por revisor"
  ) return 1 // En revisión

  if (n === "en verificacion final" || n === "observado por verificacion final" || n === "observado do filtro 2")
    return 2 // En verificación

  if (
    n === "en revision emisor" || n === "en revision do filtro 3" ||
    n === "observado por emisor" || n === "devuelta por do" || n === "observado do filtro 3" ||
    n === "en proceso do" || n === "aprobado"
  ) return 3 // En emisión

  if (n === "pendiente firma justificacion") return 4 // persona(s) externa(s) — ver nota arriba

  if (n === "pendiente firma revision") return esTD ? 7 : 6 // revisor

  if (n === "pendiente firma verificacion") return esTD ? 8 : 7 // verificador

  if (n === "pendiente firma emisor" || n === "pendiente firma dictamen") return esTD ? 9 : 8 // Emisión

  return 0 // en captura / borrador / desconocido
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

/**
 * Degradado en 5 tonos (rojo → naranja → amarillo → verde → verde fuerte) en
 * vez de un lerp de 2 puntos — con solo rojo→verde institucional el cambio
 * entre tramos era casi imperceptible porque ambos extremos son colores
 * apagados. Con 5 paradas cada 25% el cambio de tono es obvio en cada etapa.
 */
const AVANCE_COLOR_STOPS = [
  { t: 0,    color: hexToRgb("#E53935") }, // rojo
  { t: 0.25, color: hexToRgb("#FB8C00") }, // naranja
  { t: 0.5,  color: hexToRgb("#FDD835") }, // amarillo
  { t: 0.75, color: hexToRgb("#7CB342") }, // verde
  { t: 1,    color: hexToRgb("#2E7D32") }, // verde fuerte
]

function avanceColor(percent: number): string {
  const t = Math.max(0, Math.min(100, percent)) / 100
  let i = 0
  while (i < AVANCE_COLOR_STOPS.length - 2 && t > AVANCE_COLOR_STOPS[i + 1].t) i++
  const desde = AVANCE_COLOR_STOPS[i]
  const hasta = AVANCE_COLOR_STOPS[i + 1]
  const local = (t - desde.t) / (hasta.t - desde.t)
  const r = Math.round(desde.color.r + (hasta.color.r - desde.color.r) * local)
  const g = Math.round(desde.color.g + (hasta.color.g - desde.color.g) * local)
  const b = Math.round(desde.color.b + (hasta.color.b - desde.color.b) * local)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Barra "Avance hacia el dictamen", con etapas y % definidos por negocio (ver
 * AVANCE_SERVICIOS/AVANCE_TIEMPO_DETERMINADO).
 *
 * `historial` es opcional y, cuando se pasa, la barra usa el avance MÁXIMO
 * alcanzado en todo el historial de estados en vez del estado actual: si una
 * solicitud llegó a "En verificación" (30%) y luego la observan y regresa a
 * "En revisión" (20%), la barra se queda en 30% en vez de retroceder — el
 * trabajo ya hecho para llegar a esa etapa no se "deshace" visualmente solo
 * porque el estado actual retrocedió.
 */
export function AvanceSolicitud({
  estado, tipo, historial,
}: {
  estado: string | null | undefined
  tipo?: string | null
  historial?: { estadoNuevo: string }[]
}) {
  const { user } = useAuth()
  if (!ROLES_VEN_AVANCE.includes((user as any)?.rol)) return null
  const esTD = esTipoTiempoDeterminado(tipo)
  const etapas = esTD ? AVANCE_TIEMPO_DETERMINADO : AVANCE_SERVICIOS
  const indices = [avanceEtapaIndex(estado, esTD), ...(historial ?? []).map(h => avanceEtapaIndex(h.estadoNuevo, esTD))]
  const etapaIndex = Math.max(...indices)
  const etapa = etapas[etapaIndex]
  const color = avanceColor(etapa.percent)
  return (
    <div className="px-5 pt-4 pb-4 bg-white border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-content-medium">Avance hacia el dictamen</span>
        <span className="text-lg font-bold" style={{ color }}>{etapa.percent}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--sem-bg-surface-high)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300"
          style={{ width: `${etapa.percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-2 text-[11px] font-semibold" style={{ color }}>{etapa.label}</div>
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
  entries, title = "Historial de Solicitud", folio, estado, tipo,
}: { entries: HistorialEntryData[]; title?: string; folio?: string | null; estado?: string | null; tipo?: string | null }) {
  const { user } = useAuth()
  // Capturista/UEFA no ven las observaciones dentro del historial (ver
  // HistorialTimeline) — mostrarles el conteo total de eventos aquí
  // delataría que hay más eventos de los que ven, así que para ellos se
  // oculta el número.
  const ocultaConteo = ROLES_OCULTAN_OBSERVACIONES.includes((user as any)?.rol)
  const n = entries.length
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-md">
      <PanelHeader
        iconBg="bg-[#dfe6c3]"
        icon={<History className="h-5 w-5 text-[#2d331b]" />}
        title={title}
        subtitle={folio ? `Folio ${folio}` : ocultaConteo ? "Historial de la solicitud" : `${n} evento${n !== 1 ? "s" : ""} registrado${n !== 1 ? "s" : ""}`}
        countLabel={ocultaConteo ? "" : `${n} evento${n !== 1 ? "s" : ""}`}
      />
      {estado != null && <AvanceSolicitud estado={estado} tipo={tipo} historial={entries} />}
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
  const { user } = useAuth()
  // Capturista/UEFA solo deben ver la observación vigente (la más reciente
  // dentro del ciclo actual), no el historial completo de observaciones ya
  // resueltas — `todasObservaciones` viene en orden cronológico ascendente
  // (ver orderBy fecha:"asc" en las rutas que arman este arreglo), así que
  // la última posición es la actual.
  const soloActual = ROLES_OCULTAN_OBSERVACIONES.includes((user as any)?.rol)
  const observacionesVisibles = soloActual ? todasObservaciones.slice(-1) : todasObservaciones
  const count = observacionesVisibles.length > 0 ? observacionesVisibles.length : single ? 1 : 0
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
        {observacionesVisibles.length > 0 ? (
          <div className="flex flex-col gap-2">
            {observacionesVisibles.map((obs, i) => (
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
