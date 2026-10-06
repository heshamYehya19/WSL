// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { canStudentSee } from "../../src/lib/selectors.ts"
import type { Challenge, Project, Student } from "../../src/types.ts"

// A university assigns a challenge to ONE program (a major), not to the whole university. Only that program's students
// may see and start it; a student already on a project team for it (a teammate from another program) keeps access.
const JU = "university:uni-ju"
const ESTARTA = "company:org-estarta"
const AI = "student:stu-ju-omar" // B.Sc. Artificial Intelligence
const CS_SARA = "student:stu-ju-sara" // B.Sc. Computer Science
const CS_AHMAD = "student:stu-ju-ahmad" // B.Sc. Computer Science
const BIT = "student:stu-ju-tala" // B.Sc. Business Information Technology

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

interface Snap {
  challenges: Challenge[]
  projects: Project[]
  students: Student[]
  notifications: { title: string; body: string }[]
}
const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const csv = Buffer.from("building,kwh\nLibrary,120\nEngineering,340\n").toString("base64")

/** A new Estarta challenge for the University of Jordan, with a dataset attached, assigned to one program. */
async function assignedTo(programId: string) {
  const created = await server.call("POST", "/challenges", ESTARTA, {
    title: "Classify support tickets",
    problemDescription: "Support teams label tickets by hand, which is slow. Build something that routes a ticket to the right queue from its text.",
    requiredSkills: ["Python", "Machine Learning"],
    learningOutcomes: ["Classify short texts"],
    preferredUniversityId: "uni-ju",
    files: [{ kind: "dataset", name: "tickets.csv", data: csv }],
  })
  expect(created.status, JSON.stringify(created.json)).toBe(200)
  const id = (created.json.result as { id: string }).id
  expect((await server.call("POST", `/challenges/${id}/assign`, JU, { programId })).status).toBe(200)
  const fileId = ((await snapshot(JU)).challenges.find((c) => c.id === id)!.files[0] as { id: string }).id
  return { id, fileId }
}
const start = (id: string, actor: string) => server.call("POST", `/challenges/${id}/start`, actor)
const file = (id: string, fileId: string, actor: string) => server.fetch(`/challenges/${id}/files/${fileId}`, actor).then((r) => r.status)

