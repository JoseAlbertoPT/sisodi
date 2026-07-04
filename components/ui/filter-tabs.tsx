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
  /** Sobreescribe el color de la tab activa (por defecto el esquema de catálogo: bg-[#e4e3d6] border-[#c2d4a8] text-[#3a4a2a]). */
  activeClassName?: string
  /** Sobreescribe el color del contador de la tab activa (por defecto bg-[#f3f4f6] text-[#1f1f1f]). */
  activeCountClassName?: string
}

const DEFAULT_ACTIVE_TAB_CLASS = "bg-[#e4e3d6] border border-[#c2d4a8] text-[#3a4a2a]"
const DEFAULT_ACTIVE_COUNT_CLASS = "bg-[#f3f4f6] text-[#1f1f1f]"

export function FilterTabs({ value, onValueChange, items, sectionLabel, className, fullWidth, activeClassName, activeCountClassName }: FilterTabsProps) {
  return (
    <div className="flex w-full justify-center">
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-card p-1",
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
              "rounded-md px-4 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              fullWidth && "flex-1",
              isActive
                ? (activeClassName ?? DEFAULT_ACTIVE_TAB_CLASS)
                : "text-muted-foreground hover:text-card-foreground"
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                  isActive ? (activeCountClassName ?? DEFAULT_ACTIVE_COUNT_CLASS) : "bg-muted"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
    </div>
  )
}
