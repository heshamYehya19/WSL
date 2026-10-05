import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { SkillChip } from "../ui/SkillChip"
import { StatusBadge } from "../ui/StatusBadge"
import { formatDate } from "../../lib/format"
import { challengeFor, isEvidenced, skillsForProject, studentProjects, studentSignals } from "../../lib/selectors"
import type { Project, SkillSignal } from "../../types"

interface SkillSummary {
  skill: string
  signal: SkillSignal
  projectId: string
  projects: number
}

function ShieldIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ContributionLine({ project, studentId, nameOf }: { project: Project; studentId: string; nameOf: (id: string) => string | undefined }) {
  const mine = project.members.find((m) => m.studentId === studentId)
  const others = project.members.filter((m) => m.studentId !== studentId)
  const owner = project.studentId === studentId ? undefined : (nameOf(project.studentId) ?? "a teammate")
  return (
    <div className="mt-0.5 space-y-0.5 text-xs text-ink-400">
      {mine && (
        <p>
          <span className="font-semibold text-ink-600">Your contribution:</span> {mine.roleNote}
        </p>
      )}
      <p>
        Team project{owner ? ` — owned by ${owner}` : ""}
        {others.length > 0 ? ` · ${others.map((m) => `${nameOf(m.studentId) ?? "a teammate"}: ${m.roleNote}`).join(" · ")}` : ""}
      </p>
    </div>
  )
}

/** The project-level answer to "who checked this?": the university that verified it, or that it is still pending. */
function VerificationLine({
  signals,
  getStaff,
  universityOf,
}: {
  signals: SkillSignal[]
  getStaff: (id: string) => { name: string; universityId: string } | undefined
  universityOf: (universityId: string) => string | undefined
}) {
  if (signals.length === 0) return null
  const verified = signals.filter((s) => s.status === "Verified")
  const reviewer = verified.length > 0 && verified[0].verifiedBy ? getStaff(verified[0].verifiedBy) : undefined
  return (
    <p className="mt-4 border-t border-ink-100 pt-3 text-xs">
      {verified.length > 0 ? (
        <span className="text-ink-500">
          <span className="font-semibold text-verified-600">✓ Verified by {(reviewer && universityOf(reviewer.universityId)) ?? "the university"}</span>
          {reviewer ? ` · Reviewed by ${reviewer.name}` : ""}
          {verified.length < signals.length ? ` · ${signals.length - verified.length} skill${signals.length - verified.length === 1 ? "" : "s"} still pending` : ""}
        </span>
      ) : (
        <span className="font-medium text-ink-400">Pending university verification</span>
      )}
    </p>
  )
}

