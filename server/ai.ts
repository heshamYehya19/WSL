// WSL's automatic evidence analysis. AI signals are informational only: they
// never block the workflow, and only a university mentor's decision verifies a
// skill. checkRelevance is a separate gate run when evidence is submitted, which
// rejects work that just repeats the challenge brief or is off-topic.
//
// analyzeEvidence grades with a language model, Groq or Gemini (server/ml/llm-grader.ts),
// and falls back to the stricter offline scorer (server/ml/analyze.ts) whenever the
// model can't be used: no API key, or a failed call. Unlike company challenge uploads
// (screened in server/api.ts before a challenge is posted), student evidence is not run
// through the personal-data screen — it's the student's own submission, sent only to the
// configured grading provider. The demo keeps working in every one of those cases.
//
// Note text shown to students and mentors never names which grader ran or why a call
// failed — that's internal plumbing, not evidence about the student's work. Provider
// failures are logged server-side (console.warn below) for operators, not surfaced in
// the product; the offline scorer's own note is already a complete, honest explanation
// on its own.

import { createHash } from "node:crypto"
import { analyzableContent, simulateAIReview } from "./ml/analyze.ts"
import type { ChallengeContext, EvidenceLike, SimulatedRating } from "./ml/analyze.ts"
import { configuredProvider, gradeWithModel } from "./ml/llm-grader.ts"

export { canonicalSkillName, checkRelevance, noEvidenceResults, simulateAIReview, suggestedLevelFor } from "./ml/analyze.ts"
export type { ChallengeContext, EvidenceQuote, RelevanceCheck, SkillCriterion, SimulatedRating, SuggestedLevel } from "./ml/analyze.ts"

/** The model this server would grade with right now, or "offline" with no key configured. */
export function currentGradingModel(): string {
  return configuredProvider()?.model ?? "offline"
}

/**
 * Identifies exactly what a grading run was based on: the model, the required
 * skills, and every piece of evidence content (never titles/descriptions, which
 * aren't graded). Two calls with the same evidence set produce the same hash,
 * which is what lets re-analysis skip the model entirely when nothing changed.
 */
export function hashEvidenceSet(skills: string[], evidence: EvidenceLike[], model: string): string {
  const canonical = {
    model,
    skills: [...skills].sort(),
    evidence: evidence
      .map((e) => ({ id: e.id, content: analyzableContent(e) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export interface AnalysisRun {
  results: SimulatedRating[]
  /** True only when a provider was configured and the call itself failed (timeout, 429,
   * bad response). False for a clean model success or a deliberate no-provider-configured
   * run — both are stable outcomes safe to cache; a failure is not, so a retry can reach
   * the model again instead of being short-circuited by the evidence-hash cache. */
  failed: boolean
}

export async function analyzeEvidence(skills: string[], evidence: EvidenceLike[], challenge: ChallengeContext): Promise<AnalysisRun> {
  if (evidence.length === 0) return { results: [], failed: false }
  const offline = () => simulateAIReview(skills, evidence, challenge)

  const provider = configuredProvider()
  if (!provider) return { results: offline(), failed: false }

  const readable = evidence.filter((e) => analyzableContent(e).length > 0)
  if (readable.length === 0) return { results: offline(), failed: false }

  try {
    const graded = await gradeWithModel(provider, skills, readable, challenge)
    if (graded.length === skills.length) return { results: graded, failed: false }
    // Fill any skill the model skipped with the offline score rather than leaving a gap.
    const fallback = offline()
    return { results: skills.map((skill, i) => graded.find((g) => g.skill === skill) ?? fallback[i]), failed: false }
  } catch (err) {
    console.warn(`[wsl-ai] ${provider.label} grading failed, using the offline check:`, err instanceof Error ? err.message : err)
    return { results: offline(), failed: true }
  }
}
