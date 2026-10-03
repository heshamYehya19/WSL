import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Signal { id: string; skill: string; status: string; projectId: string }
interface ProjectRow { id: string; status: string }

const YAZAN_PROJECT = "prj-iris-anomaly-yazan"
const KHALED_PROJECT = "prj-estarta-access-khaled"

async function signalsFor(call: Awaited<ReturnType<typeof startServer>>["call"], actor: string, projectId: string) {
  const res = await call("GET", "/snapshot", actor)
  const all = (res.json.snapshot as { skillSignals: Signal[] }).skillSignals
  return all.filter((s) => s.projectId === projectId)
}

async function projectStatus(call: Awaited<ReturnType<typeof startServer>>["call"], actor: string, projectId: string) {
  const res = await call("GET", "/snapshot", actor)
  const projects = (res.json.snapshot as { projects: ProjectRow[] }).projects
  return projects.find((p) => p.id === projectId)!.status
}

const server = await startServer()

describe("challenge/project status rollup", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("advances to Skills Pending Verification on the first mentor decision", async () => {
    expect(await projectStatus(server.call, "university:uni-aau", YAZAN_PROJECT)).toBe("Evidence Under Review")
    const signals = await signalsFor(server.call, "university:uni-aau", YAZAN_PROJECT)
    await server.call("POST", `/projects/${YAZAN_PROJECT}/signals/${signals[0].id}/review`, "university:uni-aau", { decision: "verify" })
    expect(await projectStatus(server.call, "university:uni-aau", YAZAN_PROJECT)).toBe("Skills Pending Verification")
  })

  it("rejects /confirm while any signal is unresolved", async () => {
    const signals = await signalsFor(server.call, "university:uni-aau", YAZAN_PROJECT)
    await server.call("POST", `/projects/${YAZAN_PROJECT}/signals/${signals[0].id}/review`, "university:uni-aau", { decision: "verify" })
    const res = await server.call("POST", `/projects/${YAZAN_PROJECT}/confirm`, "university:uni-aau", {})
    expect(res.status).toBe(409)
  })

  it("confirming yields Verified once every signal is Verified", async () => {
    const signals = await signalsFor(server.call, "university:uni-aau", YAZAN_PROJECT)
    for (const s of signals) {
      await server.call("POST", `/projects/${YAZAN_PROJECT}/signals/${s.id}/review`, "university:uni-aau", { decision: "verify" })
    }
    const res = await server.call("POST", `/projects/${YAZAN_PROJECT}/confirm`, "university:uni-aau", {})
    expect(res.status).toBe(200)
    expect(await projectStatus(server.call, "university:uni-aau", YAZAN_PROJECT)).toBe("Verified")
  })

  it("confirming yields Completed when at least one signal is Rejected", async () => {
    // Khaled's project already has Network Security=Verified and Risk Assessment=More Evidence Requested.
    const signals = await signalsFor(server.call, "university:uni-just", KHALED_PROJECT)
    const riskAssessment = signals.find((s) => s.skill === "Risk Assessment")!
    const linux = signals.find((s) => s.skill === "Linux")!
    const technicalWriting = signals.find((s) => s.skill === "Technical Writing")!

    await server.call("POST", `/projects/${KHALED_PROJECT}/signals/${riskAssessment.id}/review`, "university:uni-just", {
      decision: "reject",
      reviewerNotes: "The methodology behind the ratings was never shown, even after a second look.",
    })
    await server.call("POST", `/projects/${KHALED_PROJECT}/signals/${linux.id}/review`, "university:uni-just", { decision: "verify" })
    await server.call("POST", `/projects/${KHALED_PROJECT}/signals/${technicalWriting.id}/review`, "university:uni-just", { decision: "verify" })

    const res = await server.call("POST", `/projects/${KHALED_PROJECT}/confirm`, "university:uni-just", {})
    expect(res.status).toBe(200)
    expect(await projectStatus(server.call, "university:uni-just", KHALED_PROJECT)).toBe("Completed")
  })
})
