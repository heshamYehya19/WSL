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

  const uniProjects = projects.filter((p) => p.teamStudentIds.some((sid) => isUniversityStudent(sid, university.id)))

  return (
    <div>
      <PageHeader eyebrow="Student Projects" title="Projects in progress at your university" subtitle="Monitor team composition, evidence, and skill signals for every active challenge." />

      {uniProjects.length === 0 ? (
        <EmptyState title="No student projects yet" description="Once students start a project, it will appear here." />
      ) : (
        <div className="space-y-3">
          {uniProjects.map((p) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const evCount = evidence.filter((e) => e.projectId === p.id).length
            const signals = skillsForProject(skillSignals, p.id)
            const verifiedCount = signals.filter((s) => s.status === "Verified").length
            return (
              <Link key={p.id} to={`/university/projects/${p.id}`} className="block rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-900">{p.title}</p>
                    <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry} · Started {formatDate(p.startedAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.teamStudentIds.map((sid) => {
                    const s = getStudent(sid)
                    return (
                      <span key={sid} className="flex items-center gap-1.5 rounded-full bg-ink-50 py-1 pr-2.5 pl-1">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-950 text-[9px] font-bold text-teal-300">{s?.initials}</span>
                        <span className="text-xs font-medium text-ink-700">{s?.name}</span>
                      </span>
                    )
                  })}
                </div>
                <div className="mt-3 flex gap-5 text-xs text-ink-400">
                  <span>{evCount} evidence items</span>
                  <span>{signals.length} skill signals · {verifiedCount} verified</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
