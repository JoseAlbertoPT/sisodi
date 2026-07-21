"use client"

import type { ComponentType } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export type ConfirmationModalType = "success" | "error" | "warning" | "info"

export interface ConfirmationModalAction {
  label: string
  onClick: () => void
}

export interface ConfirmationModalProps {
  open: boolean
  type: ConfirmationModalType
  title: string
  message: string
  folio?: string
  primaryAction?: ConfirmationModalAction
  secondaryAction?: ConfirmationModalAction
  onClose: () => void
}

const STYLES: Record<ConfirmationModalType, { Icon: ComponentType<{ className?: string; style?: React.CSSProperties }>; bg: string; fg: string }> = {
  success: { Icon: CheckCircle2,  bg: "#d2fad2", fg: "var(--sem-support-success)" },
  error:   { Icon: XCircle,       bg: "#ffd8e7", fg: "var(--sem-accent-primary)" },
  warning: { Icon: AlertTriangle, bg: "#fffbeb", fg: "#D97706" },
  info:    { Icon: Info,          bg: "#ecf2ff", fg: "#3266cb" },
}

/**
 * Modal de confirmación reutilizable para mensajes de éxito/error/advertencia/información.
 *
 * @example
 * <ConfirmationModal
 *   open={!!successMsg}
 *   type="success"
 *   title="Solicitud enviada al siguiente filtro"
 *   message="La solicitud fue procesada exitosamente y avanzó a la siguiente bandeja."
 *   folio={folio}
 *   primaryAction={{ label: "Regresar a bandeja", onClick: handleBack }}
 *   onClose={handleBack}
 * />
 */
export function ConfirmationModal({
  open,
  type,
  title,
  message,
  folio,
  primaryAction,
  secondaryAction,
  onClose,
}: ConfirmationModalProps) {
  const { Icon, bg, fg } = STYLES[type]

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-[420px]" role="alertdialog" aria-modal="true" showCloseButton={false}>
        <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: bg }}>
            <Icon className="h-8 w-8" style={{ color: fg }} />
          </div>

          <div className="flex flex-col gap-1">
            <DialogTitle asChild>
              <h2 className="ds-title-md text-content-high">{title}</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm text-muted-foreground">{message}</p>
            </DialogDescription>
          </div>

          {folio && (
            <span className="text-sm rounded-full px-4 py-1.5 bg-[var(--sem-support-disabled-low)]">Folio: {folio}</span>
          )}

          {(primaryAction || secondaryAction) && (
            <div className="flex gap-3 pt-1">
              {secondaryAction && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--sem-support-disabled-low)] px-5 py-2 text-sm font-medium text-[var(--sem-content-high)] transition-colors hover:bg-[var(--sem-border-md)]"
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </button>
              )}
              {primaryAction && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--sem-accent-primary)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
