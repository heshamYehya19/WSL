import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getUniversity } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import type { ChallengeStatus as ChallengeStatusType } from "../../types"

const PIPELINE: ChallengeStatusType[] = [
  "Draft",
  "Submitted",
  "Under WSL Review",
  "Approved",
  "Sent to University",
  "University Accepted",
  "Open to Students",
  "In Progress",
  "Evidence Under Review",
  "Completed",
  "Verified",
]

export default function ChallengeStatus() {
  const { id } = useParams()
  const { challenges, projects, advanceChallenge } = useStore()
  const challenge = challenges.find((c) => c.id === id)

  if (!challenge) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Challenge not found</h2>
        <Link to="/company/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to My Challenges</Link>
      </div>
    )
  }

  const uni = challenge.preferredUniversityId ? getUniversity(challenge.preferredUniversityId) : undefined
  const relatedProjects = projects.filter((p) => p.challengeId === challenge.id)
  const currentIdx = PIPELINE.indexOf(challenge.status)

  const runWSLReview = () => advanceChallenge(challenge.id, "Under WSL Review", "WSL is validating scope, required skills, and data sensitivity before structuring this into a learning challenge.")
  const completeReview = () => {
    advanceChallenge(challenge.id, "Approved", "Structured into a safe learning challenge.")
    advanceChallenge(challenge.id, "Sent to University", uni ? `Routed to ${uni.name}.` : "Routed to a matching university.")
  }
  const submitDraft = () => advanceChallenge(challenge.id, "Submitted")

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to My Challenges</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{challenge.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{uni ? uni.name : "No university preference set"} · {challenge.visibility} · {challenge.dataSensitivity}</p>
        </div>
        <StatusBadge status={challenge.status} />
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="mb-4 text-xs font-semibold tracking-wide text-teal-600 uppercase">Pipeline Progress</h3>
        <div className="flex flex-wrap gap-2">
          {PIPELINE.map((s, i) => (
            <span key={s} className={`rounded-full border px-3 py-1 text-xs font-medium ${i <= currentIdx ? "border-teal-500 bg-teal-500 text-white" : "border-ink-200 text-ink-400"}`}>
              {s}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {challenge.status === "Draft" && (
            <button onClick={submitDraft} className="rounded-lg bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">Submit for WSL Review</button>
          )}
          {challenge.status === "Submitted" && (
            <button onClick={runWSLReview} className="rounded-lg bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">Run WSL Structuring Review</button>
          )}
          {challenge.status === "Under WSL Review" && (
            <button onClick={completeReview} className="rounded-lg bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">Complete Review — Approve &amp; Send to University</button>
          )}
          {challenge.status === "Sent to University" && (
            <p className="text-sm text-ink-500">Waiting on {uni ? uni.name : "a matching university"} to accept and map this challenge to a course.</p>
          )}
          {["University Accepted", "Open to Students"].includes(challenge.status) && (
            <p className="text-sm text-ink-500">Accepted{challenge.courseMapping ? ` and mapped to ${challenge.courseMapping.course}` : ""}. Waiting on students to start projects.</p>
          )}
          {challenge.status === "In Progress" && (
            <p className="text-sm text-ink-500">A student team is actively working on this challenge.</p>
          )}
          {challenge.status === "Evidence Under Review" && (
            <p className="text-sm text-ink-500">
              The team has submitted evidence. AI has surfaced skill signals and a university mentor is reviewing them.
            </p>
          )}
          {challenge.status === "Completed" && (
            <p className="text-sm text-ink-500">Evidence review is complete — not every skill signal was verified.</p>
          )}
          {challenge.status === "Verified" && (
            <p className="text-sm text-verified-600">
              ✓ Every skill signal from this challenge's evidence was verified by a university mentor. Visit Talent Discovery to see the team's verified skills and evidence.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Student Teams</h3>
        {relatedProjects.length === 0 ? (
          <p className="text-sm text-ink-400">No teams have started this challenge yet.</p>
        ) : (
          <div className="space-y-2">
            {relatedProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5">
                <span className="text-sm font-medium text-ink-800">{p.title} · {p.teamStudentIds.length} student{p.teamStudentIds.length > 1 ? "s" : ""}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-400">
          Company visibility respects student privacy — to discover verified skills and evidence, use Talent Discovery.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">History</h3>
        <ul className="space-y-2">
          {challenge.history.map((h, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
              <span>
                <StatusBadge status={h.status} className="mr-2" />
                <span className="text-ink-400">{formatRelative(h.at)}</span>
                {h.note && <span className="mt-0.5 block text-ink-600">{h.note}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-400">Deadline: {formatDate(challenge.deadline)}</p>
      </div>
    </div>
  )
}
