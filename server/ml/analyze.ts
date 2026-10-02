// Real content analysis for WSL's "AI rating" — replaces the old hash-based
// fake in server/ai.ts. Two small models (trained in scripts/ml/train.py from
// real GitHub source files + Wikipedia articles, see that file for how) run
// server-side, synchronously, whenever a student requests a rating:
//
//   - language model: does the submitted text actually contain code in the
//     language a skill requires (e.g. "does this contain Python?"), via a
//     char n-gram TF-IDF + logistic regression classifier.
//   - topic model: for skills that aren't a programming language (Machine
//     Learning, Data Analysis, UI/UX Design, ...), how closely does the
//     submitted text's vocabulary match that topic, via word TF-IDF cosine
//     similarity against a reference document per skill.
//
// Each required skill is scored against every individual piece of evidence
// (not one big pooled blob) and takes the strongest match — otherwise a
// single real Python file gets diluted into near-nothing once averaged in
// with three unrelated prose-only reports from the same project.
//
// Calibration constants below (LOW_ANCHOR/HIGH_ANCHOR for each model) come
// from measuring real example text against the trained models — see the
// calibration run in scripts/ml — not arbitrary guesses, but still rough
// given the small training corpora available (this is intentionally a
// "simple" model, not production-grade).

import { classify, dot, loadLanguageModel, loadTopicModel, vectorizeChar, vectorizeWord } from "./vectorize.ts"

const LANGUAGE_SKILL_MAP: Record<string, string[]> = {
  "python": ["Python"],
  "java": ["Java"],
  "sql": ["SQL"],
  "react": ["JavaScript", "TypeScript", "HTML"],
  "node.js": ["JavaScript", "TypeScript"],
  "frontend development": ["JavaScript", "TypeScript", "HTML"],
  "web development": ["JavaScript", "TypeScript", "HTML"],
}

// Skills that are checked BOTH for real code (above) AND for topical vocabulary
// match (against a Wikipedia reference in topic-model.json) — the stronger of
// the two signals wins, since e.g. a Figma-only submission can still
// legitimately demonstrate "Web Development" without a single line of code.
const HYBRID_SKILLS = new Set(["frontend development", "web development"])

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

interface Signal {
  rating: number
  note: string
}

function languageSignal(skill: string, targetClasses: string[], text: string): Signal {
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

  return { rating, note }
}

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

export interface SimulatedRating {
  skill: string
  rating: number
  note: string
  evidenceIds: string[]
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

function scoreSkillAgainst(skill: string, text: string): Signal {
  const key = skill.trim().toLowerCase()
  const targetClasses = LANGUAGE_SKILL_MAP[key]
  const hasTopic = HYBRID_SKILLS.has(key)

  if (targetClasses && !hasTopic) return languageSignal(skill, targetClasses, text)

  if (targetClasses && hasTopic) {
    const lang = languageSignal(skill, targetClasses, text)
    const topic = topicSignal(skill, text)
    return lang.rating >= topic.rating ? lang : topic
  }

  return topicSignal(skill, text)
}

/**
 * Analyzes a student's submitted evidence against each skill a challenge
 * requires, returning a 0-100 rating per skill grounded in the actual
 * submitted text (not just evidence type/count). Each skill is scored
 * against every individual evidence item and takes the strongest match, so
 * one real code sample isn't drowned out by other, unrelated evidence on the
 * same project. Automatic and informational only — never blocks or gates
 * the submission.
 */
export function simulateAIReview(requiredSkills: string[], submittedEvidence: EvidenceLike[]): SimulatedRating[] {
  if (submittedEvidence.length === 0) return []

  return requiredSkills.map((skill) => {
    let best: Signal & { evidenceId: string } = { rating: -1, note: "", evidenceId: submittedEvidence[0].id }

    for (const item of submittedEvidence) {
      const text = evidenceText(item)
      const candidate =
        text.length < MIN_CONTENT_CHARS
          ? { rating: INSUFFICIENT_RATING, note: `Not enough content in "${item.title}" to verify ${skill} (${text.length} characters).` }
          : scoreSkillAgainst(skill, text)
      if (candidate.rating > best.rating) best = { ...candidate, evidenceId: item.id }
    }

    return { skill, rating: best.rating, note: best.note, evidenceIds: [best.evidenceId] }
  })
}
