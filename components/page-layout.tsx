"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSidebar } from "@/lib/sidebar-context"

interface PageLayoutProps {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  noContainer?: boolean
}

export function PageLayout({ title, description, children, noContainer = false }: PageLayoutProps) {
  const { collapsed, onToggle } = useSidebar()

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
                    aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                  >
                    {collapsed
                      ? <PanelLeftOpen className="h-4 w-4" />
                      : <PanelLeftClose className="h-4 w-4" />
                    }
                  </button>
                  <h2 className="text-base font-semibold text-black">
                    {title}
                  </h2>
                </div>
              )}
              {description != null && (
                <p className="text-sm text-muted-foreground pl-7">
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
