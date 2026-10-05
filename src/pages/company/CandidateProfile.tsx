import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"

export default function CandidateProfile() {
  const { id } = useParams()
  const { getStudent, getUniversity, getProgram, companyActions, opportunities, toggleSavedStudent, toggleInterested, inviteStudent } = useStore()
  const { company } = useDemoUser()
  const [opportunityId, setOpportunityId] = useState("")
  const [inviting, setInviting] = useState(false)
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
  const program = getProgram(student.programId)
  const saved = companyActions.some((a) => a.studentId === student.id && a.kind === "saved")
  const interested = companyActions.some((a) => a.studentId === student.id && a.kind === "interested")
  const myOpportunities = company ? opportunities.filter((o) => o.organizationId === company.id) : []
  const alreadyInvited = (oppId: string) => companyActions.some((a) => a.studentId === student.id && a.kind === "invited" && a.opportunityId === oppId)

  const sendInvite = async () => {
    if (!opportunityId) return
    setInviting(true)
    if (await inviteStudent(student.id, opportunityId, "")) setOpportunityId("")
    setInviting(false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/talent" className="text-sm text-ink-400 hover:text-teal-600">← Back to Talent Discovery</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <PageHeader eyebrow={uni?.name} title={student.name} subtitle={`${program?.name ?? student.field} · ${student.year} · GPA ${student.gpa.toFixed(2)} · ${student.availability}`} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleSavedStudent(student.id)}
            aria-pressed={saved}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${saved ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => toggleInterested(student.id)}
            aria-pressed={interested}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${interested ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
          >
            {interested ? "✓ Interested" : "Express Interest"}
          </button>
        </div>
      </div>

      {student.bio && <p className="mb-6 max-w-2xl text-sm leading-relaxed text-ink-600">{student.bio}</p>}

      {myOpportunities.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 py-3">
          <label htmlFor="invite-opportunity" className="text-xs font-medium text-ink-500">Invite to an opportunity</label>
          <select
            id="invite-opportunity"
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className="rounded-lg border border-ink-200 px-2 py-1.5 text-xs outline-none focus:border-teal-400"
          >
            <option value="">Choose an opportunity…</option>
            {myOpportunities.map((o) => (
              <option key={o.id} value={o.id} disabled={alreadyInvited(o.id)}>
                {o.title}{alreadyInvited(o.id) ? " (already invited)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={sendInvite}
            disabled={!opportunityId || inviting}
            className="rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
          >
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4 text-sm text-ink-600">
        Skills marked <span className="font-semibold text-verified-600">Verified</span> come from the student's real project work, which a university
        reviewed and verified. WSL organizes the evidence; AI helps surface the relevant parts for that review. Skills still awaiting verification are hidden
        unless you choose to include them, and are labeled when you do. Open a project to see the exact work behind each skill — this is not a
        self-reported CV, and your feedback can never change what's verified.
      </div>

      <SkillRecordBody studentId={student.id} projectHref={(pid) => `/company/submissions/${pid}`} verifiedOnlyByDefault />
    </div>
  )
}
