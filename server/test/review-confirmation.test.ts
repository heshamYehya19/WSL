import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { llmDeps } from "../ml/llm-grader.ts"
import { criteriaLabelsFor } from "../ml/analyze.ts"

// The confirmation invariant: every team member x every required skill needs a CURRENT, EXPLICIT
// university decision before a project is confirmed to the company.
//   Resolved:   Verified, Rejected (Not Verified), Insufficient Evidence the university acknowledged.
//   Unresolved: Pending, More Evidence Requested, never reviewed, no decision at all, or stale.
const PROJECT = "prj-jes-energywise"
const AHMAD = "student:stu-ju-ahmad"
const JU = "university:uni-ju"
const JES = "company:org-jes"
const SKILLS = ["Python", "Data Analysis", "SQL", "Machine Learning", "Data Visualization"]

interface Signal {
  id: string
  projectId: string
  studentId: string
  skill: string
  status: string
  suggestedLevel: string
  evidenceIds: string[]
  analyzedAt: string
}
interface ReviewItem {
  studentId: string
  skill: string
  state: string
  stale: boolean
  resolved: boolean
}
interface Snap {
  skillSignals: Signal[]
  evidence: { id: string; projectId: string; studentId: string; type: string; title: string }[]
  projects: { id: string; status: string; review: { ready: boolean; problems: string[]; items: ReviewItem[] } | null; analysis: { studentId: string; model: string; gradedAt: string }[] }[]
}

const server = await startServer()
afterAll(() => server.close())
const realFetch = llmDeps.fetch
beforeEach(() => resetDatabase())
afterEach(() => {
  llmDeps.fetch = realFetch
  delete process.env.GEMINI_API_KEY
})

const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const signalsOf = (snap: Snap, studentId: string) => snap.skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === studentId)
const signal = (snap: Snap, studentId: string, skill: string) => signalsOf(snap, studentId).find((s) => s.skill === skill)!
const reviewSignal = (id: string, body: Record<string, unknown>) => server.call("POST", `/projects/${PROJECT}/signals/${id}/review`, JU, body)
const reviewSkill = (studentId: string, skill: string, body: Record<string, unknown>) =>
  server.call("POST", `/projects/${PROJECT}/students/${studentId}/skills/${encodeURIComponent(skill)}/review`, JU, body)
const confirm = () => server.call("POST", `/projects/${PROJECT}/confirm`, JU, {})
const addEvidence = (actor: string, body: Record<string, unknown>) => server.call("POST", `/projects/${PROJECT}/evidence`, actor, body)
const analyze = (actor: string) => server.call("POST", `/projects/${PROJECT}/ai-review`, actor)
const addTala = () => server.call("POST", `/projects/${PROJECT}/members`, AHMAD, { studentId: "stu-ju-tala" })
const item = async (studentId: string, skill: string) => (await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.review!.items.find((i) => i.studentId === studentId && i.skill === skill)!

/** Decides every cell of the seeded team the way the evidence supports: verify what WSL found, acknowledge what it did not. */
async function decideTeam() {
  const snap = await snapshot(JU)
  for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
    const res = await reviewSignal(s.id, { decision: s.suggestedLevel === "Insufficient" ? "insufficient" : "verify" })
    expect(res.status).toBe(200)
  }
}

