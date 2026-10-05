// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { getDb } from "../db.ts"
import { companyProjectAccess, engagedStudentCount } from "../../src/lib/selectors.ts"
import type { Project, SkillSignal } from "../../src/types.ts"

// Level 3A.1. A company learns who a student is only through the one boundary Talent Discovery uses — eligible verified
// proof (see eligibleProofs in server/api.ts). Everyone else is "a student": no name in history, notifications or feedback,
// and no studentId on a project. And the proof a company is shown can actually be opened.
const JES = "company:org-jes"
const ESTARTA = "company:org-estarta"
const JU = "university:uni-ju"
const PROJECT = "prj-jes-energywise"
const COMPANIES = ["org-jes", "org-estarta", "org-echo", "org-skytech", "org-iris", "org-abs"].map((id) => `company:${id}`)

interface Snap {
  challenges: { id: string; title: string; history: { status: string; note?: string }[] }[]
  notifications: { title: string; body: string; link: string | null }[]
  projects: (Omit<Project, "studentId"> & { studentId?: string })[]
  students: { id: string; name: string }[]
  evidence: { id: string; projectId: string; studentId: string; title: string }[]
  skillSignals: SkillSignal[]
  companyActions: { studentId: string; kind: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const db = () => getDb()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const snapshot = async (actor: string, query = "") => (await server.call("GET", `/snapshot${query}`, actor)).json.snapshot as unknown as Snap
const raw = async (actor: string, query = "") => JSON.stringify((await server.call("GET", `/snapshot${query}`, actor)).json)
const talent = async (actor = JES) => (await server.call("GET", "/talent", actor)).json as unknown as { candidates: { studentId: string; matched: { projectId: string }[] }[] }

/** Every student, split into the ones a company can discover (the browse list) and everyone else. */
async function people() {
  const everyone = db().prepare("SELECT id, name FROM students").all() as { id: string; name: string }[]
  const eligible = new Set((await talent()).candidates.map((c) => c.studentId))
  return { eligible, hidden: everyone.filter((s) => !eligible.has(s.id)), visible: everyone.filter((s) => eligible.has(s.id)) }
}

async function confirmEnergyWise(note = "Confirmed.") {
  const snap = (await server.call("GET", "/snapshot", JU)).json.snapshot as unknown as Snap
  for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
    const body = s.suggestedLevel === "Insufficient" ? { decision: "insufficient" } : { decision: "verify" }
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, body)).status).toBe(200)
  }
  expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note })).status).toBe(200)
}

describe("the seed really does name students a company cannot discover", () => {
  it("(precondition) internal history and company notifications carry hidden students' names", async () => {
    const { hidden } = await people()
    expect(hidden.length).toBeGreaterThanOrEqual(8)
    const notes = (db().prepare("SELECT note FROM challenge_history WHERE note IS NOT NULL").all() as { note: string }[]).map((r) => r.note).join("\n")
    const bodies = (db().prepare("SELECT body FROM notifications WHERE recipient_role = 'company'").all() as { body: string }[]).map((r) => r.body).join("\n")
    expect(hidden.filter((s) => notes.includes(s.name)).length).toBeGreaterThanOrEqual(3)
    expect(hidden.filter((s) => bodies.includes(s.name)).length).toBeGreaterThanOrEqual(1)
    // …and the university, who may know them, is still sent those notes whole.
    expect(((await snapshot(JU)).challenges.flatMap((c) => c.history.map((h) => h.note ?? "")).join("\n"))).toContain("Khaled Rawashdeh started the project.")
  })
})

