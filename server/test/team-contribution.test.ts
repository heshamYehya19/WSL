import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

const PROJECT = "prj-jes-energywise"
const CHALLENGE = "chal-jes-energy"
const AHMAD = "student:stu-ju-ahmad"
const SARA = "student:stu-ju-sara"
const OMAR = "student:stu-ju-omar"
const TALA = "student:stu-ju-tala" // same university, not on the team yet
const YAZAN = "student:stu-aau-yazan" // a different university
const JU = "university:uni-ju"

interface Snap {
  projects: { id: string; challengeId: string; studentId: string; ownerRoleNote: string; members: { studentId: string; roleNote: string }[] }[]
  evidence: { id: string; projectId: string; studentId: string; type: string; content?: string }[]
  skillSignals: { projectId: string; studentId: string; skill: string; status: string; suggestedLevel: string; evidenceIds: string[] }[]
  challenges: { id: string; title: string; duration: string; constraints: string; expectedOutput: string }[]
  notifications: { title: string; body: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const project = async (actor = AHMAD) => (await snapshot(actor)).projects.find((p) => p.id === PROJECT)!
const addMember = (studentId: string, actor = AHMAD) => server.call("POST", `/projects/${PROJECT}/members`, actor, { studentId })
const removeMember = (studentId: string, actor = AHMAD) => server.call("POST", `/projects/${PROJECT}/members/${studentId}/remove`, actor)
const setContribution = (text: string, actor: string) => server.call("POST", `/projects/${PROJECT}/contribution`, actor, { text })

describe("building a team", () => {
  it("lets the project owner add a classmate, who is told about it", async () => {
    expect((await addMember("stu-ju-tala")).status).toBe(200)
    const team = (await project()).members.map((m) => m.studentId)
    expect(team).toContain("stu-ju-tala")
    expect((await snapshot(TALA)).notifications.some((n) => n.title === "You were added to a team project")).toBe(true)
  })

  it("starts a teammate with no contribution recorded — nothing is assumed about what they did", async () => {
    await addMember("stu-ju-tala")
    expect((await project()).members.find((m) => m.studentId === "stu-ju-tala")!.roleNote).toBe("")
  })

  it("keeps teams inside one university", async () => {
    const res = await addMember("stu-aau-yazan")
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("studentId")
    expect(String(res.json.error)).toMatch(/study at your university/)
  })

  it("won't add someone twice, the owner to their own team, or someone who isn't a student", async () => {
    expect((await addMember("stu-ju-sara")).status).toBe(409)
    expect((await addMember("stu-ju-ahmad")).status).toBe(409)
    expect((await addMember("stu-nobody")).status).toBe(400)
    expect((await server.call("POST", `/projects/${PROJECT}/members`, AHMAD, {})).status).toBe(400)
  })

  it("only lets the owner add teammates", async () => {
    expect((await addMember("stu-ju-tala", SARA)).status).toBe(403)
    expect((await addMember("stu-ju-tala", TALA)).status).toBe(403)
    expect((await addMember("stu-ju-tala", "company:org-jes")).status).toBe(403)
  })

  it("gives a teammate access to the project, and a stranger none", async () => {
    await addMember("stu-ju-tala")
    expect((await snapshot(TALA)).projects.some((p) => p.id === PROJECT)).toBe(true)
    const stranger = await snapshot(YAZAN)
    expect(stranger.evidence.some((e) => e.projectId === PROJECT)).toBe(false)
    expect((await server.call("POST", `/projects/${PROJECT}/evidence`, YAZAN, { type: "Contribution Statement", title: "x", content: "I did a lot of work on this project overall." })).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)).status).toBe(403)
  })

  it("opens a teammate's project instead of starting a second one for the same challenge", async () => {
    const own = await server.call("POST", `/challenges/${CHALLENGE}/start`, SARA)
    expect(own.status).toBe(200)
    expect((own.json.result as { id: string }).id).toBe(PROJECT)
    expect((await snapshot(SARA)).projects.filter((p) => p.challengeId === CHALLENGE)).toHaveLength(1)
  })

  it("won't pull a student who is already on another project for this challenge", async () => {
    // Tala starts nothing here, but a second project on the same challenge would need a program that
    // was assigned it — so use the seeded team: Sara is already on Ahmad's project.
    const res = await addMember("stu-ju-sara")
    expect(res.status).toBe(409)
    expect(String(res.json.error)).toMatch(/already/)
  })
})

