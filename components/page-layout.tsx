"use client"

/**
 * Layout unificado para todas las paginas del modulo (mismo diseno que Mis Solicitudes).
 * Contenedor con fondo arena (sidebar-bg-light), borde redondeado y encabezado opcional.
 */
interface PageLayoutProps {
  /** Titulo principal de la pagina (h2). */
  title?: React.ReactNode
  /** Descripcion debajo del titulo. */
  description?: React.ReactNode
  /** Contenido de la pagina. */
  children: React.ReactNode
  /** Si true, no aplica el contenedor con fondo (solo min-h y bg). Util para vistas de detalle. */
  noContainer?: boolean
}

export function PageLayout({ title, description, children, noContainer = false }: PageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      {noContainer ? (
        children
      ) : (
        <div className="flex-1 rounded-xl border border-border bg-sidebar-bg-light shadow-sm p-6 flex flex-col gap-6">
          {(title != null || description != null) && (
            <div>
              {title != null && (
                <h2 className="text-xl font-semibold text-black">
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
