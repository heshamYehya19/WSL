export function ConfidenceMeter({ value, label = "Evidence confidence" }: { value: number; label?: string }) {
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="font-semibold text-ink-800">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
