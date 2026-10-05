import { useState } from "react"
import { useStore } from "../../state/store"
import { signalsBy, teamOf } from "../../lib/selectors"
import { proofCounts } from "../../lib/proof"
import type { Challenge, Project, Student } from "../../types"

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"

/**
 * The people on a project and what each says they contributed. A project is shared; proof is not:
 * every member's skills come only from their own evidence, and a statement here is a claim for the
 * reviewer to check, never proof by itself.
 */
export function TeamPanel({ project, challenge, me, locked }: { project: Project; challenge?: Challenge; me: Student; locked: boolean }) {
  const { students, projects, skillSignals, getStudent, addTeammate, removeTeammate, recordContribution } = useStore()
  const team = teamOf(project)
  const mine = team.find((m) => m.studentId === me.id)
  const iOwn = project.studentId === me.id
  const [draft, setDraft] = useState(mine?.roleNote ?? "")
  const [saving, setSaving] = useState(false)
  const [contributionError, setContributionError] = useState("")
  const [mateId, setMateId] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState("")

  // Classmates who could join: same university (one university verifies the whole team), and not already on a team for this challenge.
  const busy = new Set(
    projects.filter((p) => p.challengeId === project.challengeId).flatMap((p) => teamOf(p).map((m) => m.studentId)),
  )
  const classmates = students.filter((s) => s.universityId === me.universityId && !busy.has(s.id)).sort((a, b) => a.name.localeCompare(b.name))

  const saveContribution = async () => {
    setSaving(true)
    setContributionError("")
    await recordContribution(project.id, draft.trim(), (_field, message) => setContributionError(message))
    setSaving(false)
  }
  const add = async () => {
    if (!mateId) return
    setAdding(true)
    setAddError("")
    const ok = await addTeammate(project.id, mateId, (_field, message) => setAddError(message))
    setAdding(false)
    if (ok) setMateId("")
  }

  const requiredSkills = challenge?.requiredSkills ?? []
  const unchanged = draft.trim() === (mine?.roleNote ?? "")

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-5">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">{team.length > 1 ? `Team · ${team.length} students` : "Your project"}</h3>
      <p className="mb-3 text-xs text-ink-500">
        {team.length > 1
          ? "The project is shared. Your proof is not: your skills come only from your own evidence, reviewed on their own."
          : "Working with classmates? Add them below — each of you will record your own contribution and submit your own evidence."}
      </p>

      <ul className="space-y-3">
        {team.map((m) => {
          const person = getStudent(m.studentId)
          // A teammate's evidence and skills never reach this browser — only how many items they've submitted.
          const evidenceCount = project.evidenceCounts.find((c) => c.studentId === m.studentId)?.count ?? 0
          const isMe = m.studentId === me.id
          // Someone from another university (a team made before teams stayed within one university) can always be removed,
          // even with work on the project: no one here can verify them. Their work is kept on record.
          const elsewhere = !!person && person.universityId !== me.universityId
          const counts = proofCounts(requiredSkills, isMe ? signalsBy(skillSignals, project.id, m.studentId) : [])
          return (
            <li key={m.studentId} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night text-[11px] font-bold text-teal-300">{person?.initials ?? "?"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {person?.name ?? "A teammate"} {isMe && <span className="font-normal text-ink-400">(you)</span>}
                  </p>
                  <p className="text-[11px] text-ink-400">{m.isOwner ? "Started the project" : "Teammate"} · {person?.field}</p>
                  {elsewhere && <p className="text-[11px] font-medium text-amber-700">Studies at another university, so your university cannot verify their work. Remove them to confirm the project.</p>}
                </div>
                {!locked && iOwn && !m.isOwner && (evidenceCount === 0 || elsewhere) && (
                  <button type="button" onClick={() => void removeTeammate(project.id, m.studentId)} className="shrink-0 text-[11px] font-semibold text-ink-400 hover:text-danger-600">
                    Remove
                  </button>
                )}
                {!locked && isMe && !m.isOwner && (evidenceCount === 0 || elsewhere) && (
                  <button type="button" onClick={() => void removeTeammate(project.id, m.studentId)} className="shrink-0 text-[11px] font-semibold text-ink-400 hover:text-danger-600">
                    Leave
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-700">
                <span className="font-semibold text-ink-800">Contribution:</span>{" "}
                {m.roleNote ? m.roleNote : <span className="text-ink-400 italic">{isMe ? "You haven't recorded what you contributed yet." : "Hasn't recorded their contribution yet."}</span>}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">
                {evidenceCount} evidence item{evidenceCount === 1 ? "" : "s"}
                {isMe && counts.verified > 0 && ` · ${counts.verified} verified`}
                {isMe && counts.pending + counts["more-evidence"] > 0 && ` · ${counts.pending + counts["more-evidence"]} awaiting the university`}
              </p>
            </li>
          )
        })}
      </ul>

      {!locked && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <label htmlFor="my-contribution" className="mb-1 block text-xs font-semibold text-ink-700">What did you contribute?</label>
          <textarea
            id="my-contribution"
            rows={3}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setContributionError("")
            }}
            aria-invalid={Boolean(contributionError)}
            maxLength={400}
            placeholder="e.g. Database design, SQL analysis, and the data-processing pipeline."
            className={inputClass}
          />
          {contributionError && <p role="alert" className="mt-1 text-xs font-medium text-danger-600">{contributionError}</p>}
          <p className="mt-1 text-[11px] text-ink-400">In your own words. It isn't proof by itself — your reviewer checks it against the evidence you submit.</p>
          <button
            type="button"
            onClick={saveContribution}
            disabled={saving || unchanged || draft.trim().length === 0}
            className="mt-2 rounded-lg bg-night px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
          >
            {saving ? "Saving…" : mine?.roleNote ? "Update my contribution" : "Save my contribution"}
          </button>
        </div>
      )}

      {!locked && iOwn && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <label htmlFor="add-teammate" className="mb-1 block text-xs font-semibold text-ink-700">Add a classmate</label>
          {classmates.length === 0 ? (
            <p className="text-xs text-ink-400">No other students at your university are free to join this challenge.</p>
          ) : (
            <div className="flex gap-2">
              <select id="add-teammate" value={mateId} onChange={(e) => setMateId(e.target.value)} className={inputClass} aria-invalid={Boolean(addError)}>
                <option value="">Choose a classmate…</option>
                {classmates.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.field}</option>
                ))}
              </select>
              <button type="button" onClick={add} disabled={adding || !mateId} className="shrink-0 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-40">
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          )}
          {addError && <p role="alert" className="mt-1 text-xs font-medium text-danger-600">{addError}</p>}
          <p className="mt-1 text-[11px] text-ink-400">Teammates have to study at your university, so one university can verify the whole team's work.</p>
        </div>
      )}
    </div>
  )
}
