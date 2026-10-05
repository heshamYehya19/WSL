import { useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { challengeFor, isEvidenced, projectEvidence, skillsForProject } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import { EvidenceQuotes } from "../../components/ui/EvidenceQuotes"
import { CriteriaChecklist } from "../../components/ui/CriteriaChecklist"
import { evidenceSources, hasReadableContent, studentNote } from "../../lib/aiNote"
import { EvidenceSources } from "../../components/ui/EvidenceSources"
import { VerificationPill } from "../../components/ui/VerificationPill"
import { EvidenceFileLink } from "../../components/ui/EvidenceFileLink"
import { MAX_UPLOAD_BYTES, readAsBase64 } from "../../lib/files"
import { formatBytes } from "../../lib/format"

type SubmittableType = "GitHub Repository" | "Documentation"

const EVIDENCE_TYPES: SubmittableType[] = ["GitHub Repository", "Documentation"]

// A repository is a link to where the work lives. Documentation is a link (a shared Google Doc,
// say) or a file attached from the student's own computer — mirrors server/screening.ts.
const DOC_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md"]
const ACCEPT_DOCS = DOC_EXTENSIONS.join(",")

interface PickedFile {
  name: string
  size: number
  /** Base64 contents. */
  data: string
}

const TABS = ["Overview", "Evidence & Analysis", "Feedback"] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p role="alert" className="mt-1 text-xs font-medium text-danger-600">{message}</p>
}

