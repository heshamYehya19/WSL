import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { BarList } from "../../components/ui/BarList"
import { SegmentedBar } from "../../components/ui/SegmentedBar"
import { daysUntil, formatRelative } from "../../lib/format"
import { assignmentFor, isRoutedTo, statusAtUniversity } from "../../lib/selectors"

export default function UniversityDashboard() {
  const { university } = useDemoUser()
  const { challenges, projects, students, evidence, skillSignals, getOrg, getStudent, isUniversityStudent, studentsOfUniversity } = useStore()
  if (!university) return null

  const roster = studentsOfUniversity(university.id)
  const uniChallenges = challenges.filter((c) => assignmentFor(c, university.id))
  const activeChallenges = uniChallenges.filter((c) =>
    ["University Assigned", "In Progress", "Submissions Under Review"].includes(statusAtUniversity(c, university.id, projects, students)),
  )
  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  const uniEvidence = evidence.filter((e) => isUniversityStudent(e.studentId, university.id))
  const uniSignals = skillSignals.filter((s) => isUniversityStudent(s.studentId, university.id))
  const companyRatedCount = uniSignals.filter((s) => s.companyRating !== undefined).length

  // Waiting on this university: routed to it, not yet assigned by it, and still open.
  const needsReview = challenges.filter(
    (c) => isRoutedTo(c, university.id) && !assignmentFor(c, university.id) && daysUntil(c.deadline) > 0,
  )
  const projectsAwaitingConfirmation = uniProjects.filter((p) => p.status === "Submissions Under Review")

  const confirmationSegments = [
    { key: "ai-only", label: "AI Rated Only", value: uniSignals.length - companyRatedCount, colorClassName: "bg-teal-400" },
    { key: "company-rated", label: "Company Rated", value: companyRatedCount, colorClassName: "bg-verified-500" },
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
        subtitle={`${university.faculty} · ${university.city} · ${university.programs.map((p) => p.name.replace("B.Sc. ", "")).join(", ")}`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active Challenges" value={activeChallenges.length} />
        <StatTile label="Student Projects" value={uniProjects.length} />
        <StatTile label="Evidence Submitted" value={uniEvidence.length} />
        <StatTile label="Skills Rated" value={uniSignals.length} hint={`${companyRatedCount} company-rated`} />
        <StatTile label="Students Participating" value={new Set(uniProjects.map((p) => p.studentId)).size} hint={`of ${roster.length} enrolled`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Confirmation Progress</h2>
          <SegmentedBar segments={confirmationSegments} emptyMessage="No skill signals yet." />
        </div>
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Emerging Skills</h2>
          <BarList items={topSkillItems} emptyMessage="No skill signals yet." />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Challenges Awaiting Assignment</h2>
            <Link to="/university/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {needsReview.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">Nothing waiting on you right now.</p>
            )}
            {needsReview.map((c, i) => {
              const org = getOrg(c.organizationId)
              return (
                <Link
                  key={c.id}
                  to={`/university/challenges/${c.id}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-fade-in-up block rounded-2xl border border-ink-200 bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">{c.title}</p>
                      <p className="text-xs text-ink-400">{org?.name} · {c.industry}</p>
                    </div>
                    <StatusBadge status="Sent to University" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Submissions Awaiting Confirmation</h2>
            <Link to="/university/submissions" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {projectsAwaitingConfirmation.slice(0, 5).map((p, i) => {
              const student = getStudent(p.studentId)
              return (
                <Link
                  key={p.id}
                  to={`/university/projects/${p.id}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-fade-in-up flex items-center justify-between rounded-2xl border border-ink-200 bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{p.title}</p>
                    <p className="text-xs text-ink-400">{student?.name} · started {formatRelative(p.startedAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              )
            })}
            {projectsAwaitingConfirmation.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">No submissions waiting on you right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
