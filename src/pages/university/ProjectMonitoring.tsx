import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { SignalReviewCard } from "../../components/university/SignalReviewCard"
import { challengeFor, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"
import { evidenceAnalysisLabel } from "../../lib/aiNote"

export default function ProjectMonitoring() {
  const { id } = useParams()
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addFeedback, confirmToCompany, reviewSignal, getOrg, getStudent, getProgram, getStaff, isUniversityStudent } =
    useStore()
  const [note, setNote] = useState("")
  const [confirmNote, setConfirmNote] = useState("")
  const [saving, setSaving] = useState(false)

  // Universities only monitor their own students' projects.
  const project = projects.find((p) => p.id === id && university && isUniversityStudent(p.studentId, university.id))
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
  const program = student ? getProgram(student.programId) : undefined
  const mentor = program ? getStaff(program.coordinatorId) : undefined
  const projectEvidence = evidence.filter((e) => e.projectId === project.id)
  const projectSignals = skillsForProject(skillSignals, project.id)
  const allResolved = projectSignals.length > 0 && projectSignals.every((s) => s.status === "Verified" || s.status === "Rejected")
  const readyToConfirm = project.status === "Skills Pending Verification" || project.status === "Evidence Under Review"
  const alreadyConfirmed = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    if (await addFeedback(project.id, note.trim())) setNote("")
    setSaving(false)
  }

  const handleConfirm = async () => {
    setSaving(true)
    if (await confirmToCompany(project.id, confirmNote.trim())) setConfirmNote("")
    setSaving(false)
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

      <div className="mb-6">
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{student?.initials}</span>
            <div>
              <Link to={`/university/students/${project.studentId}`} className="text-sm font-semibold text-ink-900 hover:text-teal-600">{student?.name}</Link>
              <p className="text-xs text-ink-400">{program?.name ?? student?.field} · {student?.year} · No. {student?.studentNumber}</p>
            </div>
          </div>
          {project.members.length > 0 ? (
            <p className="mt-3 text-xs text-ink-400">
              Team project. {project.members.map((m) => `${getStudent(m.studentId)?.name ?? "Teammate"}: ${m.roleNote}`).join(" · ")}
              {mentor ? ` Program mentor: ${mentor.name}.` : ""}
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-400">Worked individually — not as part of a team.{mentor ? ` Program mentor: ${mentor.name}.` : ""}</p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 font-semibold text-ink-900">Skill Signals</h3>
        <p className="mb-3 text-xs text-ink-500">
          Evidence confidence indicates how strongly submitted work supports a skill signal — it does not represent proficiency. Review each one
          individually: verify it, ask for more evidence, or reject it.
        </p>
        <div className="space-y-3">
          {projectSignals.map((s) => (
            <SignalReviewCard
              key={s.id}
              signal={s}
              evidence={projectEvidence}
              verifierName={s.verifiedBy ? getStaff(s.verifiedBy)?.name : undefined}
              onReview={(decision, options) => reviewSignal(project.id, s.id, decision, options)}
            />
          ))}
          {projectSignals.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">
              No skill signals yet — waiting on the student's evidence and AI evidence analysis.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div>
            <h3 className="mb-3 font-semibold text-ink-900">All Evidence</h3>
            <div className="space-y-2">
              {projectEvidence.map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                  <p className="text-xs text-ink-500">{e.description}</p>
                  {e.link && <p className="mt-1 text-[11px] break-all text-ink-400">{e.link}</p>}
                  {e.content && <pre className="mt-2 max-h-24 overflow-hidden rounded-lg whitespace-pre-wrap [overflow-wrap:anywhere] bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>}
                  <p className="mt-1.5 text-[11px] text-ink-400">{evidenceAnalysisLabel(e)}</p>
                </div>
              ))}
              {projectEvidence.length === 0 && <p className="text-sm text-ink-400">No evidence submitted yet.</p>}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Feedback</h3>
            <div className="space-y-2">
              {project.feedback.map((f) => (
                <div key={f.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                    <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-700">{f.note}</p>
                </div>
              ))}
            </div>
            <form onSubmit={submitFeedback} className="mt-3 flex gap-2">
              <label htmlFor="mentor-feedback" className="sr-only">Feedback note</label>
              <input
                id="mentor-feedback"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mentor ? `Leave feedback as ${mentor.name}...` : "Leave feedback for the student..."}
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
              />
              <button type="submit" disabled={saving || !note.trim()} className="rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40">Send</button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            {readyToConfirm && (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-50 p-5">
                <h3 className="mb-2 font-semibold text-ink-900">Confirm to Company</h3>
                <p className="mb-3 text-xs text-ink-600">
                  {allResolved
                    ? `Every required skill has a decision. Confirming approves this evidence for ${org?.name} to see — it does not change any verification.`
                    : "Every required skill needs a Verify or Reject decision above before you can confirm this evidence to the company."}
                </p>
                <label htmlFor="confirm-note" className="sr-only">Optional note</label>
                <input
                  id="confirm-note"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Optional note..."
                  disabled={!allResolved}
                  className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400 disabled:opacity-50"
                />
                <button
                  onClick={handleConfirm}
                  disabled={saving || !allResolved}
                  className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {saving ? "Confirming…" : "Confirm to Company"}
                </button>
                {mentor && <p className="mt-2 text-xs text-ink-500">Signed by {mentor.name}, {mentor.title}.</p>}
              </div>
            )}

            {alreadyConfirmed && (
              <div className="rounded-2xl border border-verified-500/30 bg-verified-100 p-5">
                <p className="text-sm font-semibold text-verified-600">✓ Confirmed to {org?.name}</p>
                <p className="mt-1 text-xs text-ink-600">
                  {project.status === "Company Feedback Received" ? "The company has since left feedback on this submission." : "Waiting on the company to review it."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
