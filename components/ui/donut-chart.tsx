"use client"

import { useMemo, useState } from "react"

export interface DonutChartItem {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  items: DonutChartItem[]
  subLabel: string
  size?: number
  innerRadius?: number
  outerRadius?: number
  paddingAngle?: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

export function DonutChart({
  items,
  subLabel,
  size = 260,
  innerRadius = 80,
  outerRadius = 110,
  paddingAngle = 1,
}: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const total = items.reduce((sum, item) => sum + item.value, 0)
  const cx = size / 2
  const cy = size / 2
  const radius = (innerRadius + outerRadius) / 2
  const strokeWidth = outerRadius - innerRadius

  const segments = useMemo(() => {
    if (total <= 0) return []
    const gap = items.length > 0 ? paddingAngle : 0
    const realTotalAngle = Math.max(360 - items.length * gap, 0)
    let cursor = 0
    return items.map((item, i) => {
      const start = i === 0 ? 0 : cursor + gap
      const sweep = (item.value / total) * realTotalAngle
      const end = start + sweep
      cursor = end
      return { ...item, start, end, mid: (start + end) / 2 }
    })
  }, [items, total, paddingAngle])

  const activeSegment = activeIndex !== null ? segments[activeIndex] ?? null : null

  const tooltipOffset = useMemo(() => {
    if (!activeSegment) return null
    const pt = polarToCartesian(0, 0, outerRadius + 20, activeSegment.mid)
    return { dx: pt.x, dy: pt.y }
  }, [activeSegment, outerRadius])

  return (
    <div className="mx-auto grid min-h-[250px] max-w-[720px] items-center gap-4 md:grid-cols-[300px_260px]">
      <div className="relative flex h-[230px] w-full items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full max-w-[260px]"
          role="img"
          aria-label={`${subLabel}: ${total.toLocaleString("es-MX")} en total`}
        >
          {segments.map((seg, i) => (
            <path
              key={seg.name}
              d={arcPath(cx, cy, radius, seg.start, seg.end)}
              stroke={seg.color}
              strokeWidth={activeIndex === i ? strokeWidth + 6 : strokeWidth}
              strokeLinecap="round"
              fill="none"
              opacity={activeIndex === null || activeIndex === i ? 1 : 0.18}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          ))}
          <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 26, fontWeight: 700, fill: "#283c2a" }}>
            {total.toLocaleString("es-MX")}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#86857e" }}>
            {subLabel}
          </text>
        </svg>

        {activeSegment && total > 0 && tooltipOffset && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-semibold shadow-md"
            style={{
              left: `calc(50% + ${tooltipOffset.dx}px)`,
              top: `calc(50% + ${tooltipOffset.dy}px)`,
              color: activeSegment.color,
            }}
          >
            {((activeSegment.value / total) * 100).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-1.5">
        {items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            className={[
              "flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
              activeIndex === index ? "bg-muted" : "hover:bg-muted/70",
            ].join(" ")}
          >
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-medium leading-tight text-card-foreground">
                {item.name}
              </span>
              <span className="text-xs font-bold text-card-foreground">
                {item.value.toLocaleString("es-MX")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
