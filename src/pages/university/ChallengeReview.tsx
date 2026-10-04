import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { IllustrativeDataNote } from "../../components/ui/IllustrativeDataNote"
import { ChallengeFileList, SharedDataNotice } from "../../components/ui/ChallengeFiles"
import { assignmentFor, statusAtUniversity } from "../../lib/selectors"
import { daysUntil, formatDate, formatRelative } from "../../lib/format"

export default function ChallengeReview() {
  const { id } = useParams()
  const { university } = useDemoUser()
  const { challenges, projects, students, assignChallenge, getOrg, getStaff } = useStore()
  // Visible when it was sent to this university, or to any university (no preference).
  const challenge = challenges.find(
    (c) => c.id === id && c.status !== "Draft" && (c.preferredUniversityId === null || c.preferredUniversityId === university?.id),
  )

  const [programId, setProgramId] = useState(university?.programs[0]?.id ?? "")
  const [saving, setSaving] = useState(false)

  if (!challenge || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Challenge not found</h2>
        <Link to="/university/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Challenges</Link>
      </div>
    )
  }

  const org = getOrg(challenge.organizationId)
  const mine = assignmentFor(challenge, university.id)
  const status = statusAtUniversity(challenge, university.id, projects, students)
  const deadlinePassed = daysUntil(challenge.deadline) <= 0
  const canAssign = !mine && !deadlinePassed
  const otherAssignments = challenge.assignments.filter((a) => a.universityId !== university.id).length
  // An open challenge's history also records other universities' activity, which isn't
  // this university's business — show only the company's steps plus this university's own.
  const history =
    challenge.preferredUniversityId === null
      ? [
          ...challenge.history.filter((h) => h.status === "Draft" || h.status === "Sent to University"),
          ...(mine ? [{ status: "University Assigned" as const, at: mine.assignedAt, note: `Assigned to ${mine.program} students at ${university.name}.` }] : []),
        ]
      : challenge.history
  const selectedProgram = university.programs.find((p) => p.id === programId)
  const coordinator = selectedProgram ? getStaff(selectedProgram.coordinatorId) : undefined

  const assign = async () => {
    setSaving(true)
    await assignChallenge(challenge.id, programId)
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/university/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to Challenges</Link>
      <PageHeader eyebrow={`${org?.name} · ${challenge.industry}`} title={challenge.title} action={<StatusBadge status={status} />} />
      <IllustrativeDataNote company={org?.name} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Problem</h3>
            <p className="text-sm leading-relaxed text-ink-700">{challenge.problemDescription}</p>
            <ChallengeFileList challenge={challenge} kind="description" />
          </div>
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Required Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {challenge.requiredSkills.map((s) => (
                <span key={s} className="rounded-md bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">{s}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Learning Outcomes</h3>
            <ul className="space-y-1.5">
              {challenge.learningOutcomes.map((o) => (
                <li key={o} className="flex gap-2 text-sm text-ink-700"><span className="text-teal-600">•</span>{o}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Data Sensitivity &amp; Expected Output</h3>
            <p className="text-sm text-ink-700"><strong>{challenge.dataSensitivity}</strong> · {challenge.datasetAvailability}</p>
            <ChallengeFileList challenge={challenge} kind="dataset" />
            <p className="mt-2 text-sm text-ink-700">{challenge.expectedOutput}</p>
            <p className="mt-2 text-xs text-ink-400">WSL already screened this challenge automatically for private or confidential data.</p>
            <SharedDataNotice challenge={challenge} companyName={org?.name} />
          </div>

          <div className="rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Timeline</h3>
            <ul className="space-y-2">
              {history.map((h, i) => (
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
          </div>
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl border border-ink-200 bg-surface p-5">
            <h3 className="mb-3 font-semibold text-ink-900">Assign to Students</h3>
            {canAssign ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">College / program</label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  >
                    {university.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-ink-400">Opens this challenge to every student in that program — not tied to a specific course.</p>
                  {coordinator && <p className="mt-1 text-xs text-ink-400">Mentor: {coordinator.name}</p>}
                </div>
                <button
                  onClick={assign}
                  disabled={saving || !programId}
                  className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {saving ? "Assigning…" : "Assign to Students"}
                </button>
              </div>
            ) : mine ? (
              <div>
                <p className="text-xs text-ink-400">Assigned to your students</p>
                <p className="font-medium text-ink-800">{mine.program}</p>
                <p className="mt-1 text-xs text-ink-400">on {formatDate(mine.assignedAt)}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-400">This challenge's deadline has passed, so it can no longer be assigned.</p>
            )}
            {challenge.preferredUniversityId === null && (
              <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-400">
                Open challenge — every university assigns it independently.
                {otherAssignments > 0 && ` ${otherAssignments} other universit${otherAssignments === 1 ? "y has" : "ies have"} assigned it to their own students.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
