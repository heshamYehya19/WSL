import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { DeadlinePill, DifficultyBars, PageHero, Pills, SearchInput, StageTrack } from "../../components/ui/ListKit"
import { challengeUniversityIds } from "../../lib/selectors"
import { daysUntil, formatRelative } from "../../lib/format"
import type { Challenge } from "../../types"

type Group = "all" | "draft" | "moving" | "ready" | "reviewed"

const GROUP_OF: Record<Challenge["status"], Exclude<Group, "all">> = {
  Draft: "draft",
  "Sent to University": "moving",
  "University Assigned": "moving",
  "In Progress": "moving",
  "Evidence Under Review": "moving",
  "Skills Pending Verification": "moving",
  Verified: "ready",
  Completed: "ready",
  "Company Feedback Received": "reviewed",
}

export default function MyChallenges() {
  const { company } = useDemoUser()
  const { challenges, projects, getUniversity } = useStore()
  const [group, setGroup] = useState<Group>("all")
  const [query, setQuery] = useState("")
  if (!company) return null

  const mine = challenges.filter((c) => c.organizationId === company.id)
  const count = (g: Group) => (g === "all" ? mine.length : mine.filter((c) => GROUP_OF[c.status] === g).length)
  const q = query.toLowerCase()
  const shown = mine
    .filter((c) => group === "all" || GROUP_OF[c.status] === group)
    .filter((c) => !q || `${c.title} ${c.requiredSkills.join(" ")}`.toLowerCase().includes(q))
  const studentsOn = (id: string) => projects.filter((p) => p.challengeId === id)

  return (
    <div>
      <PageHero
        eyebrow="My Challenges"
        title="Challenges you've submitted"
        subtitle="Track each problem from draft to verified evidence. Anything marked “Ready for you” has university-confirmed work waiting on your review."
        action={
          <Link
            to="/company/submit"
            className="rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
          >
            + Submit Challenge
          </Link>
        }
        stats={[
          { label: "total", value: mine.length },
          { label: "in motion", value: count("moving") },
          { label: "ready for your review", value: count("ready"), accent: count("ready") > 0 },
          { label: "students engaged", value: new Set(projects.filter((p) => p.organizationId === company.id).map((p) => p.studentId)).size },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pills<Group>
          value={group}
          onChange={setGroup}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "draft", label: "Drafts", count: count("draft") },
            { value: "moving", label: "In motion", count: count("moving") },
            { value: "ready", label: "Ready for you", count: count("ready") },
            { value: "reviewed", label: "Reviewed", count: count("reviewed") },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search your challenges…" />
      </div>

      {mine.length === 0 ? (
        <EmptyState
          title="No challenges yet"
          description="Submit your first real-world challenge for WSL to screen and route to a university."
          action={<Link to="/company/submit" className="rounded-full bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Submit a challenge</Link>}
        />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing here" description="No challenges in this group match your search." />
      ) : (
        <div key={group} className="grid gap-4 lg:grid-cols-2">
          {shown.map((c, i) => {
            const uniNames = challengeUniversityIds(c).map((u) => getUniversity(u)?.shortName).join(", ")
            const onIt = studentsOn(c.id)
            const ready = c.status === "Verified" || c.status === "Completed"
            return (
              <Link
                key={c.id}
                to={`/company/challenges/${c.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 ${
                  ready ? "border-teal-400 ring-2 ring-teal-400/20" : "border-ink-200 hover:border-teal-400"
                }`}
              >
                {ready && <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-teal-400/15 blur-2xl" />}
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.title}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {c.industry} · updated {formatRelative(c.history[c.history.length - 1].at)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="relative mt-3 flex flex-wrap gap-1.5">
                  {c.requiredSkills.slice(0, 5).map((s) => (
                    <span key={s} className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-ink-600">{s}</span>
                  ))}
                  {c.requiredSkills.length > 5 && <span className="px-1 py-1 text-[11px] text-ink-400">+{c.requiredSkills.length - 5}</span>}
                </div>

                <div className="relative mt-4">
                  <StageTrack status={c.status} showLabel />
                </div>

                <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
                  <DifficultyBars level={c.difficulty} />
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5ZM6 11.6v4.2c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9v-4.2" />
                    </svg>
                    {uniNames || "Any university"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex -space-x-1.5">
                      {onIt.slice(0, 3).map((p) => (
                        <span key={p.id} className="h-4 w-4 rounded-full border-2 border-surface bg-gradient-to-br from-teal-400 to-teal-600" />
                      ))}
                    </span>
                    {onIt.length} student{onIt.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto">
                    {c.status === "Draft" || c.status === "Company Feedback Received" ? null : <DeadlinePill days={daysUntil(c.deadline)} />}
                  </span>
                </div>

                {ready && (
                  <div className="relative mt-3 flex items-center justify-between rounded-xl bg-teal-100/60 px-3 py-2 text-xs font-semibold text-teal-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                      </span>
                      Confirmed evidence is waiting for your review
                    </span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
