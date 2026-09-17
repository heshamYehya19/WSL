import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getOrg, isUniversityStudent, studentsOfUniversity } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function UniversityDashboard() {
  const { university } = useDemoUser()
  const { challenges, projects, evidence, skillSignals } = useStore()
  if (!university) return null

  const roster = studentsOfUniversity(university.id)
  const uniChallenges = challenges.filter((c) => c.preferredUniversityId === university.id && c.status !== "Draft")
  const activeChallenges = uniChallenges.filter((c) => ["University Accepted", "Open to Students", "In Progress", "Evidence Under Review"].includes(c.status))
  const uniProjects = projects.filter((p) => p.teamStudentIds.some((sid) => isUniversityStudent(sid, university.id)))
  const uniEvidence = evidence.filter((e) => isUniversityStudent(e.contributorId, university.id))
  const uniSignals = skillSignals.filter((s) => isUniversityStudent(s.studentId, university.id))
  const verifiedCount = uniSignals.filter((s) => s.status === "Verified").length
  const pendingCount = uniSignals.filter((s) => s.status === "Pending Verification").length

  const needsReview = challenges.filter((c) => c.status === "Sent to University" && (c.preferredUniversityId === university.id || c.preferredUniversityId === null))

  return (
    <div>
      <PageHeader
        eyebrow="University Dashboard"
        title={university.name}
        subtitle={`${university.city} · ${university.programs.join(", ")}`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active Challenges" value={activeChallenges.length} />
        <StatTile label="Student Projects" value={uniProjects.length} />
        <StatTile label="Evidence Submitted" value={uniEvidence.length} />
        <StatTile label="Skills Verified" value={verifiedCount} hint={`${pendingCount} pending`} />
        <StatTile label="Students Participating" value={roster.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Challenges Awaiting Review</h2>
            <Link to="/university/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {needsReview.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">Nothing waiting on you right now.</p>
            )}
            {needsReview.map((c) => {
              const org = getOrg(c.organizationId)
              return (
                <Link key={c.id} to={`/university/challenges/${c.id}`} className="block rounded-2xl border border-ink-200 bg-white p-4 hover:border-teal-400">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">{c.title}</p>
                      <p className="text-xs text-ink-400">{org?.name} · {c.industry}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Evidence Awaiting Verification</h2>
            <Link to="/university/verification" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {uniSignals.filter((s) => s.status === "Pending Verification").slice(0, 5).map((s) => (
              <Link key={s.id} to={`/university/verification/${s.id}`} className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 hover:border-teal-400">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.skill}</p>
                  <p className="text-xs text-ink-400">Analyzed {formatRelative(s.analyzedAt)} · {s.confidence}% confidence</p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
            {uniSignals.filter((s) => s.status === "Pending Verification").length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">No pending verification items.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
