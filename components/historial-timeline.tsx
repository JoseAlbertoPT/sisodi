"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, UserCircle, CornerDownRight, Pencil, MoveRight, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  } catch { /* not JSON */ }
  return null
}

function getEvento(
  anterior: string | null,
  nuevo:    string,
  fecha:    string,
  comentario?: string | null,
): { label: string; accion: string; tipo: Tipo } {
  const n = (nuevo    ?? "").toLowerCase().trim()
  const a = (anterior ?? "").toLowerCase().trim()
  const f = fmtFecha(fecha)

  if (n === "modificada" || parseDiff(comentario) !== null)
    return { label: "Solicitud modificada", accion: f, tipo: "edicion" }

  if (n === "en captura" || n === "borrador")
    return { label: "Solicitud creada", accion: f, tipo: "captura" }

  if (n === "en validacion justificaciones") {
    if (!a || a === "en captura" || a === "borrador")
      return { label: "Recibida por Validación de Justificaciones", accion: `Recibida por Validación UEFA · ${f}`, tipo: "normal" }
    return { label: "Regresada a Validación de Justificaciones", accion: `Regresada a Validación UEFA · ${f}`, tipo: "normal" }
  }

  if (n === "pendiente do")
    return { label: "Pendiente DO", accion: `Recibida Validación DO · ${f}`, tipo: "normal" }

  if (n === "observado por validacion")
    return { label: "Observada — Validación de Justificaciones", accion: `Observada por Validación UEFA · ${f}`, tipo: "observacion" }

  if (n === "en revision revisor") {
    if (a.includes("en revision revisor"))
      return { label: "Reasignada a Revisor", accion: `Reasignada al revisor · ${f}`, tipo: "normal" }
    return { label: "Asignada a Revisor", accion: `Se asignó al revisor · ${f}`, tipo: "normal" }
  }

  if (n === "observado por revisor")
    return { label: "Observada por Revisor", accion: `Observada por Revisor · ${f}`, tipo: "observacion" }

  if (n === "aceptado por revisor")
    return { label: "Aceptado por Revisor", accion: `Revisado · ${f}`, tipo: "normal" }

  if (n === "pendiente firma justificacion")
    return { label: "Pendiente de Firma — Justificación", accion: f, tipo: "normal" }

  if (n === "en validacion final")
    return { label: "En Validación DO", accion: `Recibida Validación DO · ${f}`, tipo: "normal" }

  if (n === "observado por validacion final")
    return { label: "Observada — Validación DGDO", accion: `Observada Validación DGDO · ${f}`, tipo: "observacion" }

  if (n === "en revision emisor")
    return { label: "Enviada a Emisor", accion: `Recibida por Emisor · ${f}`, tipo: "normal" }

  if (n === "observado por emisor")
    return { label: "Observada por Emisor", accion: `Observada por Emisor · ${f}`, tipo: "observacion" }

  if (n === "pendiente firma dictamen")
    return { label: "Pendiente de Firma — Emitida", accion: f, tipo: "normal" }

  if (n === "emitido")
    return { label: "Emitida", accion: `Emitida · ${f}`, tipo: "emision" }

  if (n === "rechazado")
    return { label: "Rechazada", accion: f, tipo: "observacion" }

  return { label: nuevo, accion: f, tipo: "normal" }
}

const VINO  = "#7D1128"
const OLIVO = "#556b2f"

function DiffDialog({ cambios, usuario, fecha }: { cambios: { campo: string; de: string; a: string }[]; usuario: string; fecha: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[#C4A882]/50 bg-[#F5F0E8] px-2.5 py-1 text-[10px] font-semibold text-[#A0845C] transition-all hover:bg-[#EDE8DE] hover:border-[#A0845C]/60 hover:shadow-sm">
          <Pencil className="h-2.5 w-2.5" />
          {cambios.length} campo{cambios.length !== 1 ? "s" : ""} modificado{cambios.length !== 1 ? "s" : ""}
        </button>
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border border-border/50 shadow-2xl">

        {/* Header */}
        <div className="relative flex items-center gap-4 bg-white px-6 py-5 border-b border-border/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#A0845C]/10 border border-[#A0845C]/20">
            <Pencil className="h-5 w-5 text-[#A0845C]" />
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#A0845C]/10 px-3 py-1 text-[11px] font-semibold text-[#A0845C] shrink-0">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#A0845C] text-[9px] font-black text-white">
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
        <ScrollArea className="max-h-[65vh] bg-muted/20">
          <div className="flex flex-col divide-y divide-border/50">
            {cambios.map((c, i) => (
              <div key={i} className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#A0845C]/15 text-[10px] font-black text-[#A0845C]">
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
        </ScrollArea>

      </DialogContent>
    </Dialog>
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
    <div className="flex flex-col gap-0">
      {visible.map((entry, i) => {
        const { label, accion, tipo } = getEvento(
          entry.estadoAnterior,
          entry.estadoNuevo,
          entry.fecha,
          entry.comentario,
        )
        const diff = parseDiff(entry.comentario)
        const isObs  = tipo === "observacion"
        const isEdit = tipo === "edicion"
        const isLast    = i === visible.length - 1 && !showToggle

        const dotBorder  = isObs ? "border-[#832B56]" : isEdit ? "border-[#C4A882]"  : "border-[#6e795a]"
        const labelColor = isObs ? "text-[#832B56]"   : isEdit ? "text-[#A0845C]"   : "text-[#6e795a]"
        const userColor  = isObs ? "text-[#832B56]/80": isEdit ? "text-[#A0845C]/80": "text-[#6e795a]/80"

        const showTransicion = !isEdit && entry.estadoAnterior &&
          entry.estadoAnterior.trim() !== "" &&
          entry.estadoAnterior.toLowerCase().trim() !== entry.estadoNuevo.toLowerCase().trim()

        const nextInTime = i > 0 ? visible[i - 1] : null
        const showNextActor = nextInTime && nextInTime.usuario !== entry.usuario

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${dotBorder} bg-card`}>
                {isEdit
                  ? <Pencil className="h-2.5 w-2.5 text-[#A0845C]" />
                  : <div className={`h-2 w-2 rounded-full ${isObs ? "bg-[#832B56]" : "bg-[#6e795a]"}`} />
                }
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex flex-col gap-0.5 pb-4 flex-1 min-w-0">
              <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
              <div className="flex items-center gap-1 flex-wrap">
                <UserCircle className={`h-3 w-3 shrink-0 ${userColor}`} />
                <span className={`text-[11px] font-semibold ${userColor}`}>{entry.usuario}</span>
                {accion && <span className="text-[10px] text-muted-foreground">· {accion}</span>}
              </div>
              {showTransicion && (
                <span className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {entry.estadoAnterior}
                  <span className="mx-1">→</span>
                  <span className="font-medium">{entry.estadoNuevo}</span>
                </span>
              )}
              {diff && <DiffDialog cambios={diff} usuario={entry.usuario} fecha={accion} />}
              {showNextActor && (
                <div className="flex items-center gap-1 mt-1">
                  <CornerDownRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                  <UserCircle className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-[10px] text-muted-foreground/80 font-medium">{nextInTime.usuario}</span>
                  <span className="text-[10px] text-muted-foreground/50">· {fmtFecha(nextInTime.fecha)}</span>
                </div>
              )}
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
