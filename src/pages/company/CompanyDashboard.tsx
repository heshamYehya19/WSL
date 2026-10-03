import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { CountUp } from "../../hooks/useCountUp"
import { PIPELINE } from "../../lib/pipeline"
import { challengeUniversityIds } from "../../lib/selectors"
import { daysUntil, formatRelative } from "../../lib/format"
import type { ChallengeStatus } from "../../types"

// The company's own view of the shared pipeline: "Verified"/"Completed" are what's ready for them.
const STAGES = PIPELINE.map((s) => (s.status === "Verified" || s.status === "Completed" ? { ...s, short: "Ready for you" } : s))
const stageIndex = (s: ChallengeStatus) => STAGES.findIndex((x) => x.status === s)

// Only evidence a university has confirmed is visible to the company — same rule as Talent Discovery.
const CONFIRMED: ChallengeStatus[] = ["Verified", "Completed", "Company Feedback Received"]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

function Kpi({ label, value, suffix, icon, delay }: { label: string; value: number; suffix?: string; icon: ReactNode; delay: number }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group relative overflow-hidden rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5"
    >
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-teal-400/10 transition-transform duration-500 group-hover:scale-150" />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">{icon}</span>
      <div className="relative mt-3 text-3xl font-bold tracking-tight text-ink-950 tabular-nums">
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="relative text-sm text-ink-500">{label}</div>
    </div>
  )
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export default function CompanyDashboard() {
  const { company } = useDemoUser()
  const { challenges, projects, skillSignals, getUniversity, getStudent } = useStore()
  const [stage, setStage] = useState<ChallengeStatus | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  if (!company) return null

  const myChallenges = challenges.filter((c) => c.organizationId === company.id)
  const myProjects = projects.filter((p) => p.organizationId === company.id)
  const confirmedProjectIds = new Set(myProjects.filter((p) => CONFIRMED.includes(p.status)).map((p) => p.id))
  const visibleSignals = skillSignals.filter((s) => confirmedProjectIds.has(s.projectId))

  const awaiting = myProjects.filter((p) => p.status === "Verified" || p.status === "Completed")
  const studentsEngaged = new Set(myProjects.map((p) => p.studentId)).size
  const universitiesReached = new Set(myChallenges.flatMap((c) => c.assignments.map((a) => a.universityId))).size
  const avgDelivered = visibleSignals.length ? Math.round(visibleSignals.reduce((sum, s) => sum + s.evidenceConfidence, 0) / visibleSignals.length) : 0

  const stageCounts = STAGES.map((s) => myChallenges.filter((c) => c.status === s.status).length)
  const maxStage = Math.max(...stageCounts, 1)

  // Demand (how many of your challenges ask for it) vs. what students actually delivered on it.
  const demand = new Map<string, number>()
  for (const c of myChallenges) for (const skill of c.requiredSkills) demand.set(skill, (demand.get(skill) ?? 0) + 1)
  const skillRows = [...demand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([skill, count]) => {
      const sigs = visibleSignals.filter((s) => s.skill === skill)
      return { skill, count, delivered: sigs.length ? Math.round(sigs.reduce((sum, s) => sum + s.evidenceConfidence, 0) / sigs.length) : null }
    })
  const maxDemand = Math.max(...skillRows.map((r) => r.count), 1)

  // Top talent: students whose confirmed work on your challenges scored best.
  const byStudent = new Map<string, number[]>()
  for (const s of visibleSignals) byStudent.set(s.studentId, [...(byStudent.get(s.studentId) ?? []), s.evidenceConfidence])
  const topTalent = [...byStudent.entries()]
    .map(([id, ratings]) => ({ student: getStudent(id), avg: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length), skills: ratings.length }))
    .filter((t) => t.student)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4)

  const listed = (stage ? myChallenges.filter((c) => c.status === stage) : myChallenges).slice(0, 6)

  return (
    <div>
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-night shadow-xl shadow-ink-950/10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-ink-950 shadow-lg shadow-teal-500/30">
              {company.logoInitials}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-teal-300 uppercase">
                {greeting()} · {company.industry} · {company.city}
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{company.name}</h1>
              <p className="mt-1 text-sm text-white/70">
                {myChallenges.length} challenge{myChallenges.length === 1 ? "" : "s"} · {studentsEngaged} student{studentsEngaged === 1 ? "" : "s"} working on your problems
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            {awaiting.length > 0 ? (
              <Link
                to={`/company/submissions/${awaiting[0].id}`}
                className="group flex items-center gap-3 rounded-2xl border border-teal-400/40 bg-teal-500/10 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-500/15"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-400" />
                </span>
                <span className="text-sm text-white">
                  <span className="font-bold">{awaiting.length}</span> submission{awaiting.length === 1 ? "" : "s"} ready for your review
                </span>
                <span className="ml-auto text-teal-300 transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                <span className="text-teal-300">✓</span> You're all caught up
              </div>
            )}
            <Link
              to="/company/submit"
              className="rounded-full bg-teal-500 px-5 py-2.5 text-center text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
            >
              + Submit Challenge
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi delay={0} label="Challenges submitted" value={myChallenges.length} icon={icon("M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4")} />
        <Kpi delay={60} label="Students engaged" value={studentsEngaged} icon={icon("M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 7c0-1.7-1-3.1-2.5-3.7M17 6a3 3 0 0 1 0 5.6M5 19c0-1.7 1-3.1 2.5-3.7M7 6a3 3 0 0 0 0 5.6")} />
        <Kpi delay={120} label="Universities reached" value={universitiesReached} icon={icon("M2 9.5 12 5l10 4.5-10 4.5-10-4.5ZM6 11.6v4.2c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9v-4.2")} />
        <Kpi delay={180} label="Avg. evidence confidence" value={avgDelivered} suffix="%" icon={icon("M4 19V9M10 19V5M16 19v-7M22 19v-3")} />
      </div>

      {/* PIPELINE */}
      <div className="mt-8 rounded-2xl border border-ink-200 bg-surface p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold text-ink-900">Challenge Journey</h2>
            <p className="text-xs text-ink-400">Where every challenge sits right now — tap a stage to filter the list below.</p>
          </div>
          {stage && (
            <button onClick={() => setStage(null)} className="text-xs font-semibold text-teal-600 hover:underline">
              Clear filter ×
            </button>
          )}
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute top-6 right-[7%] left-[7%] hidden h-0.5 lg:block">
            <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 1">
              <line x1="0" y1="0.5" x2="100" y2="0.5" className="flow-line stroke-teal-400" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="relative grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {STAGES.map((s, i) => {
              const count = stageCounts[i]
              const active = stage === s.status
              const urgent = (s.status === "Verified" || s.status === "Completed") && count > 0
              return (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => setStage(active ? null : s.status)}
                  aria-pressed={active}
                  title={s.status}
                  className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-ink-50"
                >
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-base font-bold tabular-nums transition-all duration-300 group-hover:scale-110 ${
                      active
                        ? "scale-110 border-teal-500 bg-teal-500 text-ink-950 shadow-lg shadow-teal-500/30"
                        : count > 0
                          ? "border-teal-400 bg-surface text-ink-950"
                          : "border-ink-200 bg-surface text-ink-300"
                    }`}
                  >
                    {urgent && !active && <span className="absolute inset-0 animate-ping rounded-full border-2 border-teal-400 opacity-50 motion-reduce:animate-none" />}
                    {count}
                  </span>
                  <span className={`text-xs font-semibold ${active ? "text-teal-600" : "text-ink-600"}`}>{s.short}</span>
                  <span className="h-1 w-10 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className="block h-full rounded-full bg-teal-400 transition-[width] duration-700 ease-out"
                      style={{ width: mounted ? `${(count / maxStage) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* CHALLENGE LIST */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">{stage ? `${stage}` : "Recent Challenges"}</h2>
            <Link to="/company/challenges" className="text-sm font-medium text-teal-600 hover:underline">View all →</Link>
          </div>
          <div key={stage ?? "all"} className="space-y-3">
            {listed.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-8 text-center text-sm text-ink-400">
                {myChallenges.length === 0 ? "No challenges yet — submit your first one to get started." : "No challenges at this stage."}
              </p>
            )}
            {listed.map((c, i) => {
              const uniNames = challengeUniversityIds(c).map((u) => getUniversity(u)?.shortName).join(", ")
              const studentCount = myProjects.filter((p) => p.challengeId === c.id).length
              const idx = stageIndex(c.status)
              const days = daysUntil(c.deadline)
              return (
                <Link
                  key={c.id}
                  to={`/company/challenges/${c.id}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-in-up group block rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.title}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {uniNames || "Open to any university"} · {studentCount} student{studentCount === 1 ? "" : "s"} · updated{" "}
                        {formatRelative(c.history[c.history.length - 1].at)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex flex-1 gap-1" aria-label={`Stage ${idx + 1} of ${STAGES.length}`}>
                      {STAGES.map((s, si) => (
                        <span
                          key={s.status}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${si <= idx ? "bg-teal-500" : "bg-ink-100"}`}
                        />
                      ))}
                    </div>
                    {c.status !== "Company Feedback Received" && c.status !== "Draft" && (
                      <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${days < 0 ? "text-danger-600" : days <= 14 ? "text-amber-600" : "text-ink-400"}`}>
                        {days < 0 ? `${-days}d overdue` : `${days}d left`}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* TOP TALENT */}
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold text-ink-900">Top Talent From Your Challenges</h2>
            </div>
            {topTalent.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">Students appear here once a university confirms their work to you.</p>
            ) : (
              <ul className="space-y-2">
                {topTalent.map(({ student, avg, skills }, i) => (
                  <li key={student!.id}>
                    <Link
                      to={`/company/talent/${student!.id}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className="animate-fade-in-up group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink-50"
                    >
                      <span className="w-4 text-center text-xs font-bold text-ink-300">{i + 1}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-ink-950 transition-transform duration-200 group-hover:scale-110">
                        {student!.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{student!.name}</span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {getUniversity(student!.universityId)?.shortName} · {skills} skill signal{skills === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="text-lg font-bold text-teal-600 tabular-nums">{avg}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/company/talent" className="mt-3 block text-center text-xs font-semibold text-teal-600 hover:underline">
              Explore all talent →
            </Link>
          </div>

          {/* DEMAND VS DELIVERED */}
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h2 className="font-semibold text-ink-900">Skills: Asked vs. Delivered</h2>
            <div className="mt-1 mb-4 flex gap-4 text-[11px] text-ink-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-300" /> How often you ask</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-500" /> Avg. score delivered</span>
            </div>
            {skillRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">No challenges submitted yet.</p>
            ) : (
              <div className="space-y-3.5">
                {skillRows.map((r, i) => (
                  <div key={r.skill} className="group">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-800">{r.skill}</span>
                      <span className="text-xs text-ink-400 tabular-nums">
                        ×{r.count}
                        {r.delivered !== null && <span className="ml-2 font-bold text-teal-600">{r.delivered}</span>}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-ink-300 transition-[width] duration-700 ease-out"
                          style={{ width: mounted ? `${(r.count / maxDemand) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }}
                        />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                        {r.delivered !== null ? (
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-[width] duration-700 ease-out"
                            style={{ width: mounted ? `${r.delivered}%` : "0%", transitionDelay: `${i * 60 + 150}ms` }}
                          />
                        ) : (
                          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent_0_4px,var(--color-ink-200)_4px_8px)]" title="No confirmed work on this skill yet" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
