import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { challengeFor, getOrg, getStudent, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function ProjectMonitoring() {
  const { id } = useParams()
  const { university, session } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addFeedback, confirmToCompany, mentorFor } = useStore()
  const [note, setNote] = useState("")
  const [confirmNote, setConfirmNote] = useState("")

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
  const student = getStudent(project.studentId)
  const mentor = mentorFor(university.id)
  const projectSignals = skillsForProject(skillSignals, project.id)
  const readyToConfirm = project.status === "Submissions Under Review"
  const alreadyConfirmed = project.status === "Confirmed to Company" || project.status === "Company Reviewed"

  const submitFeedback = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim() || session.role !== "university") return
    addFeedback(project.id, mentor.name, mentor.role, note.trim())
    setNote("")
  }

  const handleConfirm = () => {
    addFeedback(project.id, mentor.name, mentor.role, confirmNote.trim() || "Reviewed and confirmed to the company.")
    confirmToCompany(project.id)
    setConfirmNote("")
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
            <h3 className="mb-3 font-semibold text-ink-900">Student</h3>
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{student?.initials}</span>
                <div>
                  <Link to={`/university/students/${project.studentId}`} className="text-sm font-semibold text-ink-900 hover:text-teal-600">{student?.name}</Link>
                  <p className="text-xs text-ink-400">{student?.field}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-400">Worked individually — not as part of a team.</p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Evidence</h3>
            <div className="space-y-2">
              {evidence.filter((e) => e.projectId === project.id).map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                  <p className="text-xs text-ink-500">{e.description}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{e.link}</p>
                  {e.content && (
                    <pre className="mt-2 max-h-24 overflow-hidden rounded-lg bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>
                  )}
                </div>
              ))}
              {evidence.filter((e) => e.projectId === project.id).length === 0 && (
                <p className="text-sm text-ink-400">No evidence submitted yet.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Feedback</h3>
            <div className="space-y-2">
              {project.feedback.map((f, i) => (
                <div key={i} className="rounded-xl border border-ink-200 bg-surface p-4">
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
                placeholder="Leave feedback for the student..."
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
              />
              <button type="submit" className="rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Send</button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">WSL AI Ratings</h3>
              <div className="space-y-3">
                {projectSignals.map((s) => (
                  <div key={s.id} className="rounded-xl border border-ink-100 p-3">
                    <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                    <div className="mt-1.5"><ConfidenceMeter value={s.aiRating} label="AI rating" /></div>
                    {s.aiNote && <p className="mt-1 text-[11px] text-ink-400">{s.aiNote}</p>}
                  </div>
                ))}
                {projectSignals.length === 0 && <p className="text-sm text-ink-400">No AI ratings yet — waiting on the student's evidence.</p>}
              </div>
              <p className="mt-3 text-xs text-ink-400">This rating is automatic and informational — it's just here to help you see the student's level.</p>
            </div>

            {readyToConfirm && (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-50 p-5">
                <h3 className="mb-2 font-semibold text-ink-900">Confirm to Company</h3>
                <p className="mb-3 text-xs text-ink-600">Once you've seen enough to judge this student's level, confirm the submission so {org?.name} can review it.</p>
                <input
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Optional note..."
                  className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                />
                <button onClick={handleConfirm} className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
                  Confirm to Company
                </button>
              </div>
            )}

            {alreadyConfirmed && (
              <div className="rounded-2xl border border-verified-500/30 bg-verified-100 p-5">
                <p className="text-sm font-semibold text-verified-600">✓ Confirmed to {org?.name}</p>
                <p className="mt-1 text-xs text-ink-600">
                  {project.status === "Company Reviewed" ? "The company has since reviewed and rated this submission." : "Waiting on the company to review it."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