describe("removing and leaving", () => {
  it("lets the owner remove a teammate who hasn't submitted anything, and a teammate leave", async () => {
    await addMember("stu-ju-tala")
    expect((await removeMember("stu-ju-tala")).status).toBe(200)
    expect((await project()).members.some((m) => m.studentId === "stu-ju-tala")).toBe(false)

    await addMember("stu-ju-tala")
    expect((await removeMember("stu-ju-tala", TALA)).status).toBe(200)
    expect((await project()).members.some((m) => m.studentId === "stu-ju-tala")).toBe(false)
  })

  it("keeps a teammate who has submitted evidence — their work is part of the record", async () => {
    const res = await removeMember("stu-ju-omar")
    expect(res.status).toBe(409)
    expect(String(res.json.error)).toMatch(/already submitted evidence/)
    expect((await project()).members.some((m) => m.studentId === "stu-ju-omar")).toBe(true)
  })

  it("never removes the owner, and only the owner or the teammate themselves can remove someone", async () => {
    expect((await removeMember("stu-ju-ahmad", SARA)).status).toBe(400)
    await addMember("stu-ju-tala")
    expect((await removeMember("stu-ju-tala", SARA)).status).toBe(403)
    expect((await removeMember("stu-ju-tala", "company:org-jes")).status).toBe(403)
  })
})

describe("recording your own contribution", () => {
  it("lets each member write their own, leaving everyone else's untouched", async () => {
    const before = await project()
    expect((await setContribution("Cleaned the readings and wrote the loading script for the team.", OMAR)).status).toBe(200)
    const after = await project()
    expect(after.members.find((m) => m.studentId === "stu-ju-omar")!.roleNote).toBe("Cleaned the readings and wrote the loading script for the team.")
    expect(after.members.find((m) => m.studentId === "stu-ju-sara")!.roleNote).toBe(before.members.find((m) => m.studentId === "stu-ju-sara")!.roleNote)
    expect(after.ownerRoleNote).toBe(before.ownerRoleNote)
  })

  it("lets the owner record theirs too", async () => {
    expect((await setContribution("Schema design and the SQL reports.", AHMAD)).status).toBe(200)
    expect((await project()).ownerRoleNote).toBe("Schema design and the SQL reports.")
  })

  it("asks for a real sentence, and names the field", async () => {
    for (const text of ["", "ok", "x".repeat(401)]) {
      const res = await setContribution(text, SARA)
      expect(res.status).toBe(400)
      expect(res.json.field).toBe("text")
    }
  })

  it("only lets people on the team record one", async () => {
    expect((await setContribution("I did the database work for the team.", TALA)).status).toBe(403)
    expect((await setContribution("I did the database work for the team.", YAZAN)).status).toBe(403)
  })

  it("is a claim, not proof: recording a contribution adds no evidence and verifies nothing", async () => {
    const before = await snapshot(AHMAD)
    await setContribution("Database design, SQL analysis, and the data pipeline.", AHMAD)
    const after = await snapshot(AHMAD)
    expect(after.evidence).toHaveLength(before.evidence.length)
    expect(after.skillSignals.map((s) => s.status)).toEqual(before.skillSignals.map((s) => s.status))
  })
})

