import { organizations, students, universities } from "../data/seed"
import type { Challenge, Evidence, Project, SkillSignal } from "../types"

export const getOrg = (id: string) => organizations.find((o) => o.id === id)
export const getUniversity = (id: string) => universities.find((u) => u.id === id)
export const getStudent = (id: string) => students.find((s) => s.id === id)

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

export function studentsOfUniversity(universityId: string) {
  return students.filter((s) => s.universityId === universityId)
}

export function isUniversityStudent(studentId: string, universityId: string) {
  return getStudent(studentId)?.universityId === universityId
}
