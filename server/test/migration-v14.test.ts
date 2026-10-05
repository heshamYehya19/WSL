import { describe, expect, it, vi } from "vitest"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Builds a real database, rewinds it to the shape schema v13 had — skill signals unique per
// (project, skill), the analysis cache on the project, no per-student runs, no owner contribution,
// no challenge duration — then opens it again so migrate() runs v14 on it for real.
describe("v14 migration (individual proof for team projects)", () => {
  it("keeps every signal, moves each project's analysis cache to its owner, and makes signals per student", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wsl-migrate14-"))
    process.env.WSL_DB_PATH = join(dir, "wsl.db")
    process.env.WSL_SEED_GRADES_PATH = join(dir, "no-seed-grades.json")

    const first = (await import("../db.ts")).getDb()
    // A v13 database has one signal per (project, skill) — team members' signals are a v14 idea.
    first.exec("DELETE FROM skill_signals WHERE student_id != (SELECT student_id FROM projects WHERE projects.id = skill_signals.project_id)")
    const signalCount = (first.prepare("SELECT COUNT(*) AS n FROM skill_signals").get() as { n: number }).n
    expect(signalCount).toBeGreaterThan(0)

    // Rewind: the old uniqueness rule, the project-level cache, and none of the v14 columns/tables.
    first.exec("PRAGMA foreign_keys = OFF")
    const sql = (first.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'skill_signals'").get() as { sql: string }).sql
    const oldSql = sql.replace("UNIQUE (project_id, student_id, skill)", "UNIQUE (project_id, skill)").replace("skill_signals", "skill_signals_old")
    expect(oldSql).toContain("UNIQUE (project_id, skill)")
    first.exec(`${oldSql}; INSERT INTO skill_signals_old SELECT * FROM skill_signals; DROP TABLE skill_signals; ALTER TABLE skill_signals_old RENAME TO skill_signals;`)
    first.exec("DELETE FROM analysis_runs")
    first.exec("UPDATE projects SET graded_evidence_hash = 'hash-' || id, graded_model = 'offline', graded_at = '2026-01-01T00:00:00.000Z' WHERE id = 'prj-iris-anomaly-yazan'")
    first.exec("ALTER TABLE projects DROP COLUMN owner_role_note")
    first.exec("ALTER TABLE challenges DROP COLUMN duration")
    first.exec("ALTER TABLE challenges DROP COLUMN constraints_note")
    first.exec("PRAGMA user_version = 13")
    first.close()

    vi.resetModules()
    const reopened = (await import("../db.ts")).getDb()
    expect((reopened.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(14)

    // Nothing was lost, and a signal is now unique per (project, student, skill).
    expect((reopened.prepare("SELECT COUNT(*) AS n FROM skill_signals").get() as { n: number }).n).toBe(signalCount)
    const rebuilt = (reopened.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'skill_signals'").get() as { sql: string }).sql
    expect(rebuilt).toContain("UNIQUE (project_id, student_id, skill)")
    const insert = (student: string) =>
      reopened.prepare(
        `INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, status, suggested_level, analyzed_at)
         VALUES (?, 'prj-jes-energywise', ?, 'Brand New Skill', 10, 'Pending Verification', 'Insufficient', '2026-01-01')`,
      ).run(`sig-test-${student}`, student)
    insert("stu-ju-ahmad")
    insert("stu-ju-sara") // the same skill on the same project is fine for a different student
    expect(() => insert("stu-ju-ahmad")).toThrow()

    // The cache the project kept became its owner's analysis run.
    const run = reopened.prepare("SELECT evidence_hash, model FROM analysis_runs WHERE project_id = 'prj-iris-anomaly-yazan' AND student_id = 'stu-aau-yazan'").get() as { evidence_hash: string; model: string }
    expect(run).toEqual({ evidence_hash: "hash-prj-iris-anomaly-yazan", model: "offline" })

    // The new columns are back, with safe defaults.
    expect((reopened.prepare("SELECT owner_role_note FROM projects LIMIT 1").get() as { owner_role_note: string }).owner_role_note).toBe("")
    expect(reopened.prepare("SELECT duration, constraints_note FROM challenges LIMIT 1").get()).toEqual({ duration: "", constraints_note: "" })
  })
})
