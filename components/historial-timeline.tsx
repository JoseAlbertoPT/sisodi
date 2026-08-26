"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, UserCircle, Pencil, MoveRight, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

export interface HistorialEntryData {
  fecha: string
  usuario: string
  estadoAnterior: string | null
  estadoNuevo: string
  comentario?: string | null
}

const VISIBLE_DEFAULT = 4

type Tipo = "captura" | "normal" | "observacion" | "emision" | "edicion"

function fmtFecha(v: string): string {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const dd   = String(d.getDate()).padStart(2, "0")
  const mm   = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, "0")
  const min  = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function parseDiff(comentario: string | null | undefined): { campo: string; de: string; a: string }[] | null {
  if (!comentario) return null
  try {
    const parsed = JSON.parse(comentario)
    if (parsed?.tipo === "edicion" && Array.isArray(parsed.cambios)) return parsed.cambios
  } catch { }
  return null
}

function getEvento(
  anterior: string | null,
  nuevo:    string,
  comentario?: string | null,
): { label: string; desc: string; tipo: Tipo } {
  const n = (nuevo    ?? "").toLowerCase().trim()
  const a = (anterior ?? "").toLowerCase().trim()


  if (n === "modificada" || parseDiff(comentario) !== null)
    return { label: "Solicitud Modificada", desc: "", tipo: "edicion" }

  if (n === "en captura" || n === "borrador")
    return { label: "Solicitud Creada", desc: "registrada en el sistema", tipo: "captura" }

  if (n === "en validacion justificaciones" || n === "enviada a validacion") {
    if (!a || a === "en captura" || a === "borrador")
      return {
        label: "Enviada a Validación UEFA",
        desc:  "enviada al área de Validación UEFA",
        tipo:  "normal",
      }
    return {
      label: "Reenviada a Validación UEFA",
      desc:  "reenviada tras atender las observaciones",
      tipo:  "normal",
    }
  }

  if (n === "observado por validacion" || n === "observada por validacion")
    return {
      label: "Devuelta con observaciones — Validación de Justificaciones",
      desc:  "devuelta con observaciones para corrección",
      tipo:  "observacion",
    }

  // ── Validación UEFA (alias) ───────────────────────────────────────────────
  if (n === "enviada a validacion (uefa)" || n === "enviada a validacion uefa")
    return {
      label: "Enviada a Validación UEFA",
      desc:  "enviada al área de Validación UEFA",
      tipo:  "normal",
    }

  if (n === "observada por uefa" || n === "observado por uefa")
    return {
      label: "Devuelta con observaciones — Validación UEFA",
      desc:  "devuelta con observaciones para corrección",
      tipo:  "observacion",
    }

  // ── Pendiente DO / DGDO ───────────────────────────────────────────────────
  if (n === "pendiente do" || n === "enviado a do (recepcion)")
    return {
      label: "Recibida en DGDO",
      desc:  "ingresó al DGDO",
      tipo:  "normal",
    }

  // ── Revisión por Revisor ──────────────────────────────────────────────────
  if (n === "en revision revisor") {
    if (a.includes("en revision revisor"))
      return {
        label: "Reasignada a otro Revisor",
        desc:  "reasignada a un revisor diferente",
        tipo:  "normal",
      }
    return {
      label: "Asignada al Revisor",
      desc:  "asignada al revisor para su revisión",
      tipo:  "normal",
    }
  }

  if (n === "observado por revisor" || n === "observado do filtro 1")
    return {
      label: "Devuelta por Revisor",
      desc:  "devuelta con observaciones para corrección",
      tipo:  "observacion",
    }

  if (n === "aceptado por revisor")
    return {
      label: "Aceptada por Revisor",
      desc:  "aceptada por el revisor para continuar el proceso",
      tipo:  "normal",
    }

  if (n === "aprobado por revisor")
    return {
      label: "Aprobada por Revisor",
      desc:  "aprobada por el Revisor",
      tipo:  "normal",
    }

  // ── ────────────────────────────────────────────────
  if (n === "pendiente firma justificacion")
    return {
      label: "En espera de firma — Justificación",
      desc:  "pendiente de firma de justificación",
      tipo:  "normal",
    }

  // ── Verificación DGDO ──────────────────────────────────────────────────────
  if (n === "en verificacion final")
    return {
      label: "Recibida en Verificación DGDO",
      desc:  "recibida por el DGDO para verificación",
      tipo:  "normal",
    }

  if (n === "observado por verificacion final" || n === "observado do filtro 2")
    return {
      label: "Devuelta por Verificador",
      desc:  "devuelta con observaciones para corrección",
      tipo:  "observacion",
    }

  // ── Revisión por Emisor ───────────────────────────────────────────────────
  if (n === "en revision emisor" || n === "en revision do filtro 3")
    return {
      label: "Recibida en Área de Emisión",
      desc:  "recibida en el área de Emisión para dictaminar",
      tipo:  "normal",
    }

  if (n === "observado por emisor" || n === "devuelta por do" || n === "observado do filtro 3")
    return {
      label: "Devuelta por Emisor",
      desc:  "devuelta con observaciones para corrección",
      tipo:  "observacion",
    }

  // ── Firmas ────────────────────────────────────────────────────────────────
  if (n === "pendiente firma dictamen")
    return {
      label: "En espera de firma — Dictamen",
      desc:  "pendiente de firma de dictamen",
      tipo:  "normal",
    }

  if (n === "pendiente firma revision")
    return {
      label: "En espera de firma — Revisión",
      desc:  "pendiente de firma de revisión",
      tipo:  "normal",
    }

  if (n === "pendiente firma verificacion")
    return {
      label: "En espera de firma — Verificación",
      desc:  "pendiente de firma de verificación",
      tipo:  "normal",
    }
  // ── Emisión final ─────────────────────────────────────────────────────────
  if (n === "emitido")
    return {
      label: "Dictamen Emitido",
      desc:  "proceso de justificación completado exitosamente",
      tipo:  "emision",
    }

  // ── Rechazado ─────────────────────────────────────────────────────────────
  if (n === "rechazado")
    return {
      label: "Solicitud Rechazada",
      desc:  "la solicitud fue rechazada",
      tipo:  "observacion",
    }

  // ── En proceso DO ─────────────────────────────────────────────────────────
  if (n === "en proceso do" || n === "aprobado")
    return {
      label: "En proceso DGDO",
      desc:  "en proceso de revisión por el DGDO",
      tipo:  "normal",
    }

  if (n.includes("observado") || n.includes("observada"))
    return { label: nuevo, desc: "devuelta con observaciones para corrección", tipo: "observacion" }

  return { label: nuevo, desc: "", tipo: "normal" }
}

