import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatTile } from "../../components/ui/Card"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { SkillChip } from "../../components/ui/SkillChip"
import { EmptyState } from "../../components/ui/EmptyState"
import { BarList } from "../../components/ui/BarList"
import { SkillLevels } from "../../components/ui/SkillLevels"
import { formatRelative } from "../../lib/format"
import { challengeFor, skillsForProject, studentProjects, studentSignals } from "../../lib/selectors"

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

export default function StudentDashboard() {
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, opportunities, getOrg, getProgram } = useStore()
  if (!student) return null

  const myProjects = studentProjects(projects, student.id)
  const mySignals = studentSignals(skillSignals, student.id)
  const myEvidence = evidence.filter((e) => e.studentId === student.id)
  const verifiedNames = new Set(mySignals.filter((s) => s.status === "Verified").map((s) => s.skill))
  const matchedOpportunities = opportunities.filter((o) => o.requiredSkills.some((s) => verifiedNames.has(s)))
  const avgConfidence = mySignals.length ? Math.round(mySignals.reduce((sum, s) => sum + s.evidenceConfidence, 0) / mySignals.length) : 0
  const verifiedCount = mySignals.filter((s) => s.status === "Verified").length

  const latestSignals = [...mySignals].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()).slice(0, 5)

  const topSkillsBySkill = new Map<string, (typeof mySignals)[number]>()
  for (const s of mySignals) {
    const existing = topSkillsBySkill.get(s.skill)
    if (!existing || s.evidenceConfidence > existing.evidenceConfidence) topSkillsBySkill.set(s.skill, s)
  }
  const skillRatingItems = Array.from(topSkillsBySkill.values())
    .sort((a, b) => b.evidenceConfidence - a.evidenceConfidence)
    .slice(0, 7)
    .map((s) => ({
      key: s.id,
      label: s.skill,
      value: s.evidenceConfidence,
      displayValue: `${s.evidenceConfidence}%`,
      meta:
        s.status === "Verified" ? (
          <span className="rounded-full bg-verified-100 px-1.5 py-0.5 text-[10px] font-semibold text-verified-600">University Verified</span>
        ) : undefined,
    }))

  const skillLevelItems = Array.from(topSkillsBySkill.values()).map((s) => ({ key: s.id, skill: s.skill, rating: s.evidenceConfidence, suggestedLevel: s.suggestedLevel }))

  const currentProject = myProjects.find((p) => p.status === "In Progress")

  const activity = [
    ...myProjects.map((p) => ({ at: p.startedAt, text: `Started project "${p.title}"` })),
    ...mySignals.map((s) => ({ at: s.analyzedAt, text: `WSL found an evidence signal for your "${s.skill}" work: ${s.evidenceConfidence}% confidence` })),
    ...mySignals.filter((s) => s.status === "Verified" && s.verifiedAt).map((s) => ({ at: s.verifiedAt!, text: `Your "${s.skill}" skill signal was verified` })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)

  return (
    <div>
      {/* HERO */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-night shadow-xl shadow-ink-950/10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-ink-950 shadow-lg shadow-teal-500/30">
              {student.initials}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-teal-300 uppercase">
                {getProgram(student.programId)?.name ?? student.field} · {student.year}
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {greeting()}, {student.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-white/70">Your living record of demonstrated capability.</p>
            </div>
          </div>
          {currentProject ? (
            <Link
              to={`/student/projects/${currentProject.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-teal-400/40 bg-teal-500/10 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-500/15 lg:max-w-sm"
            >
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold tracking-wide text-teal-300 uppercase">Continue where you left off</span>
                <span className="block truncate text-sm font-semibold text-white">{currentProject.title}</span>
              </span>
              <span className="ml-auto text-teal-300 transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          ) : (
            <Link
              to="/student/challenges"
              className="rounded-full bg-teal-500 px-5 py-2.5 text-center text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25"
            >
              Discover challenges →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active Projects" value={myProjects.filter((p) => p.status === "In Progress").length} />
        <StatTile label="Skill Signals" value={mySignals.length} />
        <StatTile label="Avg. Evidence Confidence" value={mySignals.length ? `${avgConfidence}%` : "—"} />
        <StatTile label="Verified Skills" value={verifiedCount} />
        <StatTile label="Evidence Submitted" value={myEvidence.length} />
        <StatTile label="Opportunities Matched" value={matchedOpportunities.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Skill Signals</h2>
          <BarList items={skillRatingItems} max={100} emptyMessage="No skill signals yet — submit evidence to start building your profile." />
        </div>
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-ink-900">Skill Levels</h2>
            <span className="text-xs text-ink-400">Tap a level to see its skills</span>
          </div>
          <SkillLevels items={skillLevelItems} emptyMessage="No skill signals yet — submit evidence to start building your profile." />
        </div>
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
              description="Browse challenges assigned by your university and start your first project."
              action={<Link to="/student/challenges" className="rounded-full bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Discover Challenges</Link>}
            />
          ) : (
            <div className="space-y-3">
              {myProjects.map((p, i) => {
                const org = getOrg(p.organizationId)
                const challenge = challengeFor(challenges, p)
                const projectSignals = skillsForProject(skillSignals, p.id)
                const myEv = evidence.filter((e) => e.projectId === p.id)
                return (
                  <Link
                    key={p.id}
                    to={`/student/projects/${p.id}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-fade-in-up block rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-ink-900">{p.title}</h3>
                        <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {projectSignals.map((s) => (
                        <SkillChip key={s.id} skill={s.skill} rating={s.evidenceConfidence} size="sm" />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-ink-400">{myEv.length} evidence item{myEv.length === 1 ? "" : "s"} submitted</p>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="mt-8 mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Latest AI Evidence Signals</h2>
          </div>
          {latestSignals.length === 0 ? (
            <EmptyState title="No AI evidence signals yet" description="Submit evidence on a project to get WSL's AI evidence analysis — it appears here right away." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {latestSignals.map((s) => (
                <div key={s.id} className="rounded-2xl border border-ink-200 bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                    <span className="text-sm font-bold text-teal-600">{s.evidenceConfidence}%</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">Analyzed {formatRelative(s.analyzedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-ink-900">Recent Activity</h2>
          <div className="rounded-2xl border border-ink-200 bg-surface p-4">
            {activity.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">No activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((a, i) => (
                  <li key={i} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-in-up relative pl-4 text-sm">
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
