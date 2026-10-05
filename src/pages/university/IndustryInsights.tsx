import { useEffect, useState } from "react"
import { useStore } from "../../state/store"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero } from "../../components/ui/ListKit"
import { demandSummary } from "../../lib/selectors"
import type { IndustryInsights as Insights } from "../../types"

/**
 * What companies are asking for across the challenges sent to this university, and where its students have already shown
 * it. Counts only, derived by the server from challenge data and verified proof — no score, no ranking, no AI.
 */
export default function IndustryInsights() {
  const { getIndustryInsights } = useStore()
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let current = true
    getIndustryInsights().then(
      (d) => {
        if (!current) return
        setData(d)
        setError("")
      },
      (e: Error) => {
        if (current) setError(e.message)
      },
    )
    return () => {
      current = false
    }
  }, [getIndustryInsights])

  const maxSkill = Math.max(...(data?.skills.map((s) => s.challengeCount) ?? [0]), 1)
  const maxIndustry = Math.max(...(data?.industries.map((i) => i.challengeCount) ?? [0]), 1)

  return (
    <div>
      <PageHero
        eyebrow="Industry Insights"
        title="What companies are asking for"
        subtitle="See what companies are asking for across WSL challenges, and where your students have demonstrated verified proof."
        stats={[
          { label: "company challenges", value: data?.challengeCount ?? 0, accent: true },
          { label: "requested skills", value: data?.skills.length ?? 0 },
          { label: "industries", value: data?.industries.length ?? 0 },
        ]}
      />

      {error ? (
        <EmptyState title="Industry Insights isn't available" description={error} />
      ) : !data ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading industry insights…</p>
      ) : data.challengeCount === 0 ? (
        <EmptyState title="No company challenges yet" description="Industry Insights appears once companies send challenges to your university." />
      ) : (
        <div className="space-y-6">
          <section aria-label="What industry is asking for" className="rounded-2xl border border-teal-500/30 bg-teal-50 p-5">
            <h2 className="text-xs font-semibold tracking-wide text-teal-700 uppercase">What industry is asking for</h2>
            <p className="mt-1.5 text-base font-medium text-ink-900">{demandSummary(data.skills)}</p>
            <p className="mt-1 text-xs text-ink-500">Counted from {data.challengeCount} company challenge{data.challengeCount === 1 ? "" : "s"} sent to your university. A skill counts once per challenge.</p>
          </section>

          <section aria-label="Most requested skills" className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h2 className="font-semibold text-ink-900">Most requested skills</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-wide text-ink-400 uppercase">
                    <th className="py-2 pr-4 font-semibold">Skill</th>
                    <th className="py-2 pr-4 font-semibold">Challenges</th>
                    <th className="py-2 font-semibold">Verified students</th>
                  </tr>
                </thead>
                <tbody>
                  {data.skills.map((s) => (
                    <tr key={s.skill} className="border-t border-ink-100">
                      <td className="py-2.5 pr-4 font-medium text-ink-800">{s.skill}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-100">
                            <div className="h-full rounded-full bg-ink-400" style={{ width: `${(s.challengeCount / maxSkill) * 100}%` }} />
                          </div>
                          <span className="tabular-nums text-ink-700">{s.challengeCount}</span>
                        </div>
                      </td>
                      <td className="py-2.5 tabular-nums">
                        {s.verifiedStudentCount > 0 ? <span className="font-semibold text-verified-600">✓ {s.verifiedStudentCount}</span> : <span className="text-ink-400">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-ink-400">
              Verified students are your students with that skill currently verified by your university and confirmed to companies. It is a headcount, not an
              assessment of any student.
            </p>
          </section>

          <section aria-label="Industry demand" className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h2 className="font-semibold text-ink-900">Industry demand</h2>
            <ul className="mt-3 space-y-3">
              {data.industries.map((i) => (
                <li key={i.industry} className="border-t border-ink-100 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{i.industry}</p>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${(i.challengeCount / maxIndustry) * 100}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-ink-600">
                        {i.challengeCount} challenge{i.challengeCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {i.topSkills.map((skill) => (
                      <span key={skill} className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                        {skill}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
