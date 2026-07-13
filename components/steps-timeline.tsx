import { CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type StepStatus = "success" | "warning" | "error"

export interface StepItem {
  label: string
  status: StepStatus
}

const STATUS_STYLES: Record<StepStatus, { bg: string; icon: LucideIcon }> = {
  success: { bg: "#2E7D32", icon: CheckCircle2 },
  warning: { bg: "#8A6D1D", icon: AlertCircle },
  error:   { bg: "#C62828", icon: AlertCircle },
}

export function StepsTimeline({ steps, className }: { steps: StepItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-xl bg-[#EFEBE0] px-4 py-4", className)}>
      {steps.map((step, i) => {
        const { bg, icon: Icon } = STATUS_STYLES[step.status]
        const isLast = i === steps.length - 1

        return (
          <div key={i} className="flex gap-3">
            {/* ── Icon + connector line ── */}
            <div className="flex flex-col items-center">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: bg }}
              >
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              {!isLast && (
                <div className="w-0 flex-1 min-h-[18px] border-l-2 border-dashed border-[#C7C2B3] my-1" />
              )}
            </div>

            {/* ── Label ── */}
            <div className={cn("flex items-center min-w-0", isLast ? "pb-0" : "pb-4")} style={{ minHeight: 24 }}>
              <span className="text-sm font-medium text-[#4B4B4B] leading-snug">{step.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
