"use client"

import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function SelectConBusqueda({
  opciones, value, onValueChange, placeholder, disabled = false, className = "", contentClassName = "",
}: {
  opciones: { value: string; label: string }[]
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  className?: string
  /** Clases extra de la lista desplegable (p. ej. z-index dentro de un modal). */
  contentClassName?: string
}) {
  const [busqueda, setBusqueda] = useState("")
  const [open, setOpen] = useState(false)
  const palabras = busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtradas = useMemo(() => {
    if (!palabras.length) return opciones
    return opciones.filter((o) => {
      const etiqueta = norm(o.label)
      return palabras.every((p) => etiqueta.includes(norm(p)))
    })
  }, [opciones, busqueda])
  const selectedLabel = opciones.find((o) => o.value === value)?.label
  return (
    <Select
      value={value}
      onValueChange={(v) => { onValueChange(v); setOpen(false) }}
      disabled={disabled}
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setBusqueda("") }}
    >
      <SelectTrigger
        className={`w-full rounded-[12px]
          data-[state=open]:bg-white
          ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span className="block truncate text-sm pr-1">
          {selectedLabel ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent
        className={`rounded-[12px] border-[#E5E7EB] shadow-lg p-1.5 ${contentClassName}`}
        style={{ width: "var(--radix-select-trigger-width)", maxWidth: "var(--radix-select-trigger-width)" }}
      >

        <div className="sticky top-0 z-10 bg-white pb-1.5 px-0.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sem-border-high)]" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="h-9 rounded-xl border border-border bg-white shadow-sm text-sm font-light text-foreground placeholder:text-[var(--sem-border-high)] pl-9 pr-8 focus:border-[#2D3B2D]"
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sem-border-high)] hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {busqueda && (
            <p className="text-[10px] text-[#9CA3AF] mt-1 pl-3">
              {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="max-h-52 overflow-y-auto">
          {filtradas.length === 0
            ? <div className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados para "{busqueda}"</div>
            : filtradas.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="min-w-0 rounded-[8px] focus:bg-[#f0ede6] focus:text-[#773357] data-[state=checked]:bg-[#f0ede6] data-[state=checked]:text-[#773357]"
              >
                <span className="line-clamp-2 min-w-0 break-words">{o.label}</span>
              </SelectItem>
            ))
          }
        </div>
      </SelectContent>
    </Select>
  )
}
