import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

// One shared project, three students: what the system must keep apart. The seeded EnergyWise
// project (Jordan Energy Solutions' "Smart Campus Energy Optimization") has Ahmad on SQL and the
// data pipeline, Sara on machine learning, and Omar on the dashboard — each with their own evidence.
const PROJECT = "prj-jes-energywise"
const AHMAD = "student:stu-ju-ahmad"
const SARA = "student:stu-ju-sara"
const OMAR = "student:stu-ju-omar"
const JU = "university:uni-ju"
const ids = { ahmad: "stu-ju-ahmad", sara: "stu-ju-sara", omar: "stu-ju-omar" }

interface Signal {
  id: string
  projectId: string
  studentId: string
  skill: string
  status: string
  suggestedLevel: string
  evidenceIds: string[]
  verifiedBy?: string
  reviewerNotes?: string
}
interface Evidence {
  id: string
  projectId: string
  studentId: string
  type: string
  title: string
}
interface Snap {
  skillSignals: Signal[]
  evidence: Evidence[]
  projects: { id: string; status: string; studentId: string; ownerRoleNote: string; members: { studentId: string; roleNote: string }[] }[]
  notifications: { title: string; body: string }[]
  staff: { id: string; name: string; universityId: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const signalsOf = (snap: Snap, studentId: string) => snap.skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === studentId)
const signal = (snap: Snap, studentId: string, skill: string) => signalsOf(snap, studentId).find((s) => s.skill === skill)!
const review = (signalId: string, body: Record<string, unknown>, actor = JU) => server.call("POST", `/projects/${PROJECT}/signals/${signalId}/review`, actor, body)

describe("the EnergyWise team: one project, individual proof", () => {
  it("records every member's own contribution, owner included", async () => {
    const project = (await snapshot(AHMAD)).projects.find((p) => p.id === PROJECT)!
    expect(project.studentId).toBe(ids.ahmad)
    expect(project.ownerRoleNote).toMatch(/SQL/)
    expect(project.members.map((m) => m.studentId).sort()).toEqual([ids.omar, ids.sara])
    expect(project.members.find((m) => m.studentId === ids.sara)!.roleNote).toMatch(/machine-learning/)
    expect(project.members.find((m) => m.studentId === ids.omar)!.roleNote).toMatch(/Dashboard/)
  })

  it("keeps the whole team inside one university", async () => {
    const snap = (await server.call("GET", "/snapshot", JU)).json.snapshot as unknown as { students: { id: string; universityId: string }[] }
    const universities = new Set(["stu-ju-ahmad", "stu-ju-sara", "stu-ju-omar"].map((id) => snap.students.find((s) => s.id === id)!.universityId))
    expect(universities).toEqual(new Set(["uni-ju"]))
  })

  it("gives each student their own signals for every required skill", async () => {
    const snap = await snapshot(JU)
    for (const id of Object.values(ids)) {
      expect(signalsOf(snap, id).map((s) => s.skill).sort()).toEqual(["Data Analysis", "Data Visualization", "Machine Learning", "Python", "SQL"])
    }
  })

  it("analyzes each student only from their own evidence", async () => {
    const snap = await snapshot(JU)
    const author = new Map(snap.evidence.map((e) => [e.id, e.studentId]))
    for (const sig of snap.skillSignals.filter((s) => s.projectId === PROJECT)) {
      for (const evidenceId of sig.evidenceIds) expect(author.get(evidenceId), `${sig.studentId} ${sig.skill} cites ${evidenceId}`).toBe(sig.studentId)
    }
  })

  it("finds each student's skill in their own work and nowhere else", async () => {
    const snap = await snapshot(JU)
    // Ahmad wrote the SQL; Sara and Omar did not, and must not inherit it.
    expect(signal(snap, ids.ahmad, "SQL").suggestedLevel).not.toBe("Insufficient")
    expect(signal(snap, ids.sara, "SQL").suggestedLevel).toBe("Insufficient")
    expect(signal(snap, ids.omar, "SQL").suggestedLevel).toBe("Insufficient")
    // Sara trained the model; Ahmad and Omar did not.
    expect(signal(snap, ids.sara, "Machine Learning").suggestedLevel).not.toBe("Insufficient")
    expect(signal(snap, ids.ahmad, "Machine Learning").suggestedLevel).toBe("Insufficient")
    expect(signal(snap, ids.omar, "Machine Learning").suggestedLevel).toBe("Insufficient")
    // Omar built the dashboard; the others did not.
    expect(signal(snap, ids.omar, "Data Visualization").suggestedLevel).not.toBe("Insufficient")
    expect(signal(snap, ids.ahmad, "Data Visualization").suggestedLevel).toBe("Insufficient")
    expect(signal(snap, ids.sara, "Data Visualization").suggestedLevel).toBe("Insufficient")
  })

  it("never credits Ahmad's SQL evidence to Sara or Omar, nor Sara's model to Ahmad", async () => {
    const snap = await snapshot(JU)
    const ahmadSql = signal(snap, ids.ahmad, "SQL").evidenceIds
    expect(ahmadSql.length).toBeGreaterThan(0)
    for (const other of [ids.sara, ids.omar]) {
      for (const sig of signalsOf(snap, other)) expect(sig.evidenceIds.some((e) => ahmadSql.includes(e))).toBe(false)
    }
    const saraMl = signal(snap, ids.sara, "Machine Learning").evidenceIds
    for (const sig of signalsOf(snap, ids.ahmad)) expect(sig.evidenceIds.some((e) => saraMl.includes(e))).toBe(false)
  })

  it("leaves every skill awaiting university verification until a reviewer decides", async () => {
    const snap = await snapshot(JU)
    for (const sig of snap.skillSignals.filter((s) => s.projectId === PROJECT)) {
      expect(sig.status).toBe("Pending Verification")
      expect(sig.verifiedBy).toBeUndefined()
    }
  })
})

describe("university review is per student and per skill", () => {
  it("verifying Ahmad's SQL verifies nothing else — not Sara's SQL, not Ahmad's other skills", async () => {
    const before = await snapshot(JU)
    const res = await review(signal(before, ids.ahmad, "SQL").id, { decision: "verify" })
    expect(res.status).toBe(200)

    const after = await snapshot(JU)
    expect(signal(after, ids.ahmad, "SQL").status).toBe("Verified")
    expect(signal(after, ids.sara, "SQL").status).toBe("Pending Verification")
    expect(signal(after, ids.omar, "SQL").status).toBe("Pending Verification")
    expect(signal(after, ids.ahmad, "Python").status).toBe("Pending Verification")
    expect(after.skillSignals.filter((s) => s.projectId === PROJECT && s.status === "Verified")).toHaveLength(1)
  })

  it("records who verified it: the reviewer from the student's own university", async () => {
    const before = await snapshot(JU)
    await review(signal(before, ids.sara, "Machine Learning").id, { decision: "verify", reviewerNotes: "Evaluation matches the claimed contribution." })
    const after = await snapshot(JU)
    const verified = signal(after, ids.sara, "Machine Learning")
    expect(verified.status).toBe("Verified")
    expect(verified.reviewerNotes).toBe("Evaluation matches the claimed contribution.")
    expect(after.staff.find((s) => s.id === verified.verifiedBy)!.universityId).toBe("uni-ju")
  })

  it("tells only the student whose skill was reviewed", async () => {
    const before = await snapshot(JU)
    await review(signal(before, ids.sara, "Machine Learning").id, { decision: "verify" })
    expect((await snapshot(SARA)).notifications.some((n) => n.title === '"Machine Learning" verified')).toBe(true)
    expect((await snapshot(AHMAD)).notifications.some((n) => n.title === '"Machine Learning" verified')).toBe(false)
    expect((await snapshot(OMAR)).notifications.some((n) => n.title === '"Machine Learning" verified')).toBe(false)
  })

  it("lets the reviewer ask one student for more evidence without touching the rest of the team", async () => {
    const before = await snapshot(JU)
    const res = await review(signal(before, ids.omar, "Python").id, { decision: "request-more-evidence", reviewerNotes: "Please add the code that loads the data." })
    expect(res.status).toBe(200)
    const after = await snapshot(JU)
    expect(signal(after, ids.omar, "Python").status).toBe("More Evidence Requested")
    expect(signal(after, ids.omar, "Python").reviewerNotes).toBe("Please add the code that loads the data.")
    expect(signal(after, ids.ahmad, "Python").status).toBe("Pending Verification")
    expect(signal(after, ids.sara, "Python").status).toBe("Pending Verification")
  })

  it("can decline to verify: Not Verified is the university's decision on the evidence, not on the student", async () => {
    const before = await snapshot(JU)
    const res = await review(signal(before, ids.ahmad, "Data Analysis").id, { decision: "reject", reviewerNotes: "The evidence doesn't yet show the analysis itself." })
    expect(res.status).toBe(200)
    const after = await snapshot(JU)
    expect(signal(after, ids.ahmad, "Data Analysis").status).toBe("Rejected")
    expect(signal(after, ids.sara, "Data Analysis").status).toBe("Pending Verification")
  })

  it("requires a note when asking for more evidence or declining", async () => {
    const snap = await snapshot(JU)
    expect((await review(signal(snap, ids.ahmad, "Python").id, { decision: "reject" })).status).toBe(400)
    expect((await review(signal(snap, ids.ahmad, "Python").id, { decision: "request-more-evidence" })).status).toBe(400)
  })

  it("only lets a student's own university review their skills", async () => {
    const snap = await snapshot(JU)
    expect((await review(signal(snap, ids.ahmad, "SQL").id, { decision: "verify" }, "university:uni-aau")).status).toBe(403)
    expect((await review(signal(snap, ids.ahmad, "SQL").id, { decision: "verify" }, AHMAD)).status).toBe(403)
    expect(signal(await snapshot(JU), ids.ahmad, "SQL").status).toBe("Pending Verification")
  })

  it("keeps a verified skill verified when its student adds more evidence later", async () => {
    const before = await snapshot(JU)
    await review(signal(before, ids.ahmad, "SQL").id, { decision: "verify" })
    await server.call("POST", `/projects/${PROJECT}/evidence`, AHMAD, {
      type: "Documentation",
      title: "More energy reports",
      link: "https://docs.example.com/energy-reports",
      content: "SELECT building_id, AVG(energy_kwh) AS average_kwh FROM energy_usage GROUP BY building_id ORDER BY average_kwh DESC; The meter readings show which campus buildings use the most energy.",
    })
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, AHMAD)).status).toBe(200)
    expect(signal(await snapshot(JU), ids.ahmad, "SQL").status).toBe("Verified")
  })
})

