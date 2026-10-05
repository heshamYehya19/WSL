import { useState } from "react"
import { EvidenceFileLink } from "../../components/ui/EvidenceFileLink"
import { Link, useParams } from "react-router-dom"
import { useStore } from "../../state/store"
import { useDemoUser } from "../../state/demoUser"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { challengeFor, companyProjectAccess, evidenceBy, signalsBy, skillsForProject, teamOf } from "../../lib/selectors"
import { evidenceTypeLabel } from "../../lib/evidenceTypes"
import { formatDate } from "../../lib/format"
import { EvidenceSources } from "../../components/ui/EvidenceSources"
import { EvidenceQuotes } from "../../components/ui/EvidenceQuotes"
import { CriteriaChecklist } from "../../components/ui/CriteriaChecklist"

const FEEDBACK_OPTIONS = [
  { key: "strongTechnicalExecution", label: "Strong technical execution" },
  { key: "relevantForInternship", label: "Relevant for internship consideration" },
  { key: "interestedInSpeaking", label: "Interested in speaking with this student" },
] as const

export default function CompanySubmission() {
  const { projectId } = useParams()
  const { company } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, submitCompanyFeedback, getStudent, getUniversity } = useStore()
  // A company opens a project of its own challenge, or any project whose verified proof it was sent through Talent Discovery.
  // What it can read there is only what the server sent it: verified skills and the evidence behind them.
  const access = companyProjectAccess(projects, skillSignals, projectId, company?.id)
  const project = access?.project
  const own = access?.own ?? false
  const signals = project ? skillsForProject(skillSignals, project.id) : []
  // Companies only see what a university verified, student by student; an unverified skill is never presented as proven.
  const [flags, setFlags] = useState<Record<(typeof FEEDBACK_OPTIONS)[number]["key"], boolean>>(() => ({
    strongTechnicalExecution: project?.companyFeedback?.strongTechnicalExecution ?? false,
    relevantForInternship: project?.companyFeedback?.relevantForInternship ?? false,
    interestedInSpeaking: project?.companyFeedback?.interestedInSpeaking ?? false,
  }))
  const [note, setNote] = useState(project?.companyFeedback?.note ?? "")
  const [saving, setSaving] = useState(false)

  if (!project) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">No verified proof to show</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">This project isn't one of yours, and no university has shared verified proof from it with you.</p>
        <Link to="/company/talent" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Talent Discovery</Link>
      </div>
    )
  }

  const student = getStudent(project.studentId)
  // Another company's project has no owner/university of its own for you: name the university that verified the work.
  const uni = student ? getUniversity(student.universityId) : getUniversity(project.universityId ?? signals.find((s) => s.verifiedByUniversityId)?.verifiedByUniversityId ?? "")
  const challenge = challengeFor(challenges, project)
  const projectEvidence = evidence.filter((e) => e.projectId === project.id)
  const canReview = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"
  const alreadyReviewed = project.status === "Company Feedback Received"
  // Feedback is for the company whose challenge it was; anyone else is only reading verified proof.
  const canGiveFeedback = own

  const submit = async () => {
    setSaving(true)
    await submitCompanyFeedback(project.id, { ...flags, note: note.trim() })
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/company/talent" className="text-sm text-ink-400 hover:text-teal-600">← Back to Talent Discovery</Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-400">
            {teamOf(project).map((m) => getStudent(m.studentId)?.name).filter(Boolean).join(", ")} · {uni?.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{challenge?.industry}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {!own && (
        <div className="mb-6 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          This project belongs to another company's challenge. You can read the skills a university verified here and the evidence behind them.
        </div>
      )}

      {!canReview ? (
        <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm text-ink-700">
          This evidence hasn't been confirmed by the university yet — it opens here once the university has verified it.
        </div>
      ) : (
      <div className="rounded-2xl border border-ink-200 bg-surface p-6">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Verified proof, student by student</h3>
        <p className="mb-4 text-xs text-ink-500">
          The project is shared; the proof is individual. Each section shows one student's own contribution and only the skills the university
          verified for them.
        </p>
        <div className="space-y-5">
          {teamOf(project).map((member) => {
            const person = getStudent(member.studentId)
            const theirEvidence = evidenceBy(projectEvidence, project.id, member.studentId)
            const theirSignals = signalsBy(signals, project.id, member.studentId)
            const theirVerified = theirSignals.filter((s) => s.status === "Verified")
            // The API only sends a company the verified skills and the evidence behind them — nothing else of a student's reaches here.
            const work = theirEvidence
            return (
              <section key={member.studentId} className="rounded-xl border border-ink-200 p-4" aria-label={`${person?.name ?? "Student"}'s verified proof`}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{person?.initials}</span>
                  <div className="min-w-0">
                    <Link to={`/company/talent/${member.studentId}`} className="text-sm font-semibold text-ink-900 hover:text-teal-600">{person?.name}</Link>
                    <p className="text-xs text-ink-400">{person?.field} · {person ? getUniversity(person.universityId)?.shortName : ""}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-700">
                  <span className="font-semibold text-ink-800">Contribution (their own words):</span>{" "}
                  {member.roleNote || <span className="text-ink-400 italic">{theirVerified.length === 0 ? "nothing shared — no skill of theirs was verified" : "not recorded"}</span>}
                </p>

                <h4 className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Evidence behind the verified skills</h4>
                <div className="space-y-2">
                  {work.map((e) => (
                    <div key={e.id} className="rounded-lg border border-ink-100 p-2.5">
                      <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{evidenceTypeLabel(e.type)}</span>{" "}
                      <span className="text-sm font-medium text-ink-800">{e.title}</span>
                      {e.description && <p className="mt-1 text-xs text-ink-500">{e.description}</p>}
                      {e.link && <p className="mt-1 text-xs break-all text-teal-600">{e.link}</p>}
                      <EvidenceFileLink evidence={e} />
                      {e.content && <pre className="mt-2 max-h-24 overflow-hidden rounded-lg whitespace-pre-wrap [overflow-wrap:anywhere] bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>}
                      <EvidenceSources evidence={e} />
                    </div>
                  ))}
                  {work.length === 0 && <p className="text-sm text-ink-400">No evidence has been verified for this student on this project.</p>}
                </div>

                <h4 className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Verified skills</h4>
                <div className="space-y-3">
                  {theirVerified.map((s) => (
                    <div key={s.id} className="rounded-lg border border-verified-500/30 p-3">
                      <span className="text-sm font-semibold text-ink-900">
                        {s.skill}
                        <span className="ml-1.5 text-xs font-semibold text-verified-600">✓ Verified by {getUniversity(s.verifiedByUniversityId ?? "")?.name ?? "the university"}</span>
                      </span>
                      {s.criteria.length > 0 && (
                        <div className="mt-3">
                          <CriteriaChecklist criteria={s.criteria} part="demonstrates" />
                        </div>
                      )}
                      {s.aiQuotes.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Proof in the work</p>
                          <EvidenceQuotes quotes={s.aiQuotes} evidenceTitle={(id) => projectEvidence.find((e) => e.id === id)?.title} />
                        </div>
                      )}
                      {s.evidenceIds.length > 0 && (
                        <p className="mt-2 text-[11px] text-ink-500">
                          <span className="font-semibold text-ink-600">Evidence:</span>{" "}
                          {s.evidenceIds.map((id) => projectEvidence.find((e) => e.id === id)?.title).filter(Boolean).join("; ")}
                        </p>
                      )}
                      {s.verifiedAt && <p className="mt-1.5 text-[11px] text-ink-400">Verified {formatDate(s.verifiedAt)}</p>}
                    </div>
                  ))}
                  {theirVerified.length === 0 && <p className="text-sm text-ink-400">No skills have been verified for {person?.name.split(" ")[0]} on this project.</p>}
                  {theirVerified.length > 0 && <p className="text-[11px] text-ink-400">Only skills the university verified are shared with you.</p>}
                </div>
              </section>
            )
          })}
        </div>

        {canGiveFeedback && (
        <>
        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">
          {alreadyReviewed ? "Your Feedback" : "Company Feedback"}
        </h3>
        <p className="mb-3 text-xs text-ink-500">
          Feedback is your own reaction to this evidence — it's separate from verification and can never change a skill's verified status.
        </p>
        <div className="space-y-2">
          {FEEDBACK_OPTIONS.map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={flags[opt.key]}
                onChange={(e) => setFlags((f) => ({ ...f, [opt.key]: e.target.checked }))}
                disabled={alreadyReviewed}
                className="h-4 w-4 accent-teal-500"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="company-feedback-note" className="mb-1 block text-xs font-medium text-ink-500">Feedback note (optional)</label>
          <textarea
            id="company-feedback-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={alreadyReviewed}
            placeholder="What stood out? What would you want to see more of?"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400 disabled:opacity-60"
          />
          {challenge && !alreadyReviewed && (
            <p className="mt-1 text-xs text-ink-400">Sent as {challenge.contactPerson}, {challenge.contactRole} — the contact on this challenge.</p>
          )}
        </div>

        {!alreadyReviewed && (
          <button onClick={submit} disabled={saving} className="mt-3 w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
            {saving ? "Saving…" : "Submit Feedback"}
          </button>
        )}

        {alreadyReviewed && project.companyFeedback && (
          <p className="mt-5 text-xs text-verified-600">
            ✓ You gave feedback on {formatDate(project.companyFeedback.submittedAt)}.
          </p>
        )}
        </>
        )}
      </div>
      )}

      {canReview && project.feedback.length > 0 && (
        <div className="mt-6 rounded-2xl border border-ink-200 bg-surface p-6">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Feedback Thread</h3>
          <div className="space-y-2">
            {project.feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                  <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                </div>
                <p className="mt-1.5 text-sm text-ink-700">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
