"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface FilterTabItem {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
}

interface FilterTabsProps {
  value: string
  onValueChange: (value: string) => void
  items: FilterTabItem[]
  sectionLabel?: string
  className?: string
  /** Distribuye las tabs ocupando todo el ancho disponible (flex-1 por tab) en vez de agruparlas a su tamaño natural. */
  fullWidth?: boolean
  /** Sobreescribe el color de la tab activa (por defecto el esquema de catálogo: bg-[var(--sem-bg-surface-high)] border-[#c2d4a8] text-[var(--color-core-bosque-30)]). */
  activeClassName?: string
  /** Sobreescribe el color del contador de la tab activa (por defecto bg-[var(--sem-support-disabled-low)] text-[#1f1f1f]). */
  activeCountClassName?: string
}

const DEFAULT_ACTIVE_TAB_CLASS = "bg-card shadow-sm text-[var(--color-core-bosque-30)]"
const DEFAULT_ACTIVE_COUNT_CLASS = "bg-[var(--sem-accent-primary)] text-white"

export function FilterTabs({ value, onValueChange, items, sectionLabel, className, fullWidth, activeClassName, activeCountClassName }: FilterTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-border bg-muted/60 p-1",
        fullWidth ? "w-full" : "w-fit",
        className
      )}
      role="tablist"
      aria-label={sectionLabel ?? "Filtros"}
    >
      {items.map((item) => {
        const isActive = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${item.value}`}
            id={`tab-${item.value}`}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "rounded-xl px-5 py-2 text-sm font-light transition-colors flex items-center justify-center gap-1.5 text-content-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-support-focus focus-visible:ring-offset-2",
              fullWidth && "flex-1",
              isActive
                ? (activeClassName ?? DEFAULT_ACTIVE_TAB_CLASS)
                : "hover:bg-black/5"
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-normal",
                  isActive ? (activeCountClassName ?? DEFAULT_ACTIVE_COUNT_CLASS) : "bg-[var(--sem-accent-primary)] text-white"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
