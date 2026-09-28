import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getOrg } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function ChallengeReview() {
  const { id } = useParams()
  const { university } = useDemoUser()
  const { challenges, assignChallenge } = useStore()
  const challenge = challenges.find((c) => c.id === id)

  const [program, setProgram] = useState(university?.programs[0] ?? "")

  if (!challenge || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Challenge not found</h2>
        <Link to="/university/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Challenges</Link>
      </div>
    )
  }

  const org = getOrg(challenge.organizationId)
  const canAssign = challenge.status === "Sent to University"

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/university/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to Challenges</Link>
      <PageHeader eyebrow={`${org?.name} · ${challenge.industry}`} title={challenge.title} action={<StatusBadge status={challenge.status} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Problem</h3>
            <p className="text-sm leading-relaxed text-ink-700">{challenge.problemDescription}</p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Required Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {challenge.requiredSkills.map((s) => (
                <span key={s} className="rounded-md bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">{s}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Learning Outcomes</h3>
            <ul className="space-y-1.5">
              {challenge.learningOutcomes.map((o) => (
                <li key={o} className="flex gap-2 text-sm text-ink-700"><span className="text-teal-600">•</span>{o}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Data Sensitivity &amp; Expected Output</h3>
            <p className="text-sm text-ink-700"><strong>{challenge.dataSensitivity}</strong> · {challenge.datasetAvailability}</p>
            <p className="mt-2 text-sm text-ink-700">{challenge.expectedOutput}</p>
            <p className="mt-2 text-xs text-ink-400">WSL already screened this challenge automatically for private or confidential data.</p>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Timeline</h3>
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
          </div>
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-ink-900">Assign to Students</h3>
            {canAssign ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">College / program</label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  >
                    {university.programs.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-ink-400">Opens this challenge to every student in that program — not tied to a specific course.</p>
                </div>
                <button
                  onClick={() => assignChallenge(challenge.id, program)}
                  className="w-full rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
                >
                  Assign to Students
                </button>
              </div>
            ) : challenge.assignedProgram ? (
              <div>
                <p className="text-xs text-ink-400">Assigned to</p>
                <p className="font-medium text-ink-800">{challenge.assignedProgram}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-400">This challenge hasn't reached your university yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
