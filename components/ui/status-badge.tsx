import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Mapa de estados → color hexadecimal ─────────────────────────────────────
const C_AMARILLO = "#D97706"
const C_ROSA_VINO = "#9D174D"

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
  activo:             "#15803d",
  inactivo:           "#87090c",
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
  centralizada:       "#166534",
  paraestatal:        "#7b1d3d",
}

function resolveColor(label: string, fallback = "#64748b"): string {
  const key = label.toLowerCase().trim()
  if (STATUS_COLOR[key]) return STATUS_COLOR[key]
  // fuzzy: emitido, en validación final, etc.
  if (key.includes("emitido"))             return "#15803d"
  if (key.includes("activo"))              return "#15803d"
  if (key.includes("inactivo"))            return "#87090c"
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
  if (key.includes("centraliz"))           return "#166534"
  if (key.includes("paraestatal"))         return "#7b1d3d"
  return fallback
}

// ─── Componente ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** Texto que se muestra en el badge. También determina el color si no se pasa `color`. */
  label: string
  /** Color hex opcional. Si se omite, se resuelve automáticamente desde `label`. */
  color?: string
  className?: string
}

const C_VERDE = "#15803d"

export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  const c = color ?? C_VERDE
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-2 text-xs font-light w-fit",
        className,
      )}
      style={{ backgroundColor: `${c}18`, color: c }}
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

export function estadoBadge(estado: string): React.ReactElement {
  const n = (estado ?? "").toLowerCase()
  let label = estado ?? "—"
  let color = "#64748b"

  if (n === "borrador" || n === "en captura")                           { label = "Borrador";         color = "#94a3b8" }
  else if (n.includes("en validacion justificaciones") || n.includes("enviada a validacion") || n.includes("pendiente firma justificacion"))
                                                                         { label = "En Aprobación";    color = "#15803d" }
  else if (n.includes("observado por revisor"))                          { label = "Obs. Revisión";    color = C_ROSA_VINO }
  else if (n.includes("observado por validacion final"))                 { label = "Obs. Validación";  color = C_ROSA_VINO }
  else if (n.includes("observado por emisor"))                          { label = "Obs. Emisión";     color = C_ROSA_VINO }
  else if (n.includes("observado por uefa") || (n.includes("observado por validacion") && !n.includes("final")))
                                                                         { label = "Obs. UEFA";        color = C_ROSA_VINO }
  else if (n.includes("devuelta por do") || n.includes("observado do filtro") || n.includes("observado por do"))
                                                                         { label = "Devuelta por DO";  color = C_ROSA_VINO }
  else if (n.includes("en revision revisor") || n === "aprobado por revisor" || n === "aceptado por revisor")
                                                                         { label = "En Revisión";      color = C_AMARILLO }
  else if (n.includes("en validacion final") || n === "aprobado")       { label = "En Validación";    color = C_AMARILLO }
  else if (n.includes("en revision emisor"))                            { label = "En Emisión";       color = C_AMARILLO }
  else if (n.includes("pendiente firma dictamen") || n.includes("pendiente firma"))
                                                                         { label = "Pendiente Firma";  color = C_AMARILLO }
  else if (n.includes("en revision do") || n === "en proceso do" || n === "pendiente do")
                                                                         { label = "En Proceso DGDO";  color = C_AMARILLO }
  else if (n === "emitido" || n.includes("emitido"))                    { label = "Emitido";          color = "#15803d" }

  return <StatusBadge label={label} color={color} />
}
