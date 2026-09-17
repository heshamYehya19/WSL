import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { challengeFor, getOrg, getStudent } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function CompanyEvidenceView() {
  const { projectId, studentId } = useParams()
  const { projects, challenges, evidence, skillSignals } = useStore()

  const project = projects.find((p) => p.id === projectId)
  const student = studentId ? getStudent(studentId) : undefined

  if (!project || !student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Evidence not found</h2>
        <Link to="/company/talent" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Talent Discovery</Link>
      </div>
    )
  }

  const org = getOrg(project.organizationId)
  const challenge = challengeFor(challenges, project)
  const verified = skillSignals.filter((s) => s.projectId === project.id && s.studentId === student.id && s.status === "Verified")
  const evidenceIds = new Set(verified.flatMap((s) => s.evidenceIds))
  const items = evidence.filter((e) => evidenceIds.has(e.id))

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/company/talent/${student.id}`} className="text-sm text-ink-400 hover:text-teal-600">← Back to {student.name}</Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{org?.name} · {challenge?.industry} · evidence by {student.name}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Verified Skills from this Project</h3>
        <div className="space-y-3">
          {verified.map((s) => (
            <div key={s.id} className="rounded-xl border border-verified-500/30 bg-verified-100 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-ink-900">
                  <span className="text-verified-600">✓</span> {s.skill}
                </span>
                <LevelBadge level={s.level} />
              </div>
              <div className="mt-2 max-w-xs"><ConfidenceMeter value={s.confidence} /></div>
              <p className="mt-2 text-xs text-ink-600">Verified by {s.verifiedBy} on {formatDate(s.verifiedAt)}</p>
            </div>
          ))}
          {verified.length === 0 && <p className="text-sm text-ink-400">No verified skills from this project yet.</p>}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Supporting Evidence</h3>
        <div className="space-y-2">
          {items.map((e) => (
            <div key={e.id} className="rounded-xl border border-ink-200 p-4">
              <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
              <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
              <p className="mt-0.5 text-sm text-ink-500">{e.description}</p>
              <p className="mt-1 text-xs text-teal-600">{e.link}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-ink-400">No evidence available.</p>}
        </div>
      </div>
    </div>
  )
}
