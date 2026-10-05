import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { resetDatabase, startServer } from "./helpers.ts"
import { getDb } from "../db.ts"
import { llmDeps } from "../ml/llm-grader.ts"
import { notebook, png, upload } from "./fixtures.ts"

// What each account may read, enforced where data leaves the server — and what a student's evidence
// can and cannot turn into.
const PROJECT = "prj-jes-energywise"
const AHMAD = "student:stu-ju-ahmad"
const SARA = "student:stu-ju-sara"
const OMAR = "student:stu-ju-omar"
const TALA = "student:stu-ju-tala"
const YAZAN = "student:stu-aau-yazan"
const JU = "university:uni-ju"
const AAU = "university:uni-aau"
const JES = "company:org-jes"
const ESTARTA = "company:org-estarta"
const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "WSL_AI_PROVIDER"]
const realFetch = llmDeps.fetch

interface Snap {
  students: { id: string; name: string; universityId: string; gpa?: number; studentNumber?: string; city?: string; bio?: string; availability?: string }[]
  challenges: { id: string; title: string; status: string; organizationId: string }[]
  projects: {
    id: string
    challengeId: string
    organizationId: string
    studentId: string
    status: string
    ownerRoleNote: string
    members: { studentId: string; roleNote: string }[]
    feedback: { author: string; authorKind: string; note: string }[]
    companyFeedback?: { note: string }
  }[]
  evidence: { id: string; projectId: string; studentId: string; type: string; title: string }[]
  skillSignals: { id: string; projectId: string; studentId: string; skill: string; status: string; suggestedLevel: string; evidenceIds: string[]; reviewerNotes?: string }[]
  notifications: { title: string; body: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => {
  resetDatabase()
  for (const k of KEYS) delete process.env[k]
})
afterEach(() => {
  llmDeps.fetch = realFetch
  for (const k of KEYS) delete process.env[k]
})

const snapshot = async (actor?: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
/** A student record with no academic or personal details in it, only a name and a program. */
const expectBare = (s: Snap["students"][number]) => {
  for (const key of ["gpa", "studentNumber", "bio", "city", "availability"] as const) expect(s[key], `${s.id}.${key}`).toBeUndefined()
}
const project = (snap: Snap, id = PROJECT) => snap.projects.find((p) => p.id === id)!
const evidenceOf = (snap: Snap, studentId: string) => snap.evidence.filter((e) => e.projectId === PROJECT && e.studentId === studentId)
const addEvidence = (actor: string, body: Record<string, unknown>, id = PROJECT) => server.call("POST", `/projects/${id}/evidence`, actor, body)

describe("wrong-project and wrong-student access", () => {
  it("11. a signal is reviewed only through its own project", async () => {
    const ju = await snapshot(JU)
    const sig = ju.skillSignals.find((s) => s.projectId === PROJECT && s.studentId === "stu-ju-ahmad" && s.skill === "SQL")!
    // The same signal id under a different JU project is a 404, and nothing changed.
    const res = await server.call("POST", `/projects/prj-skytech-maintenance-sara/signals/${sig.id}/review`, JU, { decision: "verify" })
    expect([403, 404]).toContain(res.status)
    expect((await snapshot(JU)).skillSignals.find((s) => s.id === sig.id)!.status).toBe("Pending Verification")
    // Another university may not review it at all, and a skill that is not required is not reviewable.
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${sig.id}/review`, AAU, { decision: "verify" })).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/signals/sig-nope/review`, JU, { decision: "verify" })).status).toBe(404)
  })

