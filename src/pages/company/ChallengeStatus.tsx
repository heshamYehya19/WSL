import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { challengeUniversityIds } from "../../lib/selectors"
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
  const { company } = useDemoUser()
  const { challenges, projects, submitDraft, getStudent, getUniversity } = useStore()
  const challenge = challenges.find((c) => c.id === id && c.organizationId === company?.id)

  if (!challenge) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Challenge not found</h2>
        <Link to="/company/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to My Challenges</Link>
      </div>
    )
  }

  const uniNames = challengeUniversityIds(challenge).map((u) => getUniversity(u)?.name).join(", ")
  const preferred = challenge.preferredUniversityId ? getUniversity(challenge.preferredUniversityId) : undefined
  const relatedProjects = projects.filter((p) => p.challengeId === challenge.id)
  const awaitingYou = relatedProjects.find((p) => p.status === "Confirmed to Company")
  const working = relatedProjects.filter((p) => p.status === "In Progress").length
  const currentIdx = PIPELINE.indexOf(challenge.status)

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to My Challenges</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{challenge.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{uniNames || "Open to any university"} · {challenge.visibility} · {challenge.dataSensitivity}</p>
          <p className="mt-0.5 text-xs text-ink-400">Contact: {challenge.contactPerson}, {challenge.contactRole}</p>
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
            <p className="text-sm text-ink-500">Waiting on {preferred ? preferred.name : "a university"} to assign this to their students.</p>
          )}
          {challenge.status === "University Assigned" && (
            <p className="text-sm text-ink-500">Assigned to students. Waiting on a student to start.</p>
          )}
          {challenge.status === "In Progress" && (
            <p className="text-sm text-ink-500">
              {working} student{working === 1 ? " is" : "s are"} working on this challenge, each on their own.
            </p>
          )}
          {challenge.status === "Submissions Under Review" && (
            <p className="text-sm text-ink-500">WSL has rated the submitted evidence automatically. The university is reviewing it next.</p>
          )}
          {awaitingYou ? (
            <div>
              <p className="text-sm text-verified-600">✓ The university reviewed and confirmed a submission to you.</p>
              <Link to={`/company/submissions/${awaitingYou.id}`} className="mt-2 inline-block text-sm font-semibold text-teal-600 hover:underline">
                Review the submission →
              </Link>
            </div>
          ) : (
            challenge.status === "Company Reviewed" && (
              <div>
                <p className="text-sm text-verified-600">✓ You've rated every confirmed submission.</p>
                <Link to="/company/talent" className="mt-2 inline-block text-sm font-semibold text-teal-600 hover:underline">
                  Open Talent Discovery →
                </Link>
              </div>
            )
          )}
        </div>
      </div>

      {challenge.status !== "Draft" && (
        <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">University Assignments</h3>
          {challenge.assignments.length === 0 ? (
            <p className="text-sm text-ink-400">
              {preferred ? `Not assigned by ${preferred.name} yet.` : "Open to every university — none has assigned it yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {challenge.assignments.map((a) => {
                const count = relatedProjects.filter((p) => getStudent(p.studentId)?.universityId === a.universityId).length
                return (
                  <div key={a.universityId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{getUniversity(a.universityId)?.name}</p>
                      <p className="text-xs text-ink-400">{a.program} · assigned {formatRelative(a.assignedAt)}</p>
                    </div>
                    <span className="text-xs text-ink-500">{count} student{count === 1 ? "" : "s"} started</span>
                  </div>
                )
              })}
              {!preferred && <p className="pt-1 text-xs text-ink-400">Open challenge — other universities can still assign it to their own students.</p>}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Student Submissions</h3>
        {relatedProjects.length === 0 ? (
          <p className="text-sm text-ink-400">No students have started this challenge yet.</p>
        ) : (
          <div className="space-y-2">
            {relatedProjects.map((p) => {
              const s = getStudent(p.studentId)
              const su = s ? getUniversity(s.universityId) : undefined
              const canReview = p.status === "Confirmed to Company" || p.status === "Company Reviewed"
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5">
                  {canReview ? (
                    <Link to={`/company/submissions/${p.id}`} className="text-sm font-medium text-ink-800 hover:text-teal-600">
                      {s?.name} <span className="font-normal text-ink-400">· {su?.shortName}</span> →
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-ink-800">{s?.name} <span className="font-normal text-ink-400">· {su?.shortName}</span></span>
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
