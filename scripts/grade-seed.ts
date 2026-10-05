// Pre-grades every seeded student's evidence (per project, per student) with the live model (Groq or Gemini,
// whichever is configured) and writes the result to server/ml/seed-grades.json.
// seed.ts reads that file at seed time, using the stored result whenever its hash
// still matches the current evidence — so the demo tour never needs a live model
// call, and never depends on quota, even when nobody has a key configured at all.
//
// Run with `npm run db:grade-seed`. Needs GROQ_API_KEY or GEMINI_API_KEY; with
// neither set, it prints a message and exits without changing anything, so it's
// always safe to run. It paces itself for Groq's free-tier tokens-per-minute limit
// (waiting and retrying when it is hit), moves to the other provider when one is out
// of quota for the day, and skips anything already graded for the current evidence,
// so it can be re-run until every project is covered.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Isolated from the real dev database — this only ever reads the fresh, offline-graded
// seed data to know what evidence/challenges to grade, never anything a user submitted.
process.env.WSL_DB_PATH = join(mkdtempSync(join(tmpdir(), "wsl-grade-seed-")), "wsl.db")

const { getDb } = await import("../server/db.ts")
const { configuredProviders, gradeWithModel } = await import("../server/ml/llm-grader.ts")
const { hashEvidenceSet } = await import("../server/ai.ts")

const providers = configuredProviders()
if (providers.length === 0) {
  console.log("No GROQ_API_KEY or GEMINI_API_KEY configured — skipping. Set a key and re-run to pre-grade the seed data.")
  process.exit(0)
}

const db = getDb()

interface Row {
  [key: string]: unknown
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "server", "ml", "seed-grades.json")
type Entry = { model: string; hash: string; gradedAt: string; results: unknown[] }
// Start from what's already there: a project that fails this run (quota, outage) keeps
// its previous model-graded entry instead of being dropped from the file.
let existing: Record<string, Entry> = {}
try {
  existing = JSON.parse(readFileSync(outPath, "utf8")) as Record<string, Entry>
} catch {
  // No file yet.
}
const output: Record<string, Entry> = { ...existing }
let graded = 0
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Groq's free tier allows 8,000 tokens a minute and one grade uses 2-4k, so space them out.
const PACE_MS = 25_000

/** Grades with the first provider that works: waits out per-minute limits, skips providers out of daily quota. */
async function gradeWithAnyProvider(skills: string[], evidence: Parameters<typeof gradeWithModel>[2], challenge: Parameters<typeof gradeWithModel>[3]) {
  let lastError: unknown
  for (const provider of providers) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const results = await gradeWithModel(provider, skills, evidence, challenge)
        if (results.length === skills.length) return { provider, results }
        throw new Error(`${provider.label} only answered ${results.length}/${skills.length} required skills`)
      } catch (err) {
        lastError = err
        const message = err instanceof Error ? err.message : String(err)
        if (/HTTP 429/.test(message)) {
          if (/per day|\(TPD\)/i.test(message)) break
          console.log(`  ${provider.label} per-minute limit reached, waiting 65s…`)
          await sleep(65_000)
        } else if (attempt === 2) {
          break
        }
      }
    }
  }
  throw lastError
}

const projects = db.prepare("SELECT id, challenge_id, student_id FROM projects").all() as Row[]
// Evidence the analysis never reads (statements, videos, screenshots) — mirrors src/lib/evidenceTypes.ts.
const { NOT_ANALYZED_TYPES } = await import("../src/lib/evidenceTypes.ts")

// One grade per (project, student): each student's skills come only from their own evidence.
// The owner's entry is keyed by the project id (as it always was); teammates by `project:student`.
const pairs = projects.flatMap((proj) =>
  (db.prepare("SELECT DISTINCT student_id FROM skill_signals WHERE project_id = ? ORDER BY student_id").all(String(proj.id)) as Row[]).map((r) => ({
    proj,
    studentId: String(r.student_id),
  })),
)

for (const { proj, studentId } of pairs) {
  const projectId = String(proj.id)
  const key = studentId === String(proj.student_id) ? projectId : `${projectId}:${studentId}`
  const evidenceRows = db
    .prepare("SELECT id, type, title, description, content, fetched_content FROM evidence WHERE project_id = ? AND student_id = ? ORDER BY submitted_at")
    .all(projectId, studentId) as Row[]
  const evidence = evidenceRows
    .filter((r) => !NOT_ANALYZED_TYPES.includes(String(r.type)))
    .map((r) => ({
      id: String(r.id),
      type: String(r.type),
      title: String(r.title),
      description: String(r.description),
      content: [r.content, r.fetched_content].filter(Boolean).map(String).join("\n\n") || undefined,
    }))
  if (evidence.length === 0) continue

  // Exactly the skills seed.ts grades for this student (their seeded signals), so the hash
  // written here is the same one seed.ts recomputes when it looks the entry up.
  const skills = (db.prepare("SELECT skill FROM skill_signals WHERE project_id = ? AND student_id = ? ORDER BY id").all(projectId, studentId) as Row[]).map((r) => String(r.skill))
  if (skills.length === 0) continue
  const challengeRow = db.prepare("SELECT problem_description, objectives, expected_output FROM challenges WHERE id = ?").get(String(proj.challenge_id)) as Row
  const challenge = {
    problemDescription: String(challengeRow.problem_description),
    objectives: JSON.parse(String(challengeRow.objectives)) as string[],
    expectedOutput: String(challengeRow.expected_output),
  }

  // Already graded for exactly this evidence by some model: nothing to do (keeps re-runs cheap).
  const prior = existing[key]
  if (prior && prior.hash === hashEvidenceSet(skills, evidence, prior.model)) {
    console.log(`Already graded ${key} with ${prior.model}, skipping.`)
    continue
  }

  try {
    const { provider, results } = await gradeWithAnyProvider(skills, evidence, challenge)
    output[key] = { model: provider.model, hash: hashEvidenceSet(skills, evidence, provider.model), gradedAt: new Date().toISOString(), results }
    graded++
    console.log(`Graded ${key} (${skills.length} skills) with ${provider.model}`)
    writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
    await sleep(PACE_MS)
  } catch (err) {
    console.warn(`Failed to grade ${key}${existing[key] ? " — keeping its previous entry" : ""}:`, err instanceof Error ? err.message : err)
  }
}

if (graded === 0) {
  console.log(`No project needed (or could be) graded this run, so ${outPath} was left unchanged.`)
  process.exit(0)
}
console.log(`Graded ${graded} project(s); ${Object.keys(output).length} pre-graded project(s) now in ${outPath}`)
