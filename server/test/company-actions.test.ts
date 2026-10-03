import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Action { id: string; studentId: string; kind: string; opportunityId?: string }

async function actionsFor(call: Awaited<ReturnType<typeof startServer>>["call"], actor: string) {
  const res = await call("GET", "/snapshot", actor)
  return (res.json.snapshot as { companyActions: Action[] }).companyActions
}

const server = await startServer()

describe("company engagement actions", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("saving a student toggles on then off", async () => {
    const saveRes = await server.call("POST", "/students/stu-hu-dana/company-actions", "company:org-echo", { kind: "saved" })
    expect(saveRes.status).toBe(200)
    expect((await actionsFor(server.call, "company:org-echo")).some((a) => a.studentId === "stu-hu-dana" && a.kind === "saved")).toBe(true)

    const unsaveRes = await server.call("POST", "/students/stu-hu-dana/company-actions", "company:org-echo", { kind: "saved" })
    expect(unsaveRes.status).toBe(200)
    expect((await actionsFor(server.call, "company:org-echo")).some((a) => a.studentId === "stu-hu-dana" && a.kind === "saved")).toBe(false)
  })

  it("inviting the same student to the same opportunity twice is rejected", async () => {
    // Seed already has org-estarta invite stu-ju-omar to opp-estarta-cx.
    const res = await server.call("POST", "/students/stu-ju-omar/company-actions", "company:org-estarta", {
      kind: "invited",
      opportunityId: "opp-estarta-cx",
      note: "Would still love to chat.",
    })
    expect(res.status).toBe(409)
  })

  it("inviting requires an opportunity owned by the caller", async () => {
    const res = await server.call("POST", "/students/stu-hu-dana/company-actions", "company:org-estarta", {
      kind: "invited",
      opportunityId: "opp-estarta-cx",
    })
    // opp-estarta-cx is owned by org-estarta, but has already been used for this exact
    // student/opportunity pair in the seed only for stu-ju-omar — a fresh student/opportunity
    // pair owned by the caller should succeed.
    expect(res.status).toBe(200)
  })

  it("inviting to an opportunity the caller doesn't own is rejected", async () => {
    const res = await server.call("POST", "/students/stu-hu-dana/company-actions", "company:org-echo", {
      kind: "invited",
      opportunityId: "opp-estarta-cx",
    })
    expect(res.status).toBe(400)
  })
})
