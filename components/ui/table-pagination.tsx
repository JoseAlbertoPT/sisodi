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
    <div className="flex flex-col items-center gap-0 pt-3">
      <div className="flex items-center gap-1 pb-3">
        {/* Anterior */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Página anterior"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f1f1] text-[#6b7280] transition-colors",
            "hover:bg-[#e5e5e5] disabled:opacity-30 disabled:pointer-events-none",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Números */}
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-xs text-[#9ca3af] select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-current={p === currentPage ? "page" : undefined}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors select-none",
                p === currentPage
                  ? "bg-white border border-[#d1d5db] text-[#111827] shadow-sm"
                  : "text-[#6b7280] hover:bg-[#f3f4f6]",
              )}
            >
              {p}
            </button>
          )
        )}

        {/* Siguiente */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Página siguiente"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f1f1] text-[#6b7280] transition-colors",
            "hover:bg-[#e5e5e5] disabled:opacity-30 disabled:pointer-events-none",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Separador */}
      <div className="w-full border-t border-[#e5e7eb]" />
    </div>
  )
}

export const ITEMS_PER_PAGE = 10
