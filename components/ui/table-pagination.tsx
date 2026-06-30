"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function TablePagination({ currentPage, totalPages, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-end gap-1 pt-3">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{ opacity: currentPage === 1 ? 0.3 : 1 }}
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-card-foreground transition-colors disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span
        style={{ border: "1px solid #ccc", borderRadius: 4 }}
        className="flex h-8 min-w-[2rem] items-center justify-center px-2.5 text-xs font-medium text-card-foreground bg-white select-none"
      >
        {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{ opacity: currentPage === totalPages ? 0.3 : 1 }}
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-card-foreground transition-colors disabled:pointer-events-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export const ITEMS_PER_PAGE = 10
