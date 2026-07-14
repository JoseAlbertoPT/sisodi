"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ConfirmVariant = "aprobar" | "observar" | "eliminar" | "default"

// Shared button styles used across all variants
const BTN_PINK: React.CSSProperties = { backgroundColor: "#fce4f0", color: "#7c2d5e", border: "1px solid #f0b0d0" }
const BTN_PURPLE: React.CSSProperties = { backgroundColor: "#773357", color: "#fff", border: "none" }
const BTN_GRAY: React.CSSProperties = { backgroundColor: "#F3F4F6", color: "#374151", border: "none" }

const VARIANT_CFG = {
  aprobar: {
    icon: <img src="/iconos2/Icon.svg" alt="" className="h-6 w-6" />,
    iconBorderColor: "#7c2d5e",
    defaultLabel: "Sí, aprobar",
    inverted: false,
  },
  observar: {
    icon: <img src="/iconos2/question-circle.svg" alt="" className="h-6 w-6" />,
    iconBorderColor: "#7c2d5e",
    defaultLabel: "Sí, continuar",
    inverted: false,
  },
  eliminar: {
    icon: <img src="/iconos2/Icon.svg" alt="" className="h-6 w-6" />,
    iconBorderColor: "#7c2d5e",
    defaultLabel: "Sí, Eliminar",
    inverted: true,
  },
  default: {
    icon: <img src="/iconos2/Icon.svg" alt="" className="h-6 w-6" />,
    iconBorderColor: "#7c2d5e",
    defaultLabel: "Confirmar",
    inverted: false,
  },
}

function ModalOverlay({ children, onEscape }: { children: React.ReactNode; onEscape?: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!onEscape) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onEscape() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onEscape])

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" aria-modal="true" role="dialog">
      {children}
    </div>,
    document.body
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  variant?: ConfirmVariant
  icon?: React.ReactNode
  loading?: boolean
  hideCancel?: boolean
  error?: string
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, description, confirmLabel,
  variant = "default", icon, loading = false,
  hideCancel = false, error,
}: ConfirmDialogProps) {
  const cfg = VARIANT_CFG[variant]
  const label = confirmLabel ?? cfg.defaultLabel
  const iconEl = icon ?? cfg.icon

  if (!open) return null

  const actionBtn = (
    <Button
      className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11"
      style={variant === "eliminar" ? BTN_PINK : BTN_PURPLE}
      onClick={onConfirm}
      disabled={loading}
    >
      {loading && <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {label}
    </Button>
  )

  const cancelBtn = (
    <Button
      className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11"
      style={variant === "eliminar" ? BTN_PURPLE : BTN_GRAY}
      onClick={onClose}
      disabled={loading}
    >
      Cancelar
    </Button>
  )

  return (
    <ModalOverlay onEscape={onClose}>
      <div
        className="bg-white rounded-3xl p-7 max-w-sm w-full mx-4"
        style={{ boxShadow: "0 4px 24px 0 rgba(107,45,107,0.10)" }}
      >
        <div className="flex flex-col gap-3 mb-6">
          <div className="shrink-0" style={{ color: cfg.iconBorderColor }}>{iconEl}</div>
          <h3 className="ds-title-md leading-tight text-gray-900">{title}</h3>
          <div className="font-sans text-sm font-light text-gray-500">{description}</div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {hideCancel ? (
          <div className="flex justify-end">
            <Button
              className="rounded-2xl font-medium hover:opacity-90 h-11 px-6"
              style={BTN_PURPLE}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {label}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {variant === "eliminar" ? <>{actionBtn}{cancelBtn}</> : <>{cancelBtn}{actionBtn}</>}
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}

export interface ObservarDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (obs: string) => void
  folio: string
}

export function ObservarDialog({ open, onClose, onConfirm, folio }: ObservarDialogProps) {
  const [step, setStep] = useState<"confirm" | "write">("confirm")
  const [obs, setObs] = useState("")

  const handleClose = useCallback(() => { setStep("confirm"); setObs(""); onClose() }, [onClose])

  if (!open) return null

  if (step === "confirm") {
    return (
      <ModalOverlay onEscape={handleClose}>
        <div
          className="bg-white rounded-3xl p-7 max-w-sm w-full mx-4"
          style={{ boxShadow: "0 4px 24px 0 rgba(107,45,107,0.10)" }}
        >
          <div className="flex flex-col gap-3 mb-6">
            <img src="/iconos2/question-circle.svg" alt="" className="h-5 w-5 shrink-0" />
            <h3 className="ds-title-md leading-tight text-gray-900">¿Estás seguro de observar?</h3>
            <p className="font-sans text-sm font-light text-gray-500">
              Vas a marcar <strong className="text-gray-700">{folio}</strong> con observaciones. Se devolverá a la URG.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11" style={BTN_GRAY} onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11"
              style={BTN_PURPLE}
              onClick={() => setStep("write")}
            >
              Sí, continuar
            </Button>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay onEscape={handleClose}>
      <div
        className="bg-white rounded-3xl p-7 max-w-sm w-full mx-4"
        style={{ boxShadow: "0 4px 24px 0 rgba(107,45,107,0.10)" }}
      >
        <div className="flex flex-col gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 text-[#7c2d5e] shrink-0" />
          <h3 className="ds-title-md leading-tight text-gray-900">Observar — {folio}</h3>
          <p className="font-sans text-sm font-light text-gray-500">Escriba las observaciones que se enviarán a la URG.</p>
          <Textarea
            placeholder="Describa las observaciones..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            className="min-h-[120px] bg-card"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11" style={BTN_GRAY} onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-2xl font-medium hover:opacity-90 h-11"
            style={BTN_PURPLE}
            onClick={() => { if (!obs.trim()) return; onConfirm(obs.trim()); setStep("confirm"); setObs("") }}
            disabled={!obs.trim()}
          >
            Confirmar observación
          </Button>
        </div>
      </div>
    </ModalOverlay>
  )
}
