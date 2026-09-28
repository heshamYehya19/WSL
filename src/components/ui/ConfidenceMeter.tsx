import { useEffect, useState } from "react"

export function ConfidenceMeter({ value, label = "Rating" }: { value: number; label?: string }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="font-semibold text-ink-800">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-[width] duration-700 ease-out"
          style={{ width: mounted ? `${value}%` : "0%" }}
        />
      </div>
    </div>
  )
}
