import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { SkillChip } from "../../components/ui/SkillChip"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { challengeFor, contributorEvidence, getOrg, getStudent, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function ProjectMonitoring() {
  const { id } = useParams()
  const { university, session } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addFeedback, mentorFor } = useStore()
  const [note, setNote] = useState("")

  const project = projects.find((p) => p.id === id)
  if (!project || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Project not found</h2>
        <Link to="/university/projects" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Student Projects</Link>
      </div>
    )
  }

  const org = getOrg(project.organizationId)
  const challenge = challengeFor(challenges, project)
  const mentor = mentorFor(university.id)
  const projectSignals = skillsForProject(skillSignals, project.id)

  const submitFeedback = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim() || session.role !== "university") return
    addFeedback(project.id, mentor.name, mentor.role, note.trim())
    setNote("")
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/university/projects" className="text-sm text-ink-400 hover:text-teal-600">← Back to Student Projects</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{org?.name} · {challenge?.industry} · Started {formatDate(project.startedAt)}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Team &amp; Individual Contribution</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {project.teamStudentIds.map((sid) => {
                const s = getStudent(sid)
                const contribSkills = project.individualContributions[sid] ?? []
                const myEv = contributorEvidence(evidence, project.id, sid)
                return (
                  <div key={sid} className="rounded-2xl border border-ink-200 bg-white p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{s?.initials}</span>
                      <div>
                        <Link to={`/university/students/${sid}`} className="text-sm font-semibold text-ink-900 hover:text-teal-600">{s?.name}</Link>
                        <p className="text-xs text-ink-400">{s?.field}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {contribSkills.map((sk) => <SkillChip key={sk} skill={sk} size="sm" />)}
                    </div>
                    <p className="mt-3 text-xs text-ink-400">{myEv.length} evidence item{myEv.length === 1 ? "" : "s"}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Evidence</h3>
            <div className="space-y-2">
              {evidence.filter((e) => e.projectId === project.id).map((e) => {
                const c = getStudent(e.contributorId)
                return (
                  <div key={e.id} className="rounded-xl border border-ink-200 bg-white p-4">
                    <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                    <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                    <p className="text-xs text-ink-500">{e.description}</p>
                    <p className="mt-1 text-[11px] text-ink-400">Submitted by {c?.name} · {e.link}</p>
                  </div>
                )
              })}
              {evidence.filter((e) => e.projectId === project.id).length === 0 && (
                <p className="text-sm text-ink-400">No evidence submitted yet.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Feedback</h3>
            <div className="space-y-2">
              {project.feedback.map((f, i) => (
                <div key={i} className="rounded-xl border border-ink-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                    <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-700">{f.note}</p>
                </div>
              ))}
            </div>
            <form onSubmit={submitFeedback} className="mt-3 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Leave feedback for the team..."
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
              />
              <button type="submit" className="rounded-lg bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Send</button>
            </form>
          </div>
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Skill Signals</h3>
            <div className="space-y-3">
              {projectSignals.map((s) => {
                const student = getStudent(s.studentId)
                return (
                  <Link key={s.id} to={`/university/verification/${s.id}`} className="block rounded-xl border border-ink-100 p-3 hover:border-teal-400">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                      <LevelBadge level={s.level} />
                    </div>
                    <p className="text-xs text-ink-400">{student?.name}</p>
                    <div className="mt-1.5"><ConfidenceMeter value={s.confidence} /></div>
                    <StatusBadge status={s.status} className="mt-2" />
                  </Link>
                )
              })}
              {projectSignals.length === 0 && <p className="text-sm text-ink-400">No AI skill signals yet — waiting on student evidence and analysis.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
