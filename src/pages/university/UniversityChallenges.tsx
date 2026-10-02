import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { DeadlinePill, DifficultyBars, PageHero, Pills, SearchInput, StageTrack } from "../../components/ui/ListKit"
import { daysUntil } from "../../lib/format"
import { assignmentFor, isRoutedTo, statusAtUniversity } from "../../lib/selectors"

type Tab = "incoming" | "assigned" | "all"

export default function UniversityChallenges() {
  const { university } = useDemoUser()
  const { challenges, projects, students, skillSignals, getOrg, isUniversityStudent, studentsOfUniversity } = useStore()
  const [tab, setTab] = useState<Tab>("incoming")
  const [query, setQuery] = useState("")
  if (!university) return null

  // Statuses are from this university's point of view: an open challenge another university
  // assigned is still incoming here until this university assigns it too.
  const relevant = challenges
    .filter((c) => isRoutedTo(c, university.id))
    .map((c) => ({ c, status: statusAtUniversity(c, university.id, projects, students), mine: assignmentFor(c, university.id) }))
    .sort((a, b) => new Date(a.c.deadline).getTime() - new Date(b.c.deadline).getTime())

  // Which of our students have already practised each skill — a quick read on fit.
  const roster = studentsOfUniversity(university.id)
  const practisedBy = new Map<string, Set<string>>()
  for (const s of skillSignals) {
    if (!isUniversityStudent(s.studentId, university.id)) continue
    if (!practisedBy.has(s.skill)) practisedBy.set(s.skill, new Set())
    practisedBy.get(s.skill)!.add(s.studentId)
  }
  const fitOf = (skills: string[]) => new Set(skills.flatMap((sk) => [...(practisedBy.get(sk) ?? [])])).size

  const incoming = relevant.filter((r) => !r.mine)
  const assigned = relevant.filter((r) => r.mine)
  const q = query.toLowerCase()
  const list = (tab === "incoming" ? incoming : tab === "assigned" ? assigned : relevant).filter(
    ({ c }) => !q || `${c.title} ${c.requiredSkills.join(" ")} ${getOrg(c.organizationId)?.name ?? ""}`.toLowerCase().includes(q),
  )
  const ourStudentsOn = (challengeId: string) => projects.filter((p) => p.challengeId === challengeId && isUniversityStudent(p.studentId, university.id))

  return (
    <div>
      <PageHero
        eyebrow="Challenges"
        title="Company challenges"
        subtitle="Every challenge here already passed WSL's automatic private-data screen. Pick the ones that fit and assign them to a program's students."
        stats={[
          { label: "waiting for you to assign", value: incoming.length, accent: incoming.length > 0 },
          { label: "assigned", value: assigned.length },
          { label: "open to every university", value: relevant.filter((r) => r.c.preferredUniversityId === null).length },
          { label: "students working", value: new Set(assigned.flatMap((r) => ourStudentsOn(r.c.id).map((p) => p.studentId))).size },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pills<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "incoming", label: "Incoming", count: incoming.length },
            { value: "assigned", label: "Assigned", count: assigned.length },
            { value: "all", label: "All", count: relevant.length },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search by title, skill or company…" />
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing here" description={tab === "incoming" ? "You've assigned everything that came in — nice." : "No challenges match this view right now."} />
      ) : (
        <div key={tab} className="grid gap-4 lg:grid-cols-2">
          {list.map(({ c, status, mine }, i) => {
            const org = getOrg(c.organizationId)
            const fit = fitOf(c.requiredSkills)
            const onIt = ourStudentsOn(c.id)
            const days = daysUntil(c.deadline)
            return (
              <Link
                key={c.id}
                to={`/university/challenges/${c.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 ${
                  !mine && days > 0 ? "border-teal-400/60 hover:border-teal-400" : "border-ink-200 hover:border-teal-400"
                }`}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-teal-500 to-teal-300 transition-transform duration-500 group-hover:scale-x-100" />

                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-night text-[11px] font-bold text-teal-300 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    {org?.logoInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.title}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {org?.name} · {c.industry}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.preferredUniversityId === null ? "bg-sky-100 text-sky-700" : "bg-teal-100 text-teal-700"
                    }`}
                  >
                    {c.preferredUniversityId === null ? "◎ Open to every university" : "➜ Sent to you directly"}
                  </span>
                  {c.requiredSkills.map((s) => {
                    const n = practisedBy.get(s)?.size ?? 0
                    return (
                      <span
                        key={s}
                        title={n ? `${n} of your students have practised this` : "None of your students have practised this yet"}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${n ? "bg-teal-100/60 text-teal-700" : "bg-ink-50 text-ink-500"}`}
                      >
                        {s}
                        {n > 0 && <span className="ml-1 text-[10px] font-bold opacity-70">·{n}</span>}
                      </span>
                    )
                  })}
                </div>

                <div className="mt-4 mb-4">
                  <StageTrack status={status} from={1} />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
                  <DifficultyBars level={c.difficulty} />
                  {mine ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-teal-600">
                      <span className="flex -space-x-1.5">
                        {onIt.slice(0, 3).map((p) => (
                          <span key={p.id} className="h-4 w-4 rounded-full border-2 border-surface bg-gradient-to-br from-teal-400 to-teal-600" />
                        ))}
                      </span>
                      {mine.program} · {onIt.length} working
                    </span>
                  ) : (
                    <span title="Your students who've already practised at least one required skill">
                      <span className="font-bold text-ink-800">{fit}</span> of {roster.length} students have practised these skills
                    </span>
                  )}
                  <span className="ml-auto">{status !== "Company Reviewed" && <DeadlinePill days={days} />}</span>
                </div>

                {!mine && days > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-100/60 px-3 py-2 text-xs font-semibold text-teal-700">
                    <span>Review the brief and assign it to a program</span>
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
