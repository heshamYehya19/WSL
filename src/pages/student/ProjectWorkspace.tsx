import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { SkillChip } from "../../components/ui/SkillChip"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { EmptyState } from "../../components/ui/EmptyState"
import { challengeFor, contributorEvidence, getOrg, getStudent, projectEvidence, skillsForProject } from "../../lib/selectors"
import { formatDate, formatRelative } from "../../lib/format"
import type { EvidenceType } from "../../types"

const EVIDENCE_TYPES: EvidenceType[] = [
  "Project Report",
  "GitHub Repository",
  "Code",
  "Presentation",
  "Prototype / Demo",
  "Documentation",
  "Analysis",
  "Dataset / Model",
  "Video / Demo Link",
]

const TABS = ["Overview", "Evidence & AI Analysis", "Team", "Skills", "Feedback"] as const

export default function ProjectWorkspace() {
  const { id } = useParams()
  const { student } = useDemoUser()
  const { projects, challenges, evidence, skillSignals, addEvidence, runAIAnalysis } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview")
  const [analyzing, setAnalyzing] = useState(false)
  const [form, setForm] = useState({ type: "Project Report" as EvidenceType, title: "", description: "", link: "" })

  const project = projects.find((p) => p.id === id)
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
  const allProjectEvidence = projectEvidence(evidence, project.id)
  const myEvidence = contributorEvidence(evidence, project.id, student.id)
  const mySignals = skillsForProject(skillSignals, project.id).filter((s) => s.studentId === student.id)
  const doneTasks = project.tasks.filter((t) => t.done).length
  const progressPct = project.tasks.length ? Math.round((doneTasks / project.tasks.length) * 100) : 0

  const submitEvidence = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addEvidence(project.id, student.id, form.type, form.title.trim(), form.description.trim(), form.link.trim() || "link.demo/evidence")
    setForm({ type: "Project Report", title: "", description: "", link: "" })
  }

  const handleAnalyze = () => {
    setAnalyzing(true)
    setTimeout(() => {
      runAIAnalysis(project.id, student.id)
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
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${t.done ? "border-teal-500 bg-teal-500 text-white" : "border-ink-300 text-transparent"}`}>✓</span>
                    <span className={t.done ? "text-ink-700 line-through decoration-ink-300" : "text-ink-700"}>{t.title}</span>
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
                <div className="flex justify-between"><dt className="text-ink-400">Evidence</dt><dd className="text-ink-800">{allProjectEvidence.length} items</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Your skill signals</dt><dd className="text-ink-800">{mySignals.length}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">Team</h3>
              <div className="space-y-2">
                {project.teamStudentIds.map((sid) => {
                  const s = getStudent(sid)
                  return (
                    <div key={sid} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{s?.initials}</span>
                      <div>
                        <p className="text-sm font-medium text-ink-800">{s?.name}{sid === student.id ? " (You)" : ""}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Evidence & AI Analysis" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="mb-3 font-semibold text-ink-900">Submit Evidence</h3>
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
                  <label className="mb-1 block text-xs font-medium text-ink-500">Link (repo, doc, deck...)</label>
                  <input
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="github.com/you/project"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"
                  />
                </div>
                <button type="submit" className="w-full rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
                  Add Evidence
                </button>
              </form>
            </div>

            <div className="mt-4 space-y-2">
              {allProjectEvidence.map((e) => {
                const contributor = getStudent(e.contributorId)
                return (
                  <div key={e.id} className="rounded-xl border border-ink-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{e.type}</span>
                        <p className="mt-1.5 text-sm font-medium text-ink-900">{e.title}</p>
                        <p className="text-xs text-ink-500">{e.description}</p>
                        <p className="mt-1 text-xs text-teal-600">{e.link}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-400">
                      Submitted by {contributor?.name}{e.contributorId === student.id ? " (you)" : ""} · {formatRelative(e.submittedAt)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-ink-200 bg-ink-950 p-5">
              <h3 className="font-semibold text-white">AI Evidence Analysis</h3>
              <p className="mt-1 text-xs text-ink-300">
                Simulated demo AI — analyzes your submitted evidence and identifies evidence-backed skill signals. It does not certify proficiency.
              </p>
              {myEvidence.length === 0 ? (
                <p className="mt-4 text-sm text-ink-400">Submit evidence first, then run analysis.</p>
              ) : mySignals.length > 0 ? (
                <p className="mt-4 text-sm text-teal-300">Analysis complete — see results below, or in the Skills tab.</p>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="mt-4 w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-teal-400 disabled:opacity-60"
                >
                  {analyzing ? "Analyzing evidence…" : "Analyze Evidence with AI"}
                </button>
              )}
            </div>

            {mySignals.length > 0 && (
              <div className="mt-4 space-y-3">
                {mySignals.map((s) => (
                  <div key={s.id} className="rounded-xl border border-ink-200 bg-white p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink-900">{s.skill}</span>
                      <LevelBadge level={s.level} />
                    </div>
                    <ConfidenceMeter value={s.confidence} />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <StatusBadge status={s.status} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-400">
                  Evidence confidence indicates how strongly the submitted work supports the skill signal. It does not represent proficiency.
                  A human mentor still verifies each signal before it joins your profile.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Team" && (
        <div>
          <h3 className="mb-3 font-semibold text-ink-900">Individual Contribution</h3>
          <p className="mb-4 text-sm text-ink-500">Every team member's evidence and skills are tracked individually — not shared as one identical record.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.teamStudentIds.map((sid) => {
              const s = getStudent(sid)
              const contribSkills = project.individualContributions[sid] ?? []
              const evCount = contributorEvidence(evidence, project.id, sid).length
              return (
                <div key={sid} className="rounded-2xl border border-ink-200 bg-white p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-teal-300">{s?.initials}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{s?.name}{sid === student.id ? " (You)" : ""}</p>
                      <p className="text-xs text-ink-400">{s?.field}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {contribSkills.length === 0 ? (
                      <span className="text-xs text-ink-400">No contribution recorded yet.</span>
                    ) : (
                      contribSkills.map((sk) => <SkillChip key={sk} skill={sk} size="sm" />)
                    )}
                  </div>
                  <p className="mt-3 text-xs text-ink-400">{evCount} evidence item{evCount === 1 ? "" : "s"} submitted</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === "Skills" && (
        <div>
          {mySignals.length === 0 ? (
            <EmptyState title="No skill signals yet" description="Submit evidence and run AI analysis to generate skill signals for this project." />
          ) : (
            <div className="space-y-3">
              {mySignals.map((s) => (
                <div key={s.id} className="rounded-2xl border border-ink-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900">{s.skill}</span>
                      <LevelBadge level={s.level} />
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-3 max-w-sm"><ConfidenceMeter value={s.confidence} /></div>
                  {s.status === "Verified" && (
                    <p className="mt-3 text-xs text-verified-600">
                      ✓ Verified by {s.verifiedBy} on {formatDate(s.verifiedAt)}
                    </p>
                  )}
                  {s.reviewerNotes && <p className="mt-2 text-xs text-ink-500">“{s.reviewerNotes}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Feedback" && (
        <div className="space-y-3">
          {project.feedback.length === 0 ? (
            <EmptyState title="No feedback yet" description="Mentor feedback will appear here once your evidence has been reviewed." />
          ) : (
            project.feedback.map((f, i) => (
              <div key={i} className="rounded-2xl border border-ink-200 bg-white p-5">
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
