import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { getOrg, getStudent, isUniversityStudent, skillsForProject } from "../../lib/selectors"

export default function EvidenceReview() {
  const { university } = useDemoUser()
  const { projects, evidence, skillSignals } = useStore()
  if (!university) return null

  const uniProjects = projects.filter((p) => p.teamStudentIds.some((sid) => isUniversityStudent(sid, university.id)) && evidence.some((e) => e.projectId === p.id))

  return (
    <div>
      <PageHeader eyebrow="Evidence Review" title="Submitted evidence, by project" subtitle="Browse the artifacts behind every AI skill signal before it reaches verification." />

      {uniProjects.length === 0 ? (
        <EmptyState title="No evidence submitted yet" description="Evidence will appear here once students submit work on their projects." />
      ) : (
        <div className="space-y-8">
          {uniProjects.map((p) => {
            const org = getOrg(p.organizationId)
            const members = p.teamStudentIds.filter((sid) => isUniversityStudent(sid, university.id))
            return (
              <div key={p.id} className="rounded-2xl border border-ink-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
                  <div>
                    <Link to={`/university/projects/${p.id}`} className="font-semibold text-ink-900 hover:text-teal-600">{p.title}</Link>
                    <p className="text-xs text-ink-400">{org?.name}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="divide-y divide-ink-100">
                  {members.map((sid) => {
                    const student = getStudent(sid)
                    const studentEvidence = evidence.filter((e) => e.projectId === p.id && e.contributorId === sid)
                    const studentSignals = skillsForProject(skillSignals, p.id).filter((s) => s.studentId === sid)
                    if (studentEvidence.length === 0) return null
                    return (
                      <div key={sid} className="grid gap-4 px-5 py-4 md:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">{student?.name} — Evidence</p>
                          <ul className="space-y-1.5">
                            {studentEvidence.map((e) => (
                              <li key={e.id} className="text-sm">
                                <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>{" "}
                                <span className="text-ink-700">{e.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">AI Skill Signals</p>
                          {studentSignals.length === 0 ? (
                            <p className="text-sm text-ink-400">Not yet analyzed.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {studentSignals.map((s) => (
                                <li key={s.id}>
                                  <Link to={`/university/verification/${s.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
                                    <span className="flex items-center gap-2">
                                      <span className="font-medium text-ink-800">{s.skill}</span>
                                      <LevelBadge level={s.level} />
                                      <span className="text-xs text-ink-400">AI confidence: {s.confidence}%</span>
                                    </span>
                                    <StatusBadge status={s.status} />
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
