import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Signal { id: string; skill: string; status: string; verifiedBy?: string; verifiedAt?: string; projectId: string }

// Omar's project is already "Company Feedback Received" in the seed — all 4 signals Verified.
const VERIFIED_PROJECT = "prj-estarta-intent-omar"
// Yazan's project is still "Evidence Under Review" — too early for company feedback.
const UNCONFIRMED_PROJECT = "prj-iris-anomaly-yazan"

async function signalsFor(call: Awaited<ReturnType<typeof startServer>>["call"], actor: string, projectId: string) {
  const res = await call("GET", "/snapshot", actor)
  const all = (res.json.snapshot as { skillSignals: Signal[] }).skillSignals
  return all.filter((s) => s.projectId === projectId)
}

const server = await startServer()

describe("company feedback never affects verification", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("submitting feedback does not change any signal's status or verifiedBy", async () => {
    const before = await signalsFor(server.call, "university:uni-ju", VERIFIED_PROJECT)
    expect(before.every((s) => s.status === "Verified")).toBe(true)

    const res = await server.call("POST", `/projects/${VERIFIED_PROJECT}/company-feedback`, "company:org-estarta", {
      strongTechnicalExecution: true,
      relevantForInternship: true,
      interestedInSpeaking: false,
      note: "Really strong bilingual intent classifier.",
    })
    expect(res.status).toBe(200)

    const after = await signalsFor(server.call, "university:uni-ju", VERIFIED_PROJECT)
    expect(after).toEqual(before)
  })

  it("rejects feedback before the project is Verified or Completed", async () => {
    const res = await server.call("POST", `/projects/${UNCONFIRMED_PROJECT}/company-feedback`, "company:org-iris", {
      strongTechnicalExecution: true,
      relevantForInternship: false,
      interestedInSpeaking: false,
      note: "",
    })
    expect(res.status).toBe(409)
  })
})
