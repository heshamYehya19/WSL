import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { getStudent, getUniversity } from "../../lib/selectors"

export default function UniversityStudentDetail() {
  const { id } = useParams()
  const student = id ? getStudent(id) : undefined

  if (!student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Student not found</h2>
        <Link to="/university/students" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Students</Link>
      </div>
    )
  }

  const uni = getUniversity(student.universityId)

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/university/students" className="text-sm text-ink-400 hover:text-teal-600">← Back to Students</Link>
      <PageHeader eyebrow={uni?.name} title={student.name} subtitle={`${student.field} · ${student.year}`} />
      <SkillRecordBody studentId={student.id} projectHref={(pid) => `/university/projects/${pid}`} />
    </div>
  )
}
