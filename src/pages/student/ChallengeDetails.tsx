import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { formatDate, daysUntil } from "../../lib/format"
import { getOrg } from "../../lib/selectors"

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
  const { challenges, projects, startProject } = useStore()
  const [starting, setStarting] = useState(false)

  const challenge = challenges.find((c) => c.id === id)
  const existingProject = student ? projects.find((p) => p.challengeId === id && p.teamStudentIds.includes(student.id)) : undefined

  useEffect(() => {
    if (starting && existingProject) {
      navigate(`/student/projects/${existingProject.id}`)
    }
  }, [starting, existingProject, navigate])

  if (!challenge) {
    return <EmptyChallenge />
  }
  const org = getOrg(challenge.organizationId)

  const handleStart = () => {
    if (!student) return
    if (existingProject) {
      navigate(`/student/projects/${existingProject.id}`)
      return
    }
    setStarting(true)
    startProject(challenge.id, student.id)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/student/challenges" className="text-sm text-ink-400 hover:text-teal-600">← Back to Challenges</Link>
      <PageHeader
        eyebrow={`${org?.name} · ${challenge.industry}`}
        title={challenge.title}
        subtitle={undefined}
        action={<StatusBadge status={challenge.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-200 bg-white px-6 lg:col-span-2">
          <Section title="The Problem">
            <p className="text-sm leading-relaxed text-ink-700">{challenge.problemDescription}</p>
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
          <Section title="Expected Output">
            <p className="text-sm text-ink-700">{challenge.expectedOutput}</p>
          </Section>
          <Section title="Required Skills">
            <div className="flex flex-wrap gap-1.5">
              {challenge.requiredSkills.map((s) => (
                <span key={s} className="rounded-md bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">{s}</span>
              ))}
            </div>
          </Section>
          <Section title="Data Available">
            <p className="text-sm text-ink-700">{challenge.datasetAvailability}</p>
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
              {" "}This challenge was structured and reviewed by WSL before being made available to students.
            </p>
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
          <div className="sticky top-24 rounded-2xl border border-ink-200 bg-white p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-400">Difficulty</dt><dd className="font-medium text-ink-800">{challenge.difficulty}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-400">Deadline</dt><dd className="font-medium text-ink-800">{formatDate(challenge.deadline)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-400">Time left</dt><dd className="font-medium text-ink-800">{Math.max(daysUntil(challenge.deadline), 0)} days</dd></div>
              <div className="flex justify-between"><dt className="text-ink-400">Teams</dt><dd className="font-medium text-ink-800">{challenge.numTeams}</dd></div>
              {challenge.courseMapping && (
                <div className="flex justify-between"><dt className="text-ink-400">Course</dt><dd className="text-right font-medium text-ink-800">{challenge.courseMapping.course}</dd></div>
              )}
            </dl>
            <button
              onClick={handleStart}
              disabled={!student}
              className="mt-5 w-full rounded-xl bg-ink-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
            >
              {existingProject ? "Go to Project" : "Start Project"}
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
