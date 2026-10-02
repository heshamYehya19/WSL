import type { Challenge, ChallengeStatus, Evidence, Project, SkillSignal, Student } from "../types"

// Pure helpers over data that came from the database. Entity lookups (getOrg,
// getStudent, ...) live on the store, since they need the loaded snapshot.

export function studentProjects(projects: Project[], studentId: string) {
  return projects.filter((p) => p.studentId === studentId)
}

export function studentSignals(signals: SkillSignal[], studentId: string) {
  return signals.filter((s) => s.studentId === studentId)
}

/** The best available rating for a signal — the company's own rating once given, otherwise WSL's automatic one. */
export function bestRating(signal: SkillSignal): number {
  return signal.companyRating ?? signal.aiRating
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

const PIPELINE: ChallengeStatus[] = [
  "Draft",
  "Sent to University",
  "University Assigned",
  "In Progress",
  "Submissions Under Review",
  "Confirmed to Company",
  "Company Reviewed",
]

/**
 * A challenge's status as one university sees it. An open challenge can be assigned by
 * several universities, so its global status (the company's view) says nothing about
 * whether this university has assigned it or how far its own students have got.
 */
export function statusAtUniversity(challenge: Challenge, universityId: string, projects: Project[], students: Student[]): ChallengeStatus {
  if (challenge.status === "Draft") return "Draft"
  if (!assignmentFor(challenge, universityId)) return "Sent to University"
  const ours = new Set(students.filter((s) => s.universityId === universityId).map((s) => s.id))
  let rank = PIPELINE.indexOf("University Assigned")
  for (const p of projects) {
    if (p.challengeId === challenge.id && ours.has(p.studentId)) rank = Math.max(rank, PIPELINE.indexOf(p.status))
  }
  return PIPELINE[rank]
}

/** Same rule the server enforces when a student starts a project: their own university must have assigned it. */
export function canStudentSee(challenge: Challenge, student: Student) {
  return assignmentFor(challenge, student.universityId) !== undefined
}

/** Universities shown for a challenge on company pages: who assigned it, else who it was sent to. */
export function challengeUniversityIds(challenge: Challenge): string[] {
  if (challenge.assignments.length > 0) return challenge.assignments.map((a) => a.universityId)
  return challenge.preferredUniversityId ? [challenge.preferredUniversityId] : []
}
