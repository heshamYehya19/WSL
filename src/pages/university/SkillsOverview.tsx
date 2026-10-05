import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero, Pills, SearchInput } from "../../components/ui/ListKit"
import { isEvidenced, studentProjects, studentSignals } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

type View = "cards" | "heatmap"
type Sort = "score" | "projects" | "name"

export default function SkillsOverview() {
  const { university } = useDemoUser()
  const { skillSignals, projects, studentsOfUniversity, getProgram } = useStore()
  const navigate = useNavigate()
  const [view, setView] = useState<View>("cards")
  const [sort, setSort] = useState<Sort>("score")
  const [program, setProgram] = useState("all")
  const [query, setQuery] = useState("")
  if (!university) return null

  const roster = studentsOfUniversity(university.id).map((s) => {
    // A skill WSL found no evidence of is not something the student has practised.
    const signals = studentSignals(skillSignals, s.id).filter(isEvidenced)
    const best = new Map<string, number>()
    for (const sig of signals) best.set(sig.skill, Math.max(best.get(sig.skill) ?? 0, sig.evidenceConfidence ?? 0))
    const scores = [...best.values()]
    const lastActive = signals.reduce<string | null>((l, sig) => (!l || sig.analyzedAt > l ? sig.analyzedAt : l), null)
    return {
      s,
      best,
      avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      verified: new Set(signals.filter((sig) => sig.status === "Verified").map((sig) => sig.skill)).size,
      projectCount: studentProjects(projects, s.id).length,
      lastActive,
    }
  })

  const q = query.toLowerCase()
  const shown = roster
    .filter((r) => program === "all" || r.s.programId === program)
    .filter((r) => !q || `${r.s.name} ${[...r.best.keys()].join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === "name" ? a.s.name.localeCompare(b.s.name) : sort === "projects" ? b.projectCount - a.projectCount || b.avg - a.avg : b.avg - a.avg))

  // Heatmap columns: the skills most often practised across the shown cohort.
  const freq = new Map<string, number>()
  for (const r of shown) for (const k of r.best.keys()) freq.set(k, (freq.get(k) ?? 0) + 1)
  const columns = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)

  const active = roster.filter((r) => r.projectCount > 0)
  const cohortAvg = active.filter((r) => r.avg > 0).length ? Math.round(active.filter((r) => r.avg > 0).reduce((a, r) => a + r.avg, 0) / active.filter((r) => r.avg > 0).length) : 0

  return (
    <div>
      <PageHero
        eyebrow="Students"
        title="Your cohort's skill record"
        subtitle="Every student building an evidence-backed record through WSL. Switch to the heatmap to spot strengths and gaps across the cohort at a glance."
        stats={[
          { label: "enrolled", value: roster.length },
          { label: "active on WSL", value: active.length, accent: true },
          { label: "cohort avg. evidence strength", value: cohortAvg },
          { label: "university-verified skills", value: roster.reduce((a, r) => a + r.verified, 0) },
        ]}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search students or skills…" />
          <Pills<View>
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: "▦ Cards" },
              { value: "heatmap", label: "▤ Heatmap" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {university.programs.length > 1 ? (
            <Pills
              label="Program"
              value={program}
              onChange={setProgram}
              options={[{ value: "all", label: "All" }, ...university.programs.map((p) => ({ value: p.id, label: p.name.replace("B.Sc. ", "") }))]}
            />
          ) : (
            <span />
          )}
          <Pills<Sort>
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "score", label: "Strongest evidence" },
              { value: "projects", label: "Most projects" },
              { value: "name", label: "Name" },
            ]}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No students match" description="Try a different search or program." />
      ) : view === "heatmap" ? (
        <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-ink-200 bg-surface">
          {columns.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-400">No skill signals yet in this group.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 p-3 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface px-2 pb-2 text-left text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Student</th>
                    {columns.map((c) => (
                      <th key={c} className="min-w-20 px-1 pb-2 text-center align-bottom text-[10px] leading-tight font-semibold text-ink-600">
                        {c}
                      </th>
                    ))}
                    <th className="px-2 pb-2 text-center text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, ri) => (
                    <tr
                      key={r.s.id}
                      onClick={() => navigate(`/university/students/${r.s.id}`)}
                      style={{ animationDelay: `${ri * 40}ms` }}
                      className="animate-fade-in-up group cursor-pointer"
                    >
                      <td className="sticky left-0 z-10 bg-surface px-2 py-1">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[9px] font-bold text-ink-950">
                            {r.s.initials}
                          </span>
                          <span className="truncate font-medium whitespace-nowrap text-ink-800 transition-colors group-hover:text-teal-600">{r.s.name}</span>
                        </span>
                      </td>
                      {columns.map((c) => {
                        const v = r.best.get(c)
                        return (
                          <td key={c} className="p-0">
                            {v === undefined ? (
                              <span className="block h-9 rounded-lg border border-dashed border-ink-200" title={`${r.s.name} hasn't practised ${c} yet`} />
                            ) : (
                              <span
                                title={`${r.s.name} · ${c}: ${v}`}
                                className="flex h-9 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums transition-transform duration-150 hover:scale-110 hover:shadow-md"
                                style={{
                                  background: `color-mix(in srgb, var(--color-teal-500) ${Math.max(15, v)}%, transparent)`,
                                  color: v >= 60 ? "var(--color-night)" : "var(--color-ink-900)",
                                }}
                              >
                                {v}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2 text-center font-bold text-ink-900 tabular-nums">{r.avg || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-4 py-2.5 text-[11px] text-ink-400">
            <span>Evidence confidence</span>
            <span className="h-2.5 w-32 rounded-full" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--color-teal-500) 15%, transparent), var(--color-teal-500))" }} />
            <span>0 → 100</span>
            <span className="ml-3 inline-block h-3 w-5 rounded border border-dashed border-ink-300" /> not practised yet
          </div>
        </div>
      ) : (
        <div key={`${sort}-${program}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ s, best, avg, verified, projectCount, lastActive }, i) => {
            const top = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
            const open = s.availability !== "Not Available"
            return (
              <Link
                key={s.id}
                to={`/university/students/${s.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-in-up group flex flex-col rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10"
              >
                <div className="flex items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0" title={avg ? `Average evidence confidence ${avg}` : "No skill signals yet"}>
                    <span
                      className="absolute inset-0 rounded-full transition-transform duration-500 group-hover:rotate-90"
                      style={{ background: `conic-gradient(var(--color-teal-400) ${avg * 3.6}deg, var(--color-ink-100) 0deg)` }}
                    />
                    <span className="absolute inset-[3px] flex items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-ink-950">
                      {s.initials}
                    </span>
                    <span
                      title={s.availability}
                      className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface ${open ? "bg-verified-500" : "bg-ink-300"}`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{s.name}</p>
                    <p className="truncate text-xs text-ink-400">
                      {getProgram(s.programId)?.name.replace("B.Sc. ", "") ?? s.field} · {s.year}
                    </p>
                  </div>
                  <span className="text-right">
                    <span className="block text-xl font-bold text-ink-950 tabular-nums">{avg || "—"}</span>
                    <span className="block text-[9px] font-semibold tracking-wide text-ink-400 uppercase">avg</span>
                  </span>
                </div>

                <div className="mt-4 mb-4 space-y-2">
                  {top.map(([skill, v]) => (
                    <div key={skill}>
                      <div className="mb-0.5 flex justify-between text-[11px]">
                        <span className="font-medium text-ink-700">{skill}</span>
                        <span className="font-bold text-ink-900 tabular-nums">{v}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div className={`h-full rounded-full bg-gradient-to-r ${v >= 60 ? "from-teal-500 to-teal-300" : "from-amber-500 to-amber-400"}`} style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                  {top.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ink-200 py-4 text-center text-xs text-ink-400">No skill signals yet — nudge them toward a challenge</p>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                  {[
                    [projectCount, "projects"],
                    [best.size, "skills"],
                    [verified, "verified"],
                  ].map(([n, l]) => (
                    <span key={l}>
                      <span className="block text-sm font-bold text-ink-900 tabular-nums">{n}</span>
                      <span className="block text-[10px] text-ink-400">{l}</span>
                    </span>
                  ))}
                </div>
                {lastActive && <p className="mt-2 text-center text-[10px] text-ink-400">Last analyzed {formatRelative(lastActive)}</p>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
