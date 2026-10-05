import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { SkillChip } from "../../components/ui/SkillChip"
import { PageHero, Pills, StageTrack } from "../../components/ui/ListKit"
import { challengeFor, evidenceBy, isEvidenced, signalsBy, studentProjects } from "../../lib/selectors"
import { formatDate } from "../../lib/format"
import type { Project } from "../../types"

type Tab = "all" | "active" | "review" | "done"

const TAB_OF = (p: Project): Exclude<Tab, "all"> =>
  p.status === "Verified" || p.status === "Completed" || p.status === "Company Feedback Received"
    ? "done"
    : p.status === "In Progress"
      ? "active"
      : "review"

/** What the student should expect next at each stage. */
function nextStep(p: Project, evidenceCount: number) {
  const left = p.tasks.filter((t) => !t.done).length
  switch (p.status) {
    case "In Progress":
      if (left > 0) return { text: `${left} task${left === 1 ? "" : "s"} left — keep going`, tone: "teal" as const }
      return evidenceCount === 0
        ? { text: "All tasks done — submit your evidence", tone: "teal" as const }
        : { text: "Ready to run the evidence analysis", tone: "teal" as const }
    case "Evidence Under Review":
      return { text: "Your university is reviewing each skill", tone: "amber" as const }
    case "Skills Pending Verification":
      return { text: "Some skills are still awaiting university verification", tone: "amber" as const }
    case "Verified":
    case "Completed":
      return { text: "Verified by your university — waiting on the company's feedback", tone: "amber" as const }
    case "Company Feedback Received":
      return { text: "Complete — the company left feedback on your work", tone: "verified" as const }
    default:
      return { text: p.status, tone: "teal" as const }
  }
}

const TONE = {
  teal: "bg-teal-100/60 text-teal-700",
  amber: "bg-amber-100 text-amber-600",
  verified: "bg-verified-100 text-verified-600",
}

function TaskRing({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center" title={`${done} of ${total} tasks done`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-ink-100" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={pct === 1 ? "stroke-verified-500" : "stroke-teal-500"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="text-center leading-none">
        <span className="block text-xs font-bold text-ink-900 tabular-nums">
          {done}/{total}
        </span>
        <span className="block text-[8px] font-semibold tracking-wide text-ink-400 uppercase">tasks</span>
      </span>
    </span>
  )
}

export default function MyProjects() {
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, getOrg } = useStore()
  const [tab, setTab] = useState<Tab>("all")
  if (!student) return null

  // Projects you started and projects you're a teammate on.
  const myProjects = studentProjects(projects, student.id)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  const count = (t: Tab) => (t === "all" ? myProjects.length : myProjects.filter((p) => TAB_OF(p) === t).length)
  const shown = myProjects.filter((p) => tab === "all" || TAB_OF(p) === tab)

  const verifiedSkills = new Set(skillSignals.filter((s) => s.studentId === student.id && s.status === "Verified").map((s) => s.skill)).size

  return (
    <div>
      <PageHero
        eyebrow="My Projects"
        title="Your project workspaces"
        subtitle="Everything you've built through WSL, from kickoff to verified proof."
        action={
          <Link
            to="/student/challenges"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-200"
          >
            Find a new challenge →
          </Link>
        }
        stats={[
          { label: "in progress", value: count("active"), accent: count("active") > 0 },
          { label: "in review", value: count("review") },
          { label: "completed", value: count("done") },
          { label: "verified skills", value: verifiedSkills },
        ]}
      />

      {myProjects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Start a project from Challenge Discovery to begin building your evidence record."
          action={<Link to="/student/challenges" className="rounded-full bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Discover Challenges</Link>}
        />
      ) : (
        <>
          <div className="mb-5">
            <Pills<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: "All", count: count("all") },
                { value: "active", label: "In progress", count: count("active") },
                { value: "review", label: "In review", count: count("review") },
                { value: "done", label: "Completed", count: count("done") },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <EmptyState title="Nothing here yet" description="No projects at this stage." />
          ) : (
            <div key={tab} className="space-y-4">
              {shown.map((p, i) => {
                const org = getOrg(p.organizationId)
                const challenge = challengeFor(challenges, p)
                const myEv = evidenceBy(evidence, p.id, student.id)
                const signals = signalsBy(skillSignals, p.id, student.id).filter(isEvidenced)
                const ratedSkills = new Set(signals.map((s) => s.skill))
                const pending = (challenge?.requiredSkills ?? []).filter((s) => !ratedSkills.has(s))
                const step = nextStep(p, myEv.length)
                const done = p.tasks.filter((t) => t.done).length
                return (
                  <Link
                    key={p.id}
                    to={`/student/projects/${p.id}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-fade-in-up group block rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-night text-xs font-bold text-teal-300 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                        {org?.logoInitials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{p.title}</h3>
                            <p className="text-xs text-ink-400">
                              {org?.name} · Started {formatDate(p.startedAt)} · {myEv.length} of your evidence item{myEv.length === 1 ? "" : "s"}
                              {p.members.length > 0 ? ` · Team of ${p.members.length + 1}` : ""}
                            </p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="mt-3 max-w-md">
                          <StageTrack status={p.status} from={3} />
                        </div>
                      </div>
                      {p.tasks.length > 0 && <TaskRing done={done} total={p.tasks.length} />}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 sm:pl-16">
                      {signals.map((s) => (
                        <SkillChip key={s.id} skill={s.skill} state={s.status === "Verified" ? "verified" : "pending"} size="sm" />
                      ))}
                      {pending.map((s) => (
                        <span key={s} className="rounded-lg border border-dashed border-ink-200 px-2 py-1 text-xs text-ink-400" title="No evidence identified yet">
                          {s}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 sm:pl-16">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${TONE[step.tone]}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {step.text}
                      </span>
                      <span className="text-xs font-semibold text-teal-600 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                        Open workspace →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
