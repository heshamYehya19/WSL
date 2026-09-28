function ratingTone(rating: number): string {
  if (rating >= 85) return "bg-teal-600 text-white"
  if (rating >= 70) return "bg-teal-400/80 text-ink-950"
  return "bg-ink-200 text-ink-700"
}

export function SkillChip({
  skill,
  rating,
  size = "md",
}: {
  skill: string
  rating?: number
  size?: "sm" | "md"
}) {
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white font-medium text-ink-800 ${pad}`}>
      <span>{skill}</span>
      {rating !== undefined && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ratingTone(rating)}`}>{rating}%</span>
      )}
    </span>
  )
}
