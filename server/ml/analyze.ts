// Real content analysis for WSL's "AI rating" — replaces the old hash-based
// fake in server/ai.ts. Three signals run server-side, synchronously, whenever
// a student requests a rating:
//
//   - language model: does the submitted text actually contain code in the
//     language a skill requires (e.g. "does this contain Python?"), via a
//     char n-gram TF-IDF + logistic regression classifier (trained in
//     scripts/ml/train.py from real GitHub source files).
//   - problem-relevance: does the submission's own wording (identifiers,
//     comments, prose) actually overlap with what THIS challenge's problem
//     description/objectives/expected-output specifically asked for — not
//     a fixed pretrained topic, but a plain word-overlap cosine similarity
//     computed on the fly against that one challenge's own text. This is
//     the primary signal: being written in the right language is necessary
//     but not sufficient — the submission has to address the actual ask.
//   - topic model (fallback only): for conceptual skills, a cosine match
//     against a Wikipedia reference doc (server/ml/topic-model.json),
//     used only when a submission has no detectable overlap with the
//     challenge's own (sometimes thin) problem text.
//
// Each required skill is scored against every individual piece of evidence
// (not one big pooled blob) and takes the strongest match — otherwise a
// single real Python file gets diluted into near-nothing once averaged in
// with three unrelated prose-only reports from the same project.
//
// Calibration constants below (LOW_ANCHOR/HIGH_ANCHOR, LANG_WEIGHT) come from
// measuring real example text against these signals — see the calibration
// methodology in scripts/ml — not arbitrary guesses, but still rough given
// the small training corpora available (this is intentionally a "simple"
// model, not production-grade).

import { classify, dot, loadLanguageModel, loadTopicModel, vectorizeChar, vectorizeWord } from "./vectorize.ts"

const LANGUAGE_SKILL_MAP: Record<string, string[]> = {
  "python": ["Python"],
  "java": ["Java"],
  "sql": ["SQL"],
  "javascript": ["JavaScript"],
  "typescript": ["TypeScript"],
  "html": ["HTML"],
  "css": ["CSS"],
  "react": ["JavaScript", "TypeScript", "HTML", "CSS"],
  "node.js": ["JavaScript", "TypeScript"],
  "frontend development": ["JavaScript", "TypeScript", "HTML", "CSS"],
  "web development": ["JavaScript", "TypeScript", "HTML", "CSS"],
  "c++": ["C++"],
  "c#": ["C#"],
  ".net": ["C#"],
  "asp.net": ["C#"],
  "ruby": ["Ruby"],
  "swift": ["Swift"],
  "ios development": ["Swift", "Objective-C"],
  "shell": ["Shell"],
  "bash": ["Shell"],
  "perl": ["Perl"],
  "php": ["PHP"],
  "objective-c": ["Objective-C"],
  "go": ["Go"],
  "golang": ["Go"],
  "rust": ["Rust"],
  "dart": ["Dart"],
  "flutter": ["Dart"],
  "mobile development": ["Swift", "Objective-C", "Dart"],
}

// Skills that can legitimately be demonstrated without code at all (e.g. a
// Figma-only submission can still show real "Web Development" work) — for
// these, missing the language entirely doesn't force the hard cap below.
const HYBRID_SKILLS = new Set(["frontend development", "web development", "mobile development"])

const MIN_CONTENT_CHARS = 30
const INSUFFICIENT_RATING = 14

function clampRating(n: number): number {
  return Math.max(5, Math.min(97, Math.round(n)))
}

// matchProb ranges roughly 0.08 (wrong language entirely) to ~0.45+ (a clear,
// correctly-identified match) for a single target class; scaled from measured
// examples (real Python snippet ~0.43, prose-only ~0.11, wrong-language code
// ~0.08) onto a 0-100 rating.
function scaleLanguageProb(matchProb: number): number {
  const LOW_ANCHOR = 0.1
  const HIGH_ANCHOR = 0.45
  const RATING_LOW = 15
  const RATING_HIGH = 90
  const t = (matchProb - LOW_ANCHOR) / (HIGH_ANCHOR - LOW_ANCHOR)
  return clampRating(RATING_LOW + t * (RATING_HIGH - RATING_LOW))
}

