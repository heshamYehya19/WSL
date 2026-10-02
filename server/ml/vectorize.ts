// This runs server-side (see server/ai.ts), loaded once as a static import —
// no bundle-size reason to defer loading, unlike a browser build.
import languageModelData from "./language-model.json" with { type: "json" }
import topicModelData from "./topic-model.json" with { type: "json" }

// Re-implements, byte-for-byte, the two scikit-learn TF-IDF transforms used by
// scripts/ml/train.py (see that file for how these JSON artifacts were produced):
//
//   - char n-grams (analyzer="char", ngram_range=[2,4]) for the language model
//   - word tokens  (token_pattern=/[A-Za-z0-9_]{2,}/, English stopwords removed
//     during fit) for the topic model
//
// In both cases: tf = raw term count, tfidf = tf * idf, then L2-normalize.
// Terms not in the fixed training vocabulary are simply skipped (0 weight),
// exactly matching sklearn's behavior when transforming unseen text.

export interface LanguageModel {
  analyzer: "char"
  ngramRange: number[]
  vocabulary: Record<string, number>
  idf: number[]
  classes: string[]
  coef: number[][]
  intercept: number[]
  testAccuracy: number
}

export interface TopicModel {
  vocabulary: Record<string, number>
  idf: number[]
  skills: Record<string, number[]>
}

function tfidfVector(counts: Map<number, number>, idf: number[], vocabSize: number): Float64Array {
  const vec = new Float64Array(vocabSize)
  let sumSquares = 0
  for (const [idx, count] of counts) {
    const w = count * idf[idx]
    vec[idx] = w
    sumSquares += w * w
  }
  if (sumSquares > 0) {
    const norm = Math.sqrt(sumSquares)
    for (let i = 0; i < vec.length; i++) vec[i] /= norm
  }
  return vec
}

/** Mirrors sklearn's analyzer="char": a plain sliding window over the whole
 * lowercased string, no word-boundary padding. */
export function vectorizeChar(text: string, model: LanguageModel): Float64Array {
  const lower = text.toLowerCase()
  const [minN, maxN] = model.ngramRange
  const counts = new Map<number, number>()
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= lower.length; i++) {
      const gram = lower.slice(i, i + n)
      const idx = model.vocabulary[gram]
      if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1)
    }
  }
  return tfidfVector(counts, model.idf, model.idf.length)
}

/** Mirrors sklearn's token_pattern /[A-Za-z0-9_]{2,}/ with lowercase=True;
 * stopwords need no explicit handling because they were never added to the
 * fitted vocabulary, so lookups for them naturally miss. */
export function vectorizeWord(text: string, model: TopicModel): Float64Array {
  const lower = text.toLowerCase()
  const tokens = lower.match(/[a-z0-9_]{2,}/g) ?? []
  const counts = new Map<number, number>()
  for (const tok of tokens) {
    const idx = model.vocabulary[tok]
    if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  return tfidfVector(counts, model.idf, model.idf.length)
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

/** Probability per class from the trained logistic regression, given an
 * already-vectorized (L2-normalized TF-IDF) document. */
export function classify(vec: Float64Array, model: LanguageModel): Record<string, number> {
  const logits = model.coef.map((row, c) => dot(row, vec) + model.intercept[c])
  const probs = softmax(logits)
  const out: Record<string, number> = {}
  model.classes.forEach((cls, i) => (out[cls] = probs[i]))
  return out
}

export function loadLanguageModel(): LanguageModel {
  return languageModelData as LanguageModel
}

export function loadTopicModel(): TopicModel {
  return topicModelData as TopicModel
}
