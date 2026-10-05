import { useState } from "react"
import { VerificationPill } from "../ui/VerificationPill"
import { STALE_NOTICE } from "../../lib/proof"

/**
 * A required skill with no signal for this student: nothing was analyzed, or they've submitted nothing WSL reads.
 * "No evidence" is WSL's analysis result, not a decision — the reviewer still has to say so, explicitly, before the
 * project can be confirmed. There is no analysis to verify, so the choices are to acknowledge or to ask for more.
 */
export function MissingSkillCard({
  skill,
  firstName,
  hasEvidence,
  stale,
  onDecide,
}: {
  skill: string
  firstName: string
  hasEvidence: boolean
  stale: boolean
  onDecide: (decision: "insufficient" | "request-more-evidence", reviewerNotes?: string) => Promise<boolean>
}) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const decide = async (decision: "insufficient" | "request-more-evidence") => {
    if (decision === "request-more-evidence" && !note.trim()) return
    setSaving(true)
    const ok = await onDecide(decision, decision === "request-more-evidence" ? note.trim() : undefined)
    setSaving(false)
    if (ok) {
      setAsking(false)
      setNote("")
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{skill}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {hasEvidence
              ? `${firstName} has submitted evidence, but WSL hasn't analyzed it for ${skill} yet — ${firstName} runs the analysis.`
              : `${firstName} hasn't submitted anything WSL can analyze, so there is no ${skill} evidence to verify.`}{" "}
            You still record a decision on this skill: acknowledge that the evidence is insufficient, or ask for more.
          </p>
        </div>
        <VerificationPill status="Pending Verification" insufficient />
      </div>
      {stale && <p role="status" className="mt-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">{STALE_NOTICE}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("insufficient")}
          disabled={saving}
          className="rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
        >
          Acknowledge Insufficient Evidence
        </button>
        <button
          type="button"
          onClick={() => setAsking((v) => !v)}
          aria-pressed={asking}
          disabled={saving}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-amber-400 disabled:opacity-50"
        >
          Request More Evidence
        </button>
      </div>
      {asking && (
        <div className="mt-3">
          <label htmlFor={`more-${skill}`} className="mb-1 block text-xs font-medium text-ink-500">What more evidence do you need? (required)</label>
          <textarea
            id={`more-${skill}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
          />
          <button
            type="button"
            onClick={() => decide("request-more-evidence")}
            disabled={saving || !note.trim()}
            className="mt-2 rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Submit decision"}
          </button>
        </div>
      )}
    </div>
  )
}
