import type { SkillCriterion } from "../../types"

/**
 * The named criteria a skill was checked against: what the submitted evidence demonstrates (met),
 * and what it doesn't show (unmet). A gap is a statement about the evidence, not the student —
 * they may well know it and simply haven't shown it here.
 */
export function CriteriaChecklist({ criteria, part = "all" }: { criteria: SkillCriterion[]; part?: "all" | "demonstrates" | "gaps" }) {
  if (criteria.length === 0) return null
  const met = criteria.filter((c) => c.met)
  const unmet = criteria.filter((c) => !c.met)
  return (
    <div className="space-y-2">
      {part !== "gaps" && met.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">What the evidence demonstrates</p>
          <ul className="mt-1 space-y-0.5">
            {met.map((c) => (
              <li key={c.label} className="flex gap-1.5 text-xs text-ink-700">
                <span className="text-verified-600">✓</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {part !== "demonstrates" && unmet.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
            Evidence gaps <span className="font-medium tracking-normal normal-case">— not demonstrated in the submitted evidence</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {unmet.map((c) => (
              <li key={c.label} className="flex gap-1.5 text-xs text-ink-500">
                <span className="text-amber-500">⚠</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
