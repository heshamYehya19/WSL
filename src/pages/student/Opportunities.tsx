import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { EmptyState } from "../../components/ui/EmptyState"
import { MatchRing, PageHero, Pills, SearchInput } from "../../components/ui/ListKit"
import { studentSignals } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function Opportunities() {
  const { student } = useDemoUser()
  const { skillSignals, opportunities, getOrg } = useStore()
  const [view, setView] = useState<"all" | "matched">("all")
  const [type, setType] = useState("All")
  const [query, setQuery] = useState("")
  if (!student) return null

  const verifiedNames = new Set(studentSignals(skillSignals, student.id).filter((s) => s.status === "Verified").map((s) => s.skill))

  const scored = opportunities
    .map((o) => {
      const matched = o.requiredSkills.filter((s) => verifiedNames.has(s))
      return { o, matched, pct: o.requiredSkills.length ? Math.round((matched.length / o.requiredSkills.length) * 100) : 0 }
    })
    .sort((a, b) => b.pct - a.pct || new Date(b.o.postedAt).getTime() - new Date(a.o.postedAt).getTime())

  const types = Array.from(new Set(opportunities.map((o) => o.type))).sort()
  const q = query.toLowerCase()
  const shown = scored
    .filter((x) => view === "all" || x.matched.length > 0)
    .filter((x) => type === "All" || x.o.type === type)
    .filter((x) => !q || `${x.o.title} ${x.o.requiredSkills.join(" ")} ${getOrg(x.o.organizationId)?.name ?? ""}`.toLowerCase().includes(q))
  const matchedCount = scored.filter((x) => x.matched.length > 0).length
  const topId = scored[0]?.pct > 0 ? scored[0].o.id : null

  return (
    <div>
      <PageHero
        eyebrow="Opportunities"
        title="Opportunities matched to your verified skills"
        subtitle="Matching uses skills a university mentor has verified — never a hidden compatibility score. Verify more skills, unlock more matches."
        stats={[
          { label: "matched to you", value: matchedCount, accent: matchedCount > 0 },
          { label: "open roles", value: opportunities.length },
          { label: "skills verified", value: verifiedNames.size },
        ]}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search roles, skills or companies…" />
          <Pills<"all" | "matched">
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All", count: opportunities.length },
              { value: "matched", label: "Matched to me", count: matchedCount },
            ]}
          />
        </div>
        {types.length > 1 && <Pills label="Type" value={type} onChange={setType} options={["All", ...types].map((t) => ({ value: t, label: t }))} />}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={view === "matched" ? "No matches yet" : "No opportunities match"}
          description={view === "matched" ? "Get a skill verified on a project and matching roles will appear here." : "Try a different search or filter."}
          action={
            view === "matched" ? (
              <Link to="/student/challenges" className="rounded-full bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Find a challenge</Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {shown.map(({ o, matched, pct }, i) => {
            const org = getOrg(o.organizationId)
            const missing = o.requiredSkills.filter((s) => !verifiedNames.has(s))
            return (
              <Link
                key={o.id}
                to={`/student/opportunities/${o.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 ${
                  topId === o.id ? "border-teal-400 ring-2 ring-teal-400/20" : "border-ink-200 hover:border-teal-400"
                }`}
              >
                {topId === o.id && (
                  <span className="absolute top-0 left-5 rounded-b-lg bg-gradient-to-r from-teal-500 to-teal-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">
                    ★ Top match
                  </span>
                )}
                <div className={`flex items-start gap-3 ${topId === o.id ? "mt-3" : ""}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-night text-[11px] font-bold text-teal-300 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    {org?.logoInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{o.title}</h3>
                    <p className="text-xs text-ink-400">{org?.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-600">{o.type}</span>
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-600">{o.location}</span>
                      <span className="px-1 py-0.5 text-ink-400">posted {formatRelative(o.postedAt)}</span>
                    </div>
                  </div>
                  <MatchRing pct={pct} label={`${matched.length} of ${o.requiredSkills.length} required skills proven`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {o.requiredSkills.map((s) => {
                    const has = verifiedNames.has(s)
                    return (
                      <span
                        key={s}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                          has ? "bg-teal-600 text-white shadow-sm group-hover:shadow-teal-500/30" : "border border-dashed border-ink-200 text-ink-400"
                        }`}
                      >
                        {has ? "✓ " : ""}
                        {s}
                      </span>
                    )
                  })}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
                  {missing.length === 0 ? (
                    <span className="font-semibold text-verified-600">You've proven every required skill</span>
                  ) : (
                    <span className="text-ink-500">
                      Prove <span className="font-semibold text-ink-800">{missing[0]}</span>
                      {missing.length > 1 && ` +${missing.length - 1} more`} to raise your match
                    </span>
                  )}
                  <span className="shrink-0 font-semibold text-teal-600 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                    View →
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
