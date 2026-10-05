import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { EmptyState } from "../../components/ui/EmptyState"
import { PageHero } from "../../components/ui/ListKit"
import { formatDate } from "../../lib/format"
import type { TalentCandidate, TalentProof, TalentSearchResult } from "../../types"

const selectClass =
  "rounded-2xl border border-ink-200 bg-surface px-4 py-2.5 text-sm shadow-sm outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-400/15"

/** A candidate's matched proof, one block per project: the project, the skills it proves, who verified, and their contribution. */
function groupByProject(matched: TalentProof[]) {
  const groups: { projectId: string; projectTitle: string; industry: string; verifyingUniversity: string; verifiedAt: string; contribution: string; skills: string[] }[] = []
  for (const m of matched) {
    const g = groups.find((x) => x.projectId === m.projectId)
    if (g) {
      g.skills.push(m.skill)
      if (m.verifiedAt > g.verifiedAt) g.verifiedAt = m.verifiedAt
    } else groups.push({ ...m, skills: [m.skill] })
  }
  return groups
}

/**
 * Verified Talent Discovery. The server decides who is eligible — every searched skill currently verified by a
 * university — and in what order; this page only says what was asked for and shows what came back.
 */
export default function TalentDiscovery() {
  const { companyActions, getStudent, searchTalent, toggleSavedStudent, toggleInterested } = useStore()
  const { company } = useDemoUser()
  const [skills, setSkills] = useState<string[]>([])
  const [university, setUniversity] = useState("")
  const [industry, setIndustry] = useState("")
  const [result, setResult] = useState<TalentSearchResult | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let current = true
    searchTalent({ skills, university, industry }).then(
      (r) => {
        if (!current) return
        setResult(r)
        setError("")
      },
      (e: Error) => {
        if (current) setError(e.message)
      },
    )
    return () => {
      current = false
    }
  }, [searchTalent, skills, university, industry])

  const toggleSkill = (skill: string) => setSkills((cur) => (cur.includes(skill) ? cur.filter((s) => s !== skill) : [...cur, skill]))
  const clearFilters = () => {
    setSkills([])
    setUniversity("")
    setIndustry("")
  }
  const filtered = skills.length > 0 || university !== "" || industry !== ""

  const facets = result?.facets
  // Every skill anyone has verified, plus any selected one, so a chip can always be switched off again.
  const skillOptions = [...new Set([...(facets?.skills.map((f) => f.skill) ?? []), ...skills])]
  const countOf = (skill: string) => facets?.skills.find((f) => f.skill === skill)?.count

  return (
    <div>
      <PageHero
        eyebrow="Talent Discovery"
        title="Find talent through verified proof"
        subtitle="Every skill shown was verified by a university from the student's own work. Select several skills and you only see students who have all of them verified — there is no score and no ranking by AI."
        stats={[
          { label: "matching candidates", value: result?.candidates.length ?? 0, accent: true },
          { label: "verified skills", value: facets?.skills.length ?? 0 },
          { label: "universities", value: facets?.universities.length ?? 0 },
        ]}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <select value={university} onChange={(e) => setUniversity(e.target.value)} className={selectClass} aria-label="University">
            <option value="">All universities</option>
            {facets?.universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.count})
              </option>
            ))}
          </select>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass} aria-label="Industry of the proof">
            <option value="">Any industry</option>
            {facets?.industries.map((f) => (
              <option key={f.industry} value={f.industry}>
                {f.industry} ({f.count})
              </option>
            ))}
          </select>
          {filtered && (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-teal-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
        {skillOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Verified skills">
            <span className="mr-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Verified skills</span>
            {skillOptions.map((s) => {
              const on = skills.includes(s)
              const count = countOf(s)
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
                  {count !== undefined && <span className="ml-1 font-normal opacity-70">{count}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error ? (
        <EmptyState title="Talent Discovery isn't available" description={error} />
      ) : !result ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading verified talent…</p>
      ) : result.candidates.length === 0 ? (
        filtered ? (
          <EmptyState
            title={skills.length > 1 ? "No student has all of those skills verified" : "No matching verified talent"}
            description={
              skills.length > 0
                ? `Talent Discovery only shows students with every selected skill currently verified${skills.length > 1 ? `: ${skills.join(" + ")}` : ""}. Remove a skill or a filter to see more.`
                : "No student matches these filters. Remove a filter to see more."
            }
            action={
              <button type="button" onClick={clearFilters} className="rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600">
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState title="No verified talent yet" description="Students appear here once a university has verified their skills and confirmed the project to companies." />
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-400">
            {result.candidates.length} candidate{result.candidates.length === 1 ? "" : "s"}
            {skills.length > 1 && " with every selected skill verified"} · Sorted by verified skills, then most recent verification.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {result.candidates.map((c: TalentCandidate, i) => {
              const profile = getStudent(c.studentId)
              const open = profile?.availability !== undefined && profile.availability !== "Not Available"
              const saved = company ? companyActions.some((a) => a.studentId === c.studentId && a.kind === "saved") : false
              const interested = company ? companyActions.some((a) => a.studentId === c.studentId && a.kind === "interested") : false
              const groups = groupByProject(c.matched)
              return (
                <Link
                  key={c.studentId}
                  to={`/company/talent/${c.studentId}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="animate-fade-in-up group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10"
                >
                  <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-teal-400/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="relative shrink-0">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-ink-950 shadow-md shadow-teal-500/20 transition-transform duration-300 group-hover:scale-110">
                          {c.initials}
                        </span>
                        {profile?.availability && (
                          <span
                            title={profile.availability}
                            className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${open ? "bg-verified-500" : "bg-ink-300"}`}
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900 transition-colors group-hover:text-teal-600">{c.name}</p>
                        <p className="truncate text-xs text-ink-400">{c.program}</p>
                        <p className="truncate text-xs text-ink-400">
                          {c.university} · {c.year}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        if (company) toggleSavedStudent(c.studentId)
                      }}
                      aria-pressed={saved}
                      aria-label={saved ? `Remove ${c.name} from saved` : `Save ${c.name}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${saved ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
                    >
                      {saved ? "✓ Saved" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        if (company) toggleInterested(c.studentId)
                      }}
                      aria-pressed={interested}
                      aria-label={interested ? `Remove interest in ${c.name}` : `Express interest in ${c.name}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${interested ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
                    >
                      {interested ? "✓ Interested" : "Interested"}
                    </button>
                  </div>

                  <div className="relative mt-4 space-y-3">
                    {groups.slice(0, 2).map((g) => (
                      <div key={g.projectId} className="rounded-xl border border-ink-100 p-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {g.skills.map((skill) => (
                            <span key={skill} className="inline-flex items-center gap-1 rounded-lg border border-teal-400 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                              {skill}
                              <span className="font-bold text-verified-600" title={`Verified by ${g.verifyingUniversity}`}>✓</span>
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 truncate text-[11px] font-medium text-ink-700" title={g.projectTitle}>{g.projectTitle}</p>
                        <p className="truncate text-[11px] text-ink-400">
                          {g.industry} · Verified by {g.verifyingUniversity} · {formatDate(g.verifiedAt)}
                        </p>
                        {g.contribution && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-500" title={g.contribution}>
                            <span className="font-semibold text-ink-600">Their contribution:</span> {g.contribution}
                          </p>
                        )}
                      </div>
                    ))}
                    {groups.length > 2 && <p className="text-[11px] text-ink-400">+{groups.length - 2} more project{groups.length - 2 === 1 ? "" : "s"} with verified proof</p>}
                    {c.otherVerifiedSkills.length > 0 && (
                      <p className="text-[11px] text-ink-400" title={c.otherVerifiedSkills.join(", ")}>
                        Also verified: {c.otherVerifiedSkills.slice(0, 4).join(", ")}
                        {c.otherVerifiedSkills.length > 4 && ` +${c.otherVerifiedSkills.length - 4} more`}
                      </p>
                    )}
                  </div>

                  <div className="relative mt-auto pt-4">
                    <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-verified-600">
                        ✓ {c.verifiedSkillCount} university-verified skill{c.verifiedSkillCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs font-semibold text-teal-600 transition-transform duration-200 group-hover:translate-x-1">View verified proof →</span>
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
