import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Mapa de estados → color hexadecimal ─────────────────────────────────────
export const C_AMARILLO = "#D97706"
export const C_ROSA_VINO = "#773357"
export const C_ROSA_VINO_BG = "#ffd8e7"

const STATUS_COLOR: Record<string, string> = {
  // Solicitud flow
  borrador:           "#94a3b8",
  "en captura":       "#94a3b8",
  "en aprobación":    "#15803d",
  "en aprobacion":    "#15803d",
  "en revisión":      C_AMARILLO,
  "en revision":      C_AMARILLO,
  "en validación":    C_AMARILLO,
  "en validacion":    C_AMARILLO,
  "en emisión":       C_AMARILLO,
  "en emision":       C_AMARILLO,
  "en proceso dgdo":  C_AMARILLO,
  "pendiente firma":  C_AMARILLO,
  "obs. uefa":        C_ROSA_VINO,
  "obs. revisión":    C_ROSA_VINO,
  "obs. revision":    C_ROSA_VINO,
  "obs. validación":  C_ROSA_VINO,
  "obs. validacion":  C_ROSA_VINO,
  "obs. emisión":     C_ROSA_VINO,
  "obs. emision":     C_ROSA_VINO,
  observada:          C_ROSA_VINO,
  "devuelta por do":  C_ROSA_VINO,
  emitido:            "#15803d",
  // Usuarios
  activo:             "#1c7d29",
  inactivo:           "#773357",
  // Dictamenes tipo
  dictamen:           "#2d4a3e",
  opinión:            "#7C3AED",
  opinion:            "#7C3AED",
  // Dictamenes modalidad
  electrónica:        "#0891B2",
  electronica:        "#0891B2",
  autógrafa:          "#64748b",
  autografa:          "#64748b",
  // Tipo administración
  centralizada:       "#1c7d29",
  paraestatal:        C_ROSA_VINO,
}

function resolveColor(label: string, fallback = "#64748b"): string {
  const key = label.toLowerCase().trim()
  if (STATUS_COLOR[key]) return STATUS_COLOR[key]
  // fuzzy: emitido, en validación final, etc.
  if (key.includes("emitido"))             return "#15803d"
  if (key.includes("inactivo"))            return C_ROSA_VINO
  if (key.includes("activo"))              return "#1c7d29"
  if (key.includes("borrador") || key.includes("en captura")) return "#94a3b8"
  if (key.includes("en aprobac"))          return "#15803d"
  if (key.includes("obs"))                 return C_ROSA_VINO
  if (key.includes("devuelta") || key.includes("regreso")) return C_ROSA_VINO
  if (key.includes("emision") || key.includes("emisión")) return C_AMARILLO
  if (key.includes("revision") || key.includes("revisión")) return C_AMARILLO
  if (key.includes("validaci"))            return C_AMARILLO
  if (key.includes("firma"))               return C_AMARILLO
  if (key.includes("dgdo") || key.includes("proceso do")) return C_AMARILLO
  if (key.includes("dictamen"))            return "#2d4a3e"
  if (key.includes("opini"))               return "#7C3AED"
  if (key.includes("electr"))              return "#0891B2"
  if (key.includes("centraliz"))           return "#1c7d29"
  if (key.includes("paraestatal"))         return C_ROSA_VINO
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

const C_VERDE = "#15803d"

export function StatusBadge({ label, color, bgColor, className }: StatusBadgeProps) {
  const c = color ?? C_VERDE
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit",
        className,
      )}
      style={{ backgroundColor: bgColor ?? `${c}18`, color: c }}
    >
      {label}
    </span>
  )
}

// ─── FolioBadge ──────────────────────────────────────────────────────────────

const C_VERDE_FOLIO = "#2d4a3e"
const C_VINO_FOLIO  = "#7b2d5e"

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

export const C_AZUL_REVISION = "#3266cb"
export const C_AZUL_REVISION_BG = "#ecf2ff"
export const C_VIOLETA_EMISION = "#6d28d9"    // Tailwind violet-700
export const C_VIOLETA_EMISION_BG = "#f5f3ff" // Tailwind violet-50
export const C_VERDE_ESTADO = "#1c7d29"
export const C_VERDE_ESTADO_BG = "#d2fad2"
export const C_AMARILLO_BG = "#fffbeb" // Tailwind amber-50

export function estadoBadge(estado: string): React.ReactElement {
  const n = (estado ?? "").toLowerCase()
  let label = estado ?? "—"
  let color = "#64748b"
  let bgColor: string | undefined = undefined

  if (n === "borrador" || n === "en captura")                           { label = "Borrador";         color = "#94a3b8" }
  else if (n.includes("en validacion justificaciones") || n.includes("enviada a validacion"))
                                                                         { label = "En Aprobación";    color = C_VERDE_ESTADO; bgColor = C_VERDE_ESTADO_BG }
  else if (n.includes("observado por revisor"))                          { label = "Obs. Revisión";    color = C_ROSA_VINO; bgColor = C_ROSA_VINO_BG }
  else if (n.includes("observado por validacion final"))                 { label = "Obs. Validación";  color = C_ROSA_VINO; bgColor = C_ROSA_VINO_BG }
  else if (n.includes("observado por emisor"))                          { label = "Obs. Emisión";     color = C_ROSA_VINO; bgColor = C_ROSA_VINO_BG }
  else if (n.includes("observado por uefa") || (n.includes("observado por validacion") && !n.includes("final")))
                                                                         { label = "Obs. UEFA";        color = C_ROSA_VINO; bgColor = C_ROSA_VINO_BG }
  else if (n.includes("devuelta por do") || n.includes("observado do filtro") || n.includes("observado por do"))
                                                                         { label = "Devuelta por DO";  color = C_ROSA_VINO; bgColor = C_ROSA_VINO_BG }
  else if (n.includes("en revision revisor") || n === "aprobado por revisor" || n === "aceptado por revisor")
                                                                         { label = "En Revisión";      color = C_AZUL_REVISION; bgColor = C_AZUL_REVISION_BG }
  else if (n.includes("en validacion final") || n === "aprobado")       { label = "En Validación";    color = C_AMARILLO; bgColor = C_AMARILLO_BG }
  else if (n.includes("en revision emisor"))                            { label = "En Emisión";       color = C_VIOLETA_EMISION; bgColor = C_VIOLETA_EMISION_BG }
  else if (n.includes("pendiente firma dictamen") || n.includes("pendiente firma"))
                                                                         { label = "Pendiente Firma";  color = C_VIOLETA_EMISION; bgColor = C_VIOLETA_EMISION_BG }
  else if (n.includes("en revision do") || n === "en proceso do" || n === "pendiente do")
                                                                         { label = "En Proceso DGDO";  color = C_AMARILLO }
  else if (n === "emitido" || n.includes("emitido"))                    { label = "Emitido";          color = C_VERDE_ESTADO; bgColor = C_VERDE_ESTADO_BG }

  return <StatusBadge label={label} color={color} bgColor={bgColor} />
}
