import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getUniversity } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function CompanyDashboard() {
  const { company } = useDemoUser()
  const { challenges, projects } = useStore()
  if (!company) return null

  const myChallenges = challenges.filter((c) => c.organizationId === company.id)
  const inReview = myChallenges.filter((c) => ["Submitted", "Under WSL Review"].includes(c.status))
  const active = myChallenges.filter((c) => ["Open to Students", "In Progress", "Evidence Under Review"].includes(c.status))
  const myProjects = projects.filter((p) => p.organizationId === company.id)
  const completed = myChallenges.filter((c) => ["Completed", "Verified"].includes(c.status))

  return (
    <div>
      <PageHeader eyebrow="Company Dashboard" title={company.name} subtitle={`${company.industry} · ${company.city}`} action={
        <Link to="/company/submit" className="rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
          + Submit Challenge
        </Link>
      } />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Challenges Submitted" value={myChallenges.length} />
        <StatTile label="Under WSL Review" value={inReview.length} />
        <StatTile label="Active with Students" value={active.length} />
        <StatTile label="Completed" value={completed.length} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Recent Challenges</h2>
          <Link to="/company/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
        </div>
        <div className="space-y-3">
          {myChallenges.slice(0, 5).map((c) => {
            const uni = c.preferredUniversityId ? getUniversity(c.preferredUniversityId) : undefined
            const projectCount = myProjects.filter((p) => p.challengeId === c.id).length
            return (
              <Link key={c.id} to={`/company/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div>
                  <p className="font-semibold text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-400">
                    {uni ? uni.shortName : "Awaiting university match"} · {projectCount} team{projectCount === 1 ? "" : "s"} · updated {formatRelative(c.history[c.history.length - 1].at)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
