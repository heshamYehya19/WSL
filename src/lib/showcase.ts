import { useStore } from "../state/store"
import type { ChallengeStatus } from "../types"

const SHOWCASE_ORDER: ChallengeStatus[] = ["Company Feedback Received", "Verified", "Completed", "Skills Pending Verification"]

/**
 * A real submission from the database to illustrate the public pages: the most recent
 * project with company feedback, else the most recent verified/completed one, else one still being verified.
 */
export function useShowcase() {
  const { projects, skillSignals, getOrg, getStudent, getUniversity, getProgram } = useStore()

  for (const status of SHOWCASE_ORDER) {
    const project = projects
      .filter((p) => p.status === status && skillSignals.some((s) => s.projectId === p.id))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
    if (!project) continue
    const student = getStudent(project.studentId)
    const signals = skillSignals.filter((s) => s.projectId === project.id).sort((a, b) => (b.evidenceConfidence ?? 0) - (a.evidenceConfidence ?? 0))
    return {
      project,
      signals,
      org: getOrg(project.organizationId),
      student,
      university: student ? getUniversity(student.universityId) : undefined,
      program: student ? getProgram(student.programId) : undefined,
    }
  }
  return null
}

/** Platform-wide totals, counted from the database. */
export function usePlatformTotals() {
  const { challenges, projects, evidence, skillSignals, universities, students } = useStore()
  return {
    universities: universities.length,
    students: students.length,
    activeChallenges: challenges.filter((c) => ["University Assigned", "In Progress", "Evidence Under Review"].includes(c.status)).length,
    projects: projects.length,
    evidence: evidence.length,
    skillSignals: skillSignals.length,
  }
}
