import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"

export default function UniversityStudentDetail() {
  const { id } = useParams()
  const { university } = useDemoUser()
  const { getStudent, getUniversity, getProgram } = useStore()
  const found = id ? getStudent(id) : undefined
  // A university can only open its own students' records.
  const student = found && found.universityId === university?.id ? found : undefined

  if (!student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Student not found</h2>
        <Link to="/university/students" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Students</Link>
      </div>
    )
  }

  const uni = getUniversity(student.universityId)
  const program = getProgram(student.programId)

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/university/students" className="text-sm text-ink-400 hover:text-teal-600">← Back to Students</Link>
      <PageHeader eyebrow={uni?.name} title={student.name} subtitle={[program?.name ?? student.field, student.year, student.studentNumber ? `Student no. ${student.studentNumber}` : "", student.gpa !== undefined ? `GPA ${student.gpa.toFixed(2)}` : ""].filter(Boolean).join(" · ")} />
      {student.bio && <p className="mb-6 max-w-2xl text-sm leading-relaxed text-ink-600">{student.bio}</p>}
      <SkillRecordBody studentId={student.id} projectHref={(pid) => `/university/projects/${pid}`} />
    </div>
  )
}
