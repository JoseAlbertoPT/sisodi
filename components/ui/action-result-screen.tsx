"use client"

import { CheckCircle2, ArrowLeft } from "lucide-react"

type ResultType = "save" | "approve" | "observe"

interface ActionResultScreenProps {
  type: ResultType
  title?: string
  description?: string
  folio?: string
  onBack?: () => void
  backLabel?: string
  action?: React.ReactNode
}

const DEFAULTS: Record<ResultType, { title: string; description: string }> = {
  save: {
    title: "Cambios guardados correctamente",
    description: "Los cambios han sido guardados.",
  },
  approve: {
    title: "Solicitud enviada al siguiente filtro",
    description: "La solicitud fue procesada exitosamente y avanzó a la siguiente bandeja.",
  },
  observe: {
    title: "Solicitud marcada con observaciones",
    description: "La solicitud fue devuelta con observaciones.",
  },
}

export function ActionResultScreen({
  type,
  title,
  description,
  folio,
  onBack,
  backLabel = "Regresar a bandeja",
  action,
}: ActionResultScreenProps) {
  const defaults = DEFAULTS[type]

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      {type === "observe" ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffd6d7]">
          <img src="/iconos2/cancel.svg" width={32} height={32} alt="" />
        </div>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d2fad2]">
          <CheckCircle2 className="h-8 w-8 text-[#1c7d29]" />
        </div>
      )}

      <div className="text-center max-w-sm">
        <h2 className="ds-title-md text-content-high">{title ?? defaults.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description ?? defaults.description}</p>
      </div>

      {folio && (
        <span className="text-sm rounded-full px-4 py-1.5 bg-[#F3F4F6]">Folio: {folio}</span>
      )}

      {action ?? (onBack && (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[#773357] px-5 py-2 text-sm font-medium text-[#773357] transition-colors hover:bg-[#773357]/5"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
      ))}
    </div>
  )
}
