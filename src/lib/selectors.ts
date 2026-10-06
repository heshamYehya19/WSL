import type { Challenge, ChallengeStatus, Evidence, Project, SkillSignal, Student, TalentCandidate } from "../types.ts"
import { rank } from "./pipeline.ts"

// Pure helpers over data that came from the database. Entity lookups (getOrg,
// getStudent, ...) live on the store, since they need the loaded snapshot.

/** What a company may open at /company/submissions/:id: a project of its own challenge, or any project whose verified proof it was sent. */
export function companyProjectAccess(projects: Project[], signals: SkillSignal[], projectId: string | undefined, companyId: string | undefined) {
  const project = projects.find((p) => p.id === projectId)
  if (!project || !companyId) return undefined
  if (project.organizationId === companyId) return { project, own: true }
  // A company is only ever sent verified, current proof, so having any signal on a project means it was shared with them.
  return signals.some((s) => s.projectId === project.id) ? { project, own: false } : undefined
}

/** One verified skill of a candidate, with the evidence that backs it. */
export interface ProofSkill {
  skill: string
  verifiedAt: string
  verifyingUniversity: string
  /** WSL's grounded read of the work (met criteria, quoted lines) for this skill, when the company was sent it. */
  signal?: SkillSignal
  /** The student's own work the verification cites — the proof itself. */
  evidence: Evidence[]
}

/** The proof a candidate has on one project: where it was shown, what they say they did, and the skills it proves. */
export interface ProofProject {
  projectId: string
  projectTitle: string
  industry: string
  organizationId?: string
  /** What the student says they contributed — their own account, never proof. */
  contribution: string
  skills: ProofSkill[]
}

/**
 * A candidate's Verified Proof Profile: the server's own list of what is currently verified for them (`candidate.matched`,
 * the same eligibility Talent Discovery uses) grouped by the project that proves it, each skill joined to the evidence it
 * cites. Only that student's own evidence is ever attached, and nothing outside `matched` is ever listed.
 */
export function proofByProject(candidate: TalentCandidate, projects: Project[], signals: SkillSignal[], evidence: Evidence[]): ProofProject[] {
  const groups: ProofProject[] = []
  for (const m of candidate.matched) {
    const signal = signals.find((g) => g.studentId === candidate.studentId && g.projectId === m.projectId && g.skill === m.skill && g.status === "Verified")
    const proof: ProofSkill = {
      skill: m.skill,
      verifiedAt: m.verifiedAt,
      verifyingUniversity: m.verifyingUniversity,
      signal,
      evidence: signal ? evidence.filter((e) => signal.evidenceIds.includes(e.id) && e.studentId === candidate.studentId && e.projectId === m.projectId) : [],
    }
    const group = groups.find((x) => x.projectId === m.projectId)
    if (group) group.skills.push(proof)
    else
      groups.push({
        projectId: m.projectId,
        projectTitle: m.projectTitle,
        industry: m.industry,
        organizationId: projects.find((p) => p.id === m.projectId)?.organizationId,
        contribution: m.contribution,
        skills: [proof],
      })
  }
  // Most recently verified project first; skills in a stable order within it.
  const latest = (g: ProofProject) => g.skills.reduce((a, x) => (x.verifiedAt > a ? x.verifiedAt : a), "")
  for (const g of groups) g.skills.sort((a, b) => (a.skill < b.skill ? -1 : 1))
  return groups.sort((a, b) => (latest(a) < latest(b) ? 1 : latest(a) > latest(b) ? -1 : a.projectTitle < b.projectTitle ? -1 : 1))
}

/**
 * How many students are on a company's projects. A company is not told who a project's owner is unless they are
 * discoverable, so an owner it cannot identify counts as one student per project.
 */
export function engagedStudentCount(projects: Project[]) {
  return new Set(projects.filter((p) => p.studentId).map((p) => p.studentId)).size + projects.filter((p) => !p.studentId).length
}

export function studentProjects(projects: Project[], studentId: string) {
  return projects.filter((p) => p.studentId === studentId || p.members.some((m) => m.studentId === studentId))
}

/** The people on a project, owner first, each with what they say they contributed. */
export function teamOf(project: Project) {
  return [
    ...(project.studentId ? [{ studentId: project.studentId, roleNote: project.ownerRoleNote, isOwner: true }] : []),
    ...project.members.map((m) => ({ studentId: m.studentId, roleNote: m.roleNote, isOwner: false })),
  ]
}

