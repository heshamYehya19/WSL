import { useDemoUser } from "../../state/demoUser"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { getUniversity } from "../../lib/selectors"

export default function MyProfile() {
  const { student } = useDemoUser()
  if (!student) return null
  const uni = getUniversity(student.universityId)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="My Profile" title="Living Skill Record" subtitle={undefined} />

      <div className="rounded-2xl border border-ink-200 bg-ink-950 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-lg font-bold text-ink-950">
            {student.initials}
          </span>
          <div>
            <h2 className="text-xl font-bold text-white">{student.name}</h2>
            <p className="text-sm text-ink-300">{student.field} · {uni?.name}</p>
          </div>
          <span className="ml-auto rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">
            {student.availability}
          </span>
        </div>
        <p className="mt-5 max-w-xl text-sm text-ink-300">
          This is not what {student.name.split(" ")[0]} claims to know. This is what their work has demonstrated.
        </p>
      </div>

      <div className="mt-8">
        <SkillRecordBody studentId={student.id} projectHref={(pid) => `/student/projects/${pid}`} />
      </div>
    </div>
  )
}
