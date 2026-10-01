import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { challengeFor, getOrg, getStudent, isUniversityStudent, skillsForProject } from "../../lib/selectors"
import type { ChallengeStatus } from "../../types"

const TABS: { label: string; statuses: ChallengeStatus[] }[] = [
  { label: "Awaiting Confirmation", statuses: ["Submissions Under Review"] },
  { label: "Confirmed", statuses: ["Confirmed to Company", "Company Reviewed"] },
]

export default function SubmissionsQueue() {
  const { university } = useDemoUser()
  const { projects, challenges, skillSignals } = useStore()
  const [tab, setTab] = useState(0)
  if (!university) return null

  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  const list = uniProjects.filter((p) => TABS[tab].statuses.includes(p.status))

  return (
    <div>
      <PageHeader
        eyebrow="Submissions"
        title="Review student submissions"
        subtitle="WSL rates each submission automatically. Your job here is just to see the level of your students and confirm it to the company."
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${tab === i ? "border-b-2 border-teal-500 text-ink-950" : "text-ink-400 hover:text-ink-700"}`}
          >
            {t.label} <span className="text-ink-300">({uniProjects.filter((p) => t.statuses.includes(p.status)).length})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing here" description="No submissions in this state right now." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const student = getStudent(p.studentId)
            const signals = skillsForProject(skillSignals, p.id)
            const avgRating = signals.length ? Math.round(signals.reduce((sum, s) => sum + s.aiRating, 0) / signals.length) : null
            return (
              <Link key={p.id} to={`/university/projects/${p.id}`} className="rounded-2xl border border-ink-200 bg-surface p-5 hover:border-teal-400">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-900">{p.title}</span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-xs text-ink-400">{student?.name} · {org?.name} · {challenge?.industry}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {signals.map((s) => (
                    <span key={s.id} className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-ink-600">{s.skill}: {s.aiRating}%</span>
                  ))}
                </div>
                {avgRating !== null && <p className="mt-2 text-xs text-ink-400">Average AI rating: {avgRating}%</p>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
