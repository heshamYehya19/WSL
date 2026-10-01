import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillChip } from "../../components/ui/SkillChip"
import { bestRating, studentSignals, studentsOfUniversity } from "../../lib/selectors"

export default function SkillsOverview() {
  const { university } = useDemoUser()
  const { skillSignals, projects } = useStore()
  if (!university) return null

  const roster = studentsOfUniversity(university.id)

  return (
    <div>
      <PageHeader eyebrow="Students" title="Skills overview" subtitle="Every student at your university building an evidence-backed record through WSL." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s) => {
          const signals = studentSignals(skillSignals, s.id)
          const companyRated = signals.filter((sig) => sig.companyRating !== undefined)
          const projectCount = projects.filter((p) => p.studentId === s.id).length
          return (
            <Link key={s.id} to={`/university/students/${s.id}`} className="rounded-2xl border border-ink-200 bg-surface p-5 hover:border-teal-400">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{s.initials}</span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-400">{s.field} · {s.year}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {signals.slice(0, 3).map((sig) => <SkillChip key={sig.id} skill={sig.skill} rating={bestRating(sig)} size="sm" />)}
                {signals.length === 0 && <span className="text-xs text-ink-400">No rated skills yet</span>}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-ink-400">
                <span>{projectCount} project{projectCount === 1 ? "" : "s"}</span>
                <span>{signals.length} rated</span>
                <span>{companyRated.length} company-rated</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
