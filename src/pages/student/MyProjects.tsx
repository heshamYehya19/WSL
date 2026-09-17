import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { SkillChip } from "../../components/ui/SkillChip"
import { challengeFor, contributorEvidence, getOrg, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function MyProjects() {
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals } = useStore()
  if (!student) return null

  const myProjects = projects.filter((p) => p.teamStudentIds.includes(student.id))

  return (
    <div>
      <PageHeader eyebrow="My Projects" title="Your project workspaces" subtitle="Everything you've built through WSL, from kickoff to verified skill." />

      {myProjects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Start a project from Challenge Discovery to begin building your evidence record."
          action={<Link to="/student/challenges" className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Discover Challenges</Link>}
        />
      ) : (
        <div className="space-y-4">
          {myProjects.map((p) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const myEv = contributorEvidence(evidence, p.id, student.id)
            const mySignals = skillsForProject(skillSignals, p.id).filter((s) => s.studentId === student.id)
            const verifiedCount = mySignals.filter((s) => s.status === "Verified").length
            return (
              <Link key={p.id} to={`/student/projects/${p.id}`} className="block rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink-900">{p.title}</h3>
                    <p className="text-xs text-ink-400">{org?.name} · Started {formatDate(p.startedAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(challenge?.requiredSkills ?? []).map((s) => (
                    <SkillChip key={s} skill={s} size="sm" />
                  ))}
                </div>
                <div className="mt-3 flex gap-5 text-xs text-ink-400">
                  <span>{p.teamStudentIds.length} teammate{p.teamStudentIds.length > 1 ? "s" : ""}</span>
                  <span>{myEv.length} evidence submitted</span>
                  <span>{mySignals.length} skill signals · {verifiedCount} verified</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
