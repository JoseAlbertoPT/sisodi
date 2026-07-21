import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Tokens del DS (var(--…)) ────────────────────────────────────────────────
// Regla: usar tokens SIEMPRE, nunca hex directos.
export const T_MORA        = "var(--color-core-mora-40)"
export const T_MORA_BG     = "var(--color-core-mora-95)"
export const T_VERDE_TIERRA    = "var(--color-core-verde-tierra-40)"
export const T_VERDE_TIERRA_BG = "var(--color-core-verde-tierra-90)"
export const T_SUCCESS     = "var(--sem-support-success)"
export const T_SUCCESS_BG  = "var(--sem-support-success-low)"
export const T_WARNING     = "var(--sem-support-warning)"
export const T_WARNING_BG  = "var(--sem-support-warning-low)"
export const T_INFO        = "var(--sem-support-info)"
export const T_INFO_BG     = "var(--sem-support-info-low)"
export const T_ERROR       = "var(--sem-support-error)"
export const T_ERROR_BG    = "var(--sem-support-error-low)"
export const T_ON_ERROR_LOW= "var(--sem-support-on-error-low)"
export const T_DISABLED    = "var(--sem-content-low)"
export const T_DISABLED_BG = "var(--sem-support-disabled-low)"

// Aliases legacy (compat con código que importaba constantes viejas)
export const C_AMARILLO      = T_WARNING
export const C_ROSA_VINO     = T_MORA
export const C_ROSA_VINO_BG  = T_MORA_BG

const STATUS_COLOR: Record<string, string> = {
  // Solicitud flow
  borrador:           T_DISABLED,
  "en aprobación":    T_VERDE_TIERRA,
  "en aprobacion":    T_VERDE_TIERRA,
  "en revisión":      T_INFO,
  "en revision":      T_INFO,
  "en validación":    T_WARNING,
  "en validacion":    T_WARNING,
  "en emisión":       T_SUCCESS,
  "en emision":       T_SUCCESS,
  "en proceso dgdo":  T_WARNING,
  "pendiente firma":  T_SUCCESS,
  "obs. uefa":        T_MORA,
  "obs. revisión":    T_MORA,
  "obs. revision":    T_MORA,
  "obs. validación":  T_MORA,
  "obs. validacion":  T_MORA,
  "obs. emisión":     T_MORA,
  "obs. emision":     T_MORA,
  observada:          T_MORA,
  "devuelta por do":  T_ERROR,
  emitido:            T_VERDE_TIERRA,
  // Usuarios
  activo:             T_SUCCESS,
  inactivo:           T_ON_ERROR_LOW,
  // Dictamenes tipo
  dictamen:           T_VERDE_TIERRA,
  opinión:            T_MORA,
  opinion:            T_MORA,
  // Dictamenes modalidad
  electrónica:        T_INFO,
  electronica:        T_INFO,
  autógrafa:          T_DISABLED,
  autografa:          T_DISABLED,
  // Tipo administración
  centralizada:       T_WARNING,
  paraestatal:        T_INFO,
}

// text color → bg color pair (mismo par usado por estadoBadge)
const BG_FOR: Record<string, string> = {
  [T_MORA]:         T_MORA_BG,
  [T_VERDE_TIERRA]: T_VERDE_TIERRA_BG,
  [T_SUCCESS]:      T_SUCCESS_BG,
  [T_WARNING]:      T_WARNING_BG,
  [T_INFO]:         T_INFO_BG,
  [T_ERROR]:        T_ERROR_BG,
  [T_ON_ERROR_LOW]: T_ERROR_BG,
  [T_DISABLED]:     T_DISABLED_BG,
}

function resolveBg(color: string): string {
  return BG_FOR[color] ?? "var(--sem-bg-surface-low)"
}

function resolveColor(label: string, fallback = T_DISABLED): string {
  const key = label.toLowerCase().trim()
  if (STATUS_COLOR[key]) return STATUS_COLOR[key]
  if (key.includes("emitido"))             return T_VERDE_TIERRA
  if (key.includes("inactivo"))            return T_ON_ERROR_LOW
  if (key.includes("activo"))              return T_SUCCESS
  if (key.includes("borrador"))            return T_DISABLED
  if (key.includes("en aprobac"))          return T_VERDE_TIERRA
  if (key.includes("obs"))                 return T_MORA
  if (key.includes("devuelta") || key.includes("regreso")) return T_ERROR
  if (key.includes("emision") || key.includes("emisión")) return T_SUCCESS
  if (key.includes("revision") || key.includes("revisión")) return T_INFO
  if (key.includes("validaci"))            return T_WARNING
  if (key.includes("firma"))               return T_SUCCESS
  if (key.includes("dgdo") || key.includes("proceso do")) return T_WARNING
  if (key.includes("dictamen"))            return T_VERDE_TIERRA
  if (key.includes("opini"))               return T_MORA
  if (key.includes("electr"))              return T_INFO
  if (key.includes("centraliz"))           return T_WARNING
  if (key.includes("paraestatal"))         return T_INFO
  return fallback
}

