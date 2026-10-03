import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Signal {
  id: string
  skill: string
  status: string
  evidenceConfidence: number
  verifiedAt?: string
  analyzedAt: string
  projectId: string
}

const PROJECT = "prj-estarta-access-khaled"

async function signalsFor(call: Awaited<ReturnType<typeof startServer>>["call"]) {
  const res = await call("GET", "/snapshot", "university:uni-just")
  const all = (res.json.snapshot as { skillSignals: Signal[] }).skillSignals
  return all.filter((s) => s.projectId === PROJECT)
}

const server = await startServer()

describe("ai-review re-analysis", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("re-running ai-review updates unresolved signals but never touches an already-Verified one", async () => {
    const before = await signalsFor(server.call)
    const networkSecurityBefore = before.find((s) => s.skill === "Network Security")!
    expect(networkSecurityBefore.status).toBe("Verified")
    const riskAssessmentBefore = before.find((s) => s.skill === "Risk Assessment")!
    expect(riskAssessmentBefore.status).toBe("More Evidence Requested")

    const evidenceRes = await server.call("POST", `/projects/${PROJECT}/evidence`, "student:stu-just-khaled", {
      type: "Documentation",
      title: "Risk Matrix Methodology",
      link: "https://docs.example.com/khaled/risk-matrix",
      content:
        "We rated every finding using a 5x5 likelihood/impact risk matrix against CIS Benchmarks for VPN, VDI, and the Linux jump-host. Remote agent access to client systems was reviewed control by control, and each gap was prioritized into the hardening plan.",
    })
    expect(evidenceRes.status).toBe(200)

    const reviewRes = await server.call("POST", `/projects/${PROJECT}/ai-review`, "student:stu-just-khaled")
    expect(reviewRes.status).toBe(200)

    const after = await signalsFor(server.call)
    const networkSecurityAfter = after.find((s) => s.skill === "Network Security")!
    expect(networkSecurityAfter.status).toBe("Verified")
    expect(networkSecurityAfter.verifiedAt).toBe(networkSecurityBefore.verifiedAt)
    expect(networkSecurityAfter.analyzedAt).toBe(networkSecurityBefore.analyzedAt)

    // A rejected-or-pending signal earns a fresh mentor look from new evidence.
    const riskAssessmentAfter = after.find((s) => s.skill === "Risk Assessment")!
    expect(riskAssessmentAfter.status).toBe("Pending Verification")
    expect(riskAssessmentAfter.analyzedAt).not.toBe(riskAssessmentBefore.analyzedAt)
  })
})
