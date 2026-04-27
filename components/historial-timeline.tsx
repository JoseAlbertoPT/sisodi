"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, UserCircle, CornerDownRight } from "lucide-react"

export interface HistorialEntryData {
  fecha: string
  usuario: string
  estadoAnterior: string | null
  estadoNuevo: string
}

const VISIBLE_DEFAULT = 4

type Tipo = "captura" | "normal" | "observacion" | "emision"

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

function getEvento(
  anterior: string | null,
  nuevo:    string,
  fecha:    string,
): { label: string; accion: string; tipo: Tipo } {
  const n = (nuevo    ?? "").toLowerCase().trim()
  const a = (anterior ?? "").toLowerCase().trim()
  const f = fmtFecha(fecha)

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
    return { label: "Observada — Validación Final", accion: `Observada Validación Final · ${f}`, tipo: "observacion" }

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

export function HistorialTimeline({ entries }: { entries: HistorialEntryData[] }) {
  const [expanded, setExpanded] = useState(false)

  if (!entries.length)
    return <p className="text-xs text-muted-foreground">Sin historial registrado.</p>

  const reversed = [...entries].reverse().filter((e, i, arr) =>
    i === 0 || e.estadoNuevo.toLowerCase().trim() !== arr[i - 1].estadoNuevo.toLowerCase().trim()
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
        )
        const isObs     = tipo === "observacion"
        const isEmit    = tipo === "emision"
        const isCaptura = tipo === "captura"
        const isLast    = i === visible.length - 1 && !showToggle

        const dotBorder  = isObs ? "border-[#832B56]"  : isEmit ? "border-emerald-600" : isCaptura ? "border-[#6e795a]" : "border-secondary"
        const dotFill    = isObs ? "bg-[#832B56]"       : isEmit ? "bg-emerald-600"     : isCaptura ? "bg-[#6e795a]"     : "bg-secondary"
        const labelColor = isObs ? "text-[#832B56]"     : isEmit ? "text-emerald-700"   : isCaptura ? "text-[#6e795a]"   : "text-card-foreground"
        const userColor  = isObs ? "text-[#832B56]/80"  : isEmit ? "text-emerald-700/80": isCaptura ? "text-[#6e795a]/80": "text-secondary/90"

        const showTransicion = entry.estadoAnterior &&
          entry.estadoAnterior.trim() !== "" &&
          entry.estadoAnterior.toLowerCase().trim() !== entry.estadoNuevo.toLowerCase().trim()

        const nextInTime = i > 0 ? visible[i - 1] : null
        const showNextActor = nextInTime && nextInTime.usuario !== entry.usuario

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${dotBorder} bg-card`}>
                <div className={`h-2 w-2 rounded-full ${dotFill}`} />
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
