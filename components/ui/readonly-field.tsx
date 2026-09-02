export function ReadOnlyField({ label, value, bold = true }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className={`text-sm ${bold ? "font-medium" : "font-normal"} text-card-foreground break-words whitespace-normal`}>{value || "—"}</span>
    </div>
  )
}