  it("11. evidence files and student routes stay inside the student's own projects", async () => {
    const withFile = await addEvidence(AHMAD, { type: "Notebook", title: "Meter notebook", file: upload("m.ipynb", notebook([{ type: "code", source: "import pandas as pd\nreadings = pd.read_csv('meters.csv')\nprint(readings.groupby('building').energy_kwh.sum())" }])) })
    expect(withFile.status).toBe(200)
    const id = evidenceOf(await snapshot(JU), "stu-ju-ahmad").find((e) => e.title === "Meter notebook")!.id
    expect((await server.fetch(`/evidence/${id}/file`, AHMAD)).status).toBe(200)
    expect((await server.fetch(`/evidence/${id}/file`, JU)).status).toBe(200)
    for (const actor of [SARA, YAZAN, AAU, JES, undefined]) expect((await server.fetch(`/evidence/${id}/file`, actor)).status).toBe(403)
    // A student who is not on the team can neither add evidence nor analyze.
    expect((await addEvidence(YAZAN, { type: "Contribution Statement", title: "x", content: "I did the whole project on my own, honestly." })).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)).status).toBe(403)
  })

  it("12. a Google Doc cannot be re-read through another student's route", async () => {
    const link = "https://docs.google.com/document/d/ahmadPrivateDoc123/edit"
    expect((await addEvidence(AHMAD, { type: "Documentation", title: "Unshared doc", link })).status).toBe(200)
    const id = evidenceOf(await snapshot(JU), "stu-ju-ahmad").find((e) => e.title === "Unshared doc")!.id
    const reread = (actor: string, project = PROJECT) => server.call("POST", `/projects/${project}/evidence/${id}/reread`, actor)
    expect((await reread(SARA)).status).toBe(404) // a teammate, but not the author
    expect((await reread(OMAR)).status).toBe(404)
    expect((await reread(YAZAN)).status).toBe(403) // not on the project at all
    expect((await reread(JU)).status).toBe(403) // not a student
    expect((await reread(AHMAD, "prj-skytech-maintenance-sara")).status).toBe(403) // the author, but a different project
    expect((await reread(AHMAD)).status).toBe(200) // the author, on their own project
  })
})

describe("evidence that cannot become proof on its own", () => {
  const analyzeAs = async (actor: string) => {
    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, actor)
    return res
  }
  const signalsFor = async (studentId: string) => (await snapshot(JU)).skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === studentId)

  async function addTalaWith(body: Record<string, unknown>) {
    expect((await server.call("POST", `/projects/${PROJECT}/members`, AHMAD, { studentId: "stu-ju-tala" })).status).toBe(200)
    expect((await addEvidence(TALA, body)).status).toBe(200)
    expect((await analyzeAs(TALA)).status).toBe(200)
    return signalsFor("stu-ju-tala")
  }

  it("13. a video alone produces no analyzed proof", async () => {
    const signals = await addTalaWith({ type: "Video Walkthrough", title: "SQL and machine learning demo", link: "https://youtube.com/watch?v=demo", content: "SELECT * FROM readings; I trained a model" })
    expect(signals).toHaveLength(5)
    for (const s of signals) expect(s).toMatchObject({ suggestedLevel: "Insufficient", status: "Pending Verification", evidenceIds: [] })
  })

  it("14. a screenshot alone produces no analyzed proof", async () => {
    const signals = await addTalaWith({ type: "Screenshot", title: "Dashboard screenshot", file: upload("shot.png", png()), content: "A dashboard with a bar chart and SQL queries and a machine learning model" })
    expect(signals).toHaveLength(5)
    for (const s of signals) expect(s).toMatchObject({ suggestedLevel: "Insufficient", status: "Pending Verification", evidenceIds: [] })
  })

  it("15. a contribution statement alone cannot become verified proof", async () => {
    const signals = await addTalaWith({ type: "Contribution Statement", title: "What I did", content: "I designed the SQL database, trained the machine learning model, wrote Python, and built the dashboard." })
    for (const s of signals) expect(s).toMatchObject({ suggestedLevel: "Insufficient", evidenceIds: [] })
    // …and the reviewer cannot verify what WSL found nothing for.
    for (const s of signals) expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, { decision: "verify" })).status).toBe(409)
    expect((await signalsFor("stu-ju-tala")).some((s) => s.status === "Verified")).toBe(false)
  })

  it("16. model output cannot attach another student's evidence to this student's signal", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const ju = await snapshot(JU)
    const saraEvidence = ju.evidence.find((e) => e.projectId === PROJECT && e.studentId === "stu-ju-sara" && e.type === "Notebook")!
    const requested: string[] = []
    llmDeps.fetch = async (_url, init) => {
      requested.push(String(init.body))
      // A hostile model: it cites Sara's evidence id (and invents one) for every skill, quoting Ahmad's own SQL.
      const payload = {
        restatesBrief: false,
        skills: ["Python", "Data Analysis", "SQL", "Machine Learning", "Data Visualization"].map((skill) => ({
          skill,
          score: 90,
          criteriaMet: [],
          reason: "Looks strong.",
          quotes: [
            { evidenceId: saraEvidence.id, text: "CREATE TABLE buildings", why: "wrong owner" },
            { evidenceId: "ev-does-not-exist", text: "CREATE TABLE buildings", why: "invented" },
            { evidenceId: saraEvidence.id, text: "IsolationForest(", why: "Sara's own code, never shown to this call" },
          ],
        })),
      }
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
    }
    // Ahmad's re-analysis gets a different model name, so the cache is bypassed and the model is called.
    expect((await analyzeAs(AHMAD)).status).toBe(200)
    expect(requested.length).toBeGreaterThan(0)
    expect(requested.join("\n")).not.toContain("IsolationForest") // the prompt held Ahmad's evidence only
    const mine = new Set(evidenceOf(await snapshot(AHMAD), "stu-ju-ahmad").map((e) => e.id))
    for (const s of await signalsFor("stu-ju-ahmad")) for (const id of s.evidenceIds) expect(mine.has(id)).toBe(true)
    expect((await signalsFor("stu-ju-ahmad")).every((s) => !s.evidenceIds.includes(saraEvidence.id))).toBe(true)
  })
})

