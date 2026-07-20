"use client"

import { useState, useEffect, useCallback } from "react"
import { Info } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"

export type ConfirmVariant = "aprobar" | "observar" | "eliminar" | "default"

const VARIANT_CFG = {
  aprobar:  { icon: <Info className="size-7 text-content-high"  strokeWidth={1.75} />, defaultLabel: "Sí, aprobar" },
  observar: { icon: <Info className="size-7 text-content-high"  strokeWidth={1.75} />, defaultLabel: "Sí, continuar" },
  eliminar: { icon: <Info className="size-7 text-content-high"  strokeWidth={1.75} />, defaultLabel: "Sí, Eliminar" },
  default:  { icon: <Info className="size-7 text-content-high"  strokeWidth={1.75} />, defaultLabel: "Confirmar" },
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

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          {iconEl}
          <AlertDialogTitle className="text-[18px]">{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pt-2">
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          {!hideCancel && (
            <AlertDialogCancel onClick={onClose} disabled={loading}>
              Cancelar
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            disabled={loading}
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

  useEffect(() => { if (open) { setStep("confirm"); setObs("") } }, [open])

  const handleClose = useCallback(() => { setStep("confirm"); setObs(""); onClose() }, [onClose])

  if (step === "confirm") {
    return (
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <AlertDialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <Info className="size-7 text-content-high" strokeWidth={1.75} />
            <AlertDialogTitle className="text-[18px]">¿Estás seguro de observar?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="px-6 pt-2">
            <AlertDialogDescription>
              Vas a marcar <strong className="font-normal text-content-high">{folio}</strong> con observaciones. Se devolverá a la URG.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setStep("write") }}>
              Sí, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <AlertDialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <Info className="size-7 text-content-high" strokeWidth={1.75} />
          <AlertDialogTitle className="text-[18px]">Observar — {folio}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-6 pt-2 flex flex-col gap-3">
          <AlertDialogDescription>Escriba las observaciones que se enviarán a la URG.</AlertDialogDescription>
          <Textarea
            placeholder="Describa las observaciones..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            className="min-h-[120px] bg-card"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              if (!obs.trim()) return
              onConfirm(obs.trim())
              setStep("confirm")
              setObs("")
            }}
            disabled={!obs.trim()}
          >
            Confirmar observación
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
