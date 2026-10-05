import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

const server = await startServer()

describe("/reset", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("restores the expected seeded project count", async () => {
    const res = await server.call("POST", "/reset", "university:uni-ju", {})
    expect(res.status).toBe(200)
    const snap = res.json.snapshot as { projects: unknown[] }
    expect(snap.projects.length).toBe(12)
  })

  it("is rejected outside demo mode", async () => {
    const original = process.env.WSL_DEMO_MODE
    process.env.WSL_DEMO_MODE = "false"
    try {
      const res = await server.call("POST", "/reset", "university:uni-ju", {})
      expect(res.status).toBe(403)
    } finally {
      process.env.WSL_DEMO_MODE = original
    }
  })
})
