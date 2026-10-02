import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero, Pills } from "../../components/ui/ListKit"
import { Ring } from "../../components/ui/Ring"
import { challengeFor, skillsForProject } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"
import type { ChallengeStatus } from "../../types"

type Tab = "awaiting" | "confirmed"
const STATUSES: Record<Tab, ChallengeStatus[]> = {
  awaiting: ["Submissions Under Review"],
  confirmed: ["Confirmed to Company", "Company Reviewed"],
}

function scoreTone(n: number) {
  return n >= 80 ? "from-teal-500 to-teal-300" : n >= 60 ? "from-teal-400 to-teal-300/70" : "from-amber-500 to-amber-400"
}

export default function SubmissionsQueue() {
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, getOrg, getStudent, isUniversityStudent } = useStore()
  const [tab, setTab] = useState<Tab>("awaiting")
  if (!university) return null

  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  // "Submitted" = the student's most recent evidence; longest-waiting goes first.
  const submittedAt = (projectId: string) =>
    evidence.filter((e) => e.projectId === projectId).reduce<string | null>((latest, e) => (!latest || e.submittedAt > latest ? e.submittedAt : latest), null)
  const list = uniProjects
    .filter((p) => STATUSES[tab].includes(p.status))
    .sort((a, b) => (submittedAt(a.id) ?? "").localeCompare(submittedAt(b.id) ?? ""))
  const count = (t: Tab) => uniProjects.filter((p) => STATUSES[t].includes(p.status)).length

  const companyRated = skillSignals.filter((s) => s.companyRating !== undefined && isUniversityStudent(s.studentId, university.id))
  const agreement = companyRated.length
    ? Math.round(companyRated.reduce((sum, s) => sum + (100 - Math.abs(s.companyRating! - s.aiRating)), 0) / companyRated.length)
    : 0

  return (
    <div>
      <PageHero
        eyebrow="Submissions"
        title="Review student submissions"
        subtitle="WSL rates each submission automatically. Your job is to see your students' level and confirm it to the company — oldest submissions first."
        stats={[
          { label: "awaiting your confirmation", value: count("awaiting"), accent: count("awaiting") > 0 },
          { label: "confirmed to companies", value: count("confirmed") },
          ...(companyRated.length ? [{ label: "AI–company agreement", value: agreement, suffix: "%" }] : []),
        ]}
      />

      <div className="mb-6">
        <Pills<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "awaiting", label: "Awaiting confirmation", count: count("awaiting") },
            { value: "confirmed", label: "Confirmed", count: count("confirmed") },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "awaiting" ? "Inbox zero" : "Nothing confirmed yet"}
          description={tab === "awaiting" ? "No submissions are waiting on you right now." : "Submissions you confirm to a company will show up here."}
        />
      ) : (
        <div key={tab} className="space-y-4">
          {list.map((p, i) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const student = getStudent(p.studentId)
            const signals = skillsForProject(skillSignals, p.id)
            const avg = signals.length ? Math.round(signals.reduce((sum, s) => sum + s.aiRating, 0) / signals.length) : 0
            const evCount = evidence.filter((e) => e.projectId === p.id).length
            const sent = submittedAt(p.id)
            const oldest = tab === "awaiting" && i === 0 && list.length > 1
            return (
              <Link
                key={p.id}
                to={`/university/projects/${p.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`animate-fade-in-up group relative grid gap-5 overflow-hidden rounded-2xl border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-500/10 sm:grid-cols-[auto_1fr] ${
                  tab === "awaiting" ? "border-amber-400/50 hover:border-amber-400" : "border-ink-200 hover:border-teal-400"
                }`}
              >
                {tab === "awaiting" && <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-500" />}

                <div className="flex flex-col items-center justify-center sm:w-36 sm:border-r sm:border-ink-100 sm:pr-5">
                  <Ring value={avg} max={100} label="AI rating" sub={`${signals.length} skill${signals.length === 1 ? "" : "s"}`} size="h-24 w-24" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-ink-950 transition-transform duration-200 group-hover:scale-110">
                        {student?.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{p.title}</p>
                        <p className="truncate text-xs text-ink-400">
                          {student?.name} · {org?.name} · {challenge?.industry}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {oldest && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">Longest waiting</span>}
                      <StatusBadge status={p.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {signals.map((s, si) => (
                      <div key={s.id}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-ink-700">{s.skill}</span>
                          <span className="tabular-nums">
                            <span className="font-bold text-ink-900">{s.aiRating}</span>
                            {s.companyRating !== undefined && (
                              <span
                                className={`ml-1.5 font-bold ${s.companyRating > s.aiRating ? "text-verified-600" : s.companyRating < s.aiRating ? "text-amber-600" : "text-ink-500"}`}
                                title={`Company rated ${s.companyRating}`}
                              >
                                {s.companyRating > s.aiRating ? "▲" : s.companyRating < s.aiRating ? "▼" : "="} {s.companyRating}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="relative h-1.5 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${scoreTone(s.aiRating)} transition-[width] duration-700 ease-out`}
                            style={{ width: `${s.aiRating}%`, transitionDelay: `${si * 60}ms` }}
                          />
                          {s.companyRating !== undefined && (
                            <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-verified-600" style={{ left: `${s.companyRating}%` }} title="Company rating" />
                          )}
                        </div>
                      </div>
                    ))}
                    {signals.length === 0 && <p className="text-xs text-ink-400">Not rated yet.</p>}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-400">
                    <span>
                      {evCount} evidence item{evCount === 1 ? "" : "s"}
                      {sent && ` · submitted ${formatRelative(sent)}`}
                      {tab === "confirmed" && signals.some((s) => s.companyRating !== undefined) && (
                        <span className="ml-2 inline-flex items-center gap-1 text-verified-600">
                          <span className="inline-block h-2.5 w-0.5 rounded bg-verified-600" /> company rating
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-xs font-semibold transition-transform duration-200 group-hover:translate-x-1 ${tab === "awaiting" ? "text-amber-600" : "text-teal-600"}`}
                    >
                      {tab === "awaiting" ? "Review & confirm →" : "Open →"}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
