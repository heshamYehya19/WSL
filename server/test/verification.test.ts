import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Signal { id: string; skill: string; status: string; verifiedBy?: string; verifiedAt?: string; projectId: string }

const PROJECT = "prj-iris-anomaly-yazan"

async function signalsFor(call: Awaited<ReturnType<typeof startServer>>["call"], actor: string) {
  const res = await call("GET", "/snapshot", actor)
  const all = (res.json.snapshot as { skillSignals: Signal[] }).skillSignals
  return all.filter((s) => s.projectId === PROJECT)
}

const server = await startServer()

describe("per-signal verification", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("verifying a signal sets status/verifiedBy/verifiedAt and is reflected immediately", async () => {
    const before = await signalsFor(server.call, "university:uni-aau")
    const python = before.find((s) => s.skill === "Python")!
    expect(python.status).toBe("Pending Verification")

    const res = await server.call("POST", `/projects/${PROJECT}/signals/${python.id}/review`, "university:uni-aau", { decision: "verify" })
    expect(res.status).toBe(200)

    const after = await signalsFor(server.call, "university:uni-aau")
    const pythonAfter = after.find((s) => s.skill === "Python")!
    expect(pythonAfter.status).toBe("Verified")
    expect(pythonAfter.verifiedBy).toBeTruthy()
    expect(pythonAfter.verifiedAt).toBeTruthy()
  })

  it("rejects a decision without reviewerNotes when rejecting", async () => {
    const before = await signalsFor(server.call, "university:uni-aau")
    const ml = before.find((s) => s.skill === "Machine Learning")!

    const res = await server.call("POST", `/projects/${PROJECT}/signals/${ml.id}/review`, "university:uni-aau", { decision: "reject" })
    expect(res.status).toBe(400)
  })

  it("rejects a decision without reviewerNotes when requesting more evidence", async () => {
    const before = await signalsFor(server.call, "university:uni-aau")
    const net = before.find((s) => s.skill === "Network Security")!

    const res = await server.call("POST", `/projects/${PROJECT}/signals/${net.id}/review`, "university:uni-aau", { decision: "request-more-evidence" })
    expect(res.status).toBe(400)
  })
})
