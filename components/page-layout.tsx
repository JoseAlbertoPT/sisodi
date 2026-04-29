"use client"

interface PageLayoutProps {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  noContainer?: boolean
}

export function PageLayout({ title, description, children, noContainer = false }: PageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      {noContainer ? (
        children
      ) : (
        <div className="flex-1 rounded-xl border border-border bg-sidebar-bg-light shadow-sm p-4 flex flex-col gap-3">
          {(title != null || description != null) && (
            <div>
              {title != null && (
                <h2 className="text-base font-semibold text-black">
                  {title}
                </h2>
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
