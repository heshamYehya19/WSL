import type { SkillLevel } from "../../types"

const LEVEL_TONE: Record<SkillLevel, string> = {
  Advanced: "bg-teal-600 text-white",
  Intermediate: "bg-teal-400/80 text-ink-950",
  Foundational: "bg-ink-200 text-ink-700",
  Demonstrated: "bg-amber-400/80 text-ink-950",
}

export function SkillChip({
  skill,
  level,
  verified,
  size = "md",
}: {
  skill: string
  level?: SkillLevel
  verified?: boolean
  size?: "sm" | "md"
}) {
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white font-medium text-ink-800 ${pad}`}>
      {verified && <span className="text-verified-600">✓</span>}
      <span>{skill}</span>
      {level && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_TONE[level]}`}>{level}</span>
      )}
    </span>
  )
}
