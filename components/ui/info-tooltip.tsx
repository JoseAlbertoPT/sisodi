"use client"

import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

// Texto placeholder: pendiente de que el área responsable entregue la
// redacción definitiva (observación 9). Reemplazar el prop `text` cuando
// se reciba.
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground hover:text-content-high transition-colors",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