describe("student names in what a company is sent", () => {
  it("A/B. no company is sent an undiscoverable student's name, at any depth — and the names are not just gone everywhere", async () => {
    const { hidden, visible } = await people()
    for (const actor of COMPANIES) {
      const text = await raw(actor)
      for (const s of hidden) {
        expect(text, `${actor} / ${s.name}`).not.toContain(s.name)
        expect(text, `${actor} / ${s.id}`).not.toContain(`"${s.id}"`)
      }
    }
    // Students the company can discover are still named for it (their own entry in the student list at the very least).
    const names = (await snapshot(ESTARTA)).students.map((s) => s.name)
    for (const s of visible) expect(names).toContain(s.name)
  })

  it("C. history notes keep their meaning in neutral wording, and the reviewer is the university", async () => {
    const reviewing = db().prepare("SELECT challenge_id AS id, note FROM challenge_history WHERE note LIKE '%began reviewing Khaled Rawashdeh%'").get() as { id: string; note: string }
    const started = db().prepare("SELECT challenge_id AS id FROM challenge_history WHERE note = 'Khaled Rawashdeh started the project.'").get() as { id: string }
    const uni = (db().prepare("SELECT u.name FROM universities u JOIN staff s ON s.university_id = u.id WHERE s.name = 'Dr. Rania Al-Shorman'").get() as { name: string }).name
    for (const actor of COMPANIES) {
      const notes = (c: string) => (async () => (await snapshot(actor)).challenges.find((x) => x.id === c)!.history.map((h) => h.note))()
      expect(await notes(started.id), actor).toContain("A student started the project.")
      expect(await notes(reviewing.id), actor).toContain(`${uni} began reviewing a student's skill signals.`)
    }
  })

  it("C. a company's own notification says a student started its challenge, without saying who", async () => {
    const body = (await snapshot(JES)).notifications.find((n) => n.title === "Student started your challenge")!.body
    expect(body).toBe("A student (JU) started “Smart Campus Energy Optimization”.")
    // The same notification, for the university the student belongs to, is untouched by any of this.
    expect((await snapshot(JU)).notifications.map((n) => n.body).join("\n")).toContain("Ahmad Al-Khatib")
  })

  it("A. a discoverable student keeps their name — and is named for the company exactly when they become discoverable", async () => {
    const energyNotes = async () => (await snapshot(JES)).challenges.find((c) => c.id === "chal-jes-energy")!.history.map((h) => h.note)
    const startedBody = async () => (await snapshot(JES)).notifications.find((n) => n.title === "Student started your challenge")!.body
    // Omar's work for Estarta is verified and confirmed, so he is named everywhere a company reads about him.
    const omar = db().prepare("SELECT challenge_id AS id FROM challenge_history WHERE note = 'Omar Al-Fayez started the project.'").get() as { id: string }
    expect((await snapshot(JES)).challenges.find((c) => c.id === omar.id)!.history.map((h) => h.note)).toContain("Omar Al-Fayez started the project.")
    // Ahmad's EnergyWise work is not confirmed yet: he is "a student".
    expect(await energyNotes()).toContain("A student started the project.")
    expect(await startedBody()).toMatch(/^A student \(JU\)/)
    await confirmEnergyWise()
    // Now his verified proof is discoverable, and the same sentences name him.
    expect(await energyNotes()).toContain("Ahmad Al-Khatib started the project.")
    expect(await startedBody()).toMatch(/^Ahmad Al-Khatib \(JU\) started/)
    // …and if that proof stops being current, he goes back to being "a student".
    db().prepare("UPDATE skill_signals SET status = 'Pending Verification' WHERE project_id = ? AND student_id = 'stu-ju-ahmad'").run(PROJECT)
    expect(await energyNotes()).toContain("A student started the project.")
  })

  it("C. names written by a new event are scrubbed as they are read", async () => {
    const created = await server.call("POST", "/challenges", JES, {
      title: "Optimize campus lighting schedules",
      problemDescription: "A university wants to cut the electricity used by corridor and lecture-hall lighting without leaving students in the dark.",
      requiredSkills: ["Python", "SQL"],
      learningOutcomes: ["Analyze occupancy and lighting data"],
      preferredUniversityId: "uni-ju",
    })
    const id = (created.json.result as { id: string }).id
    expect((await server.call("POST", `/challenges/${id}/assign`, JU, { programId: "prg-ju-cs" })).status).toBe(200)
    expect((await server.call("POST", `/challenges/${id}/start`, "student:stu-ju-sara")).status).toBe(200)
    // The write itself names Sara (the university and the student read it that way)…
    expect((db().prepare("SELECT note FROM challenge_history WHERE challenge_id = ? AND status = 'In Progress'").get(id) as { note: string }).note).toBe("Sara Al-Najjar started the project.")
    // …but the company, which cannot discover her, is not told her name.
    const jes = await snapshot(JES)
    expect(jes.challenges.find((c) => c.id === id)!.history.find((h) => h.status === "In Progress")!.note).toBe("A student started the project.")
    expect(jes.notifications.find((n) => n.body.includes("Optimize campus lighting schedules") && n.title === "Student started your challenge")!.body).toBe("A student (UJ) started “Optimize campus lighting schedules”.")
    expect(await raw(JES)).not.toContain("Sara Al-Najjar")
  })

  it("C. a university's note naming an undiscoverable student reaches the company without the name", async () => {
    await confirmEnergyWise("Strong team. The same cohort as Khaled Rawashdeh's group did well too.")
    const project = (await snapshot(JES)).projects.find((p) => p.id === PROJECT)!
    const note = project.feedback.map((f) => f.note).join("\n")
    expect(note).toContain("Strong team.")
    expect(note).toContain("a student's group")
    expect(note).not.toContain("Khaled")
    expect(JSON.stringify(project.feedback.map((f) => f.author))).toContain("University of Jordan")
  })

  it("D. query parameters cannot switch the sanitization off", async () => {
    const { hidden } = await people()
    const plain = await raw(JES)
    for (const q of ["?includeHidden=true", "?names=1&debug=1&raw=true", "?studentId=stu-ju-sara", "?student=Sara%20Al-Najjar", "?role=university", "?actor=university:uni-ju", "?unredacted=true&__proto__=x"]) {
      const text = await raw(JES, q)
      expect(text, q).toBe(plain)
      for (const s of hidden) expect(text, `${q} ${s.name}`).not.toContain(s.name)
    }
    // Nor can a header trick: an unknown or garbled actor is a guest, which is shown no student detail at all.
    const odd = await server.call("GET", "/snapshot?names=1", "company:org-jes:university:uni-ju")
    expect(JSON.stringify(odd.json)).not.toContain("Khaled Rawashdeh started")
  })
})

