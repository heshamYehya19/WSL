// Pre-grades every seeded project's evidence with the live model (Groq or Gemini,
// whichever is configured) and writes the result to server/ml/seed-grades.json.
// seed.ts reads that file at seed time, using the stored result whenever its hash
// still matches the current evidence — so the demo tour never needs a live model
// call, and never depends on quota, even when nobody has a key configured at all.
//
// Run with `npm run db:grade-seed`. Needs GROQ_API_KEY or GEMINI_API_KEY; with
// neither set, it prints a message and exits without changing anything, so it's
// always safe to run.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Isolated from the real dev database — this only ever reads the fresh, offline-graded
// seed data to know what evidence/challenges to grade, never anything a user submitted.
process.env.WSL_DB_PATH = join(mkdtempSync(join(tmpdir(), "wsl-grade-seed-")), "wsl.db")

const { getDb } = await import("../server/db.ts")
const { configuredProvider, gradeWithModel } = await import("../server/ml/llm-grader.ts")
const { hashEvidenceSet } = await import("../server/ai.ts")

const provider = configuredProvider()
if (!provider) {
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

const projects = db.prepare("SELECT id, challenge_id FROM projects").all() as Row[]

for (const proj of projects) {
  const projectId = String(proj.id)
  const evidenceRows = db
    .prepare("SELECT id, type, title, description, content, fetched_content FROM evidence WHERE project_id = ? ORDER BY submitted_at")
    .all(projectId) as Row[]
  if (evidenceRows.length === 0) continue
  const evidence = evidenceRows.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    title: String(r.title),
    description: String(r.description),
    content: [r.content, r.fetched_content].filter(Boolean).map(String).join("\n\n") || undefined,
  }))

  // Exactly the skills seed.ts grades for this project (its seeded signals), so the
  // hash written here is the same one seed.ts recomputes when it looks the entry up.
  const skills = (db.prepare("SELECT skill FROM skill_signals WHERE project_id = ? ORDER BY id").all(projectId) as Row[]).map((r) => String(r.skill))
  if (skills.length === 0) continue
  const challengeRow = db.prepare("SELECT problem_description, objectives, expected_output FROM challenges WHERE id = ?").get(String(proj.challenge_id)) as Row
  const challenge = {
    problemDescription: String(challengeRow.problem_description),
    objectives: JSON.parse(String(challengeRow.objectives)) as string[],
    expectedOutput: String(challengeRow.expected_output),
  }

  try {
    const results = await gradeWithModel(provider, skills, evidence, challenge)
    if (results.length !== skills.length) {
      console.warn(`Skipping ${projectId}: the model only answered ${results.length}/${skills.length} required skills.`)
      continue
    }
    output[projectId] = { model: provider.model, hash: hashEvidenceSet(skills, evidence, provider.model), gradedAt: new Date().toISOString(), results }
    graded++
    console.log(`Graded ${projectId} (${skills.length} skills) with ${provider.model}`)
  } catch (err) {
    console.warn(`Failed to grade ${projectId}${existing[projectId] ? " — keeping its previous entry" : ""}:`, err instanceof Error ? err.message : err)
  }
}

if (graded === 0) {
  console.log(`No project could be graded this run, so ${outPath} was left unchanged.`)
  process.exit(1)
}
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Graded ${graded} project(s); ${Object.keys(output).length} pre-graded project(s) now in ${outPath}`)
