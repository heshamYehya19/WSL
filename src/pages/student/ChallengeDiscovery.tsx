import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { getOrg } from "../../lib/selectors"
import { daysUntil } from "../../lib/format"

const OPEN_STATUSES = ["Open to Students", "In Progress", "Evidence Under Review", "Completed", "Verified"]

export default function ChallengeDiscovery() {
  const { student } = useDemoUser()
  const { challenges } = useStore()
  const [query, setQuery] = useState("")
  const [industry, setIndustry] = useState("All")

  const visible = useMemo(() => {
    return challenges.filter((c) => {
      if (!OPEN_STATUSES.includes(c.status)) return false
      if (c.visibility !== "Public" && c.preferredUniversityId !== student?.universityId) return false
      if (industry !== "All" && c.industry !== industry) return false
      if (query && !`${c.title} ${c.requiredSkills.join(" ")}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [challenges, student, industry, query])

  const industries = ["All", ...Array.from(new Set(challenges.map((c) => c.industry)))]

  return (
    <div>
      <PageHeader
        eyebrow="Challenge Discovery"
        title="Challenges approved by your university"
        subtitle="Every challenge below has already been structured by WSL and accepted by a university — safe to explore."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or skill..."
          className="min-w-56 flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400"
        >
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No challenges match" description="Try a different search or filter." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const org = getOrg(c.organizationId)
            const dLeft = daysUntil(c.deadline)
            return (
              <Link
                key={c.id}
                to={`/student/challenges/${c.id}`}
                className="flex flex-col rounded-2xl border border-ink-200 bg-white p-5 transition-colors hover:border-teal-400"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-[11px] font-bold text-teal-300">
                    {org?.logoInitials}
                  </span>
                  <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] font-medium text-ink-500">{c.visibility}</span>
                </div>
                <h3 className="font-semibold text-ink-900">{c.title}</h3>
                <p className="text-xs text-ink-400">{org?.name} · {c.industry}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.requiredSkills.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-ink-600">{s}</span>
                  ))}
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-ink-500">{c.learningOutcomes[0]}</p>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-400">
                  <span>{c.difficulty}</span>
                  <span>{c.numTeams} team{c.numTeams > 1 ? "s" : ""}</span>
                  <span>{dLeft > 0 ? `${dLeft}d left` : "Closed"}</span>
                </div>
                <div className="mt-2">
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
