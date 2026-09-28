import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { BarList } from "../../components/ui/BarList"
import { getUniversity } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function CompanyDashboard() {
  const { company } = useDemoUser()
  const { challenges, projects } = useStore()
  if (!company) return null

  const myChallenges = challenges.filter((c) => c.organizationId === company.id)
  const drafts = myChallenges.filter((c) => c.status === "Draft")
  const active = myChallenges.filter((c) => ["Sent to University", "University Assigned", "In Progress", "Submissions Under Review"].includes(c.status))
  const awaitingReview = myChallenges.filter((c) => c.status === "Confirmed to Company")
  const reviewed = myChallenges.filter((c) => c.status === "Company Reviewed")
  const myProjects = projects.filter((p) => p.organizationId === company.id)

  const pipelineItems = [
    { key: "drafts", label: "Drafts", value: drafts.length },
    { key: "active", label: "Active", value: active.length },
    { key: "awaiting", label: "Awaiting Your Review", value: awaitingReview.length },
    { key: "reviewed", label: "Reviewed", value: reviewed.length },
  ]

  const skillCounts = new Map<string, number>()
  for (const c of myChallenges) for (const skill of c.requiredSkills) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1)
  const requestedSkillItems = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([skill, count]) => ({ key: skill, label: skill, value: count }))

  return (
    <div>
      <PageHeader eyebrow="Company Dashboard" title={company.name} subtitle={`${company.industry} · ${company.city}`} action={
        <Link to="/company/submit" className="rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0">
          + Submit Challenge
        </Link>
      } />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatTile label="Drafts" value={drafts.length} />
        <StatTile label="Active" value={active.length} />
        <StatTile label="Awaiting Your Review" value={awaitingReview.length} hint={awaitingReview.length > 0 ? "Ready now" : undefined} />
        <StatTile label="Reviewed" value={reviewed.length} />
        <StatTile label="Total Submitted" value={myChallenges.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Challenge Pipeline</h2>
          <BarList items={pipelineItems} emptyMessage="No challenges submitted yet." />
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Most Requested Skills</h2>
          <BarList items={requestedSkillItems} emptyMessage="No challenges submitted yet." />
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Recent Challenges</h2>
          <Link to="/company/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
        </div>
        <div className="space-y-3">
          {myChallenges.slice(0, 5).map((c, i) => {
            const uni = c.preferredUniversityId ? getUniversity(c.preferredUniversityId) : undefined
            const studentCount = myProjects.filter((p) => p.challengeId === c.id).length
            return (
              <Link
                key={c.id}
                to={`/company/challenges/${c.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-in-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-400">
                    {uni ? uni.shortName : "Awaiting university match"} · {studentCount} student{studentCount === 1 ? "" : "s"} · updated {formatRelative(c.history[c.history.length - 1].at)}
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
