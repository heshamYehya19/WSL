// WSL's automatic evidence analysis. AI signals are informational only: they
// never block the workflow, and only a university mentor's decision verifies a
// skill. checkRelevance is a separate gate run when evidence is submitted, which
// rejects work that just repeats the challenge brief or is off-topic.
//
// analyzeEvidence grades with a language model, Groq or Gemini (server/ml/llm-grader.ts),
// and falls back to the stricter offline scorer (server/ml/analyze.ts) whenever the
// model can't be used: no API key, a failed call, or personal data in the evidence,
// which never leaves WSL. The demo keeps working in every one of those cases.

import { analyzableContent, simulateAIReview } from "./ml/analyze.ts"
import type { ChallengeContext, EvidenceLike, SimulatedRating } from "./ml/analyze.ts"
import { configuredProvider, gradeWithModel } from "./ml/llm-grader.ts"
import { screenChallenge, summarizeFindings } from "./screening.ts"

export { checkRelevance, simulateAIReview, suggestedLevelFor } from "./ml/analyze.ts"
export type { ChallengeContext, EvidenceQuote, RelevanceCheck, SimulatedRating, SuggestedLevel } from "./ml/analyze.ts"

function withPrefix(ratings: SimulatedRating[], prefix: string): SimulatedRating[] {
  return ratings.map((r) => ({ ...r, note: `${prefix} ${r.note}` }))
}

export async function analyzeEvidence(skills: string[], evidence: EvidenceLike[], challenge: ChallengeContext): Promise<SimulatedRating[]> {
  if (evidence.length === 0) return []
  const offline = () => simulateAIReview(skills, evidence, challenge)

  const provider = configuredProvider()
  if (!provider) return withPrefix(offline(), "Offline check (no AI model is configured on this server).")

  const readable = evidence.filter((e) => analyzableContent(e).length > 0)
  if (readable.length === 0) return offline()

  // The same personal-data screen companies' challenges go through runs before
  // anything is sent to the model. If it finds anything, the evidence stays on WSL.
  const findings = screenChallenge({
    fields: readable.flatMap((e) => [
      { label: e.title, text: analyzableContent(e) },
      { label: `${e.title} (description)`, text: `${e.title}\n${e.description}` },
    ]),
    files: [],
  })
  if (findings.length > 0) {
    return withPrefix(offline(), `Offline check: WSL found possible personal data (${summarizeFindings(findings)}), so this evidence was not sent to ${provider.label}.`)
  }

  try {
    const graded = await gradeWithModel(provider, skills, readable, challenge)
    if (graded.length === skills.length) return graded
    // Fill any skill the model skipped with the offline score rather than leaving a gap.
    const fallback = offline()
    return skills.map((skill, i) => graded.find((g) => g.skill === skill) ?? withPrefix([fallback[i]], `Offline check (${provider.label} skipped this skill).`)[0])
  } catch (err) {
    console.warn(`[wsl-ai] ${provider.label} grading failed, using the offline check:`, err instanceof Error ? err.message : err)
    return withPrefix(offline(), `Offline check (${provider.label} was unavailable).`)
  }
}