/** What one student says they contributed to a project ("" if they haven't said). */
export function contributionOf(project: Project, studentId: string) {
  return teamOf(project).find((m) => m.studentId === studentId)?.roleNote ?? ""
}

export function isOnTeam(project: Project, studentId: string) {
  return teamOf(project).some((m) => m.studentId === studentId)
}

/** One student's signals on one project — never the whole team's. */
export function signalsBy(signals: SkillSignal[], projectId: string, studentId: string) {
  return signals.filter((s) => s.projectId === projectId && s.studentId === studentId)
}

/** The evidence one student authored on one project. */
export function evidenceBy(evidence: Evidence[], projectId: string, studentId: string) {
  return evidence.filter((e) => e.projectId === projectId && e.studentId === studentId)
}

export function studentSignals(signals: SkillSignal[], studentId: string) {
  return signals.filter((s) => s.studentId === studentId)
}

/**
 * A signal that actually points at evidence. An "Insufficient" signal means WSL found nothing
 * in the submitted evidence for that skill, so it must never count as something demonstrated —
 * a challenge requiring a skill is not evidence that the student has it.
 */
export function isEvidenced(signal: SkillSignal) {
  return signal.suggestedLevel !== "Insufficient" || signal.status === "Verified"
}

export function projectEvidence(evidence: Evidence[], projectId: string) {
  return evidence.filter((e) => e.projectId === projectId)
}

export function challengeFor(challenges: Challenge[], project: Project) {
  return challenges.find((c) => c.id === project.challengeId)
}

export function skillsForProject(signals: SkillSignal[], projectId: string) {
  return signals.filter((s) => s.projectId === projectId)
}

/** This university's assignment of a challenge, if it has assigned it. */
export function assignmentFor(challenge: Challenge, universityId: string | undefined) {
  return challenge.assignments.find((a) => a.universityId === universityId)
}

/** Whether a challenge was routed to this university (sent to it specifically, or open to all). */
export function isRoutedTo(challenge: Challenge, universityId: string) {
  return challenge.status !== "Draft" && (challenge.preferredUniversityId === null || challenge.preferredUniversityId === universityId)
}

/**
 * A challenge's status as one university sees it. An open challenge can be assigned by
 * several universities, so its global status (the company's view) says nothing about
 * whether this university has assigned it or how far its own students have got.
 */
export function statusAtUniversity(challenge: Challenge, universityId: string, projects: Project[], students: Student[]): ChallengeStatus {
  if (challenge.status === "Draft") return "Draft"
  if (!assignmentFor(challenge, universityId)) return "Sent to University"
  const ours = new Set(students.filter((s) => s.universityId === universityId).map((s) => s.id))
  // Tracks the actual furthest status reached (not just its rank), since "Verified" and
  // "Completed" share a rank but are distinct, equally-final statuses worth telling apart.
  let best: ChallengeStatus = "University Assigned"
  for (const p of projects) {
    if (p.challengeId === challenge.id && ((p.studentId !== undefined && ours.has(p.studentId)) || p.members.some((m) => ours.has(m.studentId))) && rank(p.status) > rank(best)) {
      best = p.status
    }
  }
  return best
}

/**
 * Same rule the server enforces when a student starts a project: their own university must have assigned the challenge to
 * THEIR program (not just to the university) — or they are already on a project team for it, which keeps their access.
 */
export function canStudentSee(challenge: Challenge, student: Student, projects: Project[] = []) {
  const mine = assignmentFor(challenge, student.universityId)
  if (mine !== undefined && mine.programId === student.programId) return true
  return projects.some((p) => p.challengeId === challenge.id && (p.studentId === student.id || p.members.some((m) => m.studentId === student.id)))
}

/** Universities shown for a challenge on company pages: who assigned it, else who it was sent to. */
export function challengeUniversityIds(challenge: Challenge): string[] {
  if (challenge.assignments.length > 0) return challenge.assignments.map((a) => a.universityId)
  return challenge.preferredUniversityId ? [challenge.preferredUniversityId] : []
}

/**
 * One plain sentence about demand, derived only from the counts: the (up to) three most requested skills, in the order the
 * server sorted them. No model writes it.
 */
export function demandSummary(skills: { skill: string }[]): string {
  const top = skills.slice(0, 3).map((s) => s.skill)
  if (top.length === 0) return "No company challenges have been sent to your university yet."
  const list = top.length === 1 ? top[0] : `${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}`
  return top.length === 1 ? `${list} is currently the most requested skill across company challenges.` : `${list} are currently among the most requested skills across company challenges.`
}
