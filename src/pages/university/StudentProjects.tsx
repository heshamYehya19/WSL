import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { challengeFor, getOrg, getStudent, isUniversityStudent, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function StudentProjects() {
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals } = useStore()
  if (!university) return null

  const uniProjects = projects.filter((p) => isUniversityStudent(p.studentId, university.id))

  return (
    <div>
      <PageHeader eyebrow="Student Projects" title="Individual submissions at your university" subtitle="Every project is one student working solo — monitor their evidence and WSL's automatic ratings." />

      {uniProjects.length === 0 ? (
        <EmptyState title="No student projects yet" description="Once a student starts a project, it will appear here." />
      ) : (
        <div className="space-y-3">
          {uniProjects.map((p) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const student = getStudent(p.studentId)
            const evCount = evidence.filter((e) => e.projectId === p.id).length
            const signals = skillsForProject(skillSignals, p.id)
            return (
              <Link key={p.id} to={`/university/projects/${p.id}`} className="block rounded-2xl border border-ink-200 bg-surface p-5 hover:border-teal-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-900">{p.title}</p>
                    <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry} · Started {formatDate(p.startedAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-night text-[9px] font-bold text-teal-300">{student?.initials}</span>
                  <span className="text-xs font-medium text-ink-700">{student?.name}</span>
                </div>
                <div className="mt-3 flex gap-5 text-xs text-ink-400">
                  <span>{evCount} evidence items</span>
                  <span>{signals.length} skills rated</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