describe("projects[].studentId in what a company is sent", () => {
  const ownerOf = (id: string) => (db().prepare("SELECT student_id AS s FROM projects WHERE id = ?").get(id) as { s: string }).s

  it("A. is absent for a project whose owner the company cannot discover — and present for the university", async () => {
    const { hidden } = await people()
    const hiddenIds = new Set(hidden.map((s) => s.id))
    const jes = await snapshot(JES)
    const hiddenOwned = jes.projects.filter((p) => hiddenIds.has(ownerOf(p.id)))
    expect(hiddenOwned.length).toBeGreaterThanOrEqual(4)
    for (const p of hiddenOwned) expect("studentId" in p, p.id).toBe(false)
    // The university (and the student) still get what they need to run the project.
    const ju = await snapshot(JU)
    for (const p of hiddenOwned.filter((x) => ownerOf(x.id).startsWith("stu-ju-"))) expect(ju.projects.find((x) => x.id === p.id)!.studentId).toBe(ownerOf(p.id))
    expect((await snapshot("student:stu-ju-sara")).projects.find((p) => p.id === "prj-skytech-maintenance-sara")!.studentId).toBe("stu-ju-sara")
  })

  it("B. keeps what the company legitimately needs: the project, its university, and the owner once discoverable", async () => {
    let jes = await snapshot(JES)
    let energy = jes.projects.find((p) => p.id === PROJECT)!
    // Its own challenge's project before confirmation: no student named, but everything else it needs to follow it.
    expect(energy).toMatchObject({ challengeId: "chal-jes-energy", title: "Smart Campus Energy Optimization", status: "Evidence Under Review", universityId: "uni-ju" })
    expect("studentId" in energy).toBe(false)
    expect(energy.members).toEqual([])
    await confirmEnergyWise()
    jes = await snapshot(JES)
    energy = jes.projects.find((p) => p.id === PROJECT)!
    expect(energy.studentId).toBe("stu-ju-ahmad")
    expect(energy.members.map((m) => m.studentId).sort()).toEqual(["stu-ju-omar", "stu-ju-sara"])
    expect(energy.ownerRoleNote).toMatch(/SQL analysis/)
    expect(energy.members.every((m) => m.roleNote.length > 10)).toBe(true)
    // Every id that is present anywhere in a company's data belongs to a discoverable student.
    const { eligible } = await people()
    for (const actor of COMPANIES) {
      const s = await snapshot(actor)
      const ids = [
        ...s.projects.flatMap((p) => [p.studentId, ...p.members.map((m) => m.studentId)]),
        ...s.skillSignals.map((g) => g.studentId),
        ...s.evidence.map((e) => e.studentId),
        ...s.students.map((x) => x.id),
        ...s.companyActions.map((a) => a.studentId),
      ].filter((x): x is string => !!x)
      for (const id of ids) expect(eligible.has(id), `${actor} sees ${id}`).toBe(true)
    }
  })

  it("C/D. Talent Discovery and the candidate profile data still work", async () => {
    const t = await talent()
    expect(t.candidates).toHaveLength(5)
    const snap = await snapshot(JES)
    for (const c of t.candidates) {
      expect((await server.call("GET", `/talent/${c.studentId}`, JES)).status).toBe(200)
      // The profile page is built from the snapshot: the student, their projects and their verified skills are all there.
      expect(snap.students.some((s) => s.id === c.studentId)).toBe(true)
      expect(snap.projects.some((p) => p.studentId === c.studentId || p.members.some((m) => m.studentId === c.studentId))).toBe(true)
      expect(snap.skillSignals.some((g) => g.studentId === c.studentId && g.status === "Verified")).toBe(true)
    }
  })

  it("E. company actions still enforce discoverability", async () => {
    const act = (id: string) => server.call("POST", `/students/${id}/company-actions`, ESTARTA, { kind: "saved" })
    expect((await act("stu-hu-leen")).status).toBe(200)
    const refused = await act("stu-ju-sara")
    expect(refused.status).toBe(404)
    expect(JSON.stringify(refused.json)).not.toContain("stu-ju-sara")
  })

  it("F. no company endpoint leaks a hidden student's id or name", async () => {
    const { hidden } = await people()
    await confirmEnergyWise()
    const after = await people() // Ahmad, Sara and Omar are discoverable now
    expect(after.hidden.length).toBeLessThan(hidden.length)
    const bodies: string[] = []
    for (const actor of COMPANIES) {
      bodies.push(await raw(actor))
      bodies.push(JSON.stringify((await server.call("GET", "/talent", actor)).json))
      bodies.push(JSON.stringify((await server.call("GET", "/talent?skills=Python,SQL&industry=x", actor)).json))
      for (const s of after.hidden) {
        bodies.push(JSON.stringify((await server.call("GET", `/talent/${s.id}`, actor)).json))
        bodies.push(JSON.stringify((await server.call("POST", `/students/${s.id}/company-actions`, actor, { kind: "saved" })).json))
        bodies.push(await server.fetch(`/evidence/ev-${s.id}/file`, actor).then((r) => r.text()))
      }
      bodies.push(JSON.stringify((await server.call("POST", `/projects/${PROJECT}/company-feedback`, actor, { note: "x" })).json))
    }
    const text = bodies.join("\n")
    for (const s of after.hidden) {
      expect(text, s.name).not.toContain(s.name)
      expect(text, s.id).not.toContain(s.id)
    }
  })

  it("a student whose proof stops being current disappears from the company's saved list too", async () => {
    const actions = async () => (await snapshot(ESTARTA)).companyActions.filter((a) => a.studentId === "stu-ju-omar")
    expect((await actions()).map((a) => a.kind)).toEqual(["invited"]) // seeded: Estarta invited Omar
    db().prepare("UPDATE skill_signals SET status = 'Pending Verification' WHERE project_id = 'prj-estarta-intent-omar'").run()
    expect(await actions()).toEqual([])
    expect(await raw(ESTARTA)).not.toContain("stu-ju-omar")
    db().prepare("UPDATE skill_signals SET status = 'Verified' WHERE project_id = 'prj-estarta-intent-omar' AND verified_by IS NOT NULL").run()
    expect((await actions()).map((a) => a.kind)).toEqual(["invited"])
  })
})

