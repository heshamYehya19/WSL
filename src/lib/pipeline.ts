import type { ChallengeStatus } from "../types"

/** Every challenge/project status in order, with a short label for compact UI. */
export const PIPELINE: { status: ChallengeStatus; short: string }[] = [
  { status: "Draft", short: "Draft" },
  { status: "Sent to University", short: "Sent" },
  { status: "University Assigned", short: "Assigned" },
  { status: "In Progress", short: "In progress" },
  { status: "Submissions Under Review", short: "Uni review" },
  { status: "Confirmed to Company", short: "Ready for company" },
  { status: "Company Reviewed", short: "Reviewed" },
]
