import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { getStudent, getUniversity } from "../../lib/selectors"

export default function CandidateProfile() {
  const { id } = useParams()
  const student = id ? getStudent(id) : undefined

  if (!student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Candidate not found</h2>
        <Link to="/company/talent" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Talent Discovery</Link>
      </div>
    )
  }

  const uni = getUniversity(student.universityId)

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/talent" className="text-sm text-ink-400 hover:text-teal-600">← Back to Talent Discovery</Link>
      <PageHeader eyebrow={uni?.name} title={student.name} subtitle={`${student.field} · ${student.year} · ${student.availability}`} />

      <div className="mb-8 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4 text-sm text-ink-600">
        Every skill below was rated by WSL's automatic AI review from submitted evidence, and confirmed by a university before reaching you. Open a project to see the exact evidence behind it and give your own rating — this is not a self-reported CV.
      </div>

      <SkillRecordBody studentId={student.id} projectHref={(pid) => `/company/submissions/${pid}`} />
    </div>
  )
}
