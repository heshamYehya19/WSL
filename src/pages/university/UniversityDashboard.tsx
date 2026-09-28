import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { BarList } from "../../components/ui/BarList"
import { SegmentedBar } from "../../components/ui/SegmentedBar"
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

  const verificationSegments = [
    { key: "Verified", label: "Verified", value: verifiedCount, colorClassName: "bg-verified-500" },
    { key: "Pending Verification", label: "Pending", value: pendingCount, colorClassName: "bg-amber-500" },
    { key: "More Evidence Requested", label: "More Evidence Requested", value: uniSignals.filter((s) => s.status === "More Evidence Requested").length, colorClassName: "bg-amber-600" },
    { key: "Rejected", label: "Rejected", value: uniSignals.filter((s) => s.status === "Rejected").length, colorClassName: "bg-danger-600" },
  ]

  const skillCounts = new Map<string, number>()
  for (const s of uniSignals) skillCounts.set(s.skill, (skillCounts.get(s.skill) ?? 0) + 1)
  const topSkillItems = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([skill, count]) => ({ key: skill, label: skill, value: count }))

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
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Verification Funnel</h2>
          <SegmentedBar segments={verificationSegments} emptyMessage="No skill signals yet." />
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Emerging Skills</h2>
          <BarList items={topSkillItems} emptyMessage="No skill signals yet." />
        </div>
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
            {needsReview.map((c, i) => {
              const org = getOrg(c.organizationId)
              return (
                <Link
                  key={c.id}
                  to={`/university/challenges/${c.id}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-fade-in-up block rounded-2xl border border-ink-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
                >
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
            {uniSignals.filter((s) => s.status === "Pending Verification").slice(0, 5).map((s, i) => (
              <Link
                key={s.id}
                to={`/university/verification/${s.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-in-up flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
              >
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