describe("the seeded team has 15 cells and none is decided", () => {
  it("lists every student x every required skill, all unresolved", async () => {
    const review = (await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.review!
    expect(review.items).toHaveLength(3 * SKILLS.length)
    expect(review.ready).toBe(false)
    expect(review.items.every((i) => !i.resolved)).toBe(true)
    expect((await confirm()).status).toBe(409)
  })
})

describe("a team member with no signal", () => {
  it("1. cannot be skipped: confirmation stays blocked until each of their skills has a decision", async () => {
    await decideTeam()
    expect((await addTala()).status).toBe(200)
    expect((await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.review!.items.filter((i) => i.studentId === "stu-ju-tala")).toHaveLength(SKILLS.length)
    expect((await confirm()).status).toBe(409)
    for (const skill of SKILLS.slice(0, 4)) await reviewSkill("stu-ju-tala", skill, { decision: "insufficient" })
    expect((await confirm()).status).toBe(409) // one skill still undecided
    await reviewSkill("stu-ju-tala", SKILLS[4], { decision: "insufficient" })
    expect((await confirm()).status).toBe(200)
  })

  it("an unreviewed skill with no signal reads 'unreviewed', and only the no-signal route can decide it", async () => {
    await addTala()
    expect((await item("stu-ju-tala", "SQL")).state).toBe("unreviewed")
    // There is no analysis to verify or decline.
    expect((await reviewSkill("stu-ju-tala", "SQL", { decision: "verify" })).status).toBe(409)
    expect((await reviewSkill("stu-ju-tala", "SQL", { decision: "reject", reviewerNotes: "No." })).status).toBe(409)
    // And only a required skill of the project's own challenge.
    expect((await reviewSkill("stu-ju-tala", "Cooking", { decision: "insufficient" })).status).toBe(404)
  })
})

describe("insufficient evidence", () => {
  it("2. a required skill with no evidence is not decided until the reviewer acknowledges it", async () => {
    const snap = await snapshot(JU)
    const found = signal(snap, "stu-ju-ahmad", "Machine Learning")
    expect(found.suggestedLevel).toBe("Insufficient")
    expect(found.status).toBe("Pending Verification")
    expect((await item("stu-ju-ahmad", "Machine Learning")).state).toBe("unreviewed")
    expect((await item("stu-ju-ahmad", "Machine Learning")).resolved).toBe(false)
  })

  it("3. an explicit acknowledgement resolves that skill, and only that skill", async () => {
    const snap = await snapshot(JU)
    expect((await reviewSignal(signal(snap, "stu-ju-ahmad", "Machine Learning").id, { decision: "insufficient" })).status).toBe(200)
    const after = await snapshot(JU)
    expect(signal(after, "stu-ju-ahmad", "Machine Learning").status).toBe("Insufficient Evidence")
    expect(await item("stu-ju-ahmad", "Machine Learning")).toMatchObject({ state: "acknowledged", stale: false, resolved: true })
    expect((await item("stu-ju-ahmad", "Data Visualization")).resolved).toBe(false)
    expect((await item("stu-ju-sara", "Machine Learning")).resolved).toBe(false)
  })

  it("can be acknowledged only where WSL found nothing; where it found evidence the reviewer decides on that evidence", async () => {
    const snap = await snapshot(JU)
    const res = await reviewSignal(signal(snap, "stu-ju-ahmad", "SQL").id, { decision: "insufficient" })
    expect(res.status).toBe(409)
  })

  it("is never proof: an acknowledged skill is invisible to a company, and the project is Completed, not Verified", async () => {
    await decideTeam()
    expect((await confirm()).status).toBe(200)
    const projectStatus = (await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.status
    expect(projectStatus).toBe("Completed")
    const company = await snapshot(JES)
    expect(company.skillSignals.filter((s) => s.projectId === PROJECT).every((s) => s.status === "Verified")).toBe(true)
  })
})

describe("the other decisions", () => {
  it("4. Verified resolves a skill", async () => {
    const snap = await snapshot(JU)
    await reviewSignal(signal(snap, "stu-ju-ahmad", "SQL").id, { decision: "verify" })
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "verified", resolved: true })
  })

  it("5. Rejected / Not Verified is an explicit, resolved decision — and does not block confirmation", async () => {
    const snap = await snapshot(JU)
    for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
      const decision = s.suggestedLevel === "Insufficient" ? { decision: "insufficient" } : s.skill === "SQL" && s.studentId === "stu-ju-ahmad" ? { decision: "reject", reviewerNotes: "The queries do not match the brief." } : { decision: "verify" }
      expect((await reviewSignal(s.id, decision)).status).toBe(200)
    }
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "not-verified", resolved: true })
    expect((await confirm()).status).toBe(200)
    expect((await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.status).toBe("Completed")
    // Not Verified is hidden from the company like every other non-verified state.
    expect(signalsOf(await snapshot(JES), "stu-ju-ahmad").some((s) => s.skill === "SQL")).toBe(false)
  })

  it("6. More Evidence Requested blocks confirmation", async () => {
    await decideTeam()
    const snap = await snapshot(JU)
    expect((await reviewSignal(signal(snap, "stu-ju-ahmad", "SQL").id, { decision: "request-more-evidence", reviewerNotes: "Add the reports." })).status).toBe(200)
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "more-evidence", resolved: false })
    expect((await confirm()).status).toBe(409)
  })

  it("asking for more evidence on a skill with no signal also blocks, and a note is required", async () => {
    await addTala()
    expect((await reviewSkill("stu-ju-tala", "SQL", { decision: "request-more-evidence" })).status).toBe(400)
    expect((await reviewSkill("stu-ju-tala", "SQL", { decision: "request-more-evidence", reviewerNotes: "Show your queries." })).status).toBe(200)
    expect(await item("stu-ju-tala", "SQL")).toMatchObject({ state: "more-evidence", resolved: false })
  })
})

