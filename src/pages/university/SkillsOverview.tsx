import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillChip } from "../../components/ui/SkillChip"
import { studentSignals, studentsOfUniversity } from "../../lib/selectors"

export default function SkillsOverview() {
  const { university } = useDemoUser()
  const { skillSignals, projects } = useStore()
  if (!university) return null

  const roster = studentsOfUniversity(university.id)

  return (
    <div>
      <PageHeader eyebrow="Students" title="Skills overview" subtitle="Every student at your university building an evidence-backed skill record through WSL." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s) => {
          const signals = studentSignals(skillSignals, s.id)
          const verified = signals.filter((sig) => sig.status === "Verified")
          const pending = signals.filter((sig) => sig.status === "Pending Verification")
          const projectCount = projects.filter((p) => p.teamStudentIds.includes(s.id)).length
          return (
            <Link key={s.id} to={`/university/students/${s.id}`} className="rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{s.initials}</span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-400">{s.field} · {s.year}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {verified.slice(0, 3).map((sig) => <SkillChip key={sig.id} skill={sig.skill} size="sm" verified />)}
                {verified.length === 0 && <span className="text-xs text-ink-400">No verified skills yet</span>}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-ink-400">
                <span>{projectCount} project{projectCount === 1 ? "" : "s"}</span>
                <span>{verified.length} verified</span>
                <span>{pending.length} pending</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