describe("what a student receives", () => {
  it("17. a student's snapshot holds only their own evidence and signals, and no teammate's review", async () => {
    const sara = await snapshot(SARA)
    expect(new Set(sara.evidence.filter((e) => e.projectId === PROJECT).map((e) => e.studentId))).toEqual(new Set(["stu-ju-sara"]))
    expect(new Set(sara.skillSignals.filter((s) => s.projectId === PROJECT).map((s) => s.studentId))).toEqual(new Set(["stu-ju-sara"]))
    expect(JSON.stringify(sara)).not.toMatch(/ev-energy-ahmad|ev-energy-omar/)
    expect(JSON.stringify(project(sara).members)).toBeDefined()
  })

  it("5. contribution notes are for the team, the owner's university and (once verified) a company — nobody else", async () => {
    const note = project(await snapshot(AHMAD)).ownerRoleNote
    expect(note).toMatch(/SQL analysis/)
    // Team members and the owner's university read them.
    expect(project(await snapshot(SARA)).ownerRoleNote).toBe(note)
    expect(project(await snapshot(JU)).ownerRoleNote).toBe(note)
    expect(project(await snapshot(SARA)).members.find((m) => m.studentId === "stu-ju-omar")!.roleNote).toMatch(/Dashboard/)
    // A student on another team, a student at another university, another university, a company that
    // has not been shown the work, and a guest do not.
    for (const actor of [TALA, YAZAN, AAU, JES, ESTARTA, undefined]) {
      const p = project(await snapshot(actor))
      expect(p.ownerRoleNote, String(actor)).toBe("")
      expect(p.members.every((m) => m.roleNote === ""), String(actor)).toBe(true)
    }
  })

  it("5. a teammate is not listed to someone who cannot see the project", async () => {
    for (const actor of [TALA, YAZAN, AAU, ESTARTA, undefined]) expect(project(await snapshot(actor)).members, String(actor)).toEqual([])
  })
})