// Cosine similarity of short submission text against a long reference article
// is naturally modest even for a strong topical match (measured: genuinely
// on-topic text ~0.18-0.32, unrelated text ~0.00-0.03).
function scaleTopicSim(sim: number): number {
  return clampRating(8 + sim * 260)
}

// Word-overlap cosine similarity between a submission and THIS challenge's own
// problem text is naturally sparse for code (identifiers/comments are a small
// fraction of a source file) and richer for prose (a report can closely echo
// the challenge's own wording). Measured on real examples: code genuinely
// solving the stated problem ~0.15-0.5 depending on how descriptive its
// naming/comments are; code solving a different problem in the same language,
// or unrelated prose, ~0.00; a report written about the actual problem ~0.3-0.5+.
function scaleProblemOverlap(sim: number): number {
  const LOW_ANCHOR = 0.02
  const HIGH_ANCHOR = 0.4
  const RATING_LOW = 15
  const RATING_HIGH = 92
  const t = (sim - LOW_ANCHOR) / (HIGH_ANCHOR - LOW_ANCHOR)
  return clampRating(RATING_LOW + t * (RATING_HIGH - RATING_LOW))
}

// A compact English stopword list (same intent as sklearn's stop_words="english"
// used in scripts/ml/train.py) so overlap reflects meaningful vocabulary, not
// grammar words both texts inevitably share.
const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both
   but by can cannot could did do does doing don down during each few for from further had has have having he her
   here hers herself him himself his how i if in into is it its itself just let me more most my myself no nor not
   now of off on once only or other our ours ourselves out over own same she should so some such than that the
   their theirs them themselves then there these they this those through to too under until up very was we were
   what when where which while who whom why will with you your yours yourself yourselves using use used uses via
   also able new build built using provide provides across`
    .split(/\s+/)
    .filter(Boolean),
)

// Splits snake_case/camelCase identifiers (e.g. "call_transcripts", "intentLabel")
// into separate words so code identifiers can be matched against the plain
// English wording of a challenge's problem description.
function splitIdentifier(token: string): string[] {
  return token.split(/_+/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])/))
}

function tokenize(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9_]{2,}/g) ?? []
  const words: string[] = []
  for (const tok of raw) {
    for (const piece of splitIdentifier(tok)) {
      const w = piece.toLowerCase()
      if (w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) words.push(w)
    }
  }
  return words
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return tf
}

function cosineOverlap(a: Map<string, number>, b: Map<string, number>): number {
  let dotP = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  for (const [t, v] of a) {
    const w = b.get(t)
    if (w) dotP += v * w
  }
  if (na === 0 || nb === 0) return 0
  return dotP / (Math.sqrt(na) * Math.sqrt(nb))
}

interface Signal {
  rating: number
  note: string
}

interface LangResult extends Signal {
  matched: boolean
}

function languageSignal(skill: string, targetClasses: string[], text: string): LangResult {
  const model = loadLanguageModel()
  const vec = vectorizeChar(text, model)
  const probs = classify(vec, model)
  const matchProb = targetClasses.reduce((sum, c) => sum + (probs[c] ?? 0), 0)
  const [topClass, topProb] = Object.entries(probs).sort((a, b) => b[1] - a[1])[0]
  const isActuallyThatLanguage = targetClasses.includes(topClass)
  // Hard guarantee, not just a statistical tendency: if the model's best guess
  // for this content isn't the required language at all, the rating can never
  // read as a confident match — e.g. no submission can show "91% Python" when
  // it doesn't actually look like Python.
  const rating = isActuallyThatLanguage ? scaleLanguageProb(matchProb) : Math.min(scaleLanguageProb(matchProb), 38)

  const note = isActuallyThatLanguage
    ? `Detected ${topClass} code (${Math.round(topProb * 100)}% confidence) across ${text.trim().length.toLocaleString()} characters analyzed.`
    : `No ${skill} code detected in the submitted content — closest match was ${topClass} (${Math.round(topProb * 100)}% confidence).`

  return { rating, note, matched: isActuallyThatLanguage }
}

// Does the submission's own wording actually address what THIS challenge
// asked for in its problem description/objectives/expected output — not
// just whether it's broadly "about" the skill in the abstract.
function problemSignal(challengeText: string, text: string): Signal {
  const sim = cosineOverlap(termFreq(tokenize(challengeText)), termFreq(tokenize(text)))
  const rating = scaleProblemOverlap(sim)
  const note =
    sim > 0.05
      ? `${Math.round(sim * 100)}% of the submitted content's wording matches what this challenge specifically asked for.`
      : `Submitted content doesn't substantively address this challenge's stated problem (${Math.round(sim * 100)}% match).`
  return { rating, note }
}

