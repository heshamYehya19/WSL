import { useState } from "react"
import { useCountUp } from "../../hooks/useCountUp"

export interface SkillLevelItem {
  key: string
  skill: string
  /** Evidence confidence (0-100) — shown as a secondary number, not the tier itself. */
  rating: number
  /** The authoritative tier — set server-side (suggestedLevelFor), never recomputed here. */
  suggestedLevel: "Foundational" | "Intermediate" | "Advanced" | "Demonstrated"
}

// Same thresholds as server/ml/analyze.ts's suggestedLevelFor — kept in sync by hand
// since this is a display-only mirror, not a second source of truth for the tier itself.
const LEVELS = [
  { key: "Demonstrated", label: "Demonstrated", range: "80+", dot: "bg-teal-600", ring: "ring-teal-600/40", text: "text-teal-600" },
  { key: "Advanced", label: "Advanced", range: "60–79", dot: "bg-teal-400", ring: "ring-teal-400/40", text: "text-teal-500" },
  { key: "Intermediate", label: "Intermediate", range: "35–59", dot: "bg-amber-400", ring: "ring-amber-400/40", text: "text-amber-500" },
  { key: "Foundational", label: "Foundational", range: "0–34", dot: "bg-ink-400", ring: "ring-ink-400/40", text: "text-ink-500" },
] as const

type LevelKey = (typeof LEVELS)[number]["key"]

function ScoreRing({ score }: { score: number }) {
  const shown = Math.round(useCountUp(score))
  const r = 44
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-ink-100" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-teal-500 drop-shadow-[0_0_6px_rgba(20,184,166,0.45)]"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-ink-950 tabular-nums">{shown}</span>
        <span className="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Avg. confidence</span>
      </div>
    </div>
  )
}

export function SkillLevels({ items, emptyMessage }: { items: SkillLevelItem[]; emptyMessage: string }) {
  const counts = Object.fromEntries(LEVELS.map((l) => [l.key, items.filter((i) => i.suggestedLevel === l.key).length])) as Record<LevelKey, number>
  const defaultLevel = LEVELS.find((l) => counts[l.key] > 0)?.key ?? "Demonstrated"
  const [selected, setSelected] = useState<LevelKey>(defaultLevel)

  if (items.length === 0) return <p className="py-8 text-center text-sm text-ink-400">{emptyMessage}</p>

  const avg = Math.round(items.reduce((sum, i) => sum + i.rating, 0) / items.length)
  const level = LEVELS.find((l) => l.key === selected)!
  const inLevel = items.filter((i) => i.suggestedLevel === selected).sort((a, b) => b.rating - a.rating)

  // The skill closest to crossing into the next tier up — a concrete next step.
  // Mirrors suggestedLevelFor's thresholds (35/60/80), not an independent scheme.
  const nextUp = items
    .filter((i) => i.rating < 80)
    .map((i) => ({ ...i, gap: (i.rating >= 60 ? 80 : i.rating >= 35 ? 60 : 35) - i.rating, target: i.rating >= 60 ? "Demonstrated" : i.rating >= 35 ? "Advanced" : "Intermediate" }))
    .sort((a, b) => a.gap - b.gap)[0]

  return (
    <div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <ScoreRing score={avg} />
        <div className="grid w-full flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVELS.map((l) => {
            const active = l.key === selected
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setSelected(l.key)}
                aria-pressed={active}
                className={`group rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${
                  active ? `border-transparent bg-ink-50 ring-2 ${l.ring}` : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${l.dot} transition-transform duration-200 group-hover:scale-150`} />
                  <span className="text-xs font-semibold text-ink-700">{l.label}</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-ink-950 tabular-nums">{counts[l.key]}</div>
                <div className="text-[10px] text-ink-400">{l.range}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div key={selected} className="mt-5 min-h-[3.5rem]">
        {inLevel.length === 0 ? (
          <p className="animate-fade-in-up text-sm text-ink-400">No {level.label.toLowerCase()} skills yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inLevel.map((i, idx) => (
              <span
                key={i.key}
                style={{ animationDelay: `${idx * 40}ms` }}
                className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-teal-400"
              >
                {i.skill}
                <span className={`font-bold tabular-nums ${level.text}`}>{i.rating}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {nextUp && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-100/60 px-3 py-2 text-xs text-ink-700">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          <span>
            <span className="font-semibold text-ink-900">{nextUp.skill}</span> is {nextUp.gap} pt{nextUp.gap === 1 ? "" : "s"} of evidence confidence from{" "}
            <span className="font-semibold text-teal-600">{nextUp.target}</span> — but only a university mentor's verification makes it official.
          </span>
        </div>
      )}
    </div>
  )
}