function renombrarEstado(s: string | null | undefined): string {
  if (!s) return ""
  const lower = s.toLowerCase().trim()
  if (lower === "en verificacion final")         return "Verificación DGDO"
  if (lower === "observado por verificacion final") return "Observado por Verificación DGDO"
  return s
}

const VINO  = "#7D1128"
const OLIVO = "#556b2f"

function DiffDialog({ cambios, usuario, fecha }: { cambios: { campo: string; de: string; a: string }[]; usuario: string; fecha: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[#C4A882]/50 bg-[#F5F0E8] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-core-arena-60)] transition-all hover:bg-[#EDE8DE] hover:border-[var(--color-core-arena-60)]/60 hover:shadow-sm">
          <Pencil className="h-2.5 w-2.5" />
          {cambios.length} campo{cambios.length !== 1 ? "s" : ""} modificado{cambios.length !== 1 ? "s" : ""}
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border border-border/50 shadow-2xl">

        {/* Header */}
        <div className="relative flex items-center gap-4 bg-white px-6 py-5 border-b border-border/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-core-arena-60)]/10 border border-[var(--color-core-arena-60)]/20">
            <Pencil className="h-5 w-5 text-[var(--color-core-arena-60)]" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-bold text-foreground leading-none">
                Modificación de solicitud
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground/70">{usuario}</span>
              <span className="text-border">·</span>
              <span>{fecha}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-core-arena-60)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-core-arena-60)] shrink-0">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-core-arena-60)] text-[9px] font-black text-white">
              {cambios.length}
            </span>
            campo{cambios.length !== 1 ? "s" : ""} modificado{cambios.length !== 1 ? "s" : ""}
          </span>
          <DialogClose className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus:outline-none">
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
        </div>

        {/* Lista de cambios */}
        {/* overflow-y-auto nativo (no Radix ScrollArea): min-h-0 sigue siendo
            necesario porque, como hijo flex de DialogContent (flex flex-col),
            sin esto el navegador ignora max-h y el contenedor crece para
            caber todo su contenido en vez de scrollear — el sobrante queda
            cortado por el overflow-hidden del modal, sin forma de verlo. */}
        <div className="max-h-[65vh] min-h-0 overflow-y-auto bg-muted/20">
          <div className="flex flex-col divide-y divide-border/50">
            {cambios.map((c, i) => (
              <div key={i} className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-core-arena-60)]/15 text-[10px] font-black text-[var(--color-core-arena-60)]">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-bold text-foreground">{c.campo}</span>
                </div>

                <div className="grid grid-cols-[1fr_40px_1fr] items-start gap-3">

                  {/* Antes */}
                  <div className="rounded-xl border shadow-sm px-4 py-3" style={{ backgroundColor: `${VINO}0F`, borderColor: `${VINO}35` }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: VINO }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: VINO }} />
                      Antes
                    </p>
                    {c.de
                      ? c.de.split("\n").map((item, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 mb-1 last:mb-0">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `${VINO}60` }} />
                            <p className="text-[12px] leading-relaxed" style={{ color: VINO }}>{item}</p>
                          </div>
                        ))
                      : <p className="text-[12px]" style={{ color: VINO }}>—</p>
                    }
                  </div>

                  {/* Flecha */}
                  <div className="flex items-center justify-center pt-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EBE2] border border-[#D8CFC0] shadow-sm">
                      <MoveRight className="h-3.5 w-3.5 text-[#9A8E7A]" />
                    </div>
                  </div>

                  {/* Después */}
                  <div className="rounded-xl border shadow-sm px-4 py-3" style={{ backgroundColor: `${OLIVO}0F`, borderColor: `${OLIVO}35` }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: OLIVO }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: OLIVO }} />
                      Después
                    </p>
                    {c.a
                      ? c.a.split("\n").map((item, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 mb-1 last:mb-0">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `${OLIVO}60` }} />
                            <p className="text-[12px] font-medium leading-relaxed" style={{ color: OLIVO }}>{item}</p>
                          </div>
                        ))
                      : <p className="text-[12px]" style={{ color: OLIVO }}>—</p>
                    }
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}

