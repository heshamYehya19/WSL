import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { bestRating, getOrg, studentSignals } from "../../lib/selectors"
import { opportunities } from "../../data/seed"

const MATCH_THRESHOLD = 75

export default function Opportunities() {
  const { student } = useDemoUser()
  const { skillSignals } = useStore()
  if (!student) return null

  const ratedNames = new Set(studentSignals(skillSignals, student.id).filter((s) => bestRating(s) >= MATCH_THRESHOLD).map((s) => s.skill))

  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Opportunities matched to your rated skills"
        subtitle="Matching is based on overlap with skills WSL or a company has actually rated — not a hidden compatibility score."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {opportunities.map((o) => {
          const org = getOrg(o.organizationId)
          const matched = o.requiredSkills.filter((s) => ratedNames.has(s))
          return (
            <Link key={o.id} to={`/student/opportunities/${o.id}`} className="rounded-2xl border border-ink-200 bg-surface p-5 hover:border-teal-400">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink-900">{o.title}</h3>
                  <p className="text-xs text-ink-400">{org?.name} · {o.type} · {o.location}</p>
                </div>
                {matched.length > 0 && (
                  <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">{matched.length} skill match</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.requiredSkills.map((s) => (
                  <span
                    key={s}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                      ratedNames.has(s) ? "bg-teal-600 text-white" : "bg-ink-50 text-ink-500"
                    }`}
                  >
                    {ratedNames.has(s) ? "✓ " : ""}{s}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