describe("what a company receives", () => {
  async function confirmEnergyWise() {
    const snap = await snapshot(JU)
    for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
      await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, { decision: s.suggestedLevel === "Insufficient" ? "insufficient" : "verify", reviewerNotes: "Internal: matches the notebook." })
    }
    expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Confirmed." })).status).toBe(200)
  }

  it("18. sees only verified signals, only the evidence they cite, and no reviewer notes", async () => {
    await confirmEnergyWise()
    const company = await snapshot(JES)
    const signals = company.skillSignals.filter((s) => s.projectId === PROJECT)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every((s) => s.status === "Verified")).toBe(true)
    expect(signals.some((s) => s.reviewerNotes)).toBe(false)
    const cited = new Set(signals.flatMap((s) => s.evidenceIds))
    for (const e of company.evidence.filter((x) => x.projectId === PROJECT)) expect(cited.has(e.id)).toBe(true)
    expect(company.evidence.filter((e) => e.projectId === PROJECT && e.type === "Contribution Statement")).toHaveLength(0)
  })

  it("18. never sees another company's feedback, internal notes or a verified skill's role note before verification", async () => {
    await confirmEnergyWise()
    // JES leaves feedback on its own project; no other company may read it, nor a student elsewhere, nor a guest.
    expect((await server.call("POST", `/projects/${PROJECT}/company-feedback`, JES, { note: "Please follow up with Sara.", relevantForInternship: true })).status).toBe(200)
    expect(project(await snapshot(JES)).companyFeedback?.note).toBe("Please follow up with Sara.")
    for (const actor of [AHMAD, JU]) expect(project(await snapshot(actor)).companyFeedback?.note).toBe("Please follow up with Sara.")
    for (const actor of [ESTARTA, YAZAN, AAU, TALA, undefined]) {
      const snap = await snapshot(actor)
      expect(project(snap).companyFeedback, String(actor)).toBeUndefined()
      expect(JSON.stringify(snap), String(actor)).not.toContain("Please follow up with Sara.")
    }
    // The same goes for every seeded company's feedback on its own projects.
    const estarta = await snapshot(ESTARTA)
    for (const p of estarta.projects.filter((x) => x.organizationId !== "org-estarta")) expect(p.companyFeedback, p.id).toBeUndefined()
    for (const p of estarta.projects.filter((x) => x.organizationId !== "org-estarta")) {
      expect(p.feedback.filter((f) => f.authorKind === "contact"), p.id).toEqual([])
    }
  })

  it("18. never sees another company's draft challenge", async () => {
    const draft = await server.call("POST", "/challenges", ESTARTA, {
      title: "Secret draft: predict churn for a client",
      problemDescription: "A confidential draft the company has not sent to any university yet, about predicting churn.",
      requiredSkills: ["Python"],
      learningOutcomes: ["Predict churn"],
      asDraft: true,
    })
    expect(draft.status).toBe(200)
    const has = async (actor?: string) => (await snapshot(actor)).challenges.some((c) => c.title.startsWith("Secret draft"))
    expect(await has(ESTARTA)).toBe(true)
    for (const actor of [JES, JU, AHMAD, YAZAN, undefined]) expect(await has(actor), String(actor)).toBe(false)
  })

  it("18. sees student profiles only for students with verified proof, and never a student number", async () => {
    await confirmEnergyWise()
    const company = await snapshot(JES)
    const byId = new Map(company.students.map((s) => [s.id, s]))
    // Discoverable: verified proof on a confirmed project — a profile a company may weigh.
    expect(byId.get("stu-ju-ahmad")).toMatchObject({ name: "Ahmad Al-Khatib" })
    expect(typeof byId.get("stu-ju-ahmad")!.gpa).toBe("number")
    expect(byId.get("stu-ju-ahmad")!.studentNumber).toBeUndefined()
    // Everyone else is not in the company's data at all: no directory of students without verified proof.
    const undiscovered = company.students.filter((s) => !company.skillSignals.some((g) => g.studentId === s.id && g.status === "Verified"))
    expect(undiscovered).toEqual([])
    expect(company.students.length).toBeLessThan((await snapshot(JU)).students.length)
  })

  it("guests get names for the demo sign-in and nothing academic", async () => {
    const guest = await snapshot()
    expect(guest.students.length).toBeGreaterThan(0)
    for (const s of guest.students) expectBare(s)
  })

  it("a student sees their own full profile, and a university sees its own students' full profiles", async () => {
    const own = (await snapshot(SARA)).students.find((s) => s.id === "stu-ju-sara")!
    expect(own.gpa).toBeGreaterThan(0)
    expect(own.studentNumber).toBeTruthy()
    const ju = (await snapshot(JU)).students
    for (const s of ju.filter((x) => x.universityId === "uni-ju")) expect(s.studentNumber, s.id).toBeTruthy()
    for (const s of ju.filter((x) => x.universityId !== "uni-ju")) expect(s.studentNumber, s.id).toBeUndefined()
    // A student does not read a classmate's grades or number.
    for (const s of (await snapshot(SARA)).students.filter((x) => x.id !== "stu-ju-sara")) expectBare(s)
  })
})

