import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { SkillChip } from "../ui/SkillChip"
import { StatusBadge } from "../ui/StatusBadge"
import { bestRating, challengeFor, skillsForProject, studentProjects, studentSignals } from "../../lib/selectors"

interface SkillSummary {
  skill: string
  rating: number
  verified: boolean
  projects: number
}

function tierOf(rating: number) {
  if (rating >= 80) return { label: "Strong", bar: "from-teal-500 to-teal-300", text: "text-teal-600" }
  if (rating >= 60) return { label: "Solid", bar: "from-teal-400 to-teal-300/70", text: "text-teal-500" }
  return { label: "Developing", bar: "from-amber-500 to-amber-400", text: "text-amber-500" }
}

function ShieldIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SkillCard({ s, index, mounted }: { s: SkillSummary; index: number; mounted: boolean }) {
  const tier = tierOf(s.rating)
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-fade-in-up group rounded-2xl border border-ink-200 bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">{s.skill}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
            <span className={`font-semibold ${tier.text}`}>{tier.label}</span>
            <span>·</span>
            <span>
              {s.projects} project{s.projects === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <span className="text-xl font-bold text-ink-950 tabular-nums">{s.rating}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tier.bar} transition-[width] duration-700 ease-out`}
          style={{ width: mounted ? `${s.rating}%` : "0%", transitionDelay: `${index * 40}ms` }}
        />
      </div>
      {s.verified && (
        <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-verified-100 px-2 py-0.5 text-[10px] font-semibold text-verified-600">
          <ShieldIcon className="h-3 w-3" />
          Company verified
        </div>
      )}
    </div>
  )
}

export function SkillRecordBody({
  studentId,
  projectHref,
}: {
  studentId: string
  projectHref: (projectId: string) => string
}) {
  const { projects, challenges, evidence, skillSignals, getOrg } = useStore()
  const [filter, setFilter] = useState<"all" | "verified">("all")
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const mySignals = studentSignals(skillSignals, studentId)
  const myProjects = studentProjects(projects, studentId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const bySkill = new Map<string, SkillSummary>()
  for (const s of mySignals) {
    const cur = bySkill.get(s.skill) ?? { skill: s.skill, rating: 0, verified: false, projects: 0 }
    cur.rating = Math.max(cur.rating, bestRating(s))
    cur.verified ||= s.companyRating !== undefined
    cur.projects += 1
    bySkill.set(s.skill, cur)
  }
  const allSkills = [...bySkill.values()].sort((a, b) => b.rating - a.rating)
  const shownSkills = filter === "verified" ? allSkills.filter((s) => s.verified) : allSkills
  const verifiedCount = allSkills.filter((s) => s.verified).length

  return (
    <div>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">Skill Ratings</h3>
          {allSkills.length > 0 && (
            <div className="inline-flex rounded-full border border-ink-200 bg-surface p-1 text-xs font-semibold">
              {(
                [
                  ["all", `All · ${allSkills.length}`],
                  ["verified", `Company verified · ${verifiedCount}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`rounded-full px-3 py-1 transition-all duration-200 ${filter === key ? "bg-night text-white shadow" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {allSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">
            No rated skills yet — submit evidence on a project to get WSL's automatic rating.
          </p>
        ) : shownSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">
            No company-verified skills yet — they appear once a company rates a confirmed project.
          </p>
        ) : (
          <div key={filter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownSkills.map((s, i) => (
              <SkillCard key={s.skill} s={s} index={i} mounted={mounted} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h3 className="mb-5 text-lg font-semibold text-ink-900">Project Timeline</h3>
        <div className="relative space-y-6 pl-8">
          <div className="absolute top-2 bottom-2 left-[9px] w-0.5 rounded-full bg-gradient-to-b from-teal-400 via-ink-200 to-transparent" />
          {myProjects.map((p, idx) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const signals = skillsForProject(skillSignals, p.id).filter((s) => s.studentId === studentId)
            const myEv = evidence.filter((e) => e.projectId === p.id && e.studentId === studentId)
            const started = new Date(p.startedAt)
            const live = p.status === "In Progress" || p.status === "Submissions Under Review"
            const done = p.tasks.filter((t) => t.done).length
            return (
              <div key={p.id} style={{ animationDelay: `${idx * 70}ms` }} className="animate-fade-in-up group relative">
                <span className="absolute top-5 -left-8 flex h-5 w-5 items-center justify-center">
                  {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/50 motion-reduce:animate-none" />}
                  <span
                    className={`relative h-3.5 w-3.5 rounded-full border-[3px] border-ink-50 transition-transform duration-200 group-hover:scale-125 ${
                      p.status === "Company Reviewed" ? "bg-verified-500" : "bg-teal-500"
                    }`}
                  />
                </span>

                <div className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 group-hover:border-teal-400/60 group-hover:shadow-lg group-hover:shadow-teal-500/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-xs font-bold text-teal-300">
                        {org?.logoInitials ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <Link to={projectHref(p.id)} className="font-semibold text-ink-900 transition-colors hover:text-teal-600">
                          {p.title}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {org?.name} · {challenge?.industry} · {started.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  {p.tasks.length > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                          style={{ width: mounted ? `${(done / p.tasks.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-ink-400 tabular-nums">
                        {done}/{p.tasks.length} tasks
                      </span>
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Skills rated</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {signals.length === 0 && <span className="text-xs text-ink-400">Not rated yet.</span>}
                        {signals.map((s) => (
                          <span
                            key={s.id}
                            title={s.companyRating !== undefined ? `AI ${s.aiRating}% · Company ${s.companyRating}%` : `AI ${s.aiRating}%`}
                            className="inline-flex items-center gap-1"
                          >
                            <SkillChip skill={s.skill} rating={s.companyRating ?? s.aiRating} size="sm" />
                            {s.companyRating !== undefined && <ShieldIcon className="h-3.5 w-3.5 text-verified-600" />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Evidence</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {myEv.length === 0 && <span className="text-xs text-ink-400">No evidence submitted yet.</span>}
                        {myEv.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-600 transition-colors hover:border-teal-400"
                          >
                            <span className="font-semibold text-ink-800">{e.type}</span>
                            <span className="text-ink-300">·</span>
                            <span className="max-w-[12rem] truncate">{e.title}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {myProjects.length === 0 && <p className="text-sm text-ink-400">No projects yet.</p>}
        </div>
      </div>
    </div>
  )
}
