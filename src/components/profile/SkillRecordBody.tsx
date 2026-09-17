import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { SkillChip } from "../ui/SkillChip"
import { StatusBadge } from "../ui/StatusBadge"
import { challengeFor, getOrg, skillsForProject, studentProjects, verifiedSignals } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export function SkillRecordBody({
  studentId,
  projectHref,
}: {
  studentId: string
  projectHref: (projectId: string) => string
}) {
  const { projects, challenges, evidence, skillSignals } = useStore()
  const myVerified = verifiedSignals(skillSignals, studentId)
  const myProjects = studentProjects(projects, studentId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return (
    <div>
      <div>
        <h3 className="mb-3 font-semibold text-ink-900">Verified Skills</h3>
        {myVerified.length === 0 ? (
          <p className="text-sm text-ink-400">No verified skills yet — evidence is under mentor review.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myVerified.map((s) => (
              <SkillChip key={s.id} skill={s.skill} level={s.level} verified />
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
            const verified = signals.filter((s) => s.status === "Verified")
            const myEv = evidence.filter((e) => e.projectId === p.id && e.contributorId === studentId)
            const year = new Date(p.startedAt).getFullYear()
            return (
              <div key={p.id} className="relative">
                <span className="absolute top-1.5 -left-[29px] h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
                <div className="mb-1 text-xs font-semibold text-teal-600">{year}</div>
                <div className="rounded-2xl border border-ink-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link to={projectHref(p.id)} className="font-semibold text-ink-900 hover:text-teal-600">{p.title}</Link>
                      <p className="text-xs text-ink-400">{org?.name} · {challenge?.industry}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <p className="mt-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">Skills demonstrated</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {signals.length === 0 && <span className="text-xs text-ink-400">Analysis not yet run.</span>}
                    {signals.map((s) => (
                      <SkillChip key={s.id} skill={s.skill} level={s.level} verified={s.status === "Verified"} size="sm" />
                    ))}
                  </div>

                  <p className="mt-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">Evidence</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {myEv.length === 0 && <span className="text-xs text-ink-400">No evidence submitted yet.</span>}
                    {myEv.map((e) => (
                      <a key={e.id} href="#" onClick={(ev) => ev.preventDefault()} className="rounded-md border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600 hover:border-teal-400">
                        {e.type}: {e.title}
                      </a>
                    ))}
                  </div>

                  {verified.length > 0 ? (
                    <p className="mt-3 text-xs text-verified-600">✓ Verified by {verified[0].verifiedBy} on {formatDate(verified[0].verifiedAt)}</p>
                  ) : signals.length > 0 ? (
                    <p className="mt-3 text-xs text-amber-600">Awaiting university mentor verification.</p>
                  ) : null}
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
