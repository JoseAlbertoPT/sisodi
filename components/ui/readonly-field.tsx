export function ReadOnlyField({
  label, value, bold = true, accent = false,
}: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  if (!accent) {
    return (
      <div className="flex flex-col gap-1 min-w-0">
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
        <span className={`text-sm ${bold ? "font-medium" : "font-light"} text-card-foreground break-words whitespace-normal`}>{value || "—"}</span>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5 min-w-0">
      <span className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full bg-border-high" aria-hidden="true" />
      <div className="flex flex-col gap-1 min-w-0">
        {label && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        )}
        <span className="text-sm font-light text-card-foreground break-words whitespace-normal">{value || "—"}</span>
      </div>
    </div>
  )
}
