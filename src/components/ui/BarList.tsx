import { useEffect, useState, type ReactNode } from "react"

export interface BarListItem {
  key: string
  label: ReactNode
  value: number
  displayValue?: ReactNode
  meta?: ReactNode
}

export function BarList({
  items,
  max,
  emptyMessage = "No data yet.",
}: {
  items: BarListItem[]
  max?: number
  emptyMessage?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">{emptyMessage}</p>
  }

  const scale = max ?? Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const pct = Math.max(2, Math.min(100, (item.value / scale) * 100))
        return (
          <div key={item.key} className="group/row" title={`${typeof item.label === "string" ? item.label : ""} — ${item.value}`.trim()}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-ink-800">{item.label} {item.meta}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink-900">{item.displayValue ?? item.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-[width] duration-700 ease-out group-hover/row:from-teal-600 group-hover/row:to-teal-500"
                style={{ width: mounted ? `${pct}%` : "0%" }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
