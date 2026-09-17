import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { getUniversity } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function MyChallenges() {
  const { company } = useDemoUser()
  const { challenges } = useStore()
  if (!company) return null

  const mine = challenges.filter((c) => c.organizationId === company.id)

  return (
    <div>
      <PageHeader
        eyebrow="My Challenges"
        title="Challenges you've submitted"
        action={<Link to="/company/submit" className="rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">+ Submit Challenge</Link>}
      />

      {mine.length === 0 ? (
        <EmptyState title="No challenges yet" description="Submit your first real-world challenge for WSL to structure and route to a university." />
      ) : (
        <div className="space-y-3">
          {mine.map((c) => {
            const uni = c.preferredUniversityId ? getUniversity(c.preferredUniversityId) : undefined
            return (
              <Link key={c.id} to={`/company/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div>
                  <p className="font-semibold text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-400">
                    {uni ? uni.name : "No university preference"} · Deadline {formatDate(c.deadline)} · {c.visibility}
                  </p>
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
