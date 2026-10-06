import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { IllustrativeDataNote } from "../../components/ui/IllustrativeDataNote"
import { ChallengeFileList, SharedDataNotice } from "../../components/ui/ChallengeFiles"
import { formatDate, daysUntil } from "../../lib/format"
import { assignmentFor, canStudentSee, isOnTeam, statusAtUniversity } from "../../lib/selectors"
import { LifecycleStepper } from "../../components/ui/LifecycleStepper"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 py-5 last:border-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">{title}</h3>
      {children}
    </div>
  )
}

export default function ChallengeDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { student } = useDemoUser()
  const { challenges, projects, students, startProject, getOrg } = useStore()
  const [starting, setStarting] = useState(false)

  const found = challenges.find((c) => c.id === id)
  const challenge = found && student && canStudentSee(found, student, projects) ? found : undefined
  // A project you started, or one a classmate started and added you to.
  const existingProject = student ? projects.find((p) => p.challengeId === id && isOnTeam(p, student.id)) : undefined

  if (!challenge) {
    return <EmptyChallenge />
  }
  const org = getOrg(challenge.organizationId)
  const closed = daysUntil(challenge.deadline) <= 0

  const handleStart = async () => {
    if (!student) return
    if (existingProject) {
      navigate(`/student/projects/${existingProject.id}`)
      return
    }
    setStarting(true)
    const projectId = await startProject(challenge.id)
    setStarting(false)
    if (projectId) navigate(`/student/projects/${projectId}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/student/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to Challenges</Link>
      <PageHeader
        eyebrow={`${org?.name} · ${challenge.industry}`}
        title={challenge.title}
        subtitle={undefined}
        action={<StatusBadge status={statusAtUniversity(challenge, student!.universityId, projects, students)} />}
      />
      <IllustrativeDataNote company={org?.name} />
      <LifecycleStepper status={statusAtUniversity(challenge, student!.universityId, projects, students)} className="mb-6 rounded-2xl border border-ink-200 bg-surface px-4 py-3" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-200 bg-surface px-6 lg:col-span-2">
          <Section title="The Problem">
            <p className="text-sm leading-relaxed text-ink-700">{challenge.problemDescription}</p>
            <ChallengeFileList challenge={challenge} kind="description" />
          </Section>
          <Section title="Objectives">
            <ul className="space-y-1.5">
              {challenge.objectives.map((o) => (
                <li key={o} className="flex gap-2 text-sm text-ink-700">
                  <span className="text-teal-600">•</span>
                  {o}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Deliverables">
            <p className="text-sm text-ink-700">{challenge.expectedOutput}</p>
          </Section>
          {challenge.duration && (
            <Section title="Duration">
              <p className="text-sm text-ink-700">{challenge.duration}</p>
            </Section>
          )}
          {challenge.constraints && (
            <Section title="Constraints">
              <p className="text-sm text-ink-700">{challenge.constraints}</p>
            </Section>
          )}
          <Section title="Required Skills">
            <div className="flex flex-wrap gap-1.5">
              {challenge.requiredSkills.map((s) => (
                <span key={s} className="rounded-md bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">{s}</span>
              ))}
            </div>
          </Section>
          <Section title="Data Available">
            <p className="text-sm text-ink-700">{challenge.datasetAvailability}</p>
            <ChallengeFileList challenge={challenge} kind="dataset" />
          </Section>
          <Section title="Submission Requirements">
            <div className="flex flex-wrap gap-1.5">
              {challenge.submissionRequirements.map((s) => (
                <span key={s} className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600">{s}</span>
              ))}
            </div>
          </Section>
          <Section title="Confidentiality">
            <p className="text-sm text-ink-700">
              Data sensitivity: <strong>{challenge.dataSensitivity}</strong>. Visibility: <strong>{challenge.visibility}</strong>.
              {" "}WSL automatically screened this challenge for private or confidential data before it reached your university.
            </p>
            <SharedDataNotice challenge={challenge} companyName={org?.name} />
          </Section>
          <Section title="Learning Outcomes">
            <ul className="space-y-1.5">
              {challenge.learningOutcomes.map((o) => (
                <li key={o} className="flex gap-2 text-sm text-ink-700">
                  <span className="text-teal-600">•</span>
                  {o}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl border border-ink-200 bg-surface p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-400">Difficulty</dt><dd className="font-medium text-ink-800">{challenge.difficulty}</dd></div>
              {challenge.duration && <div className="flex justify-between"><dt className="text-ink-400">Duration</dt><dd className="font-medium text-ink-800">{challenge.duration}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-400">Deadline</dt><dd className="font-medium text-ink-800">{formatDate(challenge.deadline)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-400">Time left</dt><dd className="font-medium text-ink-800">{Math.max(daysUntil(challenge.deadline), 0)} days</dd></div>
              {assignmentFor(challenge, student?.universityId) && (
                <div className="flex justify-between"><dt className="text-ink-400">Assigned to</dt><dd className="text-right font-medium text-ink-800">{assignmentFor(challenge, student?.universityId)?.program}</dd></div>
              )}
            </dl>
            <p className="mt-3 text-xs text-ink-400">
              {existingProject && existingProject.studentId !== student?.id
                ? "A classmate added you to this project. Record what you're contributing, then submit your own evidence."
                : "Work on your own, or start the project and add classmates from your university. Either way, each of you records your own contribution and submits your own evidence."}
            </p>
            <button
              onClick={handleStart}
              disabled={!student || starting || (closed && !existingProject)}
              className="mt-3 w-full rounded-xl bg-night px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
            >
              {existingProject ? "Go to Project" : closed ? "Deadline Passed" : starting ? "Starting…" : "Start Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyChallenge() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h2 className="font-semibold text-ink-800">Challenge not found</h2>
      <Link to="/student/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Challenges</Link>
    </div>
  )
}