// Fallback for conceptual skills when a submission has no detectable overlap
// with the challenge's own (sometimes thin) problem text — falls back to a
// generic Wikipedia-based reference for the skill rather than reading as zero.
function topicSignal(skill: string, text: string): Signal {
  const model = loadTopicModel()
  const ref = model.skills[skill]
  if (!ref) return { rating: clampRating(50), note: "No reference model for this skill yet." }
  const vec = vectorizeWord(text, model)
  const sim = dot(vec, ref)
  const rating = scaleTopicSim(sim)
  const note =
    sim > 0.08
      ? `${Math.round(sim * 100)}% topical match to ${skill} reference material, based on the submitted content's wording.`
      : `Submitted content doesn't clearly relate to ${skill} — only ${Math.round(sim * 100)}% topical match.`
  return { rating, note }
}

export type SuggestedLevel = "Foundational" | "Intermediate" | "Advanced" | "Demonstrated"

// A deterministic, tunable read of the same 0-100 confidence number — not a
// second model. Presented to a mentor as a starting point, never as a verdict:
// only a human verification decision can actually set a student's skill level.
export function suggestedLevelFor(rating: number): SuggestedLevel {
  return rating >= 80 ? "Demonstrated" : rating >= 60 ? "Advanced" : rating >= 35 ? "Intermediate" : "Foundational"
}

export interface SimulatedRating {
  skill: string
  rating: number
  suggestedLevel: SuggestedLevel
  note: string
  evidenceIds: string[]
}

export interface ChallengeContext {
  problemDescription: string
  objectives: string[]
  expectedOutput: string
}

interface EvidenceLike {
  id: string
  type: string
  title: string
  description: string
  content?: string
}

function evidenceText(e: EvidenceLike): string {
  return [e.title, e.description, e.content].filter(Boolean).join(". ").trim()
}

// Weight given to raw language-match confidence once a submission is
// confirmed to actually be in the required language; the rest of the rating
// is driven by problem-relevance — being in the right language no longer
// carries a submission to a high rating on its own.
const LANG_WEIGHT = 0.35

function scoreSkillAgainst(skill: string, text: string, challengeText: string): Signal {
  const key = skill.trim().toLowerCase()
  const targetClasses = LANGUAGE_SKILL_MAP[key]
  const hasTopic = HYBRID_SKILLS.has(key)
  const problem = problemSignal(challengeText, text)

  if (!targetClasses) {
    const topic = topicSignal(skill, text)
    return problem.rating >= topic.rating ? problem : topic
  }

  const lang = languageSignal(skill, targetClasses, text)
  if (!lang.matched) {
    // Hybrid skills can still be demonstrated without code at all; everything
    // else can't claim the skill from wording alone, no matter how closely
    // the text echoes the problem statement.
    return hasTopic && problem.rating > lang.rating ? problem : lang
  }

  // Being in the right language is necessary but not sufficient: the final
  // rating is dominated by whether this code actually solves what the
  // challenge specifically asked for, not just its language family.
  const rating = clampRating(LANG_WEIGHT * lang.rating + (1 - LANG_WEIGHT) * problem.rating)
  return { rating, note: `${lang.note} ${problem.note}` }
}