describe("evidence added after a decision", () => {
  const SQL_MORE = {
    type: "Documentation",
    title: "More energy reports",
    link: "https://docs.example.com/energy-reports",
    content: "SELECT building_id, AVG(energy_kwh) AS average_kwh FROM energy_usage GROUP BY building_id ORDER BY average_kwh DESC; The meter readings show which campus buildings use the most energy.",
  }

  it("7. makes the student's decisions stale and blocks confirmation", async () => {
    await decideTeam()
    await addEvidence(AHMAD, { type: "Contribution Statement", title: "Addendum", content: "I also reviewed the team's pull requests for the pipeline." })
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "verified", stale: true, resolved: false })
    expect((await item("stu-ju-sara", "SQL")).resolved).toBe(true) // a teammate's decisions are untouched
    expect((await confirm()).status).toBe(409)
  })

  it("8. analyzable evidence stays blocking until it is analyzed AND the reviewer has looked again", async () => {
    await decideTeam()
    await addEvidence(AHMAD, SQL_MORE)
    expect((await confirm()).status).toBe(409) // not analyzed yet

    expect((await analyze(AHMAD)).status).toBe(200)
    expect((await confirm()).status).toBe(409) // analyzed, but nobody has reviewed the new analysis

    // The reviewer re-decides every cell of that student that is no longer current.
    const snap = await snapshot(JU)
    const stale = snap.projects.find((p) => p.id === PROJECT)!.review!.items.filter((i) => !i.resolved)
    expect(stale.every((i) => i.studentId === "stu-ju-ahmad")).toBe(true)
    for (const i of stale) {
      const s = signal(snap, i.studentId, i.skill)
      await reviewSignal(s.id, { decision: s.suggestedLevel === "Insufficient" ? "insufficient" : "verify" })
    }
    expect((await confirm()).status).toBe(200)
  })

  it("9. a video added after review also invalidates it: all new evidence is review-relevant", async () => {
    await decideTeam()
    expect((await addEvidence(AHMAD, { type: "Video Walkthrough", title: "Late demo", link: "https://youtube.com/watch?v=late" })).status).toBe(200)
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ stale: true, resolved: false })
    expect((await confirm()).status).toBe(409)
    // Analysis does not read a video, so there is nothing to re-analyze: the reviewer simply looks again.
    expect((await analyze(AHMAD)).json.result).toMatchObject({ unchanged: true })
    const snap = await snapshot(JU)
    for (const s of signalsOf(snap, "stu-ju-ahmad")) await reviewSignal(s.id, { decision: s.suggestedLevel === "Insufficient" ? "insufficient" : "verify" })
    expect((await confirm()).status).toBe(200)
  })

  it("10. re-analysing one student leaves a teammate's signals, cache and verification exactly as they were", async () => {
    const before = await snapshot(JU)
    await reviewSignal(signal(before, "stu-ju-sara", "Machine Learning").id, { decision: "verify" })
    const sara = JSON.stringify(signalsOf(await snapshot(JU), "stu-ju-sara"))
    const saraRun = (await snapshot(JU)).projects.find((p) => p.id === PROJECT)!.analysis.find((a) => a.studentId === "stu-ju-sara")

    await addEvidence(AHMAD, SQL_MORE)
    expect((await analyze(AHMAD)).status).toBe(200)

    const after = await snapshot(JU)
    expect(JSON.stringify(signalsOf(after, "stu-ju-sara"))).toBe(sara)
    expect(after.projects.find((p) => p.id === PROJECT)!.analysis.find((a) => a.studentId === "stu-ju-sara")).toEqual(saraRun)
    expect(signal(after, "stu-ju-sara", "Machine Learning").status).toBe("Verified")
  })
})

