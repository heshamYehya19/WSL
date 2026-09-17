import type { SkillLevel } from "../../types"

const LEVEL_TONE: Record<SkillLevel, string> = {
  Advanced: "bg-teal-600 text-white",
  Intermediate: "bg-teal-400/80 text-ink-950",
  Foundational: "bg-ink-200 text-ink-700",
  Demonstrated: "bg-amber-400/80 text-ink-950",
}

export function LevelBadge({ level, size = "sm" }: { level: SkillLevel; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
  return <span className={`rounded font-semibold ${pad} ${LEVEL_TONE[level]}`}>{level}</span>
}
