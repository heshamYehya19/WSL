import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import type { TalentCandidate } from "../../types"

type Loaded = { id: string; candidate: TalentCandidate | null }

/** A student's Verified Proof Profile: only skills a university has verified right now, and the work behind them. */
export default function CandidateProfile() {
  const { id } = useParams()
  const { getStudent, getCandidate, companyActions, opportunities, toggleSavedStudent, toggleInterested, inviteStudent } = useStore()
  const { company } = useDemoUser()
  const [opportunityId, setOpportunityId] = useState("")
  const [inviting, setInviting] = useState(false)
  // The server says whether this student has proof a company may see — a 404 is "not discoverable", not "unknown".
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!id) return
    let current = true
    getCandidate(id).then(
      (candidate) => current && setLoaded({ id, candidate }),
      () => current && setLoaded({ id, candidate: null }),
    )
    return () => {
      current = false
    }
  }, [id, getCandidate])

  const candidate = loaded && loaded.id === id ? loaded.candidate : undefined
  if (!id || candidate === null) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">No verified proof to show</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">This student has no skill that a university has currently verified, so there is nothing to show you.</p>
        <Link to="/company/talent" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Talent Discovery</Link>
      </div>
    )
  }
  if (candidate === undefined) return <p className="py-20 text-center text-sm text-ink-400">Loading verified proof…</p>

  // Profile information the student chose to share; it is not evidence for any skill.
  const profile = getStudent(candidate.studentId)
  const saved = companyActions.some((a) => a.studentId === candidate.studentId && a.kind === "saved")
  const interested = companyActions.some((a) => a.studentId === candidate.studentId && a.kind === "interested")
  const myOpportunities = company ? opportunities.filter((o) => o.organizationId === company.id) : []
  const alreadyInvited = (oppId: string) => companyActions.some((a) => a.studentId === candidate.studentId && a.kind === "invited" && a.opportunityId === oppId)

  const sendInvite = async () => {
    if (!opportunityId) return
    setInviting(true)
    if (await inviteStudent(candidate.studentId, opportunityId, "")) setOpportunityId("")
    setInviting(false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/company/talent" className="text-sm text-ink-400 hover:text-teal-600">← Back to Talent Discovery</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow={candidate.university}
          title={candidate.name}
          subtitle={[candidate.program, candidate.year, profile?.gpa !== undefined ? `GPA ${profile.gpa.toFixed(2)}` : "", profile?.availability ?? ""].filter(Boolean).join(" · ")}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleSavedStudent(candidate.studentId)}
            aria-pressed={saved}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${saved ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => toggleInterested(candidate.studentId)}
            aria-pressed={interested}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${interested ? "border-teal-500 bg-teal-500 text-ink-950" : "border-ink-200 text-ink-500 hover:border-teal-400"}`}
          >
            {interested ? "✓ Interested" : "Express Interest"}
          </button>
        </div>
      </div>

      {profile?.bio && (
        <div className="mb-6 max-w-2xl">
          <p className="text-sm leading-relaxed text-ink-600">{profile.bio}</p>
          <p className="mt-1 text-[11px] text-ink-400">Profile information written by the student. It is not evidence for any skill below.</p>
        </div>
      )}

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
        This is a <span className="font-semibold text-ink-800">Verified Proof Profile</span>: it lists only skills a university has verified from the student's real
        project work, and nothing else. WSL organizes the evidence and AI helps surface the relevant parts for that review; the university makes the decision.
        Open a project to see the exact work behind each skill. The contribution shown is the student's own account — the verified evidence is the proof, and
        your feedback can never change what's verified.
      </div>

      <SkillRecordBody studentId={candidate.studentId} projectHref={(pid) => `/company/submissions/${pid}`} verifiedOnly />
    </div>
  )
}
