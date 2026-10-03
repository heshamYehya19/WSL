import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

const server = await startServer()

describe("ownership checks", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("a student cannot submit evidence to another student's project", async () => {
    // prj-estarta-intent-omar belongs to stu-ju-omar — stu-hu-leen tries to add evidence to it.
    const res = await server.call("POST", "/projects/prj-estarta-intent-omar/evidence", "student:stu-hu-leen", {
      type: "Code",
      title: "intrusion.py",
      content: "x".repeat(40),
    })
    expect(res.status).toBe(403)
  })

  it("a student cannot trigger ai-review on another student's project", async () => {
    const res = await server.call("POST", "/projects/prj-estarta-intent-omar/ai-review", "student:stu-hu-leen")
    expect(res.status).toBe(403)
  })

  it("a university cannot review another university's students' signals", async () => {
    // prj-iris-anomaly-yazan's student is at uni-aau — uni-hu tries to review one of its signals.
    const snap = await server.call("GET", "/snapshot", "university:uni-aau")
    const signal = (snap.json.snapshot as { skillSignals: { id: string; projectId: string }[] }).skillSignals.find(
      (s) => s.projectId === "prj-iris-anomaly-yazan",
    )!
    const res = await server.call("POST", `/projects/prj-iris-anomaly-yazan/signals/${signal.id}/review`, "university:uni-hu", { decision: "verify" })
    expect(res.status).toBe(403)
  })

  it("a company cannot confirm or review another company's challenge submissions", async () => {
    const res = await server.call("POST", "/projects/prj-estarta-intent-omar/company-feedback", "company:org-echo", {
      strongTechnicalExecution: true,
      relevantForInternship: false,
      interestedInSpeaking: false,
      note: "",
    })
    expect(res.status).toBe(403)
  })
})
