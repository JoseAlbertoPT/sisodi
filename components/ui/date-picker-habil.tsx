"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
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
  toDate?: Date
  startMonth?: Date
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
  toDate,
  startMonth,
  defaultMonth,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  compact = false,
}: DatePickerHabilProps) {
  const [open, setOpen] = React.useState(false)

  
  const [month, setMonth] = React.useState<Date>(
    () => value ?? defaultMonth ?? startMonth ?? fromDate ?? new Date()
  )

  React.useEffect(() => {
    if (value) setMonth(value)
    else if (defaultMonth) setMonth(defaultMonth)
    else if (startMonth) setMonth(startMonth)
    else if (fromDate) setMonth(fromDate)
  }, [value, defaultMonth, startMonth, fromDate])

  const label = value
    ? value.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal gap-1.5 w-fit rounded-full bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 h-auto",
            compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <img src="/iconos2/calender-alt-1.svg" alt="" className={cn("shrink-0 opacity-60", compact ? "h-3 w-3" : "h-4 w-4")} />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="ds-calendar-popover relative w-auto rounded-[20px] border border-dashed border-[#E4CCE8] bg-white p-5 shadow-[0_8px_24px_-4px_rgba(138,31,82,0.12)]"
        align="start"
      >
        <DayPicker
          mode="single"
          locale={es}
          selected={value}
          month={month}
          onMonthChange={setMonth}
          startMonth={startMonth ?? fromDate}
          fromDate={fromDate}
          toDate={toDate}
          weekStartsOn={1}
          showOutsideDays
          disabled={[
            ...INHABILES,
            ...(fromDate ? [{ before: fromDate }] : []),
            ...(toDate   ? [{ after:  toDate   }] : []),
          ]}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          modifiers={{
            inhabil: INHABILES,
            available: (date: Date) => {
              if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) return false
              if (INHABILES.some(d => d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate())) return false
              if (fromDate && date < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return false
              if (toDate && date > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())) return false
              return true
            },
          }}
          modifiersClassNames={{
            inhabil: "cursor-not-allowed",
            available: "[&>button]:bg-[#F2F1F4] [&>button]:rounded-lg",
          }}
          classNames={{
            root: "select-none",

            months:        "flex flex-col gap-4",
            month:         "flex flex-col gap-3",
            month_caption: "flex h-6 items-center justify-center px-10",
            caption_label: "text-base font-semibold capitalize text-card-foreground",
            nav:            "absolute left-3 right-3 top-1 flex items-center justify-between",
            button_previous: cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#E4CCE8] p-0 text-foreground",
              "hover:bg-[#FBF1F8] hover:text-foreground transition-colors",
            ),
            button_next: cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#E4CCE8] p-0 text-foreground",
              "hover:bg-[#FBF1F8] hover:text-foreground transition-colors",
            ),
            weekdays:    "flex mt-2",
            weekday:     "text-gray-500 rounded-md w-10 font-normal text-[0.8rem] text-center pb-1 capitalize",
            week:        "flex w-full",
           day:
  "relative p-0 text-center w-10 h-10 [&>button]:h-9 [&>button]:w-9 [&>button]:rounded-lg [&>button]:border [&>button]:border-dashed [&>button]:border-transparent [&>button]:bg-transparent [&>button]:text-[#1A2419] [&>button]:text-sm [&>button]:font-medium [&>button]:transition-colors [&>button:hover]:border-[#E4CCE8] [&>button:hover]:bg-[#FBF1F8] [&>button:hover]:text-[#1A2419]",

outside:
  "[&>button]:text-gray-300",

selected:
  "[&>button]:!border-transparent [&>button]:!bg-[#773357] [&>button]:!text-white [&>button:hover]:!bg-[#773357] [&>button:hover]:!text-white",

today:
  "[&>button]:font-semibold",

disabled:
  "opacity-40 pointer-events-none [&>button]:!bg-transparent [&>button]:!text-[#A8A8A8] [&>button]:no-underline",
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left"
                ? <ChevronLeftIcon className="h-4 w-4" />
                : <ChevronRightIcon className="h-4 w-4" />,
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