describe("a verification that no longer matches the evidence", () => {
  it("Phase 3. cannot verify a skill WSL found no evidence for — the server refuses, not only the UI", async () => {
    const snap = await snapshot(JU)
    const nothing = signal(snap, "stu-ju-ahmad", "Machine Learning")
    expect(nothing.suggestedLevel).toBe("Insufficient")
    for (const body of [{ decision: "verify" }, { decision: "verify", suggestedLevel: "Advanced" }]) {
      const res = await reviewSignal(nothing.id, body)
      expect(res.status).toBe(409)
      expect(String(res.json.error)).toMatch(/Insufficient Evidence|acknowledge/i)
    }
    expect(signal(await snapshot(JU), "stu-ju-ahmad", "Machine Learning").status).toBe("Pending Verification")
    // The same applies to a skill that has no signal yet.
    await addTala()
    expect((await reviewSkill("stu-ju-tala", "SQL", { decision: "verify" })).status).toBe(409)
  })

  // A model whose answer the test controls, so it decides exactly what WSL "found": every skill is graded 80 with
  // three criteria met, quoting one line of the student's own work.
  function mockModel(quote: { evidenceId: string; text: string }) {
    process.env.GEMINI_API_KEY = "test-key"
    llmDeps.fetch = async () => {
      const payload = {
        restatesBrief: false,
        skills: SKILLS.map((skill) => ({ skill, score: 80, criteriaMet: criteriaLabelsFor(skill).slice(0, 3), reason: "Working queries.", quotes: [{ ...quote, why: "Shows the skill." }] })),
      }
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
    }
  }
  const FIRST_LINE = { evidenceId: "ev-energy-ahmad-1", text: "CREATE TABLE buildings (" }
  const NEW_LINE = "SELECT building_id, AVG(energy_kwh) AS average_kwh FROM energy_usage GROUP BY building_id ORDER BY average_kwh DESC;"
  const addMoreSql = () =>
    addEvidence(AHMAD, {
      type: "Documentation",
      title: "More energy reports",
      link: "https://docs.example.com/energy-reports",
      content: `${NEW_LINE} The meter readings show which campus buildings use the most energy.`,
    })
  async function verifySql() {
    mockModel(FIRST_LINE)
    expect((await analyze(AHMAD)).json.result).toMatchObject({ unchanged: false, failed: false })
    const sql = signal(await snapshot(JU), "stu-ju-ahmad", "SQL")
    expect(sql.suggestedLevel).not.toBe("Insufficient")
    expect((await reviewSignal(sql.id, { decision: "verify", reviewerNotes: "Matches the contribution." })).status).toBe(200)
    return signal(await snapshot(JU), "stu-ju-ahmad", "SQL")
  }

  it("Phase 4. new evidence that changes a verified skill is analyzed in, and the verification stops standing", async () => {
    const verified = await verifySql()
    expect(verified.status).toBe("Verified")
    expect(verified.evidenceIds).toEqual(["ev-energy-ahmad-1"])

    expect((await addMoreSql()).status).toBe(200)
    const added = (await snapshot(AHMAD)).evidence.find((e) => e.title === "More energy reports")!
    mockModel({ evidenceId: added.id, text: NEW_LINE }) // the analysis now rests on the new work
    expect((await analyze(AHMAD)).json.result).toMatchObject({ unchanged: false, failed: false })

    const after = signal(await snapshot(JU), "stu-ju-ahmad", "SQL")
    expect(after.evidenceIds).toEqual([added.id]) // the new evidence is in the signal
    expect(after.status).toBe("Pending Verification") // and the old verification no longer applies to it
    expect(after.analyzedAt > verified.analyzedAt).toBe(true)
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "pending", resolved: false })
    expect((await confirm()).status).toBe(409)

    // Verified again, or declined, or sent back: the reviewer decides on the evidence as it now is.
    expect((await reviewSignal(after.id, { decision: "reject", reviewerNotes: "The new reports do not answer the brief." })).status).toBe(200)
    expect(signal(await snapshot(JU), "stu-ju-ahmad", "SQL").status).toBe("Rejected")
    expect((await reviewSignal(after.id, { decision: "verify" })).status).toBe(200)
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "verified", stale: false, resolved: true })
  })

  it("Phase 4. a verified skill the new evidence does not change keeps its verification, but still needs a fresh look at the new evidence", async () => {
    const verified = await verifySql()
    expect((await addMoreSql()).status).toBe(200)
    mockModel(FIRST_LINE) // WSL finds exactly what it found before
    expect((await analyze(AHMAD)).json.result).toMatchObject({ unchanged: false })
    const after = signal(await snapshot(JU), "stu-ju-ahmad", "SQL")
    expect(after).toMatchObject({ status: "Verified", evidenceIds: verified.evidenceIds, analyzedAt: verified.analyzedAt })
    // It is new evidence all the same: the earlier decision predates it, so it does not count until the reviewer decides again.
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ state: "verified", stale: true, resolved: false })
    expect((await reviewSignal(after.id, { decision: "verify" })).status).toBe(200)
    expect(await item("stu-ju-ahmad", "SQL")).toMatchObject({ stale: false, resolved: true })
  })

  it("Phase 4. a model that cannot be reached leaves a verified skill as it was", async () => {
    await verifySql()
    expect((await addMoreSql()).status).toBe(200)
    process.env.GEMINI_API_KEY = "test-key"
    llmDeps.fetch = async () => Response.json({ error: { message: "Rate limit reached" } }, { status: 429 })
    expect((await analyze(AHMAD)).json.result).toMatchObject({ failed: true })
    expect(signal(await snapshot(JU), "stu-ju-ahmad", "SQL").status).toBe("Verified")
    expect((await item("stu-ju-ahmad", "SQL")).stale).toBe(true) // the new evidence is still unanalyzed, so it blocks
  })

  it("Phase 4. the student and the university are told that a verified skill needs a new review", async () => {
    await verifySql()
    expect((await addMoreSql()).status).toBe(200)
    const added = (await snapshot(AHMAD)).evidence.find((e) => e.title === "More energy reports")!
    mockModel({ evidenceId: added.id, text: NEW_LINE })
    await analyze(AHMAD)
    const notes = async (actor: string) => ((await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as { notifications: { title: string; body: string }[] }).notifications
    expect((await notes(JU)).find((n) => n.title === "Verified skill needs a new review")?.body).toMatch(/SQL/)
    expect((await notes(AHMAD)).find((n) => n.title === "A verified skill will be reviewed again")?.body).toMatch(/SQL/)
  })
})