describe("the dashboard counts students without needing to know who they are", () => {
  it("counts a known owner once, and an owner it cannot identify as one student per project", () => {
    const p = (studentId?: string) => ({ studentId }) as Project
    expect(engagedStudentCount([p("a"), p("a"), p("b")])).toBe(2)
    expect(engagedStudentCount([p(), p(), p("a")])).toBe(3)
    expect(engagedStudentCount([])).toBe(0)
  })
})

describe("'View supporting evidence' leads somewhere a company may go", () => {
  const evidenceOf = (snap: Snap, projectId: string) => snap.evidence.filter((e) => e.projectId === projectId).map((e) => e.id).sort()
  const citedBy = (snap: Snap, projectId: string) => [...new Set(snap.skillSignals.filter((g) => g.projectId === projectId).flatMap((g) => g.evidenceIds))].sort()

  it("every project a candidate's proof points at opens for the company, with exactly the evidence the university's verification cites", async () => {
    const snap = await snapshot(JES)
    const t = await talent()
    const projectIds = [...new Set(t.candidates.flatMap((c) => c.matched.map((m) => m.projectId)))]
    expect(projectIds.length).toBeGreaterThanOrEqual(5)
    for (const projectId of projectIds) {
      const access = companyProjectAccess(snap.projects as Project[], snap.skillSignals, projectId, "org-jes")
      expect(access, projectId).toBeDefined()
      expect(access!.own, projectId).toBe(false) // another company's challenge — Level 3A's own seed has none confirmed for JES
      // The supporting evidence is reachable, and it is exactly what verified skills cite — no more.
      expect(evidenceOf(snap, projectId).length, projectId).toBeGreaterThan(0)
      expect(evidenceOf(snap, projectId), projectId).toEqual(citedBy(snap, projectId))
    }
  })

  it("a project with no verified proof for the company does not open, whether it is another company's or unconfirmed", async () => {
    const snap = await snapshot(JES)
    for (const other of ["prj-skytech-maintenance-sara", "prj-iris-anomaly-yazan", "prj-estarta-access-khaled"]) {
      expect(companyProjectAccess(snap.projects as Project[], snap.skillSignals, other, "org-jes"), other).toBeUndefined()
      expect(evidenceOf(snap, other), other).toEqual([])
    }
    expect(companyProjectAccess(snap.projects as Project[], snap.skillSignals, "prj-not-a-project", "org-jes")).toBeUndefined()
    expect(companyProjectAccess(snap.projects as Project[], snap.skillSignals, PROJECT, undefined)).toBeUndefined()
  })

  it("a company's own unconfirmed project opens as its own, with no proof in it yet; once confirmed, other companies can open it too", async () => {
    const own = companyProjectAccess((await snapshot(JES)).projects as Project[], (await snapshot(JES)).skillSignals, PROJECT, "org-jes")
    expect(own?.own).toBe(true)
    expect(evidenceOf(await snapshot(JES), PROJECT)).toEqual([])
    // Another company cannot open it yet…
    const before = await snapshot(ESTARTA)
    expect(companyProjectAccess(before.projects as Project[], before.skillSignals, PROJECT, "org-estarta")).toBeUndefined()
    await confirmEnergyWise()
    // …and can once the university has verified skills on it.
    const after = await snapshot(ESTARTA)
    const access = companyProjectAccess(after.projects as Project[], after.skillSignals, PROJECT, "org-estarta")
    expect(access?.own).toBe(false)
    expect(evidenceOf(after, PROJECT)).toEqual(citedBy(after, PROJECT))
    expect(evidenceOf(after, PROJECT).length).toBeGreaterThan(0)
    // Opening it grants no right to act on it: only the owning company may leave feedback.
    expect((await server.call("POST", `/projects/${PROJECT}/company-feedback`, ESTARTA, { note: "Not mine to review." })).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/company-feedback`, JES, { note: "Ours." })).status).toBe(200)
  })

  it("evidence behind the link can be downloaded when it is cited, and not otherwise", async () => {
    const attach = (id: string) => db().prepare("INSERT OR REPLACE INTO evidence_files (evidence_id, name, mime, size, data) VALUES (?, 'work.txt', 'text/plain', 4, ?)").run(id, Buffer.from("work"))
    const status = (id: string) => server.fetch(`/evidence/${id}/file`, JES).then((r) => r.status)
    const snap = await snapshot(JES)
    const project = "prj-estarta-intent-omar"
    const cited = citedBy(snap, project)[0]
    const uncited = (db().prepare("SELECT id FROM evidence WHERE project_id = ?").all(project) as { id: string }[]).map((e) => e.id).find((id) => !citedBy(snap, project).includes(id))
    expect(cited).toBeDefined()
    attach(cited)
    expect(await status(cited)).toBe(200)
    if (uncited) {
      attach(uncited)
      expect(await status(uncited)).toBe(403)
    }
    // Once the verification behind it stops being current, the same link stops working.
    await sleep(5)
    db().prepare("INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late-link', ?, 'stu-ju-omar', 'Contribution Statement', 'Late', '', '', 'Written after the decision.', ?)").run(project, new Date().toISOString())
    expect(await status(cited)).toBe(403)
    const later = await snapshot(JES)
    expect(companyProjectAccess(later.projects as Project[], later.skillSignals, project, "org-jes")).toBeUndefined()
  })
})
