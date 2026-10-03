import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero, Pills, SearchInput } from "../../components/ui/ListKit"
import { challengeFor, skillsForProject } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"
import type { ChallengeStatus } from "../../types"

const COLUMNS: { statuses: ChallengeStatus[]; title: string; hint: string; dot: string; needsYou?: boolean }[] = [
  { statuses: ["In Progress"], title: "In progress", hint: "Students are working", dot: "bg-sky-700" },
  { statuses: ["Evidence Under Review", "Skills Pending Verification"], title: "Needs you", hint: "Verify each skill, then confirm to the company", dot: "bg-amber-500", needsYou: true },
  { statuses: ["Verified", "Completed"], title: "With the company", hint: "Waiting on their feedback", dot: "bg-teal-500" },
  { statuses: ["Company Feedback Received"], title: "Feedback received", hint: "Fully verified evidence", dot: "bg-verified-500" },
]

export default function StudentProjects() {
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, getOrg, getStudent, getProgram, isUniversityStudent } = useStore()
  const [program, setProgram] = useState("all")
  const [query, setQuery] = useState("")
  if (!university) return null

  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  const q = query.toLowerCase()
  const filtered = uniProjects
    .filter((p) => program === "all" || getStudent(p.studentId)?.programId === program)
    .filter((p) => !q || `${p.title} ${getStudent(p.studentId)?.name ?? ""} ${getOrg(p.organizationId)?.name ?? ""}`.toLowerCase().includes(q))

  const byStatus = (statuses: ChallengeStatus[]) => filtered.filter((p) => statuses.includes(p.status))
  const programsInUse = university.programs.filter((pr) => uniProjects.some((p) => getStudent(p.studentId)?.programId === pr.id))

  return (
    <div>
      <PageHero
        eyebrow="Student Projects"
        title="Every project, at a glance"
        subtitle="Each project is one student working solo. Follow them across the board — the amber column is where your confirmation is needed."
        stats={[
          { label: "projects", value: uniProjects.length },
          { label: "in progress", value: uniProjects.filter((p) => p.status === "In Progress").length },
          {
            label: "need your review",
            value: uniProjects.filter((p) => p.status === "Evidence Under Review" || p.status === "Skills Pending Verification").length,
            accent: uniProjects.some((p) => p.status === "Evidence Under Review" || p.status === "Skills Pending Verification"),
          },
          { label: "company feedback received", value: uniProjects.filter((p) => p.status === "Company Feedback Received").length },
        ]}
      />

      {uniProjects.length === 0 ? (
        <EmptyState title="No student projects yet" description="Once a student starts a project, it will appear here." />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {programsInUse.length > 1 && (
              <Pills
                value={program}
                onChange={setProgram}
                options={[{ value: "all", label: "All programs" }, ...programsInUse.map((p) => ({ value: p.id, label: p.name.replace("B.Sc. ", "") }))]}
              />
            )}
            <SearchInput value={query} onChange={setQuery} placeholder="Search by project, student or company…" />
          </div>

          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col, ci) => {
              const items = byStatus(col.statuses)
              const glow = col.needsYou && items.length > 0
              return (
                <section
                  key={col.title}
                  style={{ animationDelay: `${ci * 70}ms` }}
                  className={`animate-fade-in-up flex flex-col rounded-2xl border p-3 transition-colors ${
                    glow ? "border-amber-400/60 bg-amber-100/40" : "border-ink-200 bg-ink-100/40"
                  }`}
                >
                  <header className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                        <span className="relative flex h-2 w-2">
                          {glow && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${col.dot} opacity-60 motion-reduce:animate-none`} />}
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${col.dot}`} />
                        </span>
                        {col.title}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-ink-400">{col.hint}</p>
                    </div>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-ink-700 tabular-nums shadow-sm">{items.length}</span>
                  </header>

                  <div className="flex flex-col gap-2.5">
                    {items.length === 0 && (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-ink-200 px-3 py-8 text-center text-xs text-ink-400">
                        Nothing here
                      </div>
                    )}
                    {items.map((p, i) => {
                      const org = getOrg(p.organizationId)
                      const student = getStudent(p.studentId)
                      const challenge = challengeFor(challenges, p)
                      const evCount = evidence.filter((e) => e.projectId === p.id).length
                      const signals = skillsForProject(skillSignals, p.id)
                      const avg = signals.length ? Math.round(signals.reduce((sum, s) => sum + s.evidenceConfidence, 0) / signals.length) : null
                      const done = p.tasks.filter((t) => t.done).length
                      return (
                        <Link
                          key={p.id}
                          to={`/university/projects/${p.id}`}
                          style={{ animationDelay: `${ci * 70 + i * 50}ms` }}
                          className="animate-fade-in-up group block rounded-xl border border-ink-200 bg-surface p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:rotate-[0.4deg] hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/10"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[10px] font-bold text-ink-950">
                              {student?.initials}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-ink-900">{student?.name}</p>
                              <p className="truncate text-[10px] text-ink-400">{getProgram(student?.programId ?? "")?.name.replace("B.Sc. ", "")}</p>
                            </div>
                            {avg !== null && (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${avg >= 80 ? "bg-teal-600 text-white" : avg >= 60 ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-600"}`}
                                title="Average evidence confidence"
                              >
                                {avg}
                              </span>
                            )}
                          </div>
                          <p className="mt-2.5 text-sm leading-snug font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{p.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-ink-400">
                            {org?.name} · {challenge?.industry}
                          </p>
                          {p.tasks.length > 0 && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100">
                                <div className="h-full rounded-full bg-teal-500" style={{ width: `${(done / p.tasks.length) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-medium text-ink-400 tabular-nums">
                                {done}/{p.tasks.length}
                              </span>
                            </div>
                          )}
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-ink-400">
                            <span>
                              {evCount} evidence · {signals.length} signal{signals.length === 1 ? "" : "s"}
                            </span>
                            <span>{formatRelative(p.startedAt)}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
