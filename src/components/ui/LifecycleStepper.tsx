import type { ChallengeStatus } from "../../types"

// The journey of one real-world challenge. These are steps of the story, not extra database states:
// "WSL structures it" is the automatic screening and routing that happens when a challenge is sent,
// so it needs no state of its own. Each status below maps onto the step the work has reached.
const STEPS = [
  { label: "Industry Need", detail: "A company has a real problem" },
  { label: "Real-World Challenge", detail: "Written up as a safe challenge" },
  { label: "WSL Structures It", detail: "Screened and routed to a university" },
  { label: "University Assignment", detail: "A university makes it available" },
  { label: "Student Work", detail: "A team works on it" },
  { label: "Evidence", detail: "Each student submits their own" },
  { label: "University Review", detail: "Evidence is reviewed skill by skill" },
  { label: "Verified Proof", detail: "Verified by the university" },
  { label: "Company Opportunity", detail: "The company sees the proof" },
] as const

/** The step each status has reached — the one currently in progress. */
const CURRENT_STEP: Record<ChallengeStatus, number> = {
  Draft: 1,
  "Sent to University": 3,
  "University Assigned": 4,
  "In Progress": 4,
  "Evidence Under Review": 6,
  "Skills Pending Verification": 6,
  Verified: 7,
  Completed: 7,
  "Company Feedback Received": 8,
}

export function LifecycleStepper({ status, className = "" }: { status: ChallengeStatus; className?: string }) {
  const current = CURRENT_STEP[status] ?? 0
  const finished = status === "Company Feedback Received"
  return (
    <ol
      aria-label="Where this challenge is in its journey"
      className={`grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-5 lg:grid-cols-9 ${className}`}
    >
      {STEPS.map((step, i) => {
        const done = i < current || (finished && i === current)
        const active = i === current && !finished
        return (
          <li key={step.label} className="flex min-w-0 flex-col items-center text-center" aria-current={active ? "step" : undefined} title={step.detail}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done ? "bg-teal-500 text-ink-950" : active ? "bg-night text-teal-300 ring-2 ring-teal-400/60" : "border border-ink-200 bg-surface text-ink-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight [overflow-wrap:anywhere] ${active ? "font-semibold text-ink-900" : done ? "text-ink-600" : "text-ink-400"}`}>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