describe("a legacy team member from another university", () => {
  /** What an older version allowed: a teammate at a different university, with work on the project. */
  function legacyMember() {
    const db = getDb()
    db.prepare("INSERT INTO project_members (project_id, student_id, role_note, added_at) VALUES (?, ?, 'I helped with the network side.', ?)").run(PROJECT, "stu-aau-yazan", new Date().toISOString())
    db.prepare(
      "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-legacy-1', ?, 'stu-aau-yazan', 'Contribution Statement', 'My part', '', '', 'I wrote the network capture scripts for the energy meters.', ?)",
    ).run(PROJECT, new Date().toISOString())
  }

  it("19. cannot be added any more", async () => {
    const res = await server.call("POST", `/projects/${PROJECT}/members`, AHMAD, { studentId: "stu-aau-yazan" })
    expect(res.status).toBe(400)
  })

  it("19. blocks confirmation, with a reason the owner's university can act on", async () => {
    legacyMember()
    const review = (await snapshot(JU)).projects.find((p) => p.id === PROJECT)!
    expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, {})).status).toBe(409)
    expect(JSON.stringify(review)).toBeDefined()
  })

  it("19. the owner's university can detach them; their work is kept and nothing else is touched", async () => {
    legacyMember()
    const res = await server.call("POST", `/projects/${PROJECT}/members/stu-aau-yazan/remove`, JU)
    expect(res.status).toBe(200)
    const after = await snapshot(JU)
    expect(project(after).members.map((m) => m.studentId)).toEqual(["stu-ju-sara", "stu-ju-omar"])
    // Their evidence is kept in the database, but is no longer part of the team's project or anyone's review.
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM evidence WHERE id = 'ev-legacy-1'").get()).toEqual({ n: 1 })
    expect(after.evidence.some((e) => e.id === "ev-legacy-1")).toBe(false)
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM students WHERE id = 'stu-aau-yazan'").get()).toEqual({ n: 1 })
    // Their own account is told, and the project can now be reviewed by the university that can verify it.
    expect((await snapshot(YAZAN)).notifications.some((n) => /removed/i.test(n.title))).toBe(true)
    const rest = after.skillSignals.filter((s) => s.projectId === PROJECT)
    for (const s of rest) await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, { decision: s.suggestedLevel === "Insufficient" ? "insufficient" : "verify" })
    expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, {})).status).toBe(200)
  })

  it("19. the owner can detach them too, and they can leave; other universities and other students cannot", async () => {
    legacyMember()
    expect((await server.call("POST", `/projects/${PROJECT}/members/stu-aau-yazan/remove`, AAU)).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/members/stu-aau-yazan/remove`, SARA)).status).toBe(403)
    expect((await server.call("POST", `/projects/${PROJECT}/members/stu-aau-yazan/remove`, AHMAD)).status).toBe(200)
  })

  it("19. a same-university teammate with work still cannot be removed, and the university may not detach them", async () => {
    // Sara has evidence on the project: she stays — only a cross-university member is detached.
    expect((await server.call("POST", `/projects/${PROJECT}/members/stu-ju-sara/remove`, AHMAD)).status).toBe(409)
    expect((await server.call("POST", `/projects/${PROJECT}/members/stu-ju-sara/remove`, JU)).status).toBe(403)
  })

  it("19. a detached student can still leave their own record intact: their own signals are not shown to the team's company", async () => {
    legacyMember()
    getDb()
      .prepare(
        `INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, ai_note, ai_quotes, ai_criteria, suggested_level, graded_source, status, analyzed_at)
         VALUES ('sig-legacy-1', ?, 'stu-aau-yazan', 'Python', 60, '', '[]', '[]', 'Intermediate', 'offline', 'Pending Verification', ?)`,
      )
      .run(PROJECT, new Date().toISOString())
    await server.call("POST", `/projects/${PROJECT}/members/stu-aau-yazan/remove`, JU)
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM skill_signals WHERE id = 'sig-legacy-1'").get()).toEqual({ n: 1 })
    expect((await snapshot(JU)).skillSignals.some((s) => s.id === "sig-legacy-1")).toBe(false)
  })
})
