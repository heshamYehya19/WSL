import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { EmptyState } from "../../components/ui/EmptyState"
import { MatchRing, PageHero, Pills, SearchInput } from "../../components/ui/ListKit"
import type { SkillSignal } from "../../types"

const CONFIRMED_STATUSES = ["Verified", "Completed", "Company Feedback Received"]

type Sort = "score" | "skills" | "verified"

const selectClass =
  "rounded-2xl border border-ink-200 bg-surface px-4 py-2.5 text-sm shadow-sm outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-400/15"

export default function TalentDiscovery() {
  const { skillSignals, projects, students, universities, companyActions, getUniversity, toggleSavedStudent, toggleInterested } = useStore()
  const { company } = useDemoUser()
  const [query, setQuery] = useState("")
  const [field, setField] = useState("All")
  const [uniFilter, setUniFilter] = useState("All")
  const [sort, setSort] = useState<Sort>("score")

  const fields = ["All", ...Array.from(new Set(students.map((s) => s.field))).sort()]
  const unis = useMemo(() => [{ id: "All", name: "All universities" }, ...universities.map((u) => ({ id: u.id, name: u.name }))], [universities])

  const queryTerms = query.toLowerCase().split(/[,+]/).map((t) => t.trim()).filter(Boolean)

  // Discoverable = the university has confirmed at least one project of theirs to a company.
  const confirmedProjectIds = new Set(projects.filter((p) => CONFIRMED_STATUSES.includes(p.status)).map((p) => p.id))
  const discoverable = skillSignals.filter((s) => confirmedProjectIds.has(s.projectId))

  // Most-proven skills across the network, offered as one-click search suggestions.
  const skillFreq = new Map<string, number>()
  for (const s of discoverable) skillFreq.set(s.skill, (skillFreq.get(s.skill) ?? 0) + 1)
  const suggestions = [...skillFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s)
  const toggleSkill = (skill: string) => {
    const has = queryTerms.includes(skill.toLowerCase())
    const terms = has ? queryTerms.filter((t) => t !== skill.toLowerCase()) : [...queryTerms, skill.toLowerCase()]
    setQuery(terms.map((t) => suggestions.find((s) => s.toLowerCase() === t) ?? t).join(" + "))
  }

  const results = students
    .map((s) => {
      const signals = discoverable.filter((sig) => sig.studentId === s.id) as SkillSignal[]
      const best = new Map<string, SkillSignal>()
      for (const sig of signals) if (!best.has(sig.skill) || sig.evidenceConfidence > best.get(sig.skill)!.evidenceConfidence) best.set(sig.skill, sig)
      const top = [...best.values()].sort((a, b) => b.evidenceConfidence - a.evidenceConfidence)
      const avg = top.length ? Math.round(top.reduce((sum, v) => sum + v.evidenceConfidence, 0) / top.length) : 0
      const verified = top.filter((v) => v.status === "Verified").length
      return { student: s, top, avg, verified }
    })
    .filter(({ top }) => top.length > 0)
    .filter(({ student }) => field === "All" || student.field === field)
    .filter(({ student }) => uniFilter === "All" || student.universityId === uniFilter)
    .filter(({ top }) => queryTerms.length === 0 || queryTerms.every((t) => top.some((v) => v.skill.toLowerCase().includes(t))))
    .sort((a, b) => (sort === "skills" ? b.top.length - a.top.length : sort === "verified" ? b.verified - a.verified : 0) || b.avg - a.avg)

  const totalCandidates = new Set(discoverable.map((s) => s.studentId)).size

  return (
    <div>
      <PageHero
        eyebrow="Talent Discovery"
        title="Find talent through demonstrated capability"
        subtitle="No opaque matching score — every candidate is backed by evidence-based skill signals, verified by a university."
        stats={[
          { label: "discoverable candidates", value: totalCandidates, accent: true },
          { label: "skills signaled", value: skillFreq.size },
          { label: "universities", value: universities.length },
        ]}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search skill signals, e.g. Python + Machine Learning" />
          <select value={field} onChange={(e) => setField(e.target.value)} className={selectClass} aria-label="Major">
            {fields.map((f) => <option key={f} value={f}>{f === "All" ? "All majors" : f}</option>)}
          </select>
          <select value={uniFilter} onChange={(e) => setUniFilter(e.target.value)} className={selectClass} aria-label="University">
            {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Popular</span>
              {suggestions.map((s) => {
                const on = queryTerms.includes(s.toLowerCase())
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                      on ? "border-teal-500 bg-teal-500 text-ink-950" : "border-dashed border-ink-300 text-ink-500 hover:-translate-y-0.5 hover:border-teal-400 hover:text-teal-600"
                    }`}
                  >
                    {on ? "✓ " : "+ "}
                    {s}
                  </button>
                )
              })}
            </div>
          )}
          <Pills<Sort>
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "score", label: "Top score" },
              { value: "skills", label: "Most skills" },
              { value: "verified", label: "Verified" },
            ]}
          />
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState title="No matches" description={'Try a broader search — for example just "Python".'} />
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-400">
            {results.length} candidate{results.length === 1 ? "" : "s"}
            {queryTerms.length > 0 && " with every searched skill"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map(({ student, top, avg, verified }, i) => {
              const uni = getUniversity(student.universityId)
              const project = projects.find((p) => confirmedProjectIds.has(p.id) && p.studentId === student.id)
              const open = student.availability !== "Not Available"
              const saved = company ? companyActions.some((a) => a.studentId === student.id && a.kind === "saved") : false
              const interested = company ? companyActions.some((a) => a.studentId === student.id && a.kind === "interested") : false
              return (
                <Link
                  key={student.id}
                  to={`/company/talent/${student.id}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10"
                >
                  <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-teal-400/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="relative shrink-0">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-ink-950 shadow-md shadow-teal-500/20 transition-transform duration-300 group-hover:scale-110">
                          {student.initials}
                        </span>
                        <span
                          title={student.availability}
                          className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${open ? "bg-verified-500" : "bg-ink-300"}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{student.name}</p>
                        <p className="truncate text-xs text-ink-400">
                          {student.field} · {uni?.shortName} · {student.year}
                        </p>
                        {verified > 0 && <p className="mt-0.5 text-[11px] font-semibold text-verified-600">✓ {verified} university-verified skill{verified === 1 ? "" : "s"}</p>}
                      </div>
                    </div>
                    <MatchRing pct={avg} label={`Average evidence confidence: ${avg}`} />
                  </div>

                  <div className="relative mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        if (company) toggleSavedStudent(student.id)
                      }}
                      aria-pressed={saved}
                      aria-label={saved ? `Remove ${student.name} from saved` : `Save ${student.name}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${saved ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
                    >
                      {saved ? "✓ Saved" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        if (company) toggleInterested(student.id)
                      }}
                      aria-pressed={interested}
                      aria-label={interested ? `Remove interest in ${student.name}` : `Express interest in ${student.name}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${interested ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
                    >
                      {interested ? "✓ Interested" : "Interested"}
                    </button>
                  </div>

                  <div className="relative mt-4 space-y-2">
                    {top.slice(0, 3).map((v) => {
                      const hit = queryTerms.some((t) => v.skill.toLowerCase().includes(t))
                      return (
                        <div key={v.id}>
                          <div className="mb-0.5 flex items-center justify-between text-[11px]">
                            <span className={`font-medium ${hit ? "text-teal-600" : "text-ink-700"}`}>
                              {v.skill}
                              {v.status === "Verified" && <span className="ml-1 text-verified-600" title="University Verified">✓</span>}
                            </span>
                            <span className="font-bold text-ink-900 tabular-nums">{v.evidenceConfidence}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                            <div
                              className={`h-full rounded-full transition-[width] duration-700 ${hit ? "bg-teal-500" : "bg-gradient-to-r from-teal-500 to-teal-300"}`}
                              style={{ width: `${v.evidenceConfidence}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {top.length > 3 && <p className="text-[11px] text-ink-400">+{top.length - 3} more skill signal{top.length - 3 === 1 ? "" : "s"}</p>}
                  </div>

                  <div className="relative mt-auto pt-4">
                    {project && <p className="truncate text-[11px] text-ink-400">Latest: {project.title}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-verified-600">
                        {verified > 0 ? `✓ ${verified} university verified` : <span className="font-medium text-ink-400">AI evidence signal, university confirmed</span>}
                      </span>
                      <span className="text-xs font-semibold text-teal-600 transition-transform duration-200 group-hover:translate-x-1">View evidence →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
