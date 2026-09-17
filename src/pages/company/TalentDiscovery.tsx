import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillChip } from "../../components/ui/SkillChip"
import { EmptyState } from "../../components/ui/EmptyState"
import { students } from "../../data/seed"
import { getUniversity, verifiedSignals } from "../../lib/selectors"

export default function TalentDiscovery() {
  const { skillSignals, projects } = useStore()
  const [query, setQuery] = useState("")
  const [field, setField] = useState("All")
  const [uniFilter, setUniFilter] = useState("All")

  const fields = ["All", ...Array.from(new Set(students.map((s) => s.field)))]
  const unis = useMemo(() => {
    const map = new Map<string, string>()
    students.forEach((s) => {
      const u = getUniversity(s.universityId)
      if (u) map.set(u.id, u.name)
    })
    return [{ id: "All", name: "All" }, ...Array.from(map, ([id, name]) => ({ id, name }))]
  }, [])

  const queryTerms = query.toLowerCase().split(/[,+]/).map((t) => t.trim()).filter(Boolean)

  const results = students
    .map((s) => ({ student: s, verified: verifiedSignals(skillSignals, s.id) }))
    .filter(({ verified }) => verified.length > 0)
    .filter(({ student }) => field === "All" || student.field === field)
    .filter(({ student }) => uniFilter === "All" || student.universityId === uniFilter)
    .filter(({ verified }) => queryTerms.length === 0 || queryTerms.every((t) => verified.some((v) => v.skill.toLowerCase().includes(t))))

  return (
    <div>
      <PageHeader
        eyebrow="Talent Discovery"
        title="Find talent through demonstrated capability"
        subtitle="No opaque matching score — every result below is backed by verified skills and viewable evidence."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search verified skills, e.g. Python + Machine Learning"
          className="min-w-64 flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400"
        />
        <select value={field} onChange={(e) => setField(e.target.value)} className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400">
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={uniFilter} onChange={(e) => setUniFilter(e.target.value)} className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400">
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {results.length === 0 ? (
        <EmptyState title="No matches" description={'Try a broader search — for example just "Python".'} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map(({ student, verified }) => {
            const uni = getUniversity(student.universityId)
            const project = projects.find((p) => p.teamStudentIds.includes(student.id))
            return (
              <Link key={student.id} to={`/company/talent/${student.id}`} className="rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{student.initials}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{student.name}</p>
                    <p className="text-xs text-ink-400">{student.field} · {uni?.shortName}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {verified.map((v) => (
                    <SkillChip key={v.id} skill={v.skill} level={v.level} verified size="sm" />
                  ))}
                </div>
                {project && <p className="mt-3 text-xs text-ink-400">Project: {project.title}</p>}
                <p className="mt-3 text-sm font-medium text-teal-600">View Evidence →</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
