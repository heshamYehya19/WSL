import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { SkillChip } from "../ui/SkillChip"
import { StatusBadge } from "../ui/StatusBadge"
import { bestRating, challengeFor, getOrg, skillsForProject, studentProjects, studentSignals } from "../../lib/selectors"

export function SkillRecordBody({
  studentId,
  projectHref,
}: {
  studentId: string
  projectHref: (projectId: string) => string
}) {
  const { projects, challenges, evidence, skillSignals } = useStore()
  const mySignals = studentSignals(skillSignals, studentId)
  const myProjects = studentProjects(projects, studentId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const topSkills = new Map<string, number>()
  mySignals.forEach((s) => {
    const r = bestRating(s)
    if ((topSkills.get(s.skill) ?? -1) < r) topSkills.set(s.skill, r)
  })

  return (
    <div>
      <div>
        <h3 className="mb-3 font-semibold text-ink-900">Skill Ratings</h3>
        {topSkills.size === 0 ? (
          <p className="text-sm text-ink-400">No rated skills yet — submit evidence on a project to get WSL's automatic rating.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(topSkills, ([skill, rating]) => (
              <SkillChip key={skill} skill={skill} rating={rating} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h3 className="mb-4 font-semibold text-ink-900">Project Timeline</h3>
        <div className="space-y-6 border-l-2 border-ink-100 pl-6">
          {myProjects.map((p) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const signals = skillsForProject(skillSignals, p.id).filter((s) => s.studentId === studentId)
            const myEv = evidence.filter((e) => e.projectId === p.id && e.studentId === studentId)
            const year = new Date(p.startedAt).getFullYear()
            return (
              <div key={p.id} className="relative">
                <span className="absolute top-1.5 -left-[29px] h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
                <div className="mb-1 text-xs font-semibold text-teal-600">{year}</div>
                <div className="rounded-2xl border border-ink-200 bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link to={projectHref(p.id)} className="font-semibold text-ink-900 hover:text-teal-600">{p.title}</Link>
                      <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <p className="mt-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">Skills rated</p>
                  <div className="mt-1.5 space-y-1.5">
                    {signals.length === 0 && <span className="text-xs text-ink-400">No evidence submitted yet.</span>}
                    {signals.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2">
                        <SkillChip skill={s.skill} rating={s.companyRating ?? s.aiRating} size="sm" />
                        {s.companyRating !== undefined && (
                          <span className="text-[11px] text-ink-400">AI {s.aiRating}% · Company {s.companyRating}%</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">Evidence</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {myEv.length === 0 && <span className="text-xs text-ink-400">No evidence submitted yet.</span>}
                    {myEv.map((e) => (
                      <span key={e.id} className="rounded-md border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600">
                        {e.type}: {e.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
          {myProjects.length === 0 && <p className="text-sm text-ink-400">No projects yet.</p>}
        </div>
      </div>
    </div>
  )
}
