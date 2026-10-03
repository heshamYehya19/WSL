/** Splits an AI note (written as complete sentences, e.g. "Detected Python code
 * (92% confidence)... 58% of the submitted content's wording matches...") into a
 * "Why WSL found this" bullet list for display, rather than one dense paragraph. */
export function splitAiNote(note: string): string[] {
  return note.split(/(?<=\.)\s+/).filter(Boolean)
}