describe("assigning a challenge to a program", () => {
  it("lets that program's students start it", async () => {
    const { id } = await assignedTo("prg-ju-ai")
    const res = await start(id, AI)
    expect(res.status).toBe(200)
    expect((res.json.result as { id: string }).id).toMatch(/^prj-/)
  })

  it("does not let the university's other programs start it — and says why", async () => {
    const { id } = await assignedTo("prg-ju-ai")
    for (const actor of [CS_SARA, CS_AHMAD, BIT]) {
      const res = await start(id, actor)
      expect(res.status, actor).toBe(403)
      expect(String(res.json.error), actor).toMatch(/Artificial Intelligence/)
      expect(String(res.json.error), actor).toMatch(/isn't open to your program/)
    }
    // No project was created for any of them.
    const projects = (await snapshot(JU)).projects.filter((p) => p.challengeId === id)
    expect(projects).toEqual([])
  })

  it("is the same whichever program it is assigned to", async () => {
    const { id } = await assignedTo("prg-ju-cs")
    expect((await start(id, AI)).status).toBe(403) // the AI student is now the one left out
    expect((await start(id, BIT)).status).toBe(403)
    expect((await start(id, CS_SARA)).status).toBe(200)
  })

  it("still keeps out students of other universities (even in the same major)", async () => {
    const { id } = await assignedTo("prg-ju-ai")
    const res = await start(id, "student:stu-aau-rahaf") // AI at Amman Arab University
    expect(res.status).toBe(403)
    expect(String(res.json.error)).toMatch(/hasn't assigned this challenge/)
  })

  it("notifies only the assigned program's students", async () => {
    const { id } = await assignedTo("prg-ju-ai")
    const had = async (actor: string) => (await snapshot(actor)).notifications.some((n) => n.title === "New challenge available" && n.body.includes("Classify support tickets"))
    expect(await had(AI)).toBe(true)
    for (const actor of [CS_SARA, CS_AHMAD, BIT]) expect(await had(actor), actor).toBe(false)
    expect(id).toBeTruthy()
  })
})

describe("the challenge's files follow the same rule", () => {
  it("are downloadable by the assigned program's students and not by the rest of the university", async () => {
    const { id, fileId } = await assignedTo("prg-ju-ai")
    expect(await file(id, fileId, AI)).toBe(200)
    for (const actor of [CS_SARA, CS_AHMAD, BIT, "student:stu-aau-rahaf"]) expect(await file(id, fileId, actor), actor).toBe(403)
    // The university and the company that wrote it are unaffected.
    expect(await file(id, fileId, JU)).toBe(200)
    expect(await file(id, fileId, ESTARTA)).toBe(200)
  })
})

describe("a teammate from another program keeps access to the project they were added to", () => {
  it("can open the project and the challenge files, and can still ask to start it (it returns their project)", async () => {
    const { id, fileId } = await assignedTo("prg-ju-ai")
    const started = await start(id, AI)
    const projectId = (started.json.result as { id: string }).id
    // Same-university teams are unchanged: the owner may add a classmate from another program.
    expect((await server.call("POST", `/projects/${projectId}/members`, AI, { studentId: "stu-ju-sara" })).status).toBe(200)
    expect(await file(id, fileId, CS_SARA)).toBe(200)
    const again = await start(id, CS_SARA)
    expect(again.status).toBe(200)
    expect((again.json.result as { id: string }).id).toBe(projectId)
    // Someone who was not added is still out.
    expect((await start(id, CS_AHMAD)).status).toBe(403)
    expect(await file(id, fileId, CS_AHMAD)).toBe(403)
  })

  it("the seeded EnergyWise team (Omar is in AI, the challenge was assigned to CS) is unaffected", async () => {
    const snap = await snapshot(AI)
    const energy = snap.challenges.find((c) => c.id === "chal-jes-energy")!
    const project = snap.projects.find((p) => p.id === "prj-jes-energywise")!
    expect(canStudentSee(energy, snap.students.find((s) => s.id === "stu-ju-omar")!, snap.projects)).toBe(true)
    expect(project.members.some((m) => m.studentId === "stu-ju-omar")).toBe(true)
    expect((await start("chal-jes-energy", AI)).status).toBe(200) // returns his existing project
  })
})

describe("what the student's screens use to decide: canStudentSee", () => {
  it("shows a challenge to the assigned program's students, hides it from the rest, and keeps it for teammates", async () => {
    const { id } = await assignedTo("prg-ju-ai")
    const snap = await snapshot(AI)
    const challenge = snap.challenges.find((c) => c.id === id)!
    const student = (sid: string) => snap.students.find((s) => s.id === sid)!
    expect(challenge.assignments).toEqual([expect.objectContaining({ universityId: "uni-ju", programId: "prg-ju-ai" })])
    expect(canStudentSee(challenge, student("stu-ju-omar"))).toBe(true)
    for (const sid of ["stu-ju-sara", "stu-ju-ahmad", "stu-ju-tala"]) expect(canStudentSee(challenge, student(sid)), sid).toBe(false)
    // …unless they are already on a team for it.
    const asTeammate = { ...snap.projects[0], challengeId: id, studentId: "stu-ju-omar", members: [{ studentId: "stu-ju-sara", roleNote: "" }] } as Project
    expect(canStudentSee(challenge, student("stu-ju-sara"), [asTeammate])).toBe(true)
    expect(canStudentSee(challenge, student("stu-ju-ahmad"), [asTeammate])).toBe(false)
  })
})
