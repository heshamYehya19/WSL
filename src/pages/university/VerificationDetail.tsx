import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { getStudent } from "../../lib/selectors"
import { confidenceDescription } from "../../lib/ai"
import { formatDate } from "../../lib/format"

export default function VerificationDetail() {
  const { signalId } = useParams()
  const navigate = useNavigate()
  const { university } = useDemoUser()
  const { skillSignals, evidence, projects, reviewSignal, mentorFor } = useStore()
  const [notes, setNotes] = useState("")

  const signal = skillSignals.find((s) => s.id === signalId)

  if (!signal || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Skill signal not found</h2>
        <Link to="/university/verification" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Verification</Link>
      </div>
    )
  }

  const student = getStudent(signal.studentId)
  const project = projects.find((p) => p.id === signal.projectId)
  const supportingEvidence = evidence.filter((e) => signal.evidenceIds.includes(e.id))
  const mentor = mentorFor(university.id)
  const isPending = signal.status === "Pending Verification"

  const act = (action: "verify" | "more_evidence" | "reject") => {
    reviewSignal(signal.id, action, mentor.name, notes.trim() || undefined)
    if (action === "verify") {
      // stay on page briefly so the reviewer sees the confirmed state
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/university/verification" className="text-sm text-ink-400 hover:text-teal-600">← Back to Verification Queue</Link>

      <div className="mt-4 rounded-2xl border border-ink-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-400">{student?.name} · {project?.title}</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">{signal.skill}</h1>
          </div>
          <StatusBadge status={signal.status} />
        </div>

        {signal.status === "Verified" && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-verified-500/30 bg-verified-100 px-4 py-3">
            <span className="text-lg text-verified-600">✓</span>
            <div>
              <p className="text-sm font-semibold text-verified-600">VERIFIED SKILL</p>
              <p className="text-xs text-ink-600">Verified by {signal.verifiedBy} on {formatDate(signal.verifiedAt)}</p>
            </div>
          </div>
        )}

        {project && (project.status === "Completed" || project.status === "Verified") && (
          <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">
              {project.status === "Verified" ? "✓ Project fully verified" : "Project evidence review complete"}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">
              {project.status === "Verified"
                ? "Every skill signal from this project's evidence has now been verified — the status moved to Verified."
                : "All skill signals for this project have been reviewed, but not every one was verified — the status moved to Completed."}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-ink-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">AI Assessment</p>
            <div className="mt-1.5"><LevelBadge level={signal.level} size="md" /></div>
          </div>
          <div className="rounded-xl bg-ink-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Evidence Confidence</p>
            <p className="mt-1.5 mb-2 text-lg font-bold text-ink-900">{signal.confidence}%</p>
            <ConfidenceMeter value={signal.confidence} label="" />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {confidenceDescription(signal.confidence)}. Evidence confidence indicates how strongly the submitted work supports this
          skill signal — it does not represent proficiency. Skill level and evidence confidence are assessed separately.
        </p>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Supporting Evidence</p>
          <div className="space-y-2">
            {supportingEvidence.map((e) => (
              <div key={e.id} className="rounded-xl border border-ink-200 p-3">
                <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>{" "}
                <span className="text-sm font-medium text-ink-800">{e.title}</span>
                <p className="mt-1 text-xs text-ink-500">{e.description}</p>
                <p className="mt-1 text-xs text-teal-600">{e.link}</p>
              </div>
            ))}
          </div>
        </div>

        {signal.reviewerNotes && (
          <div className="mt-6 rounded-xl border border-ink-200 bg-ink-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Reviewer Notes</p>
            <p className="mt-1 text-sm text-ink-700">“{signal.reviewerNotes}”</p>
          </div>
        )}

        {isPending ? (
          <div className="mt-8 border-t border-ink-100 pt-6">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Reviewer Notes (optional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add a note to accompany your decision..."
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => act("verify")} className="rounded-lg bg-verified-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-verified-600">
                Verify
              </button>
              <button onClick={() => act("more_evidence")} className="rounded-lg border border-amber-400 px-5 py-2.5 text-sm font-semibold text-amber-600 hover:bg-amber-100">
                Request More Evidence
              </button>
              <button onClick={() => act("reject")} className="rounded-lg border border-danger-100 px-5 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-100">
                Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 border-t border-ink-100 pt-4">
            <button onClick={() => navigate("/university/verification")} className="text-sm font-medium text-teal-600 hover:underline">
              ← Back to queue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
