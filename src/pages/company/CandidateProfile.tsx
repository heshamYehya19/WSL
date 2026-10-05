import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { CriteriaChecklist } from "../../components/ui/CriteriaChecklist"
import { EvidenceFileLink } from "../../components/ui/EvidenceFileLink"
import { EvidenceQuotes } from "../../components/ui/EvidenceQuotes"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { evidenceTypeLabel } from "../../lib/evidenceTypes"
import { formatDate } from "../../lib/format"
import { proofByProject } from "../../lib/selectors"
import type { TalentCandidate } from "../../types"

type Loaded = { id: string; candidate: TalentCandidate | null }

/** A student's Verified Proof Profile: only skills a university has verified right now, and the work behind them. */
export default function CandidateProfile() {
  const { id } = useParams()
  const { getStudent, getCandidate, getOrg, projects, skillSignals, evidence, companyActions, opportunities, toggleSavedStudent, toggleInterested, inviteStudent } = useStore()
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
  const proof = proofByProject(candidate, projects, skillSignals, evidence)
  const profileFacts = [profile?.gpa !== undefined ? `GPA ${profile.gpa.toFixed(2)}` : "", profile?.availability ?? "", profile?.city ?? ""].filter(Boolean)
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
          subtitle={`${candidate.program} · ${candidate.year}`}
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

      {/* Profile information is what the student chose to share about themselves. It sits apart from the verified proof below. */}
      {(profileFacts.length > 0 || profile?.bio) && (
        <section aria-label="Profile information" className="mb-6 max-w-2xl rounded-xl border border-dashed border-ink-200 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Profile information · shared by the student, not evidence</p>
          {profileFacts.length > 0 && <p className="mt-1 text-sm text-ink-600">{profileFacts.join(" · ")}</p>}
          {profile?.bio && <p className="mt-1 text-sm leading-relaxed text-ink-600">{profile.bio}</p>}
        </section>
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

      <div className="mb-6 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4 text-sm text-ink-600">
        This is a <span className="font-semibold text-ink-800">Verified Proof Profile</span>. Each skill below was verified by a university from the student's real
        project work, and is traced <span className="font-semibold text-ink-800">skill → project → their contribution → supporting evidence → university verification</span>.
        The contribution is the student's own account of what they did; the evidence is the proof. There is no score, and nothing here is unverified.
      </div>

      <section aria-label="Verified skills" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Verified skills · {candidate.verifiedSkillCount}</h2>
        <ul className="flex flex-wrap gap-2">
          {proof
            .flatMap((g) => g.skills.map((k) => ({ ...k, projectTitle: g.projectTitle })))
            .sort((a, b) => (a.skill < b.skill ? -1 : 1))
            .map((k) => (
              <li key={`${k.skill}-${k.projectTitle}`} className="rounded-lg border border-verified-500/40 bg-surface px-3 py-2 text-xs">
                <span className="text-sm font-semibold text-ink-900">{k.skill}</span> <span className="font-bold text-verified-600">✓</span>
                <span className="mt-0.5 block text-ink-500">Verified by {k.verifyingUniversity} · {formatDate(k.verifiedAt)}</span>
              </li>
            ))}
          {candidate.otherVerifiedSkills.map((skill) => (
            <li key={skill} className="rounded-lg border border-verified-500/40 bg-surface px-3 py-2 text-xs">
              <span className="text-sm font-semibold text-ink-900">{skill}</span> <span className="font-bold text-verified-600">✓</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Verified proof by project">
        <h2 className="mb-1 text-lg font-semibold text-ink-900">Verified proof, project by project</h2>
        <p className="mb-4 text-xs text-ink-500">Where each skill was demonstrated, what the student says they personally did there, and the work that backs it.</p>
        <div className="space-y-5">
          {proof.map((g) => (
            <article key={g.projectId} className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="font-semibold text-ink-900">{g.projectTitle}</h3>
              <p className="text-xs text-ink-400">{[getOrg(g.organizationId ?? "")?.name, g.industry].filter(Boolean).join(" · ")}</p>
              <p className="mt-3 text-sm text-ink-700">
                <span className="font-semibold text-ink-800">Their contribution</span> <span className="text-xs text-ink-400">(their own words — a claim, not proof)</span>
                <span className="mt-0.5 block">{g.contribution || <span className="text-ink-400 italic">not recorded</span>}</span>
              </p>
              <div className="mt-4 space-y-3">
                {g.skills.map((k) => (
                  <div key={k.skill} className="rounded-xl border border-verified-500/30 p-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {k.skill} <span className="text-verified-600">✓</span>
                      <span className="ml-1.5 text-xs font-semibold text-verified-600">Verified by {k.verifyingUniversity}</span>
                      <span className="ml-1.5 text-xs font-normal text-ink-400">{formatDate(k.verifiedAt)}</span>
                    </p>
                    <p className="mt-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Supporting evidence</p>
                    {k.evidence.length === 0 ? (
                      <p className="text-xs text-ink-400">The evidence behind this skill is not available to show.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {k.evidence.map((e) => (
                          <li key={e.id} className="text-xs text-ink-700">
                            <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{evidenceTypeLabel(e.type)}</span> <span className="font-medium">{e.title}</span>
                            <EvidenceFileLink evidence={e} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {k.signal && (k.signal.criteria.some((c) => c.met) || k.signal.aiQuotes.length > 0) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-teal-600">What the evidence shows</summary>
                        <div className="mt-2 space-y-3">
                          <CriteriaChecklist criteria={k.signal.criteria} part="demonstrates" />
                          {k.signal.aiQuotes.length > 0 && (
                            <div>
                              <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Proof in the work</p>
                              <EvidenceQuotes quotes={k.signal.aiQuotes} evidenceTitle={(id) => k.evidence.find((e) => e.id === id)?.title} />
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
              <Link to={`/company/submissions/${g.projectId}`} className="mt-4 inline-block text-xs font-semibold text-teal-600 hover:underline">
                Open the full project proof →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
