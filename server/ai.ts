// WSL's automatic evidence analysis. AI signals are informational only: they
// never block the workflow, and only a university mentor's decision verifies a
// skill. checkRelevance is a separate gate run when evidence is submitted, which
// rejects work that just repeats the challenge brief or is off-topic.
//
// analyzeEvidence grades with a language model, Groq or Gemini (server/ml/llm-grader.ts),
// and falls back to the stricter offline scorer (server/ml/analyze.ts) whenever the
// model can't be used: no API key, a failed call, or personal data in the evidence,
// which never leaves WSL. The demo keeps working in every one of those cases.
// Model grades are cached by a hash of everything the model saw, so analyzing the
// same evidence again returns the same scores instead of a fresh, slightly different
// opinion. Offline results are deterministic already and aren't cached.

import { createHash } from "node:crypto"
import { getDb } from "./db.ts"
import { analyzableContent, simulateAIReview } from "./ml/analyze.ts"
import type { ChallengeContext, EvidenceLike, SimulatedRating } from "./ml/analyze.ts"
import { GRADER_VERSION, configuredProvider, gradeWithModel, sampleCount } from "./ml/llm-grader.ts"
import type { Provider } from "./ml/llm-grader.ts"
import { screenChallenge, summarizeFindings } from "./screening.ts"

export { checkRelevance, simulateAIReview, suggestedLevelFor } from "./ml/analyze.ts"
export type { ChallengeContext, EvidenceQuote, RelevanceCheck, SimulatedRating, SuggestedLevel } from "./ml/analyze.ts"

function withPrefix(ratings: SimulatedRating[], prefix: string): SimulatedRating[] {
  return ratings.map((r) => ({ ...r, note: `${prefix} ${r.note}` }))
}

function cacheKey(provider: Provider, skills: string[], evidence: EvidenceLike[], challenge: ChallengeContext): string {
  const seen = {
    grader: GRADER_VERSION,
    provider: provider.id,
    model: provider.model,
    samples: sampleCount(),
    skills,
    challenge,
    evidence: evidence.map((e) => [e.id, e.type, e.title, e.description, e.content ?? ""]),
  }
  return createHash("sha256").update(JSON.stringify(seen)).digest("hex")
}

function cachedGrade(key: string): SimulatedRating[] | null {
  const row = getDb().prepare("SELECT ratings FROM ai_grade_cache WHERE key = ?").get(key) as { ratings: string } | undefined
  return row ? (JSON.parse(row.ratings) as SimulatedRating[]) : null
}

function saveGrade(key: string, ratings: SimulatedRating[]) {
  getDb().prepare("INSERT OR REPLACE INTO ai_grade_cache (key, ratings, created_at) VALUES (?, ?, ?)").run(key, JSON.stringify(ratings), new Date().toISOString())
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

  const key = cacheKey(provider, skills, readable, challenge)
  const cached = cachedGrade(key)
  if (cached) return cached

  try {
    const graded = await gradeWithModel(provider, skills, readable, challenge)
    if (graded.length === skills.length) {
      saveGrade(key, graded)
      return graded
    }
    // Fill any skill the model skipped with the offline score rather than leaving a gap.
    const fallback = offline()
    return skills.map((skill, i) => graded.find((g) => g.skill === skill) ?? withPrefix([fallback[i]], `Offline check (${provider.label} skipped this skill).`)[0])
  } catch (err) {
    console.warn(`[wsl-ai] ${provider.label} grading failed, using the offline check:`, err instanceof Error ? err.message : err)
    return withPrefix(offline(), `Offline check (${provider.label} was unavailable).`)
  }
}
