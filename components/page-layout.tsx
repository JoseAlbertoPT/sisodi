"use client"

import { PanelLeft } from "lucide-react"
import { useSidebar } from "@/lib/sidebar-context"

interface PageLayoutProps {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  noContainer?: boolean
}

export function PageLayout({ title, description, children, noContainer = false }: PageLayoutProps) {
  const { onToggle } = useSidebar()

  return (
    <div className="flex flex-1 flex-col bg-white">
      {noContainer ? (
        children
      ) : (
        <div className="flex-1 rounded-xl border border-border bg-sidebar-bg-light shadow-sm p-4 flex flex-col gap-3">
          {(title != null || description != null) && (
            <div>
              {title != null && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Toggle menú"
                    className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
                  >
                    <PanelLeft size={18} />
                  </button>
                  <h2 className="text-base font-semibold text-black">
                    {title}
                  </h2>
                </div>
              )}
              {description != null && (
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