describe("confirming a team project to the company", () => {
  async function decideEverything(decision: "verify" | "reject") {
    const snap = await snapshot(JU)
    for (const sig of snap.skillSignals.filter((s) => s.projectId === PROJECT)) {
      const res = await review(sig.id, { decision, reviewerNotes: "Reviewed against the submitted evidence." })
      expect(res.status).toBe(200)
    }
  }

  it("waits until every student's skills have a final decision", async () => {
    const snap = await snapshot(JU)
    await review(signal(snap, ids.ahmad, "SQL").id, { decision: "verify" })
    const res = await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Ready." })
    expect(res.status).toBe(409)
  })

  it("shares each student's verified proof with the company once confirmed, and tells the whole team", async () => {
    await decideEverything("verify")
    expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Confirmed." })).status).toBe(200)

    const company = await snapshot("company:org-jes")
    for (const id of Object.values(ids)) {
      expect(signalsOf(company, id).filter((s) => s.status === "Verified").length).toBeGreaterThan(0)
    }
    // Each student's evidence is theirs: the company can tell whose is whose.
    expect(company.evidence.filter((e) => e.projectId === PROJECT && e.studentId === ids.ahmad).length).toBeGreaterThan(0)
    for (const actor of [AHMAD, SARA, OMAR]) {
      expect((await snapshot(actor)).notifications.some((n) => n.title.startsWith("Evidence confirmed to"))).toBe(true)
    }
  })

  it("closes the project to new evidence and team changes after it is confirmed", async () => {
    await decideEverything("verify")
    await server.call("POST", `/projects/${PROJECT}/confirm`, JU, {})
    const evidence = await server.call("POST", `/projects/${PROJECT}/evidence`, SARA, { type: "Contribution Statement", title: "Late note", content: "A statement written after the project was confirmed." })
    expect(evidence.status).toBe(409)
    const add = await server.call("POST", `/projects/${PROJECT}/members`, AHMAD, { studentId: "stu-ju-tala" })
    expect(add.status).toBe(409)
  })

  it("hides unconfirmed teamwork from companies", async () => {
    const company = await snapshot("company:org-jes")
    expect(company.evidence.filter((e) => e.projectId === PROJECT)).toHaveLength(0)
    expect(company.skillSignals.filter((s) => s.projectId === PROJECT)).toHaveLength(0)
  })
})

describe("a required skill nobody has evidence for", () => {
  it("is Insufficient evidence for every student on the project — the challenge asking for it proves nothing", async () => {
    // SkyTech's maintenance project requires REST API Design, but neither Sara's dashboard nor Omar's model
    // shows any: the requirement is not evidence, for anyone on the team.
    const snap = (await server.call("GET", "/snapshot", "university:uni-ju")).json.snapshot as unknown as Snap
    const rest = snap.skillSignals.filter((s) => s.projectId === "prj-skytech-maintenance-sara" && s.skill === "REST API Design")
    expect(rest.map((s) => s.studentId).sort()).toEqual(["stu-ju-omar", "stu-ju-sara"])
    for (const sig of rest) {
      expect(sig.suggestedLevel).toBe("Insufficient")
      expect(sig.status).toBe("Pending Verification")
    }
  })
})
