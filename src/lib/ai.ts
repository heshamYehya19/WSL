import type { Evidence, EvidenceType, SkillLevel } from "../types"

// Demo-only simulated AI evidence analysis. In a production WSL, this step would
// run a real model over submitted artifacts. Here we deterministically derive a
// plausible result from the challenge's required skills and the evidence actually
// submitted, so the analysis always feels grounded in what was uploaded.

const LEVEL_CYCLE: SkillLevel[] = ["Advanced", "Intermediate", "Advanced", "Foundational"]

const EVIDENCE_WEIGHT: Record<EvidenceType, number> = {
  "GitHub Repository": 6,
  "Code": 5,
  "Project Report": 4,
  "Documentation": 4,
  "Analysis": 4,
  "Dataset / Model": 4,
  "Presentation": 2,
  "Prototype / Demo": 5,
  "Video / Demo Link": 2,
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export interface SimulatedSignal {
  skill: string
  level: SkillLevel
  confidence: number
  evidenceIds: string[]
}

/**
 * Simulates AI evidence analysis for a set of required skills, given the
 * evidence actually submitted for a project. Confidence scales with how much
 * (and what kind of) evidence was submitted — never with an assumed skill level.
 */
export function simulateEvidenceAnalysis(requiredSkills: string[], submittedEvidence: Evidence[]): SimulatedSignal[] {
  if (submittedEvidence.length === 0) return []

  const baseWeight = submittedEvidence.reduce((sum, e) => sum + (EVIDENCE_WEIGHT[e.type] ?? 3), 0)
  const evidenceIds = submittedEvidence.map((e) => e.id)

  return requiredSkills.map((skill, idx) => {
    const seed = hashString(skill + submittedEvidence.length)
    const level = LEVEL_CYCLE[seed % LEVEL_CYCLE.length]
    const spread = seed % 5
    const confidence = Math.max(72, Math.min(96, 74 + baseWeight * 1.5 - idx * 2 + spread))
    return {
      skill,
      level,
      confidence: Math.round(confidence),
      evidenceIds,
    }
  })
}

export function confidenceDescription(confidence: number): string {
  if (confidence >= 90) return "Strongly supported by submitted evidence"
  if (confidence >= 80) return "Well supported by submitted evidence"
  return "Partially supported — additional evidence would strengthen this signal"
}
