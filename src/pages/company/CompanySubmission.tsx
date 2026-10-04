import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { challengeFor, skillsForProject } from "../../lib/selectors"
import { formatDate } from "../../lib/format"
import { assessmentLabel, evidenceAnalysisLabel, evidenceStrengthFor } from "../../lib/aiNote"
import { EvidenceQuotes } from "../../components/ui/EvidenceQuotes"
import { CriteriaChecklist } from "../../components/ui/CriteriaChecklist"

const FEEDBACK_OPTIONS = [
  { key: "strongTechnicalExecution", label: "Strong technical execution" },
  { key: "relevantForInternship", label: "Relevant for internship consideration" },
  { key: "interestedInSpeaking", label: "Interested in speaking with this student" },
] as const

export default function CompanySubmission() {
  const { projectId } = useParams()
  const { company } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, submitCompanyFeedback, getStudent, getUniversity, getStaff } = useStore()
  // Companies only see submissions to their own challenges.
  const project = projects.find((p) => p.id === projectId && p.organizationId === company?.id)
  const signals = project ? skillsForProject(skillSignals, project.id) : []
  // Companies only see what a mentor verified; AI signals alone are never presented as skills.
  const verifiedSignals = signals.filter((s) => s.status === "Verified")
  const unverifiedCount = signals.length - verifiedSignals.length
  const [flags, setFlags] = useState<Record<(typeof FEEDBACK_OPTIONS)[number]["key"], boolean>>(() => ({
    strongTechnicalExecution: project?.companyFeedback?.strongTechnicalExecution ?? false,
    relevantForInternship: project?.companyFeedback?.relevantForInternship ?? false,
    interestedInSpeaking: project?.companyFeedback?.interestedInSpeaking ?? false,
  }))
  const [note, setNote] = useState(project?.companyFeedback?.note ?? "")
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
  const canReview = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"
  const alreadyReviewed = project.status === "Company Feedback Received"

  const submit = async () => {
    setSaving(true)
    await submitCompanyFeedback(project.id, { ...flags, note: note.trim() })
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

      {!canReview ? (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm text-ink-700">
          This evidence hasn't been confirmed by the university yet — it opens here once a mentor has verified it.
        </div>
      ) : (
      <div className="rounded-2xl border border-ink-200 bg-surface p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">University-Approved Evidence</h3>
        <div className="space-y-2">
          {projectEvidence.map((e) => (
            <div key={e.id} className="rounded-xl border border-ink-200 p-3">
              <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>{" "}
              <span className="text-sm font-medium text-ink-800">{e.title}</span>
              <p className="mt-1 text-xs text-ink-500">{e.description}</p>
              {e.link && <p className="mt-1 text-xs break-all text-teal-600">{e.link}</p>}
              {e.content && <pre className="mt-2 max-h-24 overflow-hidden rounded-lg whitespace-pre-wrap [overflow-wrap:anywhere] bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>}
              <p className="mt-1 text-[11px] text-ink-400">{evidenceAnalysisLabel(e)}</p>
            </div>
          ))}
          {projectEvidence.length === 0 && <p className="text-sm text-ink-400">No evidence submitted.</p>}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Verified Skills</h3>
        <div className="space-y-3">
          {verifiedSignals.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">
                  {s.skill}
                  <span className="ml-1.5 text-xs font-semibold text-verified-600">✓ University Verified</span>
                </span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">{assessmentLabel(s.suggestedLevel)}</span>
              </div>
              <p className="mt-2 text-xs font-medium text-ink-700">
                Evidence Strength: <span className="font-semibold">{evidenceStrengthFor(s.evidenceConfidence)}</span>
              </p>
              <div className="mt-1"><ConfidenceMeter value={s.evidenceConfidence} label="Evidence confidence" /></div>
              {s.criteria.length > 0 && (
                <div className="mt-3">
                  <CriteriaChecklist criteria={s.criteria} />
                </div>
              )}
              {s.aiQuotes.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Proof in the work</p>
                  <EvidenceQuotes quotes={s.aiQuotes} evidenceTitle={(id) => projectEvidence.find((e) => e.id === id)?.title} />
                </div>
              )}
              {s.verifiedBy && (
                <p className="mt-1.5 text-[11px] text-ink-400">
                  Verified by {getStaff(s.verifiedBy)?.name ?? "a university mentor"}
                  {s.verifiedAt ? ` · ${formatDate(s.verifiedAt)}` : ""}
                </p>
              )}
            </div>
          ))}
          {verifiedSignals.length === 0 && <p className="text-sm text-ink-400">No skills from this project have been verified yet.</p>}
          {unverifiedCount > 0 && (
            <p className="text-[11px] text-ink-400">
              {unverifiedCount} other skill signal{unverifiedCount === 1 ? " was" : "s were"} not verified by the university, so {unverifiedCount === 1 ? "it isn't" : "they aren't"} shown.
            </p>
          )}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">
          {alreadyReviewed ? "Your Feedback" : "Company Feedback"}
        </h3>
        <p className="mb-3 text-xs text-ink-500">
          Feedback is your own reaction to this evidence — it's separate from verification and can never change a skill's verified status.
        </p>
        <div className="space-y-2">
          {FEEDBACK_OPTIONS.map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={flags[opt.key]}
                onChange={(e) => setFlags((f) => ({ ...f, [opt.key]: e.target.checked }))}
                disabled={alreadyReviewed}
                className="h-4 w-4 accent-teal-500"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="company-feedback-note" className="mb-1 block text-xs font-medium text-ink-500">Feedback note (optional)</label>
          <textarea
            id="company-feedback-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={alreadyReviewed}
            placeholder="What stood out? What would you want to see more of?"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400 disabled:opacity-60"
          />
          {challenge && !alreadyReviewed && (
            <p className="mt-1 text-xs text-ink-400">Sent as {challenge.contactPerson}, {challenge.contactRole} — the contact on this challenge.</p>
          )}
        </div>

        {!alreadyReviewed && (
          <button onClick={submit} disabled={saving} className="mt-3 w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
            {saving ? "Saving…" : "Submit Feedback"}
          </button>
        )}

        {alreadyReviewed && project.companyFeedback && (
          <p className="mt-5 text-xs text-verified-600">
            ✓ You gave feedback on {formatDate(project.companyFeedback.submittedAt)}.
          </p>
        )}
      </div>
      )}

      {canReview && project.feedback.length > 0 && (
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
