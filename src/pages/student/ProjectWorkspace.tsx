import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { LifecycleStepper } from "../../components/ui/LifecycleStepper"
import { TeamPanel } from "../../components/project/TeamPanel"
import { EvidenceForm } from "../../components/project/EvidenceForm"
import { challengeFor, contributionOf, evidenceBy, isEvidenced, isOnTeam, signalsBy } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import { EvidenceQuotes } from "../../components/ui/EvidenceQuotes"
import { CriteriaChecklist } from "../../components/ui/CriteriaChecklist"
import { evidenceSources, hasReadableContent, studentNote } from "../../lib/aiNote"
import { EvidenceSources } from "../../components/ui/EvidenceSources"
import { VerificationPill } from "../../components/ui/VerificationPill"
import { EvidenceFileLink } from "../../components/ui/EvidenceFileLink"
import { parseGoogleDocLink } from "../../lib/googleDocs"
import { evidenceTypeLabel, NOT_ANALYZED_TYPES } from "../../lib/evidenceTypes"
import { PROOF_STATE_LABEL, PROOF_STATE_MEANING, STALE_STUDENT_NOTICE, reviewItemFor, skillProofState } from "../../lib/proof"

const TABS = ["Overview", "Evidence & Analysis", "Feedback"] as const

export default function ProjectWorkspace() {
  const { id } = useParams()
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, rereadEvidence, runAIReview, toggleTask, getOrg, getStaff, getUniversity } = useStore()
  const [searchParams] = useSearchParams()
  // ?tab=evidence opens straight on the evidence (the guided tour links there).
  const [tab, setTab] = useState<(typeof TABS)[number]>(searchParams.get("tab") === "evidence" ? "Evidence & Analysis" : "Overview")
  const [analyzing, setAnalyzing] = useState(false)
  const [rereading, setRereading] = useState<string | null>(null)

  // Students open the projects they're on — as the owner or as a teammate.
  const project = projects.find((p) => p.id === id && student && isOnTeam(p, student.id))
  if (!project || !student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Project not found</h2>
        <Link to="/student/projects" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to My Projects</Link>
      </div>
    )
  }

  const org = getOrg(project.organizationId)
  const challenge = challengeFor(challenges, project)
  const requiredSkills = challenge?.requiredSkills ?? []
  // Everything below is about this student: their own evidence, and the skills built from it.
  const myEvidence = evidenceBy(evidence, project.id, student.id)
  const mySignals = signalsBy(skillSignals, project.id, student.id)
  // Teammates' evidence is private to them and the university: the API sends this student only a count.
  const teammatesEvidenceCount = project.evidenceCounts.filter((c) => c.studentId !== student.id).reduce((sum, c) => sum + c.count, 0)
  const isTeam = project.members.length > 0
  const doneTasks = project.tasks.filter((t) => t.done).length
  const progressPct = project.tasks.length ? Math.round((doneTasks / project.tasks.length) * 100) : 0

  // Once the university confirms the evidence it is locked — evidence and tasks become read-only.
  const locked = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"
  // A reviewer's verification is durable — ai-review always skips an already-Verified
  // signal (server/api.ts), so once every required skill is Verified, re-analysis is a
  // guaranteed no-op even though the project itself isn't locked yet (confirm is still pending).
  const allSignalsVerified = mySignals.length > 0 && mySignals.every((s) => s.status === "Verified")
  // Retry is only for a real, temporary failure of the analysis. If WSL simply has nothing it can
  // read (a link it can't open, no excerpt), trying again can't help — the student needs to add content.
  const analyzable = myEvidence.filter((e) => !NOT_ANALYZED_TYPES.includes(e.type))
  const hasReadable = analyzable.some(hasReadableContent)
  // Evidence added after the last analysis just needs a new run; it isn't a failure. (Judged from
  // the signals' own timestamps: a run that fell back still stamps the signals it rewrote.)
  const lastAnalyzedAt = Math.max(0, ...mySignals.map((sig) => new Date(sig.analyzedAt).getTime()))
  const evidenceSinceAnalysis = analyzable.some((e) => new Date(e.submittedAt).getTime() > lastAnalyzedAt)
  // A completed run — even by the offline scorer, which is all WSL has without a provider — records itself
  // at the moment it stamped the signals. A run that failed doesn't, so signals newer than the record mean
  // the analysis really was unavailable.
  const myRun = project.analysis.find((a) => a.studentId === student.id)
  const completedRun = Boolean(myRun) && new Date(myRun!.gradedAt).getTime() >= lastAnalyzedAt - 1000
  const analysisUnavailable = hasReadable && !evidenceSinceAnalysis && !completedRun && mySignals.some((s) => s.gradedSource === "offline" && s.status !== "Verified")
  // Evidence added after the university's last decision on a skill means that decision no longer counts. If the
  // evidence is analyzable the student re-analyzes; otherwise (a video, a screenshot, a statement) the university just looks again.
  const staleNoticeFor = (skill: string) => {
    if (!reviewItemFor(project.review, student.id, skill)?.stale) return ""
    return evidenceSinceAnalysis ? STALE_STUDENT_NOTICE : "You added evidence since this was reviewed. Your university will look at it again."
  }

  const handleAnalyze = () => {
    setAnalyzing(true)
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1000))
    Promise.all([runAIReview(project.id), minDelay]).finally(() => setAnalyzing(false))
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/student/projects" className="text-sm text-ink-400 hover:text-teal-600">← Back to My Projects</Link>

      <div className="mt-3 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {org?.name} · {challenge?.industry}
            {challenge?.duration ? ` · ${challenge.duration}` : ""}
            {isTeam ? ` · Team of ${project.members.length + 1}` : ""}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <LifecycleStepper status={project.status} className="mb-6 rounded-2xl border border-ink-200 bg-surface px-4 py-3" />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-teal-500 text-ink-950" : "text-ink-400 hover:text-ink-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">The challenge</h3>
              <p className="text-sm leading-relaxed text-ink-700">{challenge?.problemDescription}</p>
              <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">What you're expected to build</h3>
              <ul className="space-y-1.5">
                {challenge?.objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-sm text-ink-700"><span className="text-teal-600">•</span>{o}</li>
                ))}
              </ul>
              {challenge?.expectedOutput && (
                <>
                  <h3 className="mt-4 mb-1.5 text-xs font-semibold tracking-wide text-teal-600 uppercase">Deliverables</h3>
                  <p className="text-sm leading-relaxed text-ink-700">{challenge.expectedOutput}</p>
                </>
              )}
              {(challenge?.duration || challenge?.constraints) && (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {challenge.duration && (
                    <div>
                      <dt className="text-xs font-semibold text-ink-500">Duration</dt>
                      <dd className="mt-0.5 text-sm text-ink-700">{challenge.duration}</dd>
                    </div>
                  )}
                  {challenge.constraints && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-ink-500">Constraints</dt>
                      <dd className="mt-0.5 text-sm text-ink-700">{challenge.constraints}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Required skills → what your evidence shows</h3>
              <p className="mb-3 text-xs text-ink-500">
                The challenge asks for these skills. That is not the same as having shown them: each is only as strong as the evidence you submit and
                what your university verifies.
              </p>
              <ul className="divide-y divide-ink-100">
                {requiredSkills.map((skill) => {
                  const signal = mySignals.find((s) => s.skill === skill)
                  const state = skillProofState(signal)
                  const waiting = !signal && myEvidence.length > 0
                  return (
                    <li key={skill} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{skill}</p>
                        <p className="text-[11px] text-ink-400">
                          {waiting
                            ? "You have evidence — run the analysis to see what it shows."
                            : !signal && myEvidence.length === 0
                              ? "You haven't submitted any evidence yet."
                              : PROOF_STATE_MEANING[state]}
                        </p>
                        {staleNoticeFor(skill) && <p className="mt-0.5 text-[11px] font-medium text-amber-700">{staleNoticeFor(skill)}</p>}
                      </div>
                      {waiting ? (
                        <span className="inline-flex rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-500">Not analyzed yet</span>
                      ) : (
                        <VerificationPill status={signal?.status ?? "Pending Verification"} insufficient={state === "insufficient" || state === "acknowledged"} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Tasks</h3>
              <ul className="space-y-2">
                {project.tasks.length === 0 && <p className="text-sm text-ink-400">No tasks recorded for this project.</p>}
                {project.tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => toggleTask(project.id, t.id, !t.done)}
                      className="flex w-full items-center gap-2.5 rounded-lg py-0.5 text-left text-sm enabled:hover:bg-ink-50 disabled:cursor-default"
                      aria-pressed={t.done}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${t.done ? "border-teal-500 bg-teal-500 text-white" : "border-ink-300"}`}>{t.done && "✓"}</span>
                      <span className={t.done ? "text-ink-700 line-through decoration-ink-300" : "text-ink-700"}>{t.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <TeamPanel project={project} challenge={challenge} me={student} locked={locked} />
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Progress</h3>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-500">{doneTasks} of {project.tasks.length} tasks complete</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-400">Started</dt><dd className="text-ink-800">{formatDate(project.startedAt)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Your evidence</dt><dd className="text-ink-800">{myEvidence.length} items</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Skills with evidence</dt><dd className="text-ink-800">{mySignals.filter(isEvidenced).length}</dd></div>
              </dl>
              {!contributionOf(project, student.id) && (
                <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-xs text-ink-800">Record what you contributed on the team card — your reviewer reads it next to your evidence.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "Evidence & Analysis" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 font-semibold text-ink-900">Submit Evidence</h3>
              {locked ? (
                <p className="text-sm text-ink-400">Your university confirmed this submission to the company, so its evidence is now locked.</p>
              ) : (
                <EvidenceForm projectId={project.id} />
              )}
            </div>

            <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Your evidence · {myEvidence.length}</h3>
            <div className="space-y-2">
              {myEvidence.length === 0 && <p className="rounded-xl border border-dashed border-ink-200 bg-surface p-4 text-sm text-ink-400">You haven't submitted any evidence on this project yet.</p>}
              {myEvidence.map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{evidenceTypeLabel(e.type)}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                  {e.link && <p className="mt-1 text-xs break-all text-teal-600">{e.link}</p>}
                  {e.description && <p className="mt-1 text-xs text-ink-500">{e.description}</p>}
                  <EvidenceFileLink evidence={e} />
                  {e.content && (
                    <pre className="mt-2 max-h-24 overflow-hidden rounded-lg whitespace-pre-wrap [overflow-wrap:anywhere] bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>
                  )}
                  <EvidenceSources evidence={e} />
                  {!locked && (e.type === "Documentation" || e.type === "Project Report") && !e.file && parseGoogleDocLink(e.link) && !e.analyzedFiles?.includes("Google Doc") && (
                    <div className="mt-2 rounded-lg bg-amber-100 px-2.5 py-2">
                      <p className="text-[11px] text-ink-800">
                        WSL couldn't read this Google Doc. It needs sharing set to <span className="font-semibold">“Anyone with the link” (Viewer)</span>. After
                        changing it, check again — or attach the document as a file instead.
                      </p>
                      <button
                        type="button"
                        disabled={rereading === e.id}
                        onClick={async () => {
                          setRereading(e.id)
                          await rereadEvidence(project.id, e.id)
                          setRereading(null)
                        }}
                        className="mt-1.5 rounded-md border border-amber-600/40 bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-800 hover:border-teal-400 disabled:opacity-50"
                      >
                        {rereading === e.id ? "Checking…" : "Check again"}
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-ink-400">Submitted {formatRelative(e.submittedAt)}</p>
                </div>
              ))}
            </div>
            {isTeam && (
              <p className="mt-3 text-[11px] text-ink-400">
                {teammatesEvidenceCount} item{teammatesEvidenceCount === 1 ? "" : "s"} from teammates {teammatesEvidenceCount === 1 ? "is" : "are"} on the team's record. Each student's skills are built only from their own evidence, and a teammate's evidence stays private to them and the university.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <div className="rounded-2xl border border-ink-200 bg-night p-5">
              <h3 className="font-semibold text-white">AI-assisted evidence analysis</h3>
              <p className="mt-1 text-xs text-ink-300">
                AI helps organize and surface the evidence relevant to each required skill, and what's still missing, for university
                review. It doesn't score you or verify anything — your university does — and it never blocks your submission.
              </p>
              {lastAnalyzedAt > 0 && <p className="mt-1.5 text-[11px] text-ink-400">Last analyzed {formatRelative(new Date(lastAnalyzedAt).toISOString())}</p>}
              {myEvidence.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">Submit your own evidence first, then run the analysis.</p>
              ) : locked ? (
                <p className="mt-4 text-sm text-teal-300">Evidence analyzed — see the results below.</p>
              ) : allSignalsVerified && !evidenceSinceAnalysis ? (
                <p className="mt-4 text-sm text-teal-300">
                  Every skill here has already been verified by your university — a verification is final, so re-analysis has
                  nothing left to update.
                </p>
              ) : (
                <>
                  {!hasReadable ? (
                    <p className="mt-4 text-sm text-ink-300">
                      {analyzable.length === 0
                        ? "Nothing you've submitted is work WSL can analyze yet. Add code, a notebook, a report or a repository — your university can still review everything you've kept."
                        : "Evidence submitted, but no readable content was available for automatic analysis. Add a representative excerpt or attach the file to have it analyzed. Your university can still review what you linked."}
                    </p>
                  ) : analysisUnavailable ? (
                    <p className="mt-4 text-sm text-amber-300">Analysis unavailable right now. What's shown below is a basic read of your evidence.</p>
                  ) : mySignals.length > 0 && evidenceSinceAnalysis ? (
                    <p className="mt-4 text-sm text-ink-300">You've added evidence since the last analysis. Re-analyze to include it.</p>
                  ) : mySignals.length > 0 ? (
                    <p className="mt-4 text-sm text-teal-300">Evidence analyzed. Add more evidence and re-analyze anytime before your university confirms it.</p>
                  ) : null}
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="mt-3 w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-teal-400 disabled:opacity-60"
                  >
                    {analyzing ? "Analyzing your evidence…" : analysisUnavailable ? "Retry" : mySignals.length > 0 ? "Re-analyze My Evidence" : "Analyze My Evidence"}
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Required by the challenge</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {requiredSkills.map((skill) => (
                    <span key={skill} className="rounded-lg border border-ink-200 bg-surface px-2 py-1 text-xs font-medium text-ink-700">{skill}</span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  This is what the challenge asks for, not what you've demonstrated. Each skill below shows only what <span className="font-semibold">your own</span> submitted
                  evidence actually shows.
                </p>
              </div>

              {requiredSkills.map((skill) => {
                const s = mySignals.find((sig) => sig.skill === skill)
                const state = skillProofState(s)
                const insufficient = state === "insufficient" || state === "acknowledged"
                const drewOn = s ? myEvidence.filter((e) => s.evidenceIds.includes(e.id)) : []
                // No signal yet: nothing has been analyzed, which is not the same as "analyzed and nothing found".
                if (!s) {
                  return (
                    <div key={skill} className="rounded-xl border border-ink-200 bg-surface p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">{skill}</span>
                        {myEvidence.length === 0 ? (
                          <VerificationPill status="Pending Verification" insufficient />
                        ) : (
                          <span className="inline-flex rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-500">Not analyzed yet</span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-ink-600">
                        {myEvidence.length === 0
                          ? `No ${skill} evidence has been submitted yet. Add relevant evidence if you want to demonstrate this skill.`
                          : "Run the analysis to see what your evidence shows for this skill."}
                      </p>
                    </div>
                  )
                }
                return (
                  <div key={s.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                      <VerificationPill status={s.status} insufficient={insufficient} />
                    </div>
                    {insufficient ? (
                      <p className="mt-2 text-xs text-ink-600">
                        No {s.skill} evidence was found in the submitted evidence. Add relevant evidence if you want to demonstrate this skill.
                      </p>
                    ) : (
                      <>
                        {s.criteria.length > 0 && (
                          <div className="mt-3">
                            <CriteriaChecklist criteria={s.criteria} part="demonstrates" />
                          </div>
                        )}
                        {s.aiQuotes.length > 0 && (
                          <div className="mt-2">
                            <EvidenceQuotes quotes={s.aiQuotes} evidenceTitle={(eid) => myEvidence.find((e) => e.id === eid)?.title} />
                          </div>
                        )}
                        {drewOn.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Evidence</p>
                            <ul className="mt-1 space-y-0.5">
                              {drewOn.map((e) => (
                                <li key={e.id} className="text-xs text-ink-700">
                                  {e.title}
                                  <span className="text-ink-400">
                                    {" "}· {evidenceTypeLabel(e.type)}
                                    {evidenceSources(e).some((src) => src.analyzed) ? ` · ${evidenceSources(e).filter((src) => src.analyzed).map((src) => src.label.toLowerCase()).join(", ")} analyzed` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.criteria.length > 0 && (
                          <div className="mt-3">
                            <CriteriaChecklist criteria={s.criteria} part="gaps" />
                          </div>
                        )}
                      </>
                    )}
                    {studentNote(s.aiNote) && <p className="mt-2 text-[11px] text-ink-400">{studentNote(s.aiNote)}</p>}
                    {s.status === "Verified" ? (
                      <p className="mt-2 text-xs font-semibold text-verified-600">
                        ✓ Verified by {getUniversity(getStaff(s.verifiedBy ?? "")?.universityId ?? "")?.name ?? "the university"}
                        {s.verifiedBy && getStaff(s.verifiedBy) ? <span className="font-normal text-ink-500"> · Reviewed by {getStaff(s.verifiedBy)!.name}</span> : null}
                      </p>
                    ) : s.status === "Rejected" ? (
                      <p className="mt-2 text-xs text-ink-600">
                        {PROOF_STATE_MEANING["not-verified"]} {s.reviewerNotes ? `Reviewer's note: ${s.reviewerNotes}` : ""}
                      </p>
                    ) : s.status === "More Evidence Requested" ? (
                      <p className="mt-2 text-xs text-amber-700">
                        {PROOF_STATE_LABEL["more-evidence"]}. {s.reviewerNotes ? `Reviewer's note: ${s.reviewerNotes}` : PROOF_STATE_MEANING["more-evidence"]}
                      </p>
                    ) : s.status === "Insufficient Evidence" ? (
                      <p className="mt-2 text-xs text-ink-600">
                        {PROOF_STATE_MEANING.acknowledged} Add relevant evidence and re-analyze if you want to change that.
                        {s.reviewerNotes ? ` Reviewer's note: ${s.reviewerNotes}` : ""}
                      </p>
                    ) : null}
                    {staleNoticeFor(skill) && <p className="mt-2 text-[11px] font-medium text-amber-700">{staleNoticeFor(skill)}</p>}
                  </div>
                )
              })}
              <p className="text-xs text-ink-400">
                This is the evidence WSL identified for each skill. It isn't a grade or a score, and it doesn't gate anything — a
                skill counts as proven only once your university verifies it.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "Feedback" && (
        <div className="space-y-3">
          {project.feedback.length === 0 ? (
            <EmptyState title="No feedback yet" description="Feedback from your university or the company will appear here." />
          ) : (
            project.feedback.map((f) => (
              <div key={f.id} className="rounded-2xl border border-ink-200 bg-surface p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">{f.author} <span className="font-normal text-ink-400">· {f.role}</span></p>
                  <p className="text-xs text-ink-400">{formatDate(f.at)}</p>
                </div>
                <p className="mt-2 text-sm text-ink-700">{f.note}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