describe("a contribution statement without supporting work", () => {
  async function addTalaWithOnlyAStatement() {
    await addMember("stu-ju-tala")
    await setContribution("I organized the team's meetings and wrote the project plan.", TALA)
    const res = await server.call("POST", `/projects/${PROJECT}/evidence`, TALA, {
      type: "Contribution Statement",
      title: "What I contributed",
      content: "I led the data cleaning, designed the whole database schema and trained the machine learning model for the team.",
    })
    expect(res.status).toBe(200)
  }

  it("never becomes proof: analysis finds nothing for any skill from a statement alone", async () => {
    await addTalaWithOnlyAStatement()
    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, TALA)
    expect(res.status).toBe(200)
    const signals = (await snapshot(TALA)).skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === "stu-ju-tala")
    expect(signals.map((s) => s.skill).sort()).toEqual(["Data Analysis", "Data Visualization", "Machine Learning", "Python", "SQL"])
    for (const sig of signals) {
      expect(sig.suggestedLevel).toBe("Insufficient")
      expect(sig.status).toBe("Pending Verification")
      expect(sig.evidenceIds).toEqual([])
    }
  })

  it("is shown to the reviewer next to the student's own evidence", async () => {
    await addTalaWithOnlyAStatement()
    const evidence = (await snapshot(JU)).evidence.filter((e) => e.projectId === PROJECT && e.studentId === "stu-ju-tala")
    expect(evidence.map((e) => e.type)).toEqual(["Contribution Statement"])
  })

  it("does not stop the team's confirmation: a skill nobody has evidence for needs no decision", async () => {
    await addTalaWithOnlyAStatement()
    await server.call("POST", `/projects/${PROJECT}/ai-review`, TALA)
    const snap = await snapshot(JU)
    for (const sig of snap.skillSignals.filter((s) => s.projectId === PROJECT && s.suggestedLevel !== "Insufficient")) {
      const res = await server.call("POST", `/projects/${PROJECT}/signals/${(sig as unknown as { id: string }).id}/review`, JU, { decision: "verify" })
      expect(res.status).toBe(200)
    }
    expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, {})).status).toBe(200)
    const company = await snapshot("company:org-jes")
    expect(company.skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === "stu-ju-tala" && s.status === "Verified")).toHaveLength(0)
  })
})

describe("the student with no evidence", () => {
  it("has nothing to analyze, so no skill is ever credited to them", async () => {
    await addMember("stu-ju-tala")
    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, TALA)
    expect(res.status).toBe(409)
    expect(String(res.json.error)).toMatch(/at least one piece of evidence/)
    expect((await snapshot(TALA)).skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === "stu-ju-tala")).toHaveLength(0)
  })
})

describe("a challenge brief that says how long it takes and what to respect", () => {
  const brief = {
    title: "Optimize campus lighting schedules",
    problemDescription: "A university wants to cut the electricity used by corridor and lecture-hall lighting without leaving students in the dark.",
    requiredSkills: ["Python", "SQL"],
    learningOutcomes: ["Analyze occupancy and lighting data"],
    deliverables: "A schedule recommendation, the analysis behind it, and a short report.",
    duration: "3–4 weeks",
    constraints: "Use the anonymized occupancy sample only.",
  }

  it("keeps the duration, constraints and deliverables the company wrote", async () => {
    const res = await server.call("POST", "/challenges", "company:org-jes", brief)
    expect(res.status).toBe(200)
    const created = (await snapshot("company:org-jes")).challenges.find((c) => c.title === brief.title)!
    expect(created.duration).toBe("3–4 weeks")
    expect(created.constraints).toBe("Use the anonymized occupancy sample only.")
    expect(created.expectedOutput).toBe(brief.deliverables)
  })

  it("treats all three as optional", async () => {
    const res = await server.call("POST", "/challenges", "company:org-jes", { ...brief, title: "Another challenge", deliverables: "", duration: "", constraints: "" })
    expect(res.status).toBe(200)
    const created = (await snapshot("company:org-jes")).challenges.find((c) => c.title === "Another challenge")!
    expect(created.duration).toBe("")
    expect(created.constraints).toBe("")
    expect(created.expectedOutput).toMatch(/working prototype/)
  })

  it("shows the seeded Smart Campus Energy Optimization brief in full", async () => {
    const seeded = (await snapshot("company:org-jes")).challenges.find((c) => c.id === CHALLENGE)!
    expect(seeded.title).toBe("Smart Campus Energy Optimization")
    expect(seeded.duration).toBe("4–6 weeks")
    expect(seeded.constraints).toMatch(/anonymized sample data/)
    expect(seeded.expectedOutput).toMatch(/dashboard/)
  })
})