// ─── Componente ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** Texto que se muestra en el badge. También determina el color si no se pasa `color`. */
  label: string
  /** Color hex opcional. Si se omite, se resuelve automáticamente desde `label`. */
  color?: string
  /** Color de fondo opcional. Si se omite, se calcula como una opacidad de `color`. */
  bgColor?: string
  className?: string
}

export function StatusBadge({ label, color, bgColor, className }: StatusBadgeProps) {
  const c = color ?? resolveColor(label)
  const bg = bgColor ?? resolveBg(c)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit",
        className,
      )}
      style={{ backgroundColor: bg, color: c }}
    >
      {label}
    </span>
  )
}

// ─── FolioBadge ──────────────────────────────────────────────────────────────

const C_VERDE_FOLIO = "var(--color-core-bosque-30)"
const C_VINO_FOLIO  = "var(--color-core-mora-30)"

/** Verde si todo OK, vino si hay observación o SLA vencido */
export function getFolioColor(estado: string, slaRestante?: number | null): string {
  const n = (estado ?? "").toLowerCase()
  if (
    n.includes("observad") || n.includes("devuelta") || n.includes("rechaz") ||
    n.includes("regreso")
  ) return C_VINO_FOLIO
  if (slaRestante !== undefined && slaRestante !== null && slaRestante <= 0) return C_VINO_FOLIO
  return C_VERDE_FOLIO
}

interface FolioBadgeProps {
  folio: string | null | undefined
  estado: string
  slaRestante?: number | null
  className?: string
}

export function FolioBadge({ folio, estado, slaRestante, className }: FolioBadgeProps) {
  if (!folio || folio === "—" || folio === "---") {
    return <span className="text-xs text-muted-foreground italic">Sin asignar</span>
  }
  const color = getFolioColor(estado, slaRestante)
  return (
    <StatusBadge
      label={folio}
      color={color}
      className={cn("font-mono tracking-wide", className)}
    />
  )
}

// ─── Helpers de dominio (misma lógica que antes pero retornan <StatusBadge>) ─

export const C_AZUL_REVISION     = T_INFO
export const C_AZUL_REVISION_BG  = T_INFO_BG
export const C_VIOLETA_EMISION   = "var(--color-core-mora-40)"
export const C_VIOLETA_EMISION_BG= "var(--color-core-mora-95)"
export const C_VERDE_ESTADO      = T_SUCCESS
export const C_VERDE_ESTADO_BG   = T_SUCCESS_BG
export const C_AMARILLO_BG       = T_WARNING_BG

export function estadoBadge(estado: string): React.ReactElement {
  const n = (estado ?? "").toLowerCase()
  let label = estado ?? "—"
  let color = T_DISABLED
  let bgColor = T_DISABLED_BG

  if (n === "borrador")                                                  { label = "Borrador";         color = T_DISABLED; bgColor = T_DISABLED_BG }
  else if (n.includes("pendiente firma"))                                { label = "Pendiente Firma";  color = T_WARNING;  bgColor = T_WARNING_BG }
  else if (n.includes("observado por revisor"))                          { label = "Obs. Revisión";    color = T_MORA;     bgColor = T_MORA_BG }
  else if (n.includes("observado por validacion final"))                 { label = "Obs. Validación";  color = T_MORA;     bgColor = T_MORA_BG }
  else if (n.includes("observado por emisor"))                           { label = "Obs. Emisión";     color = T_MORA;     bgColor = T_MORA_BG }
  else if (n.includes("observado por uefa") || (n.includes("observado por validacion") && !n.includes("final")))
                                                                         { label = "Obs. UEFA";        color = T_MORA;     bgColor = T_MORA_BG }
  else if (n.includes("devuelta por do") || n.includes("observado do filtro") || n.includes("observado por do"))
                                                                         { label = "Devuelta por DO";  color = T_ON_ERROR_LOW; bgColor = T_ERROR_BG }
  else if (n.includes("en validacion justificaciones") || n.includes("enviada a validacion"))
                                                                         { label = "En Aprobación";    color = T_INFO;     bgColor = T_INFO_BG }
  else if (n.includes("en revision revisor") || n === "aprobado por revisor" || n === "aceptado por revisor")
                                                                         { label = "En Revisión";      color = T_INFO;     bgColor = T_INFO_BG }
  else if (n.includes("en validacion final") || n === "aprobado")        { label = "En Validación";    color = T_INFO;     bgColor = T_INFO_BG }
  else if (n.includes("en revision emisor"))                             { label = "En Emisión";       color = T_INFO;     bgColor = T_INFO_BG }
  else if (n.includes("en revision do") || n === "en proceso do" || n === "pendiente do")
                                                                         { label = "En Proceso DGDO";  color = T_INFO;     bgColor = T_INFO_BG }
  else if (n === "emitido" || n.includes("emitido"))                     { label = "Emitido";          color = T_SUCCESS;  bgColor = T_SUCCESS_BG }

  return <StatusBadge label={label} color={color} bgColor={bgColor} />
}
