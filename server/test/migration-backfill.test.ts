import { describe, expect, it, vi } from "vitest"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Builds a real database, rewinds it to schema v12 with one model-graded and one
// offline-graded signal both stored as 'offline' (what v12's default produced), then
// opens it again with a fresh module so migrate() runs v13 on it for real.
describe("v13 and v14 migrations", () => {
  it("marks signals the model graded before v12 as model-graded, and leaves offline ones alone", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wsl-migrate-"))
    process.env.WSL_DB_PATH = join(dir, "wsl.db")
    process.env.WSL_SEED_GRADES_PATH = join(dir, "no-seed-grades.json")

    const first = (await import("../db.ts")).getDb()
    const [modelRow, offlineRow] = first.prepare("SELECT id FROM skill_signals ORDER BY id LIMIT 2").all() as { id: string }[]
    first.prepare("UPDATE skill_signals SET ai_note = ?, graded_source = 'offline' WHERE id = ?").run(
      "Graded by openai/gpt-oss-120b against this challenge. Fits a tuned Isolation Forest.",
      modelRow.id,
    )
    first.prepare("UPDATE skill_signals SET ai_note = ?, graded_source = 'offline' WHERE id = ?").run(
      "Found 3 concrete signs of Python in the student's own content.",
      offlineRow.id,
    )
    first.exec("PRAGMA user_version = 12")
    first.close()

    vi.resetModules()
    const reopened = (await import("../db.ts")).getDb()
    const source = (id: string) => (reopened.prepare("SELECT graded_source FROM skill_signals WHERE id = ?").get(id) as { graded_source: string }).graded_source
    expect(source(modelRow.id)).toBe("model")
    expect(source(offlineRow.id)).toBe("offline")
    expect((reopened.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(14)
  })
})
