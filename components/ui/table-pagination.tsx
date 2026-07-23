"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function buildPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "…")[] = [1]

  if (current > 3) pages.push("…")

  const start = Math.max(2, current - 1)
  const end   = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push("…")
  pages.push(total)

  return pages
}

export function TablePagination({ currentPage, totalPages, onPageChange }: TablePaginationProps) {
  const [goTo, setGoTo] = useState(String(currentPage))

  useEffect(() => { setGoTo(String(currentPage)) }, [currentPage])

  if (totalPages <= 1) return null

  const pages = buildPages(currentPage, totalPages)

  const submitGoTo = () => {
    const n = Number(goTo)
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) {
      onPageChange(n)
    } else {
      setGoTo(String(currentPage))
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Página anterior"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F4F2] text-[var(--color-core-bosque-20)] transition-colors",
            "hover:bg-[#eae9e6] disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-content-low select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-current={p === currentPage ? "page" : undefined}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md text-sm font-light transition-colors select-none text-content-high",
                p === currentPage
                  ? "bg-white border border-border shadow-sm"
                  : "hover:bg-muted",
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Página siguiente"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F4F2] text-[var(--color-core-bosque-20)] transition-colors",
            "hover:bg-[#eae9e6] disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-content-low">
        <span>Ir a</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={goTo}
          onChange={(e) => setGoTo(e.target.value)}
          onBlur={submitGoTo}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur() } }}
          aria-label="Ir a la página"
          className="h-9 w-14 rounded-md border border-border bg-white text-center text-sm text-content-high [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span>de {totalPages}</span>
      </div>
    </div>
  )
}

export const ITEMS_PER_PAGE = 10
