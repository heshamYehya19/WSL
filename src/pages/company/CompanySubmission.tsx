import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { challengeFor, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function CompanySubmission() {
  const { projectId } = useParams()
  const { company } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, submitCompanyReview, getStudent, getUniversity } = useStore()
  // Companies only see submissions to their own challenges.
  const project = projects.find((p) => p.id === projectId && p.organizationId === company?.id)
  const signals = project ? skillsForProject(skillSignals, project.id) : []
  const [ratings, setRatings] = useState<Record<string, number>>(() =>
    Object.fromEntries(signals.map((s) => [s.id, s.companyRating ?? s.aiRating])),
  )
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  if (!project) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Submission not found</h2>
        <Link to="/company/talent" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Talent Discovery</Link>
      </div>
    )
  }

  const student = getStudent(project.studentId)
  const uni = student ? getUniversity(student.universityId) : undefined
  const challenge = challengeFor(challenges, project)
  const projectEvidence = evidence.filter((e) => e.projectId === project.id)
  const canReview = project.status === "Confirmed to Company"
  const alreadyReviewed = project.status === "Company Reviewed"

  const submit = async () => {
    setSaving(true)
    if (await submitCompanyReview(project.id, ratings, note.trim())) setNote("")
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/company/talent" className="text-sm text-ink-400 hover:text-teal-600">← Back to Talent Discovery</Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-400">{student?.name} · {uni?.name}</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{challenge?.industry}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {!canReview && !alreadyReviewed ? (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm text-ink-700">
          This submission hasn't been confirmed by the university yet — its evidence opens here once it has.
        </div>
      ) : (
      <div className="rounded-2xl border border-ink-200 bg-surface p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Evidence</h3>
        <div className="space-y-2">
          {projectEvidence.map((e) => (
            <div key={e.id} className="rounded-xl border border-ink-200 p-3">
              <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>{" "}
              <span className="text-sm font-medium text-ink-800">{e.title}</span>
              <p className="mt-1 text-xs text-ink-500">{e.description}</p>
              <p className="mt-1 text-xs text-teal-600">{e.link}</p>
              {e.content && (
                <pre className="mt-2 max-h-24 overflow-hidden rounded-lg bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>
              )}
            </div>
          ))}
          {projectEvidence.length === 0 && <p className="text-sm text-ink-400">No evidence submitted.</p>}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">
          {alreadyReviewed ? "Ratings" : "Rate This Submission"}
        </h3>
        <div className="space-y-4">
          {signals.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                <span className="text-xs text-ink-400">WSL AI rating: {s.aiRating}%</span>
              </div>
              {s.aiNote && <p className="mt-1 text-[11px] text-ink-400">{s.aiNote}</p>}
              {canReview ? (
                <div className="mt-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={ratings[s.id]}
                    onChange={(e) => setRatings((r) => ({ ...r, [s.id]: Number(e.target.value) }))}
                    className="w-full accent-teal-500"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-400">Your rating</span>
                    <span className="font-semibold text-ink-800">{ratings[s.id]}%</span>
                  </div>
                </div>
              ) : alreadyReviewed && s.companyRating !== undefined ? (
                <div className="mt-2"><ConfidenceMeter value={s.companyRating} label="Company rating" /></div>
              ) : (
                <p className="mt-2 text-xs text-ink-400">Not yet rated.</p>
              )}
            </div>
          ))}
          {signals.length === 0 && <p className="text-sm text-ink-400">No skill signals yet.</p>}
        </div>

        {canReview && signals.length > 0 && (
          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-ink-500">Written feedback for the student (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What stood out? What would you want to see more of?"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
            />
            {challenge && (
              <p className="mt-1 text-xs text-ink-400">Sent as {challenge.contactPerson}, {challenge.contactRole} — the contact on this challenge.</p>
            )}
            <button onClick={submit} disabled={saving} className="mt-3 w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
              {saving ? "Saving…" : "Submit Feedback"}
            </button>
          </div>
        )}

        {alreadyReviewed && (
          <p className="mt-5 text-xs text-verified-600">
            ✓ You rated this submission
            {signals[0]?.companyRatedAt ? ` on ${formatDate(signals[0].companyRatedAt)}` : ""}.
          </p>
        )}
      </div>
      )}

      {(canReview || alreadyReviewed) && project.feedback.length > 0 && (
        <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Feedback Thread</h3>
          <div className="space-y-2">
            {project.feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                  <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                </div>
                <p className="mt-1.5 text-sm text-ink-700">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
