"use client"

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
  if (totalPages <= 1) return null

  const pages = buildPages(currentPage, totalPages)

  return (
    <div className="flex items-center gap-3">
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
  )
}

export const ITEMS_PER_PAGE = 10
