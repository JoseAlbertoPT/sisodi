"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function isoToDate(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt.getTime()) ? undefined : dt
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function dmyToDate(s: string): Date | undefined {
  if (!s) return undefined
  const parts = s.split("/")
  if (parts.length !== 3 || parts[0] === "") return undefined
  const [d, m, y] = parts.map(Number)
  const dt = new Date(y, m - 1, d)
  return isNaN(dt.getTime()) ? undefined : dt
}

export function dateToDmy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
}

interface DatePickerHabilProps {
  
  value?: Date
  onChange: (date: Date | undefined) => void
  
  fromDate?: Date
  
  defaultMonth?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
  
  compact?: boolean
}

export function DatePickerHabil({
  value,
  onChange,
  fromDate,
  defaultMonth,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  compact = false,
}: DatePickerHabilProps) {
  const [open, setOpen] = React.useState(false)

  
  const [month, setMonth] = React.useState<Date>(
    () => value ?? defaultMonth ?? new Date()
  )

  
  React.useEffect(() => {
    if (value) setMonth(value)
    else if (defaultMonth) setMonth(defaultMonth)
  }, [value, defaultMonth])

  const label = value
    ? value.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal gap-1.5",
            compact ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className={cn("shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          locale={es}
          selected={value}
          month={month}
          onMonthChange={setMonth}
          startMonth={new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
          fromDate={fromDate}
          weekStartsOn={1}
          disabled={[{ dayOfWeek: [0, 6] }]}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
          modifiersClassNames={{
            weekend: "text-muted-foreground/40 bg-muted/30 cursor-not-allowed line-through",
          }}
          classNames={{
            root:          "p-3 select-none",
            months:        "flex flex-col gap-4",
            month:         "flex flex-col gap-3",
            month_caption: "flex items-center justify-between h-8 px-1",
            caption_label: "text-sm font-semibold capitalize text-card-foreground",
            nav:           "flex items-center gap-1",
            button_previous: cn(
              "h-7 w-7 p-0 border border-input rounded-md flex items-center justify-center",
              "opacity-70 hover:opacity-100 hover:bg-accent transition-opacity",
            ),
            button_next: cn(
              "h-7 w-7 p-0 border border-input rounded-md flex items-center justify-center",
              "opacity-70 hover:opacity-100 hover:bg-accent transition-opacity",
            ),
            weekdays:    "flex mt-1",
            weekday:     "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center pb-1",
            week:        "flex w-full mt-1",
            day:         "relative p-0 text-center w-9 h-9",
            day_button:  "w-full h-full rounded-md text-sm font-normal hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            selected:    "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
            today:       "[&>button]:font-bold [&>button]:underline",
            outside:     "opacity-40",
            disabled:    "opacity-30 pointer-events-none",
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left"
                ? null
                : <ChevronRightIcon className="h-4 w-4" />,
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
