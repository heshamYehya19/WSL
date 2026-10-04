import type { Evidence, SuggestedLevel } from "../types"

/** Splits an AI note (written as complete sentences, e.g. "Graded by Gemini against
 * this challenge. Fits an Isolation Forest...") into a "Why WSL found this" bullet
 * list for display, rather than one dense paragraph. */
export function splitAiNote(note: string): string[] {
  return note.split(/(?<=\.)\s+/).filter(Boolean)
}

// Same thresholds suggestedLevelFor uses server-side (server/ml/analyze.ts) and
// SkillLevels.tsx already mirrors for its own display — a third, consistent,
// display-only read of the same number, not a second source of truth.
export type EvidenceStrength = "Weak" | "Moderate" | "Strong"

/** How strongly the evidence supports an assessment — shown as the primary word,
 * with the percentage itself kept secondary (see AI Evidence Analysis copy). */
export function evidenceStrengthFor(confidence: number): EvidenceStrength {
  return confidence >= 60 ? "Strong" : confidence >= 35 ? "Moderate" : "Weak"
}

/** "AI assessment: Intermediate" / "Insufficient Evidence" — never presented as a verdict. */
export function assessmentLabel(level: SuggestedLevel): string {
  return level === "Insufficient" ? "Insufficient Evidence" : `AI assessment: ${level}`
}

/** One line saying what WSL actually read from a piece of evidence. */
export function evidenceAnalysisLabel(e: Evidence): string {
  if (e.analyzedFiles && e.analyzedFiles.length > 0) return `Analyzed from GitHub: ${e.analyzedFiles.join(", ")}.`
  if (e.content) return "Evidence analyzed."
  return "Supporting evidence — linked for mentor review, not automatically analyzed."
}
