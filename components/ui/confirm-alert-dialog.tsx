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
        className="max-w-[min(24rem,calc(100%-2rem))] sm:max-w-[min(24rem,calc(100%-2rem))] border border-[#e4e3d6] shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <AlertDialogHeader className="items-start gap-3 text-left">
          <Info className="h-7 w-7 text-[#2e3b2b]" strokeWidth={1.75} />
          <AlertDialogTitle className="ds-title-md leading-[1.35]! text-[#2e3b2b]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="ds-label-md text-sm! font-light! leading-[1.4]! text-[#5d5e5f]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <AlertDialogCancel
            className="h-10 flex-1 rounded-full border-0 bg-[#ffeaea] text-sm font-medium text-[#87090c] hover:bg-[#ffeaea] hover:text-[#87090c] focus-visible:outline-[#e7b400]"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            className="h-10 flex-1 rounded-full bg-[#773357] text-sm font-medium text-white hover:bg-[#773357] hover:text-white hover:opacity-90 focus-visible:outline-[#e7b400]"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
