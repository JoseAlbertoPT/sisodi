"use client"

import { PanelLeft } from "lucide-react"
import { useSidebar } from "@/context/sidebar-context"

interface PageLayoutProps {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  noContainer?: boolean
}

export function PageLayout({ title, description, children, noContainer = false }: PageLayoutProps) {
  const { toggle } = useSidebar()

  if (noContainer) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-1 flex-col">
      {(title != null || description != null) && (
        <div className="border-b border-border-low px-4 md:px-8 py-4 md:py-6 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={toggle}
              aria-label="Alternar menú"
              className="flex-shrink-0 text-content-low hover:text-content-high transition-colors"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              {title != null && (
                <h1 className="font-sans text-[22px] md:text-[32px] font-light leading-[120%] text-content-high">
                  {title}
                </h1>
              )}
              {description != null && (
                <p className="ds-body-sm text-content-low">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-3 min-w-0">
        {children}
      </div>
    </div>
  )
}
