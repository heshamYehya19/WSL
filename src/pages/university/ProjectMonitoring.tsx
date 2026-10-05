import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { LifecycleStepper } from "../../components/ui/LifecycleStepper"
import { VerificationPill } from "../../components/ui/VerificationPill"
import { EvidenceFileLink } from "../../components/ui/EvidenceFileLink"
import { EvidenceSources } from "../../components/ui/EvidenceSources"
import { SignalReviewCard } from "../../components/university/SignalReviewCard"
import { challengeFor, evidenceBy, signalsBy, teamOf } from "../../lib/selectors"
import { MissingSkillCard } from "../../components/university/MissingSkillCard"
import { proofCounts, reviewItemFor, reviewItemReason } from "../../lib/proof"
import { evidenceTypeLabel } from "../../lib/evidenceTypes"
import { formatDate } from "../../lib/format"

export default function ProjectMonitoring() {
  const { id } = useParams()
  const { university } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addFeedback, confirmToCompany, reviewSignal, reviewSkill, removeTeammate, getOrg, getStudent, getProgram, getStaff, isUniversityStudent } = useStore()
  const [note, setNote] = useState("")
  const [confirmNote, setConfirmNote] = useState("")
  const [saving, setSaving] = useState(false)

  // Universities only monitor their own students' projects.
  const project = projects.find((p) => p.id === id && university && isUniversityStudent(p.studentId, university.id))
  if (!project || !university) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Project not found</h2>
        <Link to="/university/projects" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Student Projects</Link>
      </div>
    )
  }

  const org = getOrg(project.organizationId)
  const challenge = challengeFor(challenges, project)
  const requiredSkills = challenge?.requiredSkills ?? []
  const owner = getStudent(project.studentId)
  const mentor = owner ? getStaff(getProgram(owner.programId)?.coordinatorId ?? "") : undefined
  const team = teamOf(project)
  // The server decides whether the project can be confirmed (every student x every required skill has a current decision);
  // this page only shows what it says.
  const review = project.review
  const allResolved = review?.ready ?? false
  const openItems = review?.items.filter((i) => !i.resolved) ?? []
  const readyToConfirm = project.status === "Skills Pending Verification" || project.status === "Evidence Under Review" || project.status === "In Progress"
  const alreadyConfirmed = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    if (await addFeedback(project.id, note.trim())) setNote("")
    setSaving(false)
  }

  const handleConfirm = async () => {
    setSaving(true)
    if (await confirmToCompany(project.id, confirmNote.trim())) setConfirmNote("")
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/university/projects" className="text-sm text-ink-400 hover:text-teal-600">← Back to Student Projects</Link>
      <div className="mt-3 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {org?.name} · {challenge?.industry} · Started {formatDate(project.startedAt)}
            {team.length > 1 ? ` · Team of ${team.length}` : " · Worked individually"}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <LifecycleStepper status={project.status} className="mb-6 rounded-2xl border border-ink-200 bg-surface px-4 py-3" />

      <div className="mb-6 rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-3 text-xs text-ink-700">
        <p className="font-semibold text-ink-900">How to read this page</p>
        <p className="mt-1">
          The project is shared; the proof is individual. Each student below has their own contribution, their own evidence, and their own skills — built only
          from their evidence and decided one by one. AI analysis is supporting information. University verification is final.
        </p>
      </div>

      {team.length > 1 && (
        <nav aria-label="Jump to a student" className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-500">Review:</span>
          {team.map((m) => (
            <a key={m.studentId} href={`#student-${m.studentId}`} className="rounded-full border border-ink-200 bg-surface px-3 py-1 font-semibold text-ink-700 hover:border-teal-400 hover:text-teal-700">
              {getStudent(m.studentId)?.name}
            </a>
          ))}
        </nav>
      )}

      {team.map((member) => {
        const person = getStudent(member.studentId)
        const program = person ? getProgram(person.programId) : undefined
        const theirEvidence = evidenceBy(evidence, project.id, member.studentId)
        const theirSignals = signalsBy(skillSignals, project.id, member.studentId)
        const counts = proofCounts(requiredSkills, theirSignals)
        const statements = theirEvidence.filter((e) => e.type === "Contribution Statement")
        const work = theirEvidence.filter((e) => e.type !== "Contribution Statement")
        return (
          <section key={member.studentId} id={`student-${member.studentId}`} className="mb-10 scroll-mt-24" aria-label={`${person?.name ?? "Student"}'s evidence and skills`}>
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{person?.initials}</span>
                  <div>
                    <Link to={`/university/students/${member.studentId}`} className="text-base font-semibold text-ink-900 hover:text-teal-600">{person?.name}</Link>
                    <p className="text-xs text-ink-400">
                      {member.isOwner ? "Started the project" : "Teammate"} · {program?.name ?? person?.field} · {person?.year}
                      {person?.studentNumber ? ` · No. ${person.studentNumber}` : ""}
                    </p>
                    {person && person.universityId !== university.id && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-medium text-amber-700">Studies at another university — you cannot verify their work, so this project cannot be confirmed while they are on the team.</p>
                        {readyToConfirm && (
                          <button
                            type="button"
                            onClick={() => void removeTeammate(project.id, member.studentId)}
                            className="rounded-lg border border-danger-600/40 px-2.5 py-1 text-[11px] font-semibold text-danger-600 transition-colors hover:bg-danger-600/10"
                          >
                            Remove from team
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-ink-500">
                  {theirEvidence.length} evidence item{theirEvidence.length === 1 ? "" : "s"} · {counts.verified} verified ·{" "}
                  {review ? `${review.items.filter((i) => i.studentId === member.studentId && !i.resolved).length} of ${requiredSkills.length} skills still need a decision` : "review complete"}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">What {person?.name.split(" ")[0]} says they contributed</p>
                  <p className="mt-1 text-sm text-ink-800">
                    {member.roleNote || <span className="text-ink-400 italic">No contribution recorded yet — ask them to record it.</span>}
                  </p>
                  {statements.map((s) => (
                    <p key={s.id} className="mt-2 border-l-2 border-ink-200 pl-2.5 text-xs text-ink-600">
                      “{s.content}”
                      <span className="mt-0.5 block text-[11px] text-ink-400">{s.title} · the student's own account, not analyzed as work</span>
                    </p>
                  ))}
                  <p className="mt-2 text-[11px] text-ink-400">A claim to check against the evidence beside it — it isn't proof by itself.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Their evidence</p>
                  <div className="mt-1 space-y-2">
                    {work.length === 0 && <p className="text-sm text-ink-400">No work submitted yet.</p>}
                    {work.map((e) => (
                      <div key={e.id} className="rounded-lg border border-ink-100 p-2.5">
                        <p className="text-xs">
                          <span className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{evidenceTypeLabel(e.type)}</span>{" "}
                          <span className="font-medium text-ink-900">{e.title}</span>
                        </p>
                        {e.description && <p className="mt-0.5 text-[11px] text-ink-500">{e.description}</p>}
                        {e.link && <p className="mt-0.5 text-[11px] break-all text-ink-400">{e.link}</p>}
                        <EvidenceFileLink evidence={e} />
                        <EvidenceSources evidence={e} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-5 mb-1 font-semibold text-ink-900">{person?.name.split(" ")[0]}'s skills</h3>
            <p className="mb-3 text-xs text-ink-500">
              One card per required skill, and every one needs your decision before the project can be confirmed. Review each against {person?.name.split(" ")[0]}'s own evidence: verify it, ask for more evidence, or decline to verify it — or, where WSL found nothing, acknowledge that the evidence is insufficient.
            </p>
            <div className="space-y-3">
              {requiredSkills.map((skill) => {
                const s = theirSignals.find((sig) => sig.skill === skill)
                const item = reviewItemFor(review, member.studentId, skill)
                if (!s) {
                  return (
                    <MissingSkillCard
                      key={skill}
                      skill={skill}
                      firstName={person?.name.split(" ")[0] ?? "The student"}
                      hasEvidence={theirEvidence.some((e) => e.type !== "Contribution Statement")}
                      stale={item?.stale ?? false}
                      onDecide={(decision, reviewerNotes) => reviewSkill(project.id, member.studentId, skill, decision, { reviewerNotes })}
                    />
                  )
                }
                const card = (
                  <SignalReviewCard
                    key={s.id}
                    signal={s}
                    evidence={theirEvidence}
                    verifierName={s.verifiedBy ? getStaff(s.verifiedBy)?.name : undefined}
                    stale={item?.stale ?? false}
                    onReview={(decision, options) => reviewSignal(project.id, s.id, decision, options)}
                  />
                )
                // Nothing found: there is no evidence to read through, so keep it to one line until opened — it still needs a decision.
                if (s.suggestedLevel === "Insufficient" && s.status !== "Verified") {
                  return (
                    <details key={s.id} className="group rounded-2xl border border-ink-200 bg-surface">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 marker:content-none">
                        <span className="min-w-0">
                          <span className="font-semibold text-ink-900">{skill}</span>
                          <span className="ml-2 text-xs text-ink-500">No {skill} evidence in {person?.name.split(" ")[0]}'s submitted evidence.</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {item?.stale && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">New evidence</span>}
                          <VerificationPill status={s.status} insufficient />
                          <span className="text-[11px] font-semibold text-teal-600 group-open:hidden">Open</span>
                        </span>
                      </summary>
                      <div className="border-t border-ink-100 p-3">{card}</div>
                    </details>
                  )
                }
                return card
              })}
            </div>
          </section>
        )
      })}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div>
            <h3 className="mb-3 font-semibold text-ink-900">Feedback</h3>
            <div className="space-y-2">
              {project.feedback.map((f) => (
                <div key={f.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                    <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-700">{f.note}</p>
                </div>
              ))}
            </div>
            <form onSubmit={submitFeedback} className="mt-3 flex gap-2">
              <label htmlFor="mentor-feedback" className="sr-only">Feedback note</label>
              <input
                id="mentor-feedback"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mentor ? `Leave feedback as ${mentor.name}...` : "Leave feedback for the team..."}
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
              />
              <button type="submit" disabled={saving || !note.trim()} className="rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40">Send</button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            {readyToConfirm && (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-50 p-5">
                <h3 className="mb-2 font-semibold text-ink-900">Confirm to Company</h3>
                <p className="mb-3 text-xs text-ink-600">
                  {allResolved
                    ? `Every student has a current decision on every required skill. Confirming approves the verified proof for ${org?.name} to see — it does not change any verification. Only verified skills are shared.`
                    : `Every student needs a current decision on every required skill — verified, not verified, or insufficient evidence acknowledged — before you can confirm. ${openItems.length} of ${review?.items.length ?? 0} still need one.`}
                </p>
                {!allResolved && (
                  <ul className="mb-3 space-y-1 text-[11px] text-ink-600">
                    {(review?.problems ?? []).map((problem) => (
                      <li key={problem} className="font-medium text-danger-600">{problem}</li>
                    ))}
                    {openItems.slice(0, 6).map((i) => (
                      <li key={`${i.studentId}-${i.skill}`}>
                        <a href={`#student-${i.studentId}`} className="font-semibold text-teal-700 hover:underline">{getStudent(i.studentId)?.name.split(" ")[0]} · {i.skill}</a>
                        {" — "}{reviewItemReason(i)}
                      </li>
                    ))}
                    {openItems.length > 6 && <li className="text-ink-400">and {openItems.length - 6} more</li>}
                  </ul>
                )}
                <label htmlFor="confirm-note" className="sr-only">Optional note</label>
                <input
                  id="confirm-note"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Optional note..."
                  disabled={!allResolved}
                  className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400 disabled:opacity-50"
                />
                <button
                  onClick={handleConfirm}
                  disabled={saving || !allResolved}
                  className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {saving ? "Confirming…" : "Confirm to Company"}
                </button>
                {mentor && <p className="mt-2 text-xs text-ink-500">Signed by {mentor.name}, {mentor.title}.</p>}
              </div>
            )}

            {alreadyConfirmed && (
              <div className="rounded-2xl border border-verified-500/30 bg-verified-100 p-5">
                <p className="text-sm font-semibold text-verified-600">✓ Confirmed to {org?.name}</p>
                <p className="mt-1 text-xs text-ink-600">
                  {project.status === "Company Feedback Received" ? "The company has since left feedback on this submission." : "Waiting on the company to review it."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
