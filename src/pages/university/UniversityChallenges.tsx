import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { getOrg } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

const TABS = ["Incoming", "Approved", "All"] as const

export default function UniversityChallenges() {
  const { university } = useDemoUser()
  const { challenges } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>("Incoming")
  if (!university) return null

  const relevant = challenges.filter((c) => c.preferredUniversityId === university.id || c.preferredUniversityId === null).filter((c) => c.status !== "Draft")

  const list = relevant.filter((c) => {
    if (tab === "Incoming") return c.status === "Sent to University"
    if (tab === "Approved") return ["University Accepted", "Open to Students", "In Progress", "Evidence Under Review", "Completed", "Verified"].includes(c.status)
    return true
  })

  return (
    <div>
      <PageHeader eyebrow="Challenges" title="Company challenges" subtitle="Review structured challenges from WSL, then accept and map them to a course." />

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
          {list.map((c) => {
            const org = getOrg(c.organizationId)
            return (
              <Link key={c.id} to={`/university/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div>
                  <p className="font-semibold text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-400">{org?.name} · {c.industry} · Deadline {formatDate(c.deadline)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.requiredSkills.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-600">{s}</span>
                    ))}
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
