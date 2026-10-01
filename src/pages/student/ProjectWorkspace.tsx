import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { EmptyState } from "../../components/ui/EmptyState"
import { challengeFor, projectEvidence, skillsForProject } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import type { EvidenceType } from "../../types"

const EVIDENCE_TYPES: EvidenceType[] = [
  "Project Report",
  "GitHub Repository",
  "Code",
  "Presentation",
  "Prototype",
  "Documentation",
  "Analysis",
  "Dataset / Model",
  "Video Walkthrough",
]

const TABS = ["Overview", "Evidence & AI Rating", "Feedback"] as const

export default function ProjectWorkspace() {
  const { id } = useParams()
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addEvidence, runAIReview, toggleTask, getOrg } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview")
  const [analyzing, setAnalyzing] = useState(false)
  const [form, setForm] = useState({ type: "Project Report" as EvidenceType, title: "", description: "", link: "" })
  const [submitting, setSubmitting] = useState(false)

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

  // Once the university confirms the submission it is locked — evidence and tasks become read-only.
  const locked = project.status === "Confirmed to Company" || project.status === "Company Reviewed"

  const submitEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.link.trim()) return
    setSubmitting(true)
    const ok = await addEvidence(project.id, { type: form.type, title: form.title.trim(), description: form.description.trim(), link: form.link.trim() })
    setSubmitting(false)
    if (ok) setForm({ type: "Project Report", title: "", description: "", link: "" })
  }

  const handleAnalyze = () => {
    setAnalyzing(true)
    // A short pause so the simulated review reads as work being done.
    setTimeout(async () => {
      await runAIReview(project.id)
      setAnalyzing(false)
    }, 1400)
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
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Problem</h3>
              <p className="text-sm leading-relaxed text-ink-700">{challenge?.problemDescription}</p>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Objectives</h3>
              <ul className="space-y-1.5">
                {challenge?.objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-sm text-ink-700"><span className="text-teal-600">•</span>{o}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
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
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Progress</h3>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-500">{doneTasks} of {project.tasks.length} tasks complete</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-400">Started</dt><dd className="text-ink-800">{formatDate(project.startedAt)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Evidence</dt><dd className="text-ink-800">{myEvidence.length} items</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Skills rated</dt><dd className="text-ink-800">{mySignals.length}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Working Solo</h3>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{student.initials}</span>
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

      {tab === "Evidence & AI Rating" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-3 font-semibold text-ink-900">Submit Evidence</h3>
              {locked ? (
                <p className="text-sm text-ink-400">Your university confirmed this submission to the company, so its evidence is now locked.</p>
              ) : (
              <form onSubmit={submitEvidence} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Evidence type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EvidenceType }))}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  >
                    {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Demand Forecasting Model — GitHub Repo"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="What does this evidence show?"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-500">Link (repo, doc, deck...) — required</label>
                  <input
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="github.com/you/project"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  />
                </div>
                <button type="submit" disabled={submitting || !form.title.trim() || !form.link.trim()} className="w-full rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40">
                  {submitting ? "Saving…" : "Add Evidence"}
                </button>
              </form>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {myEvidence.map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-200 bg-white p-4">
                  <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                  <p className="text-xs text-ink-500">{e.description}</p>
                  <p className="mt-1 text-xs text-teal-600">{e.link}</p>
                  <p className="mt-2 text-[11px] text-ink-400">Submitted {formatRelative(e.submittedAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-ink-200 bg-ink-950 p-5">
              <h3 className="font-semibold text-white">WSL AI Rating</h3>
              <p className="mt-1 text-xs text-ink-300">
                Rates each required skill based on your submitted evidence. It's automatic and informational only: it never
                blocks or gates your submission.
              </p>
              {myEvidence.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">Submit evidence first, then request a rating.</p>
              ) : mySignals.length > 0 ? (
                <p className="mt-4 text-sm text-teal-300">Rating complete — see the results below.</p>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="mt-4 w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-teal-400 disabled:opacity-60"
                >
                  {analyzing ? "Rating your evidence…" : "Rate My Evidence with AI"}
                </button>
              )}
            </div>

            {mySignals.length > 0 && (
              <div className="mt-4 space-y-3">
                {mySignals.map((s) => (
                  <div key={s.id} className="rounded-xl border border-ink-200 bg-white p-4">
                    <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                    <div className="mt-2"><ConfidenceMeter value={s.aiRating} label="AI rating" /></div>
                    {s.companyRating !== undefined ? (
                      <div className="mt-2"><ConfidenceMeter value={s.companyRating} label="Company rating" /></div>
                    ) : (
                      <p className="mt-2 text-xs text-ink-400">Company rating not given yet.</p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-ink-400">
                  This AI rating is yours to see right away — it doesn't gate anything. Your university separately reviews your
                  full submission before sharing it with the company, who may add their own rating afterward.
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
              <div key={f.id} className="rounded-2xl border border-ink-200 bg-white p-5">
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