/* ── Dot icon for timeline ────────────────────────────────────────────────── */
function TimelineDot({ tipo }: { tipo: Tipo }) {
  if (tipo === "emision")
    return (
      <img src="/Iconos1/step-check.svg" alt="" className="h-7 w-7 shrink-0" />
    )
  if (tipo === "observacion")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sem-accent-primary)] ring-4 ring-[var(--sem-accent-primary)]/15">
        <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  if (tipo === "edicion")
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8DCC8] ring-4 ring-[#C4A882]/15">
        <svg className="h-3.5 w-3.5 text-[#8B6F47]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </div>
    )
  /* captura / normal */
  return (
    <img src="/Iconos1/step-check.svg" alt="" className="h-7 w-7 shrink-0" />
  )
}

export function HistorialTimeline({ entries }: { entries: HistorialEntryData[] }) {
  const [expanded, setExpanded] = useState(false)

  if (!entries.length)
    return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>

  const reversed = [...entries].reverse().filter((e, i, arr) =>
    i === 0 || e.estadoNuevo.toLowerCase().trim() !== arr[i - 1].estadoNuevo.toLowerCase().trim()
      || e.estadoNuevo.toLowerCase().trim() === "modificada"
  )

  const showToggle = reversed.length > VISIBLE_DEFAULT
  const visible = showToggle && !expanded ? reversed.slice(0, VISIBLE_DEFAULT) : reversed

  return (
    <div className="flex flex-col">
      {visible.map((entry, i) => {
        const { label, tipo } = getEvento(entry.estadoAnterior, entry.estadoNuevo, entry.comentario)
        const diff   = parseDiff(entry.comentario)
        const isLast = i === visible.length - 1 && !showToggle

        const labelColor =
          tipo === "observacion" ? "text-[var(--sem-accent-primary)]"
          : tipo === "edicion"    ? "text-[#8B6F47]"
          : "text-[#2D3B2D]"

        const rowBg =
          tipo === "observacion" ? "bg-[var(--sem-accent-primary)]/[0.06] border border-[var(--sem-accent-primary)]/20 rounded-lg px-3 py-2"
          : tipo === "edicion"    ? "bg-[#F5EFE3] border border-[#C4A882]/30 rounded-lg px-3 py-2"
          : "px-3 py-2"

        return (
          <div key={i} className="flex gap-3">
            {/* ── Left col: dot + vertical line ── */}
            <div className="flex flex-col items-center">
              <TimelineDot tipo={tipo} />
              {!isLast && <div className="w-px flex-1 bg-[var(--sem-border-md)] mt-1 mb-1 min-h-[20px]" />}
            </div>

            {/* ── Right col: content ── */}
            <div className={`flex flex-col gap-0.5 pb-4 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
              <div className={rowBg}>
                <span className={`text-[13px] font-semibold leading-snug ${labelColor}`}>{label}</span>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--sem-border-high)] mt-0.5">
                  <span className="font-medium text-[var(--sem-content-low)]">{entry.usuario}</span>
                  <span>·</span>
                  <span>{fmtFecha(entry.fecha)}</span>
                </div>
                {diff && (
                  <div className="mt-1">
                    <DiffDialog cambios={diff} usuario={entry.usuario} fecha={fmtFecha(entry.fecha)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {showToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-secondary hover:text-secondary/80 font-medium mt-1 ml-9 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" />Mostrar menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" />Ver {reversed.length - VISIBLE_DEFAULT} entrada{reversed.length - VISIBLE_DEFAULT !== 1 ? "s" : ""} más</>
          )}
        </button>
      )}
    </div>
  )
}
