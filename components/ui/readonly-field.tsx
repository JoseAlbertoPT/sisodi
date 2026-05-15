export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="text-sm font-medium text-card-foreground break-words whitespace-normal">{value || "—"}</span>
    </div>
  )
}
