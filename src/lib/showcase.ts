import { useStore } from "../state/store"
import { bestRating } from "./selectors"
import type { ChallengeStatus } from "../types"

const SHOWCASE_ORDER: ChallengeStatus[] = ["Company Reviewed", "Confirmed to Company", "Submissions Under Review"]

/**
 * A real submission from the database to illustrate the public pages: the most recent
 * company-reviewed project, else the most recent confirmed one, else one under review.
 */
export function useShowcase() {
  const { projects, skillSignals, getOrg, getStudent, getUniversity, getProgram } = useStore()

  for (const status of SHOWCASE_ORDER) {
    const project = projects
      .filter((p) => p.status === status && skillSignals.some((s) => s.projectId === p.id))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
    if (!project) continue
    const student = getStudent(project.studentId)
    const signals = skillSignals.filter((s) => s.projectId === project.id).sort((a, b) => bestRating(b) - bestRating(a))
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
    activeChallenges: challenges.filter((c) => ["University Assigned", "In Progress", "Submissions Under Review"].includes(c.status)).length,
    projects: projects.length,
    evidence: evidence.length,
    skillsRated: skillSignals.length,
  }
}
