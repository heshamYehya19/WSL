import { useState } from "react"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import type { Availability } from "../../types"

const AVAILABILITIES: Availability[] = ["Open to Opportunities", "Open to Internships", "Not Available"]

export default function MyProfile() {
  const { student } = useDemoUser()
  const { getUniversity, getProgram, updateStudentProfile } = useStore()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [availability, setAvailability] = useState<Availability>("Open to Opportunities")
  const [saving, setSaving] = useState(false)
  if (!student) return null
  const uni = getUniversity(student.universityId)
  const program = getProgram(student.programId)

  const startEditing = () => {
    setBio(student.bio)
    setAvailability(student.availability)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    const ok = await updateStudentProfile(student.id, { bio, availability })
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="My Profile" title="Living Skill Record" subtitle={undefined} />

      <div className="rounded-2xl border border-ink-200 bg-ink-950 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-lg font-bold text-ink-950">
            {student.initials}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white">{student.name}</h2>
            <p className="text-sm text-ink-300">{program?.name ?? student.field} · {uni?.name}</p>
            <p className="text-xs text-ink-400">
              {student.year} · Student no. {student.studentNumber} · GPA {student.gpa.toFixed(2)} · {student.city}
            </p>
          </div>
          <span className="ml-auto rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">
            {student.availability}
          </span>
        </div>
        {student.bio && <p className="mt-5 max-w-2xl text-sm text-ink-200">{student.bio}</p>}
        <p className="mt-3 max-w-xl text-sm text-ink-300">
          This is not what {student.name.split(" ")[0]} claims to know. This is what their work has demonstrated.
        </p>
        {!editing && (
          <button onClick={startEditing} className="mt-4 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-teal-300">
            Edit bio &amp; availability
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3 rounded-2xl border border-ink-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as Availability)}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
            >
              {AVAILABILITIES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={600}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
            />
            <p className="mt-1 text-xs text-ink-400">Companies see this on your candidate profile. Your skill ratings can't be edited — they come from your evidence.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm font-medium text-ink-400 hover:text-ink-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <SkillRecordBody studentId={student.id} projectHref={(pid) => `/student/projects/${pid}`} />
      </div>
    </div>
  )
}