export default function ProjectWorkspace() {
  const { id } = useParams()
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addEvidence, runAIReview, toggleTask, getOrg, getStaff, getUniversity } = useStore()
  const [searchParams] = useSearchParams()
  // ?tab=evidence opens straight on the evidence (the guided tour links there).
  const [tab, setTab] = useState<(typeof TABS)[number]>(searchParams.get("tab") === "evidence" ? "Evidence & Analysis" : "Overview")
  const [analyzing, setAnalyzing] = useState(false)
  const [form, setForm] = useState({ type: "GitHub Repository" as SubmittableType, title: "", link: "", excerpt: "" })
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  // A rejected submission's message, shown next to the field it's about (keyed as the server keys it).
  const [errors, setErrors] = useState<Record<string, string>>({})
  const editField = (key: "title" | "link" | "excerpt", value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    const serverKey = key === "excerpt" ? "content" : key
    setErrors((e) => (e[serverKey] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== serverKey)) : e))
  }
  const pickFile = async (file: File | undefined) => {
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    if (!DOC_EXTENSIONS.includes(ext)) return setErrors({ file: `“${file.name}” isn't a ${DOC_EXTENSIONS.join(", ")} file.` })
    if (file.size === 0) return setErrors({ file: `“${file.name}” is empty.` })
    if (file.size > MAX_UPLOAD_BYTES) return setErrors({ file: `“${file.name}” is larger than 10 MB.` })
    try {
      setPickedFile({ name: file.name, size: file.size, data: await readAsBase64(file) })
      setErrors({})
    } catch {
      setErrors({ file: `“${file.name}” couldn't be read. Choose it again.` })
    }
  }

  // Students only ever open their own project workspaces.
  const project = projects.find((p) => p.id === id && p.studentId === student?.id)
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
  const myEvidence = projectEvidence(evidence, project.id)
  const mySignals = skillsForProject(skillSignals, project.id)
  const doneTasks = project.tasks.filter((t) => t.done).length
  const progressPct = project.tasks.length ? Math.round((doneTasks / project.tasks.length) * 100) : 0

  // Once the university confirms the evidence it is locked — evidence and tasks become read-only.
  const locked = project.status === "Verified" || project.status === "Completed" || project.status === "Company Feedback Received"
  // A mentor's verification is durable — ai-review always skips an already-Verified
  // signal (server/api.ts), so once every required skill is Verified, re-analysis is a
  // guaranteed no-op even though the project itself isn't locked yet (confirm is still pending).
  const allSignalsVerified = mySignals.length > 0 && mySignals.every((s) => s.status === "Verified")
  // Retry is only for a real, temporary failure of the analysis. If WSL simply has nothing it can
  // read (a link it can't open, no excerpt), trying again can't help — the student needs to add content.
  const hasReadable = myEvidence.some(hasReadableContent)
  // Evidence added after the last analysis just needs a new run; it isn't a failure. (Judged from
  // the signals' own timestamps: a run that fell back still stamps the signals it rewrote.)
  const lastAnalyzedAt = Math.max(0, ...mySignals.map((sig) => new Date(sig.analyzedAt).getTime()))
  const evidenceSinceAnalysis = myEvidence.some((e) => new Date(e.submittedAt).getTime() > lastAnalyzedAt)
  const analysisUnavailable = hasReadable && !evidenceSinceAnalysis && mySignals.some((s) => s.gradedSource === "offline" && s.status !== "Verified")

  const isRepo = form.type === "GitHub Repository"
  const canSubmit = form.title.trim().length > 0 && (isRepo ? form.link.trim().length > 0 : form.link.trim().length > 0 || pickedFile !== null)

  const submitEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setErrors({})
    const ok = await addEvidence(
      project.id,
      {
        type: form.type,
        title: form.title.trim(),
        link: form.link.trim(),
        content: form.excerpt.trim(),
        ...(!isRepo && pickedFile ? { file: { name: pickedFile.name, data: pickedFile.data } } : {}),
      },
      (key, message) => setErrors({ [key]: message }),
    )
    setSubmitting(false)
    if (ok) {
      setForm({ type: "GitHub Repository", title: "", link: "", excerpt: "" })
      setPickedFile(null)
    }
  }

  const handleAnalyze = () => {
    setAnalyzing(true)
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1000))
    Promise.all([runAIReview(project.id), minDelay]).finally(() => setAnalyzing(false))
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/student/projects" className="text-sm text-ink-400 hover:text-teal-600">← Back to My Projects</Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{org?.name} · {challenge?.industry}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

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
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Problem</h3>
              <p className="text-sm leading-relaxed text-ink-700">{challenge?.problemDescription}</p>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Objectives</h3>
              <ul className="space-y-1.5">
                {challenge?.objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-sm text-ink-700"><span className="text-teal-600">•</span>{o}</li>
                ))}
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
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${t.done ? "border-teal-500 bg-teal-500 text-white" : "border-ink-300 text-transparent"}`}>✓</span>
                      <span className={t.done ? "text-ink-700 line-through decoration-ink-300" : "text-ink-700"}>{t.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Progress</h3>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-500">{doneTasks} of {project.tasks.length} tasks complete</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-400">Started</dt><dd className="text-ink-800">{formatDate(project.startedAt)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Evidence</dt><dd className="text-ink-800">{myEvidence.length} items</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Skills identified</dt><dd className="text-ink-800">{mySignals.filter(isEvidenced).length}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Working Solo</h3>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-bold text-teal-300">{student.initials}</span>
                <div>
                  <p className="text-sm font-medium text-ink-800">{student.name} (You)</p>
                  <p className="text-xs text-ink-400">{student.field}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-400">Every WSL project is worked individually — your submission is entirely your own.</p>
            </div>
          </div>
        </div>
      )}

      {tab === "Evidence & Analysis" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="rounded-2xl border border-ink-200 bg-surface p-5">
              <h3 className="mb-3 font-semibold text-ink-900">Submit Evidence</h3>
              {locked ? (
                <p className="text-sm text-ink-400">Your university confirmed this submission to the company, so its evidence is now locked.</p>
              ) : (
              <form onSubmit={submitEvidence} className="space-y-3">
                <div>
                  <label htmlFor="evidence-title" className="mb-1 block text-xs font-medium text-ink-500">Title</label>
                  <input
                    id="evidence-title"
                    value={form.title}
                    onChange={(e) => editField("title", e.target.value)}
                    aria-invalid={Boolean(errors.title)}
                    placeholder={isRepo ? "e.g. Demand Forecasting Model" : "e.g. Anomaly Detection Report"}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  />
                  <FieldError message={errors.title} />
                </div>
                <div>
                  <label htmlFor="evidence-type" className="mb-1 block text-xs font-medium text-ink-500">Evidence type</label>
                  <select
                    id="evidence-type"
                    value={form.type}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, type: e.target.value as SubmittableType, link: "", excerpt: "" }))
                      setPickedFile(null)
                      setErrors({})
                    }}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  >
                    {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError message={errors.type} />
                </div>

                {isRepo ? (
                  <div>
                    <label htmlFor="evidence-link" className="mb-1 block text-xs font-medium text-ink-500">Repository link — required</label>
                    <input
                      id="evidence-link"
                      value={form.link}
                      onChange={(e) => editField("link", e.target.value)}
                      aria-invalid={Boolean(errors.link)}
                      placeholder="github.com/you/project"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                    />
                    <FieldError message={errors.link} />
                    <p className="mt-1 text-[11px] text-ink-400">Public repositories are read automatically (README and main source files).</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="evidence-link" className="mb-1 block text-xs font-medium text-ink-500">Document link</label>
                      <input
                        id="evidence-link"
                        value={form.link}
                        onChange={(e) => editField("link", e.target.value)}
                        aria-invalid={Boolean(errors.link)}
                        placeholder="docs.google.com/document/…"
                        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                      />
                      <FieldError message={errors.link} />
                      <p className="mt-1 text-[11px] text-ink-400">
                        For a Google Doc, set sharing to “Anyone with the link can view” so WSL can read it.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                      <span className="h-px flex-1 bg-ink-100" />
                      or attach a file
                      <span className="h-px flex-1 bg-ink-100" />
                    </div>
                    <div>
                      <input
                        ref={fileInput}
                        type="file"
                        className="hidden"
                        accept={ACCEPT_DOCS}
                        aria-label="Attach a document"
                        onChange={(e) => {
                          void pickFile(e.target.files?.[0])
                          e.target.value = "" // so picking the same file again still fires onChange
                        }}
                      />
                      {pickedFile ? (
                        <div className="flex items-center gap-2.5 rounded-lg border border-teal-400/60 bg-teal-50 px-3 py-2">
                          <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-[10px] font-bold text-teal-700">
                            {pickedFile.name.slice(pickedFile.name.lastIndexOf(".") + 1).toUpperCase().slice(0, 4)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-800">{pickedFile.name}</p>
                            <p className="text-xs text-ink-400">{formatBytes(pickedFile.size)}</p>
                          </div>
                          <button type="button" onClick={() => setPickedFile(null)} className="shrink-0 text-xs font-semibold text-ink-500 hover:text-danger-600">
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="w-full rounded-lg border border-dashed border-ink-300 px-3 py-3 text-sm text-ink-500 hover:border-teal-400 hover:text-teal-700"
                        >
                          Choose a file from your computer
                          <span className="mt-0.5 block text-xs text-ink-400">{DOC_EXTENSIONS.join(", ")} · up to 10 MB</span>
                        </button>
                      )}
                      <FieldError message={errors.file} />
                    </div>
                  </div>
                )}

                {(isRepo || (form.link.trim() && !pickedFile)) && (
                  <div>
                    <label htmlFor="evidence-excerpt" className="mb-1 block text-xs font-medium text-ink-500">Representative excerpt (optional)</label>
                    <textarea
                      id="evidence-excerpt"
                      value={form.excerpt}
                      onChange={(e) => editField("excerpt", e.target.value)}
                      aria-invalid={Boolean(errors.content)}
                      rows={4}
                      placeholder="Paste a key section, snippet or summary if WSL can't open the link, so it can still be analyzed."
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-xs outline-none focus:border-teal-400"
                    />
                    <FieldError message={errors.content} />
                  </div>
                )}
                <button type="submit" disabled={submitting || !canSubmit} className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40">
                  {submitting ? "Saving…" : "Add Evidence"}
                </button>
              </form>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {myEvidence.map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-200 bg-surface p-4">
                  <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                  {e.link && <p className="mt-1 text-xs break-all text-teal-600">{e.link}</p>}
                  <EvidenceFileLink evidence={e} />
                  {e.content && <pre className="mt-2 max-h-24 overflow-hidden rounded-lg whitespace-pre-wrap [overflow-wrap:anywhere] bg-ink-50 px-2.5 py-2 font-mono text-[11px] text-ink-600">{e.content}</pre>}
                  <EvidenceSources evidence={e} />
                  <p className="mt-2 text-[11px] text-ink-400">Submitted {formatRelative(e.submittedAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-ink-200 bg-night p-5">
              <h3 className="font-semibold text-white">AI-assisted evidence analysis</h3>
              <p className="mt-1 text-xs text-ink-300">
                AI helps organize and surface the evidence relevant to each required skill, and what's still missing, for university
                review. It doesn't score you or verify anything — your university does — and it never blocks your submission.
              </p>
              {project.gradedAt && <p className="mt-1.5 text-[11px] text-ink-400">Last analyzed {formatRelative(project.gradedAt)}</p>}
              {myEvidence.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">Submit evidence first, then run the analysis.</p>
              ) : locked ? (
                <p className="mt-4 text-sm text-teal-300">Evidence analyzed — see the results below.</p>
              ) : allSignalsVerified ? (
                <p className="mt-4 text-sm text-teal-300">
                  Every skill here has already been verified by your university — a verification is final, so re-analysis has
                  nothing left to update.
                </p>
              ) : (
                <>
                  {!hasReadable ? (
                    <p className="mt-4 text-sm text-ink-300">
                      Evidence submitted, but no readable content was available for automatic analysis. Add a representative excerpt or attach the
                      file to have it analyzed. Your university can still review what you linked.
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

            {mySignals.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Required by the challenge</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(challenge?.requiredSkills ?? []).map((skill) => (
                      <span key={skill} className="rounded-lg border border-ink-200 bg-surface px-2 py-1 text-xs font-medium text-ink-700">{skill}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-ink-500">
                    This is what the challenge asks for, not what you've demonstrated. Each skill below shows only what your submitted
                    evidence actually shows.
                  </p>
                </div>
                {mySignals.map((s) => {
                  const insufficient = s.suggestedLevel === "Insufficient"
                  const drewOn = myEvidence.filter((e) => s.evidenceIds.includes(e.id))
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
                              <EvidenceQuotes quotes={s.aiQuotes} evidenceTitle={(id) => myEvidence.find((e) => e.id === id)?.title} />
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
                                      {" "}· {e.type}
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
                        <p className="mt-2 text-xs text-ink-600">{s.reviewerNotes ? `Reviewer's note: ${s.reviewerNotes}` : "The university did not verify this skill."}</p>
                      ) : s.status === "More Evidence Requested" ? (
                        <p className="mt-2 text-xs text-amber-700">{s.reviewerNotes ? `Reviewer's note: ${s.reviewerNotes}` : "Your university asked for more evidence."}</p>
                      ) : null}
                    </div>
                  )
                })}
                <p className="text-xs text-ink-400">
                  This is the evidence WSL identified for each skill. It isn't a grade or a score, and it doesn't gate anything — a
                  skill counts as proven only once your university verifies it.
                </p>
              </div>
            )}
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
