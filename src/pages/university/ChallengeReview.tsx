import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { getOrg } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"

export default function ChallengeReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { university } = useDemoUser()
  const { challenges, universityDecision } = useStore()
  const challenge = challenges.find((c) => c.id === id)

  const [course, setCourse] = useState(challenge?.courseMapping?.course ?? (university?.programs[0] ? `${university.programs[0]} — Capstone` : ""))
  const [program, setProgram] = useState(challenge?.courseMapping?.program ?? university?.programs[0] ?? "")
  const [semester, setSemester] = useState(challenge?.courseMapping?.semester ?? "Fall 2026")
  const [studentGroup, setStudentGroup] = useState(challenge?.courseMapping?.studentGroup ?? "Section A")

  if (!challenge || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Challenge not found</h2>
        <Link to="/university/challenges" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Challenges</Link>
      </div>
    )
  }

  const org = getOrg(challenge.organizationId)
  const canDecide = challenge.status === "Sent to University"

  const accept = () => {
    universityDecision(challenge.id, "accept", { course, program, semester, studentGroup })
  }
  const requestChanges = () => {
    universityDecision(challenge.id, "changes", undefined, "University requested clarification on data sensitivity before accepting.")
  }
  const reject = () => {
    universityDecision(challenge.id, "reject", undefined, "Not a fit for current course offerings this term.")
    navigate("/university/challenges")
  }

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
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Review Timeline</h3>
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
            <h3 className="mb-3 font-semibold text-ink-900">Course Mapping</h3>
            {canDecide ? (
              <div className="space-y-3">
                <Field label="Course" value={course} onChange={setCourse} />
                <Field label="Program" value={program} onChange={setProgram} />
                <Field label="Semester" value={semester} onChange={setSemester} />
                <Field label="Student Group" value={studentGroup} onChange={setStudentGroup} />
                <div className="space-y-2 pt-2">
                  <button onClick={accept} className="w-full rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
                    Accept &amp; Map to Course
                  </button>
                  <button onClick={requestChanges} className="w-full rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-amber-400">
                    Request Changes
                  </button>
                  <button onClick={reject} className="w-full rounded-lg border border-danger-100 px-4 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-100">
                    Reject
                  </button>
                </div>
              </div>
            ) : challenge.courseMapping ? (
              <dl className="space-y-2.5 text-sm">
                <div><dt className="text-xs text-ink-400">Course</dt><dd className="font-medium text-ink-800">{challenge.courseMapping.course}</dd></div>
                <div><dt className="text-xs text-ink-400">Program</dt><dd className="font-medium text-ink-800">{challenge.courseMapping.program}</dd></div>
                <div><dt className="text-xs text-ink-400">Semester</dt><dd className="font-medium text-ink-800">{challenge.courseMapping.semester}</dd></div>
                <div><dt className="text-xs text-ink-400">Student Group</dt><dd className="font-medium text-ink-800">{challenge.courseMapping.studentGroup}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-ink-400">
                {challenge.status === "Under WSL Review" || challenge.status === "Submitted"
                  ? "WSL is still structuring this challenge — it hasn't been sent to a university yet."
                  : "This challenge hasn't been mapped to a course."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
      />
    </div>
  )
}
