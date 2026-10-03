import type { ChallengeStatus } from "../types.ts"

/** Every challenge/project status in order, with a short label for compact UI. */
export const PIPELINE: { status: ChallengeStatus; short: string }[] = [
  { status: "Draft", short: "Draft" },
  { status: "Sent to University", short: "Sent" },
  { status: "University Assigned", short: "Assigned" },
  { status: "In Progress", short: "In progress" },
  { status: "Evidence Under Review", short: "Evidence review" },
  { status: "Skills Pending Verification", short: "Verifying" },
  { status: "Verified", short: "Verified" },
  { status: "Completed", short: "Completed" },
  { status: "Company Feedback Received", short: "Feedback" },
]

export const PIPELINE_ORDER: ChallengeStatus[] = PIPELINE.map((p) => p.status)

// "Verified" and "Completed" are parallel terminal branches reached by the same
// action (a university mentor confirming evidence once every required skill has
// a final decision) — not sequential stages. Give them equal rank so a challenge's
// overall status (the furthest any of its projects reached) never regresses just
// because one project landed on "Completed" while another landed on "Verified".
const RANK_OVERRIDE: Partial<Record<ChallengeStatus, number>> = { Completed: PIPELINE_ORDER.indexOf("Verified") }

export const rank = (status: string): number => RANK_OVERRIDE[status as ChallengeStatus] ?? PIPELINE_ORDER.indexOf(status as ChallengeStatus)
