import type { SkillSignalStatus } from "../../types"
import { PROOF_STATE_LABEL, PROOF_STATE_MEANING, skillProofState } from "../../lib/proof"
import type { SkillProofState } from "../../lib/proof"

const TONE: Record<SkillProofState, string> = {
  verified: "bg-verified-100 text-verified-600 border-verified-500/40",
  pending: "bg-amber-100 text-amber-700 border-amber-400/40",
  "more-evidence": "bg-amber-100 text-amber-700 border-amber-400/40",
  "not-verified": "bg-ink-100 text-ink-600 border-ink-200",
  insufficient: "bg-ink-100 text-ink-600 border-ink-200",
  acknowledged: "bg-ink-100 text-ink-700 border-ink-300",
}

/**
 * Where a skill stands with the university — the one thing a student or company should read
 * first. "Insufficient evidence" and "Not Verified" are statements about the submission and the
 * university's decision on it, never about what the student can do.
 */
export function VerificationPill({ status, insufficient = false }: { status: SkillSignalStatus; insufficient?: boolean }) {
  const state = skillProofState({ status, suggestedLevel: insufficient ? "Insufficient" : "Foundational" })
  return (
    <span
      title={PROOF_STATE_MEANING[state]}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONE[state]}`}
    >
      {state === "verified" ? `✓ ${PROOF_STATE_LABEL[state]}` : PROOF_STATE_LABEL[state]}
    </span>
  )
}
