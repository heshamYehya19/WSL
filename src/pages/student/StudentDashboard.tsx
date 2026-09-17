import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { SkillChip } from "../../components/ui/SkillChip"
import { EmptyState } from "../../components/ui/EmptyState"
import { formatRelative } from "../../lib/format"
import { challengeFor, contributorEvidence, getOrg, pendingSignals, studentProjects, studentSignals, verifiedSignals } from "../../lib/selectors"
import { opportunities } from "../../data/seed"

export default function StudentDashboard() {
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals } = useStore()
  if (!student) return null

  const myProjects = studentProjects(projects, student.id)
  const myVerified = verifiedSignals(skillSignals, student.id)
  const myPending = pendingSignals(skillSignals, student.id)
  const myEvidence = evidence.filter((e) => e.contributorId === student.id)
  const verifiedSkillNames = new Set(myVerified.map((s) => s.skill))
  const matchedOpportunities = opportunities.filter((o) => o.requiredSkills.some((s) => verifiedSkillNames.has(s)))

  const activity = [
    ...myProjects.map((p) => ({ at: p.startedAt, text: `Started project "${p.title}"` })),
    ...studentSignals(skillSignals, student.id).map((s) => ({
      at: s.analyzedAt,
      text: `AI identified a "${s.skill}" skill signal (${s.confidence}% confidence)`,
    })),
    ...myVerified.map((s) => ({ at: s.verifiedAt!, text: `"${s.skill}" verified by ${s.verifiedBy}` })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)

  return (
    <div>
      <PageHeader
        eyebrow="Student Dashboard"
        title={`Welcome back, ${student.name.split(" ")[0]}`}
        subtitle={`${student.field} · ${student.year} — this is your living record of demonstrated capability.`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active Projects" value={myProjects.filter((p) => p.status !== "Verified" && p.status !== "Completed").length} />
        <StatTile label="Verified Skills" value={myVerified.length} />
        <StatTile label="Pending Verification" value={myPending.length} />
        <StatTile label="Evidence Submitted" value={myEvidence.length} />
        <StatTile label="Opportunities Matched" value={matchedOpportunities.length} />
        <StatTile label="Skill Signals Found" value={studentSignals(skillSignals, student.id).length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Active Projects</h2>
            <Link to="/student/projects" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          {myProjects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Browse challenges approved by your university and start your first project."
              action={<Link to="/student/challenges" className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Discover Challenges</Link>}
            />
          ) : (
            <div className="space-y-3">
              {myProjects.map((p) => {
                const org = getOrg(p.organizationId)
                const challenge = challengeFor(challenges, p)
                const contribSkills = p.individualContributions[student.id] ?? []
                const myEv = contributorEvidence(evidence, p.id, student.id)
                return (
                  <Link
                    key={p.id}
                    to={`/student/projects/${p.id}`}
                    className="block rounded-2xl border border-ink-200 bg-white p-5 transition-colors hover:border-teal-400"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-ink-900">{p.title}</h3>
                        <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {contribSkills.map((s) => (
                        <SkillChip key={s} skill={s} size="sm" />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-ink-400">{myEv.length} evidence item{myEv.length === 1 ? "" : "s"} submitted</p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-ink-900">Recent Activity</h2>
          <div className="rounded-2xl border border-ink-200 bg-white p-4">
            {activity.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">No activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((a, i) => (
                  <li key={i} className="relative pl-4 text-sm">
                    <span className="absolute top-1.5 left-0 h-1.5 w-1.5 rounded-full bg-teal-500" />
                    <p className="text-ink-700">{a.text}</p>
                    <p className="text-xs text-ink-400">{formatRelative(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
