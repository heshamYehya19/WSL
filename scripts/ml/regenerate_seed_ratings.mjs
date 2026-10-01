// One-off dev utility: recomputes seed.ts's skillSignals using the real
// trained model (src/lib/ml/*.json), so the seeded demo data reflects actual
// model output instead of hand-picked numbers. Mirrors the math in
// src/lib/ml/vectorize.ts + src/lib/ml/analyze.ts exactly — kept as a
// separate plain-JS script so it can run directly in Node with no build step.
// Run: node scripts/ml/regenerate_seed_ratings.mjs

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const languageModel = JSON.parse(readFileSync(path.join(ROOT, "src/lib/ml/language-model.json"), "utf-8"))
const topicModel = JSON.parse(readFileSync(path.join(ROOT, "src/lib/ml/topic-model.json"), "utf-8"))

function tfidfVector(counts, idf, vocabSize) {
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

function vectorizeChar(text, model) {
  const lower = text.toLowerCase()
  const [minN, maxN] = model.ngramRange
  const counts = new Map()
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= lower.length; i++) {
      const gram = lower.slice(i, i + n)
      const idx = model.vocabulary[gram]
      if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1)
    }
  }
  return tfidfVector(counts, model.idf, model.idf.length)
}

function vectorizeWord(text, model) {
  const lower = text.toLowerCase()
  const tokens = lower.match(/[a-z0-9_]{2,}/g) ?? []
  const counts = new Map()
  for (const tok of tokens) {
    const idx = model.vocabulary[tok]
    if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  return tfidfVector(counts, model.idf, model.idf.length)
}

function dot(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

function softmax(logits) {
  const max = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

function classify(vec, model) {
  const logits = model.coef.map((row, c) => dot(row, vec) + model.intercept[c])
  const probs = softmax(logits)
  const out = {}
  model.classes.forEach((cls, i) => (out[cls] = probs[i]))
  return out
}

function clampRating(n) {
  return Math.max(5, Math.min(97, Math.round(n)))
}

function scaleLanguageProb(matchProb) {
  const LOW_ANCHOR = 0.1, HIGH_ANCHOR = 0.45, RATING_LOW = 15, RATING_HIGH = 90
  const t = (matchProb - LOW_ANCHOR) / (HIGH_ANCHOR - LOW_ANCHOR)
  return clampRating(RATING_LOW + t * (RATING_HIGH - RATING_LOW))
}

function scaleTopicSim(sim) {
  return clampRating(8 + sim * 260)
}

const LANGUAGE_SKILL_MAP = {
  "python": ["Python"],
  "frontend development": ["JavaScript", "TypeScript", "HTML"],
}

function languageSignal(skill, targetClasses, text) {
  const vec = vectorizeChar(text, languageModel)
  const probs = classify(vec, languageModel)
  const matchProb = targetClasses.reduce((sum, c) => sum + (probs[c] ?? 0), 0)
  const [topClass, topProb] = Object.entries(probs).sort((a, b) => b[1] - a[1])[0]
  const isActuallyThatLanguage = targetClasses.includes(topClass)
  const rating = isActuallyThatLanguage ? scaleLanguageProb(matchProb) : Math.min(scaleLanguageProb(matchProb), 38)
  const note = isActuallyThatLanguage
    ? `Detected ${topClass} code (${Math.round(topProb * 100)}% confidence) across ${text.trim().length.toLocaleString()} characters analyzed.`
    : `No ${skill} code detected in the submitted content — closest match was ${topClass} (${Math.round(topProb * 100)}% confidence).`
  return { rating, note }
}

function topicSignal(skill, text) {
  const ref = topicModel.skills[skill]
  if (!ref) return { rating: 50, note: "No reference model for this skill yet." }
  const vec = vectorizeWord(text, topicModel)
  const sim = dot(vec, ref)
  const rating = scaleTopicSim(sim)
  const note = sim > 0.08
    ? `${Math.round(sim * 100)}% topical match to ${skill} reference material, based on the submitted content's wording.`
    : `Submitted content doesn't clearly relate to ${skill} — only ${Math.round(sim * 100)}% topical match.`
  return { rating, note }
}

const MIN_CONTENT_CHARS = 30
const INSUFFICIENT_RATING = 14

function scoreSkillAgainst(skill, text) {
  const key = skill.trim().toLowerCase()
  const targetClasses = LANGUAGE_SKILL_MAP[key]
  const hasTopic = key === "frontend development"

  if (targetClasses && !hasTopic) return languageSignal(skill, targetClasses, text)
  if (targetClasses && hasTopic) {
    const lang = languageSignal(skill, targetClasses, text)
    const topic = topicSignal(skill, text)
    return lang.rating >= topic.rating ? lang : topic
  }
  return topicSignal(skill, text)
}

function itemText(e) {
  return [e.title, e.description, e.content].filter(Boolean).join(". ").trim()
}

function analyze(requiredSkills, items) {
  return requiredSkills.map((skill) => {
    let best = { rating: -1, note: "", item: items[0].title }
    for (const item of items) {
      const text = itemText(item)
      const candidate =
        text.length < MIN_CONTENT_CHARS
          ? { rating: INSUFFICIENT_RATING, note: `Not enough content in "${item.title}" to verify ${skill} (${text.length} characters).` }
          : scoreSkillAgainst(skill, text)
      if (candidate.rating > best.rating) best = { ...candidate, item: item.title }
    }
    return { skill, rating: best.rating, note: best.note, item: best.item }
  })
}

// --- seed data mirrored from src/data/seed.ts (kept in sync by hand for this one-off run) ---

const PYTHON_SNIPPET = `import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

def build_features(df):
    df["day_of_week"] = df["date"].dt.dayofweek
    df["is_holiday"] = df["date"].isin(holiday_dates)
    return df

df = pd.read_csv("cafeteria_orders.csv", parse_dates=["date"])
df = build_features(df)
X_train, X_test, y_train, y_test = train_test_split(
    df.drop(columns=["demand"]), df["demand"], test_size=0.2
)
model = RandomForestRegressor(n_estimators=200, max_depth=8)
model.fit(X_train, y_train)
print("R2:", model.score(X_test, y_test))`

const scenarios = [
  {
    project: "proj-cafeteria (Ahmed)",
    requiredSkills: ["Python", "Machine Learning", "Data Analysis", "Data Visualization"],
    evidence: [
      { title: "cafeteria-demand-forecasting", description: "Full data pipeline, feature engineering, and model training code (Python, pandas, scikit-learn).", content: PYTHON_SNIPPET },
      { title: "Cafeteria Demand Forecasting — Final Report", description: "18-page report covering data exploration, modeling approach, validation results, and limitations." },
      { title: "Model Card — Demand Forecasting Model v2", description: "Model documentation covering training data, features, evaluation metrics, and known failure modes." },
      { title: "Stakeholder Presentation — Ops Forecasting Rollout", description: "Slide deck presenting findings and a recommended ordering policy to cafeteria operations leads." },
    ],
  },
  {
    project: "proj-churn-sara (Sara)",
    requiredSkills: ["Python", "Data Analysis", "Machine Learning", "Problem Solving"],
    evidence: [
      { title: "Churn Driver Analysis", description: "Notebook of exploratory analysis comparing churned vs. retained account behavior." },
      { title: "Customer Churn — Findings Report", description: "Report summarizing churn drivers and a proposed early-warning scoring approach." },
    ],
  },
  {
    project: "proj-support-portal (Lina)",
    requiredSkills: ["UI/UX Design", "Frontend Development", "Research"],
    evidence: [
      { title: "Support Portal Redesign — Interactive Prototype", description: "High-fidelity clickable prototype of the redesigned support request and tracking flows." },
      { title: "Usability Research Summary", description: "Findings from 10 moderated usability sessions plus the resulting design recommendations." },
    ],
  },
]

for (const s of scenarios) {
  console.log(`\n=== ${s.project} ===`)
  for (const r of analyze(s.requiredSkills, s.evidence)) {
    console.log(`  ${r.skill.padEnd(20)} ${String(r.rating).padStart(3)}%   [best: ${r.item}]`)
    console.log(`  ${"".padEnd(20)}       ${r.note}`)
  }
}
