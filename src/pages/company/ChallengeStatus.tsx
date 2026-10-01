import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getStudent, getUniversity } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import type { ChallengeStatus as ChallengeStatusType } from "../../types"

const PIPELINE: ChallengeStatusType[] = [
  "Draft",
  "Sent to University",
  "University Assigned",
  "In Progress",
  "Submissions Under Review",
  "Confirmed to Company",
  "Company Reviewed",
]

export default function ChallengeStatus() {
  const { id } = useParams()
  const { challenges, projects, submitDraft } = useStore()
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

      <div className="rounded-2xl border border-ink-200 bg-surface p-6">
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
            <button
              onClick={() => submitDraft(challenge.id)}
              className="rounded-lg bg-night px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Submit for Review
            </button>
          )}
          {challenge.status === "Sent to University" && (
            <p className="text-sm text-ink-500">Waiting on {uni ? uni.name : "a matching university"} to assign this to their students.</p>
          )}
          {challenge.status === "University Assigned" && (
            <p className="text-sm text-ink-500">
              Assigned to {challenge.assignedProgram ?? "students"}{uni ? ` at ${uni.name}` : ""}. Waiting on a student to start.
            </p>
          )}
          {challenge.status === "In Progress" && (
            <p className="text-sm text-ink-500">A student is working on this challenge, on their own.</p>
          )}
          {challenge.status === "Submissions Under Review" && (
            <p className="text-sm text-ink-500">WSL has rated the submitted evidence automatically. The university is reviewing it next.</p>
          )}
          {challenge.status === "Confirmed to Company" && (
            <div>
              <p className="text-sm text-verified-600">✓ The university reviewed and confirmed a submission to you.</p>
              <Link to="/company/talent" className="mt-2 inline-block text-sm font-semibold text-teal-600 hover:underline">
                Review the submission →
              </Link>
            </div>
          )}
          {challenge.status === "Company Reviewed" && (
            <div>
              <p className="text-sm text-verified-600">✓ You've rated this submission.</p>
              <Link to="/company/talent" className="mt-2 inline-block text-sm font-semibold text-teal-600 hover:underline">
                Open Talent Discovery →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Student Submissions</h3>
        {relatedProjects.length === 0 ? (
          <p className="text-sm text-ink-400">No students have started this challenge yet.</p>
        ) : (
          <div className="space-y-2">
            {relatedProjects.map((p) => {
              const s = getStudent(p.studentId)
              const canReview = p.status === "Confirmed to Company" || p.status === "Company Reviewed"
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5">
                  {canReview ? (
                    <Link to={`/company/submissions/${p.id}`} className="text-sm font-medium text-ink-800 hover:text-teal-600">
                      {s?.name} →
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-ink-800">{s?.name}</span>
                  )}
                  <StatusBadge status={p.status} />
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-400">
          Company visibility respects student privacy — a submission only opens here once the university confirms it.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
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
