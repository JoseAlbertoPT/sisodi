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

export function FilterTabs({ value, onValueChange, items, sectionLabel, className }: FilterTabsProps) {
  return (
    <div className="flex w-full justify-center">
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit",
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
              "rounded-md px-4 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-card-foreground"
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                  isActive ? "bg-white/20" : "bg-muted"
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
