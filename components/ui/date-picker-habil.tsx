"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getNthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1)
  const diff = (1 - d.getDay() + 7) % 7
  d.setDate(1 + diff + (n - 1) * 7)
  return d
}

function getInhabilDates(year: number): Date[] {
  const easter = getEasterDate(year)
  const juevesSanto = new Date(year, easter.getMonth(), easter.getDate() - 3)
  const viernesSanto = new Date(year, easter.getMonth(), easter.getDate() - 2)
  const dates: Date[] = [
    new Date(year, 0, 1),
    getNthMonday(year, 1, 1),
    getNthMonday(year, 2, 3),
    juevesSanto,
    viernesSanto,
    new Date(year, 4, 1),
    new Date(year, 4, 5),
    new Date(year, 5, 25),
    new Date(year, 8, 16),
    new Date(year, 10, 2),
    getNthMonday(year, 10, 3),
    new Date(year, 11, 25),
  ]
  if (year === 2026) {
    const extra: [number, number][] = [
      [0, 5], [0, 6], [0, 7],
      [1, 2],
      [2, 16], [2, 30], [2, 31],
      [3, 1], [3, 2], [3, 3], [3, 10], [3, 17],
      [4, 11],
      [5, 22],
      [8, 15], [8, 30],
      [9, 12],
      [10, 16],
    ]
    for (const [mo, dy] of extra) dates.push(new Date(year, mo, dy))
  }
  return dates
}

const INHABILES: Date[] = [2025, 2026, 2027, 2028, 2029, 2030].flatMap(getInhabilDates)

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
          disabled={INHABILES}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          modifiers={{ inhabil: INHABILES }}
          modifiersClassNames={{
            inhabil: "text-muted-foreground/40 bg-muted/30 cursor-not-allowed line-through",
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
