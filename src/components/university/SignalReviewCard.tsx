import { useState } from "react"
import { ConfidenceMeter } from "../ui/ConfidenceMeter"
import { StatusBadge } from "../ui/StatusBadge"
import { EvidenceQuotes } from "../ui/EvidenceQuotes"
import { CriteriaChecklist } from "../ui/CriteriaChecklist"
import { assessmentLabel, evidenceAnalysisLabel, evidenceStrengthFor, splitAiNote } from "../../lib/aiNote"
import { formatDate } from "../../lib/format"
import type { Evidence, SkillSignal } from "../../types"

type Decision = "verify" | "request-more-evidence" | "reject"

export function SignalReviewCard({
  signal,
  evidence,
  verifierName,
  onReview,
}: {
  signal: SkillSignal
  /** All of this project's evidence — filtered here to what this signal actually drew on. */
  evidence: Evidence[]
  verifierName?: string
  onReview: (decision: Decision, options?: { reviewerNotes?: string }) => Promise<boolean>
}) {
  const [notesDraft, setNotesDraft] = useState("")
  const [active, setActive] = useState<Decision | null>(null)
  const [saving, setSaving] = useState(false)

  const supportingEvidence = evidence.filter((e) => signal.evidenceIds.includes(e.id))
  const decided = signal.status === "Verified" || signal.status === "Rejected"

  const choose = (decision: Decision) => {
    if (decision === "verify") {
      submit("verify")
      return
    }
    setActive((cur) => (cur === decision ? null : decision))
  }

  const submit = async (decision: Decision) => {
    if (decision !== "verify" && !notesDraft.trim()) return
    setSaving(true)
    const ok = await onReview(decision, decision === "verify" ? undefined : { reviewerNotes: notesDraft.trim() })
    setSaving(false)
    if (ok) {
      setActive(null)
      setNotesDraft("")
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-ink-900">{signal.skill}</h4>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">{assessmentLabel(signal.suggestedLevel)}</span>
          </div>
          <div className="mt-1"><StatusBadge status={signal.status} /></div>
        </div>
        <div className="w-36">
          <p className="mb-1 text-right text-[11px] font-semibold text-ink-600">Evidence Strength: {evidenceStrengthFor(signal.evidenceConfidence)}</p>
          <ConfidenceMeter value={signal.evidenceConfidence} label="Evidence confidence" />
        </div>
      </div>

      {signal.gradedSource === "offline" && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          Estimated offline, not graded by the AI model — ask the student to re-analyze once the model is available.
        </p>
      )}

      {signal.criteria.length > 0 && (
        <div className="mt-3">
          <CriteriaChecklist criteria={signal.criteria} />
        </div>
      )}

      {(signal.aiNote || signal.aiQuotes.length > 0) && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Why WSL found this</p>
          {signal.aiQuotes.length > 0 && (
            <div className="mt-1.5 mb-2">
              <EvidenceQuotes quotes={signal.aiQuotes} evidenceTitle={(id) => evidence.find((e) => e.id === id)?.title} />
            </div>
          )}
          <ul className="mt-1 space-y-0.5">
            {splitAiNote(signal.aiNote).map((line) => (
              <li key={line} className="flex gap-1.5 text-xs text-ink-600">
                <span className="text-teal-600">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Supporting evidence</p>
        <div className="mt-1 space-y-1.5">
          {supportingEvidence.length === 0 && <p className="text-xs text-ink-400">No evidence linked to this signal.</p>}
          {supportingEvidence.map((e) => (
            <div key={e.id} className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs">
              <span className="font-semibold text-ink-800">{e.type}</span> <span className="text-ink-600">{e.title}</span>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {evidenceAnalysisLabel(e)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {signal.reviewerNotes && (
        <p className="mt-3 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">
          <span className="font-semibold text-ink-800">Reviewer notes:</span> {signal.reviewerNotes}
        </p>
      )}
      {decided && (
        <p className="mt-2 text-[11px] text-ink-400">
          {signal.status} by {verifierName ?? "a mentor"}
          {signal.verifiedAt ? ` · ${formatDate(signal.verifiedAt)}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose("verify")}
          disabled={saving}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            signal.status === "Verified" ? "bg-verified-500 text-ink-950" : "bg-night text-white hover:bg-teal-600"
          }`}
        >
          Verify Skill
        </button>
        <button
          type="button"
          onClick={() => choose("request-more-evidence")}
          aria-pressed={active === "request-more-evidence"}
          disabled={saving}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            signal.status === "More Evidence Requested" ? "border-amber-400 bg-amber-100 text-amber-700" : "border-ink-200 text-ink-600 hover:border-amber-400"
          }`}
        >
          Request More Evidence
        </button>
        <button
          type="button"
          onClick={() => choose("reject")}
          aria-pressed={active === "reject"}
          disabled={saving}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            signal.status === "Rejected" ? "border-danger-400 bg-danger-100 text-danger-600" : "border-ink-200 text-ink-600 hover:border-danger-400"
          }`}
        >
          Reject Signal
        </button>
      </div>

      {active && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-ink-500">
            {active === "reject" ? "Why wasn't this verified?" : "What more evidence do you need?"} (required)
          </label>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
          <button
            type="button"
            onClick={() => submit(active)}
            disabled={saving || !notesDraft.trim()}
            className="mt-2 rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Submit decision"}
          </button>
        </div>
      )}
    </div>
  )
}
