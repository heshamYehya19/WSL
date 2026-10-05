import type { ReviewItem, ReviewState, SkillSignal } from "../types.ts"

/**
 * Where one student's skill stands. Derived from the data, never assumed: a required skill with no
 * signal, or a signal that found nothing in the submitted evidence, is "insufficient" — which says
 * what the evidence shows, not what the student can do. "acknowledged" is different: the university
 * reviewed that and explicitly agreed the evidence doesn't (yet) demonstrate the skill. Only the
 * university makes a skill "verified".
 */
export type SkillProofState = "insufficient" | "acknowledged" | "pending" | "more-evidence" | "not-verified" | "verified"

export function skillProofState(signal: Pick<SkillSignal, "status" | "suggestedLevel"> | undefined): SkillProofState {
  if (!signal) return "insufficient"
  switch (signal.status) {
    case "Verified":
      return "verified"
    case "Rejected":
      return "not-verified"
    case "More Evidence Requested":
      return "more-evidence"
    case "Insufficient Evidence":
      return "acknowledged"
    default:
      return signal.suggestedLevel === "Insufficient" ? "insufficient" : "pending"
  }
}

export const PROOF_STATE_LABEL: Record<SkillProofState, string> = {
  insufficient: "Insufficient evidence",
  acknowledged: "Insufficient evidence · reviewed",
  pending: "Pending University Verification",
  "more-evidence": "More Evidence Requested",
  "not-verified": "Not Verified",
  verified: "Verified",
}

/** What each state means, in words that never judge the student. */
export const PROOF_STATE_MEANING: Record<SkillProofState, string> = {
  insufficient: "The submitted evidence does not currently demonstrate this skill.",
  acknowledged: "The university reviewed this and agreed the submitted evidence does not demonstrate this skill yet.",
  pending: "Evidence was found for this skill. A university reviewer has not decided yet.",
  "more-evidence": "The university asked for more evidence before it can decide.",
  "not-verified": "The university has not verified this evidence as sufficient.",
  verified: "The university reviewed the evidence and verified this skill.",
}

/** How many of a student's required skills are in each state. */
export function proofCounts(skills: string[], signals: Pick<SkillSignal, "skill" | "status" | "suggestedLevel">[]): Record<SkillProofState, number> {
  const counts: Record<SkillProofState, number> = { insufficient: 0, acknowledged: 0, pending: 0, "more-evidence": 0, "not-verified": 0, verified: 0 }
  for (const skill of skills) counts[skillProofState(signals.find((s) => s.skill === skill))]++
  return counts
}

/** The confirmation check's verdict on one student's one skill (undefined when the project has no check, e.g. once confirmed). */
export function reviewItemFor(review: { items: ReviewItem[] } | null | undefined, studentId: string, skill: string): ReviewItem | undefined {
  return review?.items.find((i) => i.studentId === studentId && i.skill === skill)
}

const REVIEW_STATE_REASON: Record<ReviewState, string> = {
  verified: "verified",
  "not-verified": "not verified",
  acknowledged: "insufficient evidence, reviewed",
  pending: "awaiting a decision",
  "more-evidence": "more evidence requested",
  unreviewed: "not reviewed yet",
}

/** Why one cell of the confirmation check does not count yet, in a few words. */
export function reviewItemReason(item: ReviewItem): string {
  return item.stale ? "new evidence since the last review or analysis" : REVIEW_STATE_REASON[item.state]
}

/** Shown beside a decision that no longer counts because the evidence behind it changed. */
export const STALE_NOTICE = "New evidence was added after this was reviewed, so it needs a fresh look before the project can be confirmed."
/** Shown to a student whose current evidence hasn't been analyzed yet. */
export const STALE_STUDENT_NOTICE = "You added evidence since the last analysis. Analyze it so the university can review it."
