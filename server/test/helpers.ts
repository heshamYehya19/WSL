import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:http"

// server/db.ts reads WSL_DB_PATH at module-load time, so it must be set before
// db.ts/api.ts are ever imported — hence the dynamic imports below instead of
// static ones. Each test FILE gets its own fresh module registry under vitest's
// default per-file isolation, so each file gets its own temp database and its
// own in-memory getDb() singleton — no cross-file contamination.
process.env.WSL_DB_PATH = join(mkdtempSync(join(tmpdir(), "wsl-test-")), "wsl.db")
process.env.WSL_DEMO_MODE ??= "true"

export const { resetDatabase } = await import("../db.ts")
export const { handleApi } = await import("../api.ts")

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
