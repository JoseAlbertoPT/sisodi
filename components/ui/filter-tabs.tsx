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
        "inline-flex w-fit items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-[3px]",
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
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-[5px] text-[13px] whitespace-nowrap transition-colors focus-visible:outline-none",
              isActive
                ? "bg-[#e4e3d6] border border-[#c2d4a8] rounded-lg text-[#3a4a2a] font-medium px-4 py-1.5"
                : "bg-transparent border-none text-gray-500 font-normal hover:text-gray-900"
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none",
                  isActive ? "bg-gray-100 text-[#1f1f1f]" : "bg-gray-100 text-gray-500"
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
