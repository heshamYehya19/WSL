import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero, Pills } from "../../components/ui/ListKit"
import { challengeFor, evidenceBy, signalsBy, teamOf } from "../../lib/selectors"
import { proofCounts } from "../../lib/proof"
import { formatRelative } from "../../lib/format"
import type { ChallengeStatus } from "../../types"

type Tab = "awaiting" | "confirmed"
const STATUSES: Record<Tab, ChallengeStatus[]> = {
  awaiting: ["Evidence Under Review", "Skills Pending Verification"],
  confirmed: ["Verified", "Completed", "Company Feedback Received"],
}

export default function SubmissionsQueue() {
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, getOrg, getStudent, isUniversityStudent } = useStore()
  const [tab, setTab] = useState<Tab>("awaiting")
  if (!university) return null

  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))
  // "Submitted" = the team's most recent evidence; longest-waiting goes first.
  const submittedAt = (projectId: string) =>
    evidence.filter((e) => e.projectId === projectId).reduce<string | null>((latest, e) => (!latest || e.submittedAt > latest ? e.submittedAt : latest), null)
  const list = uniProjects
    .filter((p) => STATUSES[tab].includes(p.status))
    .sort((a, b) => (submittedAt(a.id) ?? "").localeCompare(submittedAt(b.id) ?? ""))
  const count = (t: Tab) => uniProjects.filter((p) => STATUSES[t].includes(p.status)).length

  const verifiedSignals = skillSignals.filter((s) => s.status === "Verified" && isUniversityStudent(s.studentId, university.id))

  return (
    <div>
      <PageHero
        eyebrow="Submissions"
        title="Review student submissions"
        subtitle="WSL organizes each student's evidence by skill. Your job is to verify each student's skills individually, then confirm the project to the company — oldest submissions first."
        stats={[
          { label: "awaiting your review", value: count("awaiting"), accent: count("awaiting") > 0 },
          { label: "confirmed to companies", value: count("confirmed") },
          { label: "skills verified", value: verifiedSignals.length },
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
            const required = challenge?.requiredSkills ?? []
            const team = teamOf(p)
            const evCount = evidence.filter((e) => e.projectId === p.id).length
            const sent = submittedAt(p.id)
            const oldest = tab === "awaiting" && i === 0 && list.length > 1
            return (
              <Link
                key={p.id}
                to={`/university/projects/${p.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`animate-fade-in-up group relative block overflow-hidden rounded-2xl border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ink-950/5 ${
                  tab === "awaiting" ? "border-amber-400/50 hover:border-amber-400" : "border-ink-200 hover:border-teal-400"
                }`}
              >
                {tab === "awaiting" && <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-500" />}

                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{p.title}</p>
                    <p className="truncate text-xs text-ink-400">
                      {org?.name} · {challenge?.industry} · {team.length > 1 ? `Team of ${team.length}` : "Individual"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {oldest && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">Longest waiting</span>}
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {team.map((m) => {
                    const person = getStudent(m.studentId)
                    const counts = proofCounts(required, signalsBy(skillSignals, p.id, m.studentId))
                    const n = evidenceBy(evidence, p.id, m.studentId).length
                    return (
                      <li key={m.studentId} className="min-w-0 rounded-xl border border-ink-100 p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night text-[10px] font-bold text-teal-300">{person?.initials}</span>
                          <p className="truncate text-sm font-semibold text-ink-900">{person?.name}</p>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-ink-500" title={m.roleNote}>
                          {m.roleNote || <span className="text-ink-400 italic">No contribution recorded</span>}
                        </p>
                        <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                          <span className="text-ink-400">{n} evidence</span>
                          {counts.pending > 0 && <span className="font-semibold text-amber-700">{counts.pending} to review</span>}
                          {counts["more-evidence"] > 0 && <span className="font-semibold text-amber-700">{counts["more-evidence"]} more evidence requested</span>}
                          {counts.verified > 0 && <span className="font-semibold text-verified-600">✓ {counts.verified} verified</span>}
                          {counts["not-verified"] > 0 && <span className="text-ink-500">{counts["not-verified"]} not verified</span>}
                          {counts.insufficient > 0 && <span className="text-ink-400">{counts.insufficient} insufficient evidence</span>}
                        </p>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-400">
                  <span>
                    {evCount} evidence item{evCount === 1 ? "" : "s"}
                    {sent && ` · latest ${formatRelative(sent)}`}
                  </span>
                  <span className={`text-xs font-semibold transition-transform duration-200 group-hover:translate-x-1 ${tab === "awaiting" ? "text-amber-600" : "text-teal-600"}`}>
                    {tab === "awaiting" ? "Review & confirm →" : "Open →"}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