function SkillCard({
  s,
  index,
  projectHref,
  getStaff,
  universityOf,
}: {
  s: SkillSummary
  index: number
  projectHref: (projectId: string) => string
  getStaff: (id: string) => { name: string; universityId: string } | undefined
  universityOf: (universityId: string) => string | undefined
}) {
  const verified = s.signal.status === "Verified"
  const verifier = s.signal.verifiedBy ? getStaff(s.signal.verifiedBy) : undefined
  const metCount = s.signal.criteria.filter((c) => c.met).length
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className={`animate-fade-in-up group rounded-2xl border bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5 ${
        verified ? "border-verified-500/40" : "border-ink-200"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink-900">
          {s.skill}
          {verified && <span className="ml-1 text-verified-600">✓</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
          <span>
            {s.projects} project{s.projects === 1 ? "" : "s"}
          </span>
          {metCount > 0 && (
            <>
              <span>·</span>
              <span>
                {metCount} concrete sign{metCount === 1 ? "" : "s"} in the work
              </span>
            </>
          )}
        </div>
      </div>
      {verified ? (
        <div className="mt-2.5 space-y-0.5 text-[11px] text-ink-500">
          <div className="inline-flex items-center gap-1 rounded-full bg-verified-100 px-2 py-0.5 text-[10px] font-semibold text-verified-600">
            <ShieldIcon className="h-3 w-3" />
            Verified by {(verifier && universityOf(verifier.universityId)) ?? "the university"}
          </div>
          {verifier && (
            <p className="pt-1">
              Reviewed by {verifier.name}
              {s.signal.verifiedAt ? ` · ${formatDate(s.signal.verifiedAt)}` : ""}
            </p>
          )}
          <Link to={projectHref(s.projectId)} className="inline-block pt-0.5 text-teal-600 hover:underline">
            View supporting evidence →
          </Link>
        </div>
      ) : (
        <div className="mt-2.5 space-y-1 text-[11px] text-ink-400">
          <div className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {s.signal.status === "Rejected" ? "Not verified" : "Awaiting university verification"}
          </div>
          <p>
            {s.signal.status === "Rejected"
              ? "A university reviewer looked at this and did not verify it."
              : s.signal.suggestedLevel === "Insufficient"
                ? "Not enough evidence yet — add more evidence and run the analysis again."
                : "Evidence identified; a university reviewer has not checked it yet."}
          </p>
        </div>
      )}
    </div>
  )
}

export function SkillRecordBody({
  studentId,
  projectHref,
  verifiedOnlyByDefault = false,
}: {
  studentId: string
  projectHref: (projectId: string) => string
  /** For companies: open on verified skills only, so an unverified skill is never mistaken for a verified one. */
  verifiedOnlyByDefault?: boolean
}) {
  const { projects, challenges, evidence, skillSignals, getOrg, getStaff, getStudent, getUniversity } = useStore()
  const universityOf = (id: string) => getUniversity(id)?.name
  const [filter, setFilter] = useState<"all" | "verified">(verifiedOnlyByDefault ? "verified" : "all")
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const mySignals = studentSignals(skillSignals, studentId).filter(isEvidenced)
  const myProjects = studentProjects(projects, studentId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const bySkill = new Map<string, SkillSummary>()
  for (const s of mySignals) {
    const cur = bySkill.get(s.skill)
    // Prefer a verified signal over any other; among equally-verified (or equally
    // unverified) signals, the strongest evidence confidence wins.
    const better = !cur || (s.status === "Verified" && cur.signal.status !== "Verified") || (s.status === cur.signal.status && s.evidenceConfidence > cur.signal.evidenceConfidence)
    if (better) bySkill.set(s.skill, { skill: s.skill, signal: s, projectId: s.projectId, projects: (cur?.projects ?? 0) + 1 })
    else if (cur) cur.projects += 1
  }
  const allSkills = [...bySkill.values()].sort((a, b) => Number(b.signal.status === "Verified") - Number(a.signal.status === "Verified") || a.skill.localeCompare(b.skill))
  const shownSkills = filter === "verified" ? allSkills.filter((s) => s.signal.status === "Verified") : allSkills
  const verifiedCount = allSkills.filter((s) => s.signal.status === "Verified").length

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-ink-500">
        Each skill below is tied to real project work. A skill counts as proven only once a university has verified it; AI helps organize the
        evidence for that review.
      </p>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">Demonstrated Skills</h3>
          {allSkills.length > 0 && (
            <div className="inline-flex rounded-full border border-ink-200 bg-surface p-1 text-xs font-semibold">
              {(
                (verifiedOnlyByDefault
                  ? [
                      ["verified", `Verified skills · ${verifiedCount}`],
                      ["all", `Include skills awaiting verification · ${allSkills.length - verifiedCount}`],
                    ]
                  : [
                      ["all", `All skills · ${allSkills.length}`],
                      ["verified", `Verified skills · ${verifiedCount}`],
                    ]) as readonly (readonly ["all" | "verified", string])[]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`rounded-full px-3 py-1 transition-all duration-200 ${filter === key ? "bg-night text-white shadow" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {allSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">
            No skills identified yet — submit evidence on a project and run the analysis.
          </p>
        ) : shownSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">
            No university-verified skills yet — they appear once a university verifies a skill.
          </p>
        ) : (
          <div key={filter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownSkills.map((s, i) => (
              <SkillCard key={s.skill} s={s} index={i} projectHref={projectHref} getStaff={getStaff} universityOf={universityOf} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h3 className="mb-5 text-lg font-semibold text-ink-900">Project Timeline</h3>
        <div className="relative space-y-6 pl-8">
          <div className="absolute top-2 bottom-2 left-[9px] w-0.5 rounded-full bg-gradient-to-b from-teal-400 via-ink-200 to-transparent" />
          {myProjects.map((p, idx) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const signals = skillsForProject(skillSignals, p.id).filter((s) => isEvidenced(s) && s.studentId === studentId && (filter === "all" || s.status === "Verified"))
            const myEv = evidence.filter((e) => e.projectId === p.id && e.studentId === studentId)
            const started = new Date(p.startedAt)
            const live = p.status === "In Progress" || p.status === "Evidence Under Review" || p.status === "Skills Pending Verification"
            const resolved = p.status === "Verified" || p.status === "Completed" || p.status === "Company Feedback Received"
            const done = p.tasks.filter((t) => t.done).length
            return (
              <div key={p.id} style={{ animationDelay: `${idx * 70}ms` }} className="animate-fade-in-up group relative">
                <span className="absolute top-5 -left-8 flex h-5 w-5 items-center justify-center">
                  {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/50 motion-reduce:animate-none" />}
                  <span
                    className={`relative h-3.5 w-3.5 rounded-full border-[3px] border-ink-50 transition-transform duration-200 group-hover:scale-125 ${
                      resolved ? "bg-verified-500" : "bg-teal-500"
                    }`}
                  />
                </span>

                <div className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 group-hover:border-teal-400/60 group-hover:shadow-lg group-hover:shadow-teal-500/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-xs font-bold text-teal-300">
                        {org?.logoInitials ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <Link to={projectHref(p.id)} className="font-semibold text-ink-900 transition-colors hover:text-teal-600">
                          {p.title}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {org?.name} · {challenge?.industry} · {started.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                        </p>
                        {p.members.length > 0 && <ContributionLine project={p} studentId={studentId} nameOf={(id) => getStudent(id)?.name} />}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  {p.tasks.length > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                          style={{ width: mounted ? `${(done / p.tasks.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-ink-400 tabular-nums">
                        {done}/{p.tasks.length} tasks
                      </span>
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Demonstrated skills</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {signals.length === 0 && <span className="text-xs text-ink-400">No skills identified yet.</span>}
                        {signals.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1"
                          >
                            <SkillChip skill={s.skill} state={s.status === "Verified" ? "verified" : "pending"} size="sm" />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">Evidence</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {myEv.length === 0 && <span className="text-xs text-ink-400">No evidence submitted yet.</span>}
                        {myEv.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-600 transition-colors hover:border-teal-400"
                          >
                            <span className="font-semibold text-ink-800">{e.type}</span>
                            <span className="text-ink-300">·</span>
                            <span className="max-w-[12rem] truncate">{e.title}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <VerificationLine signals={signals} getStaff={getStaff} universityOf={universityOf} />
                </div>
              </div>
            )
          })}
          {myProjects.length === 0 && <p className="text-sm text-ink-400">No projects yet.</p>}
        </div>
      </div>
    </div>
  )
}
