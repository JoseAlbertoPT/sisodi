"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ConfirmAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Entendido, continuar",
  cancelLabel = "Cancelar",
}: ConfirmAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[min(24rem,calc(100%-2rem))] sm:max-w-[min(24rem,calc(100%-2rem))] border border-[var(--sem-bg-surface-high)] shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <AlertDialogHeader className="items-start gap-3 text-left">
          <Info className="h-7 w-7 text-[var(--sem-content-high)]" strokeWidth={1.75} />
          <AlertDialogTitle className="ds-title-sm text-[18px]! font-normal! leading-[1.35]! text-[var(--sem-content-high)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="ds-label-md text-sm! font-light! leading-[1.4]! text-[#5d5e5f]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <AlertDialogCancel
            className="h-10 flex-1 rounded-full border-0 bg-[var(--sem-support-error-low)] text-sm font-medium text-[var(--sem-support-on-error-low)] hover:bg-[var(--sem-support-error-low)] hover:text-[var(--sem-support-on-error-low)] focus-visible:outline-[var(--sem-support-focus)]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            className="h-10 flex-1 rounded-full bg-[var(--sem-accent-primary)] text-sm font-medium text-white hover:bg-[var(--sem-accent-primary)] hover:text-white hover:opacity-90 focus-visible:outline-[var(--sem-support-focus)]"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
