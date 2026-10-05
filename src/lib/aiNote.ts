import type { Evidence, SkillSignal, SuggestedLevel } from "../types"

/** Splits an analysis note (written as complete sentences, e.g. "Graded by Gemini against
 * this challenge. Fits an Isolation Forest...") into a bullet list for display, rather
 * than one dense paragraph. */
export function splitAiNote(note: string): string[] {
  return note.split(/(?<=\.)\s+/).filter(Boolean)
}

/** The same note without the line naming the grading provider and model — that is operational
 * detail for mentors, not something a student needs to read. */
export function studentNote(note: string): string {
  return note.replace(/Graded by .+? against this challenge\.\s*/, "").trim()
}

// Same thresholds suggestedLevelFor uses server-side (server/ml/analyze.ts) — a display-only
// read of the same number, not a second source of truth.
export type EvidenceStrength = "Weak" | "Moderate" | "Strong"

/** How strongly the evidence supports an assessment. Mentor-facing only: students and companies
 * see verification status, not a strength or a score. */
export function evidenceStrengthFor(confidence: number): EvidenceStrength {
  return confidence >= 60 ? "Strong" : confidence >= 35 ? "Moderate" : "Weak"
}

/** The analysis's starting-point read of level, for the reviewing mentor — supporting information, never a verdict. */
export function assessmentLabel(level: SuggestedLevel): string {
  return level === "Insufficient" ? "Insufficient Evidence" : `AI-indicated level: ${level}`
}

/** What a student or company sees in place of a score: where the skill stands with the university. */
export function verificationLabel(status: SkillSignal["status"]): string {
  switch (status) {
    case "Verified":
      return "Verified by the university"
    case "Rejected":
      return "Not verified"
    case "More Evidence Requested":
      return "More evidence requested"
    default:
      return "Awaiting university verification"
  }
}

/** One part of an evidence item — a link, an attached file, or text the student pasted — and whether WSL analyzed it. */
export interface EvidenceSource {
  label: string
  detail: string
  analyzed: boolean
}

/** Whether WSL has any content of this item to analyze: pasted text, or something it read from a link or file. */
export function hasReadableContent(e: Evidence): boolean {
  return Boolean(e.content) || (e.analyzedFiles?.length ?? 0) > 0
}

/**
 * What an evidence item is made of and what WSL did with each part. A linked document and a
 * pasted excerpt are different things: the link is for the university to open (WSL reads it only
 * when it can), while the excerpt is text the student supplied for analysis.
 */
export function evidenceSources(e: Evidence): EvidenceSource[] {
  const read = e.analyzedFiles ?? []
  const sources: EvidenceSource[] = []
  if (e.link) {
    if (e.type === "GitHub Repository") {
      sources.push(read.length > 0 ? { label: "Repository", detail: `Read by WSL: ${read.join(", ")}`, analyzed: true } : { label: "Repository link", detail: "Available for university review", analyzed: false })
    } else {
      const doc = read.includes("Google Doc")
      sources.push({ label: "Linked document", detail: doc ? "Read by WSL" : "Available for university review", analyzed: doc })
    }
  }
  if (e.file) {
    const analyzed = read.includes(e.file.name)
    sources.push({ label: "Attached file", detail: analyzed ? "Read by WSL" : "Available for university review", analyzed })
  }
  if (e.content) sources.push({ label: e.link || e.file ? "Representative excerpt" : "Submitted text", detail: "Analyzed by WSL", analyzed: true })
  return sources
}
