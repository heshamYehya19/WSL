import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { formatDate } from "../../lib/format"
import { assignmentFor, isRoutedTo, statusAtUniversity } from "../../lib/selectors"

const TABS = ["Incoming", "Assigned", "All"] as const

export default function UniversityChallenges() {
  const { university } = useDemoUser()
  const { challenges, projects, students, getOrg } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>("Incoming")
  if (!university) return null

  // Statuses are from this university's point of view: an open challenge another university
  // assigned is still incoming here until this university assigns it too.
  const relevant = challenges
    .filter((c) => isRoutedTo(c, university.id))
    .map((c) => ({ c, status: statusAtUniversity(c, university.id, projects, students), mine: assignmentFor(c, university.id) }))

  const list = relevant.filter(({ mine }) => {
    if (tab === "Incoming") return !mine
    if (tab === "Assigned") return Boolean(mine)
    return true
  })

  return (
    <div>
      <PageHeader eyebrow="Challenges" title="Company challenges" subtitle="Every challenge here already passed WSL's automatic private-data screen — assign it to a college's students." />

      <div className="mb-6 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${tab === t ? "border-b-2 border-teal-500 text-ink-950" : "text-ink-400 hover:text-ink-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing here" description="No challenges match this view right now." />
      ) : (
        <div className="space-y-3">
          {list.map(({ c, status, mine }) => {
            const org = getOrg(c.organizationId)
            return (
              <Link key={c.id} to={`/university/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-surface p-5 hover:border-teal-400">
                <div>
                  <p className="font-semibold text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-400">{org?.name} · {c.industry} · Deadline {formatDate(c.deadline)}</p>
                  {mine && <p className="text-xs text-teal-600">Assigned to your {mine.program} students</p>}
                  {!mine && c.preferredUniversityId === null && <p className="text-xs text-ink-400">Open to every university</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.requiredSkills.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-600">{s}</span>
                    ))}
                  </div>
                </div>
                <StatusBadge status={status} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
