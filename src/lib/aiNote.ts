import type { Evidence } from "../types"

/** Splits an AI note (written as complete sentences, e.g. "Graded by Gemini against
 * this challenge. Fits an Isolation Forest...") into a "Why WSL found this" bullet
 * list for display, rather than one dense paragraph. */
export function splitAiNote(note: string): string[] {
  return note.split(/(?<=\.)\s+/).filter(Boolean)
}

/** One line saying what WSL actually read from a piece of evidence. */
export function evidenceAnalysisLabel(e: Evidence): string {
  if (e.analyzedFiles && e.analyzedFiles.length > 0) return `Analyzed from GitHub: ${e.analyzedFiles.join(", ")}.`
  if (e.content) return "Evidence analyzed."
  return "Supporting evidence — linked for mentor review, not automatically analyzed."
}
