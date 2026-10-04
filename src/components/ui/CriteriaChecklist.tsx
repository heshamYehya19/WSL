import type { SkillCriterion } from "../../types"

/** The named rubric criteria a skill was checked against — what the evidence
 * demonstrates (met) and what's still missing (unmet), not just one score. */
export function CriteriaChecklist({ criteria }: { criteria: SkillCriterion[] }) {
  if (criteria.length === 0) return null
  const met = criteria.filter((c) => c.met)
  const unmet = criteria.filter((c) => !c.met)
  return (
    <div className="space-y-2">
      {met.length > 0 && (
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
      {unmet.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Evidence gaps</p>
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