function buildChallengeText(challenge: ChallengeContext): string {
  return [challenge.problemDescription, ...challenge.objectives, challenge.expectedOutput].filter(Boolean).join(". ")
}

// Below this, a submission has essentially no detectable vocabulary overlap
// with the challenge's own problem text at all — measured examples: code or
// prose addressing a genuinely different problem lands at ~0.00, while even
// sparse but real on-topic content lands at ~0.15+ (see scaleProblemOverlap).
// Used only to reject obvious off-topic submissions at intake, not to rate —
// kept well below the rating scale's own LOW_ANCHOR so it never blocks
// legitimate, merely-sparse evidence.
const REJECT_THRESHOLD = 0.03

export interface RelevanceCheck {
  /** False only when there's enough submitted text to judge and it shows no
   * meaningful overlap with the challenge's own problem statement. */
  relevant: boolean
  overlapPct: number
}

/**
 * Checked at evidence submission time, separately from rating: does this
 * submission have anything to do with what this specific challenge asked
 * for at all? Unlike simulateAIReview (which only ever informs a rating),
 * this is an explicit accept/reject gate for obviously off-topic content —
 * e.g. code or a report for an entirely different assignment. Short
 * submissions (below MIN_CONTENT_CHARS) can't be judged either way and are
 * always accepted, since a bare link or short title is too thin a signal.
 */
export function checkRelevance(challenge: ChallengeContext, text: string): RelevanceCheck {
  if (text.trim().length < MIN_CONTENT_CHARS) return { relevant: true, overlapPct: -1 }
  const overlap = cosineOverlap(termFreq(tokenize(buildChallengeText(challenge))), termFreq(tokenize(text)))
  return { relevant: overlap >= REJECT_THRESHOLD, overlapPct: Math.round(overlap * 100) }
}

/**
 * Analyzes a student's submitted evidence against each skill a challenge
 * requires, returning a 0-100 rating per skill grounded in the actual
 * submitted text against the challenge's own problem description/objectives/
 * expected output (not just evidence type/count, and not just "is this the
 * right language in the abstract"). Each skill is scored against every
 * individual evidence item and takes the strongest match, so one real code
 * sample isn't drowned out by other, unrelated evidence on the same project.
 * Informational only — never blocks or gates the submission itself (see
 * checkRelevance for the separate accept/reject gate run at intake).
 */
export function simulateAIReview(requiredSkills: string[], submittedEvidence: EvidenceLike[], challenge: ChallengeContext): SimulatedRating[] {
  if (submittedEvidence.length === 0) return []

  const challengeText = buildChallengeText(challenge)

  return requiredSkills.map((skill) => {
    let best: Signal & { evidenceId: string } = { rating: -1, note: "", evidenceId: submittedEvidence[0].id }

    for (const item of submittedEvidence) {
      const text = evidenceText(item)
      const candidate =
        text.length < MIN_CONTENT_CHARS
          ? { rating: INSUFFICIENT_RATING, note: `Not enough content in "${item.title}" to verify ${skill} (${text.length} characters).` }
          : scoreSkillAgainst(skill, text, challengeText)
      if (candidate.rating > best.rating) best = { ...candidate, evidenceId: item.id }
    }

    return { skill, rating: best.rating, suggestedLevel: suggestedLevelFor(best.rating), note: best.note, evidenceIds: [best.evidenceId] }
  })
}
