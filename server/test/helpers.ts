import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:http"

// server/db.ts reads WSL_DB_PATH at module-load time, so it must be set before
// db.ts/api.ts are ever imported — hence the dynamic imports below instead of
// static ones. Each test FILE gets its own fresh module registry under vitest's
// default per-file isolation, so each file gets its own temp database and its
// own in-memory getDb() singleton — no cross-file contamination.
const testDir = mkdtempSync(join(tmpdir(), "wsl-test-"))
process.env.WSL_DB_PATH = join(testDir, "wsl.db")
process.env.WSL_DEMO_MODE ??= "true"
// Seed from the offline scorer, not the committed pre-graded file, so test
// expectations never shift when someone regenerates server/ml/seed-grades.json.
process.env.WSL_SEED_GRADES_PATH = join(testDir, "no-seed-grades.json")

export const { resetDatabase } = await import("../db.ts")
export const { handleApi } = await import("../api.ts")

// llm-grader.ts loads a developer's real .env on import. Tests must never reach a
// live model (slow, flaky, and it spends the real daily quota), so drop any keys it
// loaded — a test that needs a provider sets a fake key and mocks llmDeps.fetch.
for (const k of ["GROQ_API_KEY", "GROQ_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL", "WSL_AI_PROVIDER"]) delete process.env[k]

export interface TestResponse {
  status: number
  json: Record<string, unknown>
}

export interface TestServer {
  close: () => Promise<void>
  /** Calls `/api{path}` against a real ephemeral http server — the exact same
   * handleApi contract server/index.ts and vite.config.ts use in production/dev. */
  call: (method: string, path: string, actor?: string, body?: unknown) => Promise<TestResponse>
}

export async function startServer(): Promise<TestServer> {
  const server = createServer((req, res) => {
    handleApi(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404
        res.end()
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0

  return {
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    call: async (method, path, actor, body) => {
      const res = await fetch(`http://localhost:${port}/api${path}`, {
        method,
        headers: { ...(actor ? { "X-WSL-Actor": actor } : {}), "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return { status: res.status, json }
    },
  }
}
