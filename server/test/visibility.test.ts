import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface SnapshotEvidence { id: string; projectId: string }
interface SnapshotSignal { id: string; projectId: string }
interface SnapshotShape { evidence: SnapshotEvidence[]; skillSignals: SnapshotSignal[] }

const server = await startServer()

describe("snapshot visibility", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("a company only sees evidence/signals for projects confirmed to companies, regardless of who owns the challenge", async () => {
    const res = await server.call("GET", "/snapshot", "company:org-estarta")
    const snap = res.json.snapshot as unknown as SnapshotShape

    // prj-iris-anomaly-yazan is still "Evidence Under Review" (never confirmed) — must not leak,
    // even to a totally unrelated company, since this exercises the buildSnapshot fix directly.
    expect(snap.evidence.some((e) => e.projectId === "prj-iris-anomaly-yazan")).toBe(false)
    expect(snap.skillSignals.some((s) => s.projectId === "prj-iris-anomaly-yazan")).toBe(false)

    // prj-echo-helpdesk-leen is "Verified" — confirmed evidence is discoverable cross-company.
    expect(snap.evidence.some((e) => e.projectId === "prj-echo-helpdesk-leen")).toBe(true)
    expect(snap.skillSignals.some((s) => s.projectId === "prj-echo-helpdesk-leen")).toBe(true)
  })

  it("a university only sees its own students' evidence and signals", async () => {
    const res = await server.call("GET", "/snapshot", "university:uni-hu")
    const snap = res.json.snapshot as unknown as SnapshotShape

    // prj-estarta-intent-omar belongs to a University of Jordan student, not HU.
    expect(snap.evidence.some((e) => e.projectId === "prj-estarta-intent-omar")).toBe(false)
    expect(snap.skillSignals.some((s) => s.projectId === "prj-estarta-intent-omar")).toBe(false)

    // prj-echo-helpdesk-leen belongs to an HU student.
    expect(snap.evidence.some((e) => e.projectId === "prj-echo-helpdesk-leen")).toBe(true)
    expect(snap.skillSignals.some((s) => s.projectId === "prj-echo-helpdesk-leen")).toBe(true)
  })

  it("a student only sees evidence for their own projects and ones they're a team member on", async () => {
    const res = await server.call("GET", "/snapshot", "student:stu-ju-omar")
    const snap = res.json.snapshot as unknown as SnapshotShape

    // stu-ju-omar is a project_members row on prj-skytech-maintenance-sara (Sara's project).
    expect(snap.evidence.some((e) => e.projectId === "prj-skytech-maintenance-sara")).toBe(true)
    // Not a member of, nor the owner of, prj-echo-helpdesk-leen.
    expect(snap.evidence.some((e) => e.projectId === "prj-echo-helpdesk-leen")).toBe(false)
  })
})
