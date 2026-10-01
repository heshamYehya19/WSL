import type { Evidence, EvidenceType } from "../src/types.ts"

// Demo-only simulated AI review. In a production WSL this would run a real model
// over submitted artifacts; here we deterministically derive a plausible rating
// from the skills a challenge asks for and the evidence actually submitted, so
// results always feel grounded in what was uploaded. This review is automatic
// and informational only — it never blocks or gates anything in the workflow.

const EVIDENCE_WEIGHT: Record<EvidenceType, number> = {
  "GitHub Repository": 6,
  "Code": 5,
  "Project Report": 4,
  "Documentation": 4,
  "Analysis": 4,
  "Dataset / Model": 4,
  "Presentation": 2,
  "Prototype": 5,
  "Video Walkthrough": 2,
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export interface SimulatedRating {
  skill: string
  rating: number
  evidenceIds: string[]
}

/**
 * Simulates an automatic AI review: rates each required skill 0-100 based on how
 * much (and what kind of) evidence was submitted for it.
 */
export function simulateAIReview(requiredSkills: string[], submittedEvidence: Evidence[]): SimulatedRating[] {
  if (submittedEvidence.length === 0) return []

  const baseWeight = submittedEvidence.reduce((sum, e) => sum + (EVIDENCE_WEIGHT[e.type] ?? 3), 0)
  const evidenceIds = submittedEvidence.map((e) => e.id)

  return requiredSkills.map((skill, idx) => {
    const seed = hashString(skill + submittedEvidence.length)
    const spread = seed % 9
    const rating = Math.max(60, Math.min(97, 66 + baseWeight * 1.5 - idx * 2 + spread))
    return {
      skill,
      rating: Math.round(rating),
      evidenceIds,
    }
  })
}
