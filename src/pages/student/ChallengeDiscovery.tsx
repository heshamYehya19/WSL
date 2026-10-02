import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { EmptyState } from "../../components/ui/EmptyState"
import { DeadlinePill, DifficultyBars, PageHero, Pills, SearchInput } from "../../components/ui/ListKit"
import { assignmentFor, bestRating, canStudentSee, studentSignals } from "../../lib/selectors"
import { daysUntil } from "../../lib/format"

type Sort = "match" | "deadline"
type Level = "All" | "Foundational" | "Intermediate" | "Advanced"

export default function ChallengeDiscovery() {
  const { student } = useDemoUser()
  const { challenges, projects, skillSignals, getOrg } = useStore()
  const [query, setQuery] = useState("")
  const [industry, setIndustry] = useState("All")
  const [level, setLevel] = useState<Level>("All")
  const [sort, setSort] = useState<Sort>("match")

  const mine = useMemo(() => (student ? challenges.filter((c) => canStudentSee(c, student)) : []), [challenges, student])
  if (!student) return null

  // Skills this student has already proven anywhere, with their best score.
  const proven = new Map<string, number>()
  for (const s of studentSignals(skillSignals, student.id)) proven.set(s.skill, Math.max(proven.get(s.skill) ?? 0, bestRating(s)))
  const startedIds = new Set(projects.filter((p) => p.studentId === student.id).map((p) => p.challengeId))

  const matchOf = (skills: string[]) => (skills.length ? Math.round((skills.filter((s) => proven.has(s)).length / skills.length) * 100) : 0)

  const q = query.toLowerCase()
  const visible = mine
    .filter((c) => industry === "All" || c.industry === industry)
    .filter((c) => level === "All" || c.difficulty === level)
    .filter((c) => !q || `${c.title} ${c.requiredSkills.join(" ")} ${getOrg(c.organizationId)?.name ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "deadline"
        ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        : matchOf(b.requiredSkills) - matchOf(a.requiredSkills) || new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
    )

  const industries = Array.from(new Set(mine.map((c) => c.industry))).sort()
  const open = mine.filter((c) => daysUntil(c.deadline) > 0)
  const closingSoon = open.filter((c) => daysUntil(c.deadline) <= 14).length
  const topMatchId = sort === "match" && visible.length > 1 && matchOf(visible[0].requiredSkills) > 0 ? visible[0].id : null

  return (
    <div>
      <PageHero
        eyebrow="Challenge Discovery"
        title="Challenges assigned by your university"
        subtitle="Every challenge here passed WSL's automatic screening and was assigned by your university — pick one and work it on your own."
        stats={[
          { label: "open to you", value: open.length, accent: true },
          { label: "closing within 2 weeks", value: closingSoon },
          { label: "already started", value: startedIds.size },
        ]}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by title, skill or company…" />
          <Pills<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: "match", label: "Best match" },
              { value: "deadline", label: "Deadline" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Pills<Level>
            label="Level"
            value={level}
            onChange={setLevel}
            options={(["All", "Foundational", "Intermediate", "Advanced"] as const).map((l) => ({ value: l, label: l }))}
          />
          {industries.length > 1 && (
            <Pills
              label="Industry"
              value={industry}
              onChange={setIndustry}
              options={["All", ...industries].map((i) => ({ value: i, label: i }))}
            />
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No challenges match" description="Try a different search or clear a filter." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c, i) => {
            const org = getOrg(c.organizationId)
            const match = matchOf(c.requiredSkills)
            const started = startedIds.has(c.id)
            const program = assignmentFor(c, student.universityId)?.program
            return (
              <Link
                key={c.id}
                to={`/student/challenges/${c.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-teal-500 to-teal-300 transition-transform duration-500 group-hover:scale-x-100" />

                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-[11px] font-bold text-teal-300 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    {org?.logoInitials}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {topMatchId === c.id && (
                      <span className="rounded-full bg-gradient-to-r from-teal-500 to-teal-400 px-2 py-0.5 text-[10px] font-bold text-ink-950 shadow-sm">★ Best match</span>
                    )}
                    {started && <span className="rounded-full bg-verified-100 px-2 py-0.5 text-[10px] font-bold text-verified-600">✓ Started</span>}
                    <DeadlinePill days={daysUntil(c.deadline)} />
                  </div>
                </div>

                <h3 className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.title}</h3>
                <p className="mt-0.5 text-xs text-ink-400">
                  {org?.name} · {c.industry}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.requiredSkills.map((s) => {
                    const has = proven.has(s)
                    return (
                      <span
                        key={s}
                        title={has ? `You've practised this — best score ${proven.get(s)}%` : "New for you — this challenge could add it"}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                          has ? "bg-teal-100 text-teal-700 ring-1 ring-teal-400/40" : "bg-ink-50 text-ink-500"
                        }`}
                      >
                        {has && "✓ "}
                        {s}
                      </span>
                    )
                  })}
                </div>

                {c.learningOutcomes[0] && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-500">
                    <span className="font-semibold text-ink-700">You'll learn: </span>
                    {c.learningOutcomes[0]}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-ink-500">Skills you've practised</span>
                    <span className="font-bold text-teal-600 tabular-nums">{match}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-[width] duration-700" style={{ width: `${Math.max(match, 2)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                    <DifficultyBars level={c.difficulty} />
                    <span className="truncate pl-2 text-[11px] text-ink-400">{program}</span>
                    <span className="pl-2 text-xs font-semibold text-teal-600 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                      Open →
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
