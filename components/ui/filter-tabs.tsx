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
}

export function FilterTabs({ value, onValueChange, items, sectionLabel = "Secciones", className }: FilterTabsProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-sidebar-bg-light px-5 py-4",
        className
      )}
      aria-label={sectionLabel}
    >
      {sectionLabel && (
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-foreground/70">
          {sectionLabel}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2" role="tablist">
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
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-white text-foreground border-border shadow-sm hover:bg-white hover:border-foreground/20 hover:shadow"
            )}
          >
            {item.icon != null && (
              <span className="[&_svg]:h-4 [&_svg]:w-4 shrink-0" aria-hidden>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-sidebar-bg-light text-foreground"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
      </div>
    </section>
  )
}
