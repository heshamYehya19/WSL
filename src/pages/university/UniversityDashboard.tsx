import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatTile } from "../../components/ui/Card"
import { BarList } from "../../components/ui/BarList"
import { Ring } from "../../components/ui/Ring"
import { daysUntil, formatRelative } from "../../lib/format"
import { assignmentFor, evidenceBy, isRoutedTo, signalsBy, statusAtUniversity, teamOf } from "../../lib/selectors"
import { PROOF_STATE_LABEL, skillProofState } from "../../lib/proof"
import type { SkillProofState } from "../../lib/proof"
import { NOT_ANALYZED_TYPES } from "../../lib/evidenceTypes"

function DaysPill({ iso }: { iso: string }) {
  const d = daysUntil(iso)
  const tone = d <= 7 ? "bg-danger-100 text-danger-600" : d <= 21 ? "bg-amber-100 text-amber-600" : "bg-ink-100 text-ink-500"
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>{d}d left</span>
}

export default function UniversityDashboard() {
  const { university } = useDemoUser()
  const { challenges, projects, students, evidence, skillSignals, getOrg, getStudent, isUniversityStudent, studentsOfUniversity } = useStore()
  if (!university) return null

  const roster = studentsOfUniversity(university.id)
  const uniChallenges = challenges.filter((c) => assignmentFor(c, university.id))
  const activeChallenges = uniChallenges.filter((c) =>
    ["University Assigned", "In Progress", "Evidence Under Review", "Skills Pending Verification"].includes(statusAtUniversity(c, university.id, projects, students)),
  )
  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  const uniEvidence = evidence.filter((e) => isUniversityStudent(e.studentId, university.id))
  const uniSignals = skillSignals.filter((s) => isUniversityStudent(s.studentId, university.id))
  const verifiedCount = uniSignals.filter((s) => s.status === "Verified").length
  const participating = new Set(uniProjects.flatMap((p) => teamOf(p).map((m) => m.studentId)).filter((id) => isUniversityStudent(id, university.id))).size

  // Operational review status — what needs a reviewer, what has been decided, and what the evidence doesn't show.
  const byState: Record<SkillProofState, number> = { pending: 0, "more-evidence": 0, insufficient: 0, acknowledged: 0, verified: 0, "not-verified": 0 }
  for (const s of uniSignals) byState[skillProofState(s)]++
  // Students with evidence analyzed whose skills no reviewer has looked at yet.
  let awaitingFirstReview = 0
  for (const p of uniProjects) {
    if (p.status !== "Evidence Under Review" && p.status !== "Skills Pending Verification") continue
    for (const m of teamOf(p).filter((t) => isUniversityStudent(t.studentId, university.id))) {
      const work = evidenceBy(evidence, p.id, m.studentId).filter((e) => !NOT_ANALYZED_TYPES.includes(e.type))
      const theirs = signalsBy(skillSignals, p.id, m.studentId)
      const touched = theirs.some((s) => s.status !== "Pending Verification")
      if (work.length > 0 && theirs.some((s) => skillProofState(s) === "pending") && !touched) awaitingFirstReview++
    }
  }

  // Waiting on this university: routed to it, not yet assigned by it, and still open.
  const needsReview = challenges.filter(
    (c) => isRoutedTo(c, university.id) && !assignmentFor(c, university.id) && daysUntil(c.deadline) > 0,
  )
  const projectsAwaitingConfirmation = uniProjects.filter((p) => p.status === "Evidence Under Review" || p.status === "Skills Pending Verification")
  const pending = needsReview.length + projectsAwaitingConfirmation.length

  const skillCounts = new Map<string, number>()
  for (const s of uniSignals) skillCounts.set(s.skill, (skillCounts.get(s.skill) ?? 0) + 1)
  const topSkillItems = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([skill, count]) => ({ key: skill, label: skill, value: count }))

  const cardLink =
    "animate-fade-in-up group flex items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5"

  return (
    <div>
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-night shadow-xl shadow-ink-950/10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 right-1/3 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-ink-950 shadow-lg shadow-teal-500/30">
              {university.shortName.slice(0, 4)}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-teal-300 uppercase">
                {university.faculty} · {university.city}
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{university.name}</h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {university.programs.map((p) => (
                  <span key={p.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70">
                    {p.name.replace("B.Sc. ", "")}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 lg:min-w-64">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white/55 uppercase">
              {pending > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
              )}
              Waiting on you
            </div>
            {pending === 0 ? (
              <p className="mt-1 text-sm text-white/70"><span className="text-teal-300">✓</span> All caught up</p>
            ) : (
              <div className="mt-2 space-y-1.5 text-sm">
                <Link to="/university/challenges" className="flex items-center justify-between gap-4 text-white transition-colors hover:text-teal-300">
                  <span>Challenges to assign</span>
                  <span className="font-bold tabular-nums">{needsReview.length}</span>
                </Link>
                <Link to="/university/submissions" className="flex items-center justify-between gap-4 text-white transition-colors hover:text-teal-300">
                  <span>Submissions to confirm</span>
                  <span className="font-bold tabular-nums">{projectsAwaitingConfirmation.length}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active Challenges" value={activeChallenges.length} />
        <StatTile label="Student Projects" value={uniProjects.length} />
        <StatTile label="Evidence Submitted" value={uniEvidence.length} />
        <StatTile label="Skill Signals" value={uniSignals.length} hint={`${verifiedCount} verified`} />
        <StatTile label="Students Participating" value={participating} hint={`of ${roster.length} enrolled`} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-ink-900">Review status</h2>
          <Link to="/university/submissions" className="text-sm font-medium text-teal-600 hover:underline">Open the review queue →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Awaiting Evidence Review" value={awaitingFirstReview} hint="students nobody has reviewed yet" />
          <StatTile label="Pending Skill Verification" value={byState.pending} hint="skills with evidence to decide" />
          <StatTile label={PROOF_STATE_LABEL["more-evidence"]} value={byState["more-evidence"]} hint="waiting on the student" />
          <StatTile label={PROOF_STATE_LABEL.insufficient} value={byState.insufficient} hint={byState.acknowledged > 0 ? `to acknowledge · ${byState.acknowledged} reviewed` : "skills to acknowledge"} />
          <StatTile label="Verified Skills" value={byState.verified} hint={byState["not-verified"] > 0 ? `${byState["not-verified"]} not verified` : "by your university"} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-ink-200 bg-surface p-5 lg:col-span-2">
          <h2 className="font-semibold text-ink-900">At a Glance</h2>
          <p className="mb-5 text-xs text-ink-400">How far your students' work has travelled.</p>
          <div className="grid grid-cols-2 gap-4">
            <Ring value={participating} max={roster.length} label="Participation" sub={`${participating} of ${roster.length} students`} />
            <Ring
              value={verifiedCount}
              max={uniSignals.length}
              label="University verified"
              sub={`${verifiedCount} of ${uniSignals.length} signals`}
              strokeClassName="stroke-verified-500"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-surface p-5 lg:col-span-3">
          <h2 className="font-semibold text-ink-900">Emerging Skills</h2>
          <p className="mb-4 text-xs text-ink-400">Skills your students are proving most often.</p>
          <BarList items={topSkillItems} emptyMessage="No skill signals yet." />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              Challenges Awaiting Assignment
              {needsReview.length > 0 && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">{needsReview.length}</span>}
            </h2>
            <Link to="/university/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {needsReview.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">Nothing waiting on you right now.</p>
            )}
            {needsReview.map((c, i) => {
              const org = getOrg(c.organizationId)
              return (
                <Link key={c.id} to={`/university/challenges/${c.id}`} style={{ animationDelay: `${i * 60}ms` }} className={cardLink}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-xs font-bold text-teal-300 transition-transform duration-200 group-hover:scale-110">
                    {org?.logoInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.title}</p>
                    <p className="truncate text-xs text-ink-400">{org?.name} · {c.industry} · {c.difficulty}</p>
                  </div>
                  <DaysPill iso={c.deadline} />
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              Submissions Awaiting Confirmation
              {projectsAwaitingConfirmation.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-600">{projectsAwaitingConfirmation.length}</span>
              )}
            </h2>
            <Link to="/university/submissions" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {projectsAwaitingConfirmation.slice(0, 5).map((p, i) => {
              const student = getStudent(p.studentId)
              const done = p.tasks.filter((t) => t.done).length
              return (
                <Link key={p.id} to={`/university/projects/${p.id}`} style={{ animationDelay: `${i * 60}ms` }} className={cardLink}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-ink-950 transition-transform duration-200 group-hover:scale-110">
                    {student?.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{p.title}</p>
                    <p className="truncate text-xs text-ink-400">{student?.name} · started {formatRelative(p.startedAt)}</p>
                    {p.tasks.length > 0 && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(done / p.tasks.length) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-amber-600 transition-transform duration-200 group-hover:translate-x-0.5">Review →</span>
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
