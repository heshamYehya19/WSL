import { afterAll, beforeEach, describe, expect, it } from "vitest"
// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { resetDatabase, startServer } from "./helpers.ts"
import { getDb } from "../db.ts"
import { hashEvidenceSet } from "../ai.ts"

// Verified Talent Discovery: a company finds a student only through skills a university has CURRENTLY verified.
// Everything here goes through real HTTP requests; database fixtures stand in for states a confirmed project
// cannot reach through the API (it rejects new evidence and re-analysis), such as a verification gone stale.
const JES = "company:org-jes"
const ESTARTA = "company:org-estarta"
const JU = "university:uni-ju"
const AHMAD = "student:stu-ju-ahmad"
const PROJECT = "prj-jes-energywise"

interface Matched {
  skill: string
  projectId: string
  projectTitle: string
  industry: string
  verifiedAt: string
  verifyingUniversity: string
  contribution: string
}
interface Candidate {
  studentId: string
  name: string
  initials: string
  year: string
  program: string
  university: string
  verifiedSkillCount: number
  latestVerifiedAt: string
  matched: Matched[]
  otherVerifiedSkills: string[]
}
interface Facets {
  skills: { skill: string; count: number }[]
  universities: { id: string; name: string; count: number }[]
  industries: { industry: string; count: number }[]
}
interface Result {
  query: { skills: string[]; university: string | null; industry: string | null }
  candidates: Candidate[]
  facets: Facets
}
interface Snap {
  students: { id: string; name: string; gpa?: number; bio?: string; studentNumber?: string }[]
  staff: { id: string; name: string }[]
  projects: { id: string; studentId: string; ownerRoleNote: string; members: { studentId: string; roleNote: string }[]; feedback: { author: string; note: string; authorKind: string }[] }[]
  evidence: { id: string; projectId: string; studentId: string }[]
  skillSignals: { id: string; projectId: string; studentId: string; skill: string; status: string; suggestedLevel: string; evidenceIds: string[] }[]
  companyActions: { studentId: string; kind: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const snapshot = async (actor?: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
// `actor: null` is a signed-out visitor (a default of JES would swallow `undefined`).
const talent = async (query = "", actor: string | null = JES) => {
  const res = await server.call("GET", `/talent${query ? `?${query}` : ""}`, actor ?? undefined)
  return { status: res.status, body: res.json as unknown as Result & { error?: string; candidate?: Candidate }, raw: JSON.stringify(res.json) }
}
const ids = (r: { body: Result }) => r.body.candidates.map((c) => c.studentId)
const sorted = (xs: string[]) => [...xs].sort()
const review = (signalId: string, body: Record<string, unknown>, project = PROJECT) => server.call("POST", `/projects/${project}/signals/${signalId}/review`, JU, body)

const REVIEWER_NOTE = "REVIEWER-ONLY-NOTE-7f3a"

/** Decides every cell of the seeded EnergyWise team and confirms it to Jordan Energy Solutions. */
async function confirmEnergyWise() {
  const snap = await snapshot(JU)
  for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
    const body = s.suggestedLevel === "Insufficient" ? { decision: "insufficient" } : { decision: "verify", reviewerNotes: REVIEWER_NOTE }
    expect((await review(s.id, body)).status).toBe(200)
  }
  expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Confirmed." })).status).toBe(200)
}
const signalOf = async (studentId: string, skill: string) => (await snapshot(JU)).skillSignals.find((s) => s.projectId === PROJECT && s.studentId === studentId && s.skill === skill)!
const db = () => getDb()

describe("what is discoverable in the seed", () => {
  it("1. a verified candidate appears, with the project that proves the skill", async () => {
    const r = await talent("skills=Machine Learning")
    expect(r.status).toBe(200)
    expect(ids(r)).toEqual(["stu-ju-omar"])
    expect(r.body.candidates[0].matched).toHaveLength(1)
    expect(r.body.candidates[0].matched[0]).toMatchObject({ skill: "Machine Learning", projectId: "prj-estarta-intent-omar", verifyingUniversity: "University of Jordan" })
  })

  it("2. returned proof belongs to that candidate", async () => {
    const company = await snapshot(ESTARTA)
    for (const c of (await talent("")).body.candidates) {
      for (const m of c.matched) {
        const project = company.projects.find((p) => p.id === m.projectId)!
        const team = [project.studentId, ...project.members.map((x) => x.studentId)]
        expect(team, `${c.studentId} ${m.skill}`).toContain(c.studentId)
        const signal = company.skillSignals.find((s) => s.projectId === m.projectId && s.studentId === c.studentId && s.skill === m.skill)!
        expect(signal.status).toBe("Verified")
        for (const evId of signal.evidenceIds) expect(company.evidence.find((e) => e.id === evId)!.studentId).toBe(c.studentId)
      }
    }
  })

  it("3. a contribution belongs to the candidate who wrote it, and is the only thing shown as theirs", async () => {
    await confirmEnergyWise()
    const r = await talent("skills=Data Visualization")
    expect(sorted(ids(r))).toEqual(["stu-ju-omar", "stu-ju-tala"])
    const omar = r.body.candidates.find((c) => c.studentId === "stu-ju-omar")!
    expect(omar.matched[0]).toMatchObject({ projectId: PROJECT, contribution: "Dashboard, visualizations, and the presentation." })
    // Sara's and Ahmad's words never appear on Omar's result.
    expect(JSON.stringify(omar)).not.toMatch(/machine-learning model|Database design/)
    const ahmad = (await talent("skills=SQL")).body.candidates.find((c) => c.studentId === "stu-ju-ahmad")!
    expect(ahmad.matched[0].contribution).toBe("Database design, SQL analysis, and the data-processing pipeline.")
  })

  it("10. a single skill lists everyone who holds it, and nobody else", async () => {
    const r = await talent("skills=SQL")
    expect(sorted(ids(r))).toEqual(["stu-hu-leen", "stu-ju-tala", "stu-just-ahmad"])
  })

  it("browse mode lists students with at least one verified skill — and no one without", async () => {
    const r = await talent("")
    expect(sorted(ids(r))).toEqual(["stu-aau-yazan", "stu-hu-leen", "stu-ju-omar", "stu-ju-tala", "stu-just-ahmad"])
    expect(r.body.candidates.every((c) => c.matched.length > 0 && c.verifiedSkillCount > 0)).toBe(true)
  })
})

describe("only a current verification counts", () => {
  it("4. a project not yet confirmed to the company shows nothing, even for a skill the reviewer verified", async () => {
    const sara = await signalOf("stu-ju-sara", "Machine Learning")
    expect((await review(sara.id, { decision: "verify" })).status).toBe(200)
    const r = await talent("skills=Machine Learning")
    expect(ids(r)).toEqual(["stu-ju-omar"])
    expect((await talent("")).raw).not.toContain("stu-ju-sara")
  })

  it("4. pending is excluded", async () => {
    await confirmEnergyWise()
    expect(ids(await talent("skills=Machine Learning"))).toContain("stu-ju-sara")
    db().prepare("UPDATE skill_signals SET status = 'Pending Verification' WHERE project_id = ? AND student_id = 'stu-ju-sara' AND skill = 'Machine Learning'").run(PROJECT)
    const r = await talent("skills=Machine Learning")
    expect(ids(r)).toEqual(["stu-ju-omar"])
    expect(r.body.facets.skills.find((f) => f.skill === "Machine Learning")!.count).toBe(1)
  })

  it("5. rejected is excluded", async () => {
    await confirmEnergyWise()
    const sara = await signalOf("stu-ju-sara", "Machine Learning")
    expect((await review(sara.id, { decision: "reject", reviewerNotes: "Does not answer the brief." })).status).toBe(200)
    expect(ids(await talent("skills=Machine Learning"))).toEqual(["stu-ju-omar"])
    // …and her other verified skills still count.
    expect(ids(await talent("skills=Python"))).toContain("stu-ju-sara")
  })

  it("6. insufficient evidence is excluded", async () => {
    await confirmEnergyWise()
    db().prepare("UPDATE skill_signals SET status = 'Insufficient Evidence' WHERE project_id = ? AND student_id = 'stu-ju-sara' AND skill = 'Machine Learning'").run(PROJECT)
    expect(ids(await talent("skills=Machine Learning"))).toEqual(["stu-ju-omar"])
    // A signal still carrying the Insufficient level is never eligible, whatever its status says.
    db().prepare("UPDATE skill_signals SET status = 'Verified', suggested_level = 'Insufficient' WHERE project_id = ? AND student_id = 'stu-ju-sara' AND skill = 'Machine Learning'").run(PROJECT)
    expect(ids(await talent("skills=Machine Learning"))).toEqual(["stu-ju-omar"])
  })

  it("7. more evidence requested is excluded", async () => {
    await confirmEnergyWise()
    const sara = await signalOf("stu-ju-sara", "Machine Learning")
    expect((await review(sara.id, { decision: "request-more-evidence", reviewerNotes: "Add the evaluation." })).status).toBe(200)
    expect(ids(await talent("skills=Machine Learning"))).toEqual(["stu-ju-omar"])
  })

  it("8. a stale verification is excluded (evidence after the decision), and returns after a valid re-verification", async () => {
    await confirmEnergyWise()
    expect(ids(await talent("skills=SQL"))).toContain("stu-ju-ahmad")
    await sleep(5)
    db().prepare(
      "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late', ?, 'stu-ju-ahmad', 'Contribution Statement', 'Late note', '', '', 'Added after the university decided.', ?)",
    ).run(PROJECT, new Date().toISOString())
    const stale = await talent("skills=SQL")
    expect(ids(stale)).not.toContain("stu-ju-ahmad")
    expect(stale.raw).not.toContain("stu-ju-ahmad")
    // Every one of Ahmad's decisions predates the late evidence, so none of his skills qualify.
    expect(ids(await talent("skills=Python"))).not.toContain("stu-ju-ahmad")

    // The university looks again and verifies: the verification is current again.
    await sleep(5)
    const mine = (await snapshot(JU)).skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === "stu-ju-ahmad" && s.status === "Verified")
    for (const s of mine) expect((await review(s.id, { decision: "verify" })).status).toBe(200)
    expect(ids(await talent("skills=SQL"))).toContain("stu-ju-ahmad")
  })

  it("8. a signal re-analyzed after its verification is excluded until re-verified", async () => {
    await confirmEnergyWise()
    const sql = await signalOf("stu-ju-ahmad", "SQL")
    await sleep(5)
    db().prepare("UPDATE skill_signals SET analyzed_at = ? WHERE id = ?").run(new Date().toISOString(), sql.id)
    expect(ids(await talent("skills=SQL"))).not.toContain("stu-ju-ahmad")
    await sleep(5)
    expect((await review(sql.id, { decision: "verify" })).status).toBe(200)
    expect(ids(await talent("skills=SQL"))).toContain("stu-ju-ahmad")
  })

  it("8. current evidence that was never analyzed is excluded", async () => {
    await confirmEnergyWise()
    await sleep(5)
    db().prepare(
      "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-new-sql', ?, 'stu-ju-ahmad', 'Documentation', 'More SQL', '', 'https://docs.example.com/x', 'SELECT name, SUM(kwh) FROM readings GROUP BY name;', ?)",
    ).run(PROJECT, new Date().toISOString())
    expect(ids(await talent("skills=SQL"))).not.toContain("stu-ju-ahmad")
    // Re-verifying alone does not help: the new evidence still has no analysis, and a confirmed project cannot be re-analyzed.
    await sleep(5)
    const sql = await signalOf("stu-ju-ahmad", "SQL")
    expect((await review(sql.id, { decision: "verify" })).status).toBe(200)
    expect(ids(await talent("skills=SQL"))).not.toContain("stu-ju-ahmad")
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, AHMAD)).status).toBe(409)
  })

  it("a verification by a different university than the student's is not eligible", async () => {
    await confirmEnergyWise()
    db().prepare("UPDATE skill_signals SET verified_by = (SELECT id FROM staff WHERE university_id = 'uni-aau' LIMIT 1) WHERE project_id = ? AND student_id = 'stu-ju-sara'").run(PROJECT)
    expect((await talent("")).raw).not.toContain("stu-ju-sara")
  })

  it("a signal citing another student's evidence is not eligible", async () => {
    await confirmEnergyWise()
    const sql = await signalOf("stu-ju-ahmad", "SQL")
    db().prepare("INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, 'ev-energy-sara-1')").run(sql.id)
    expect(ids(await talent("skills=SQL"))).not.toContain("stu-ju-ahmad")
  })

  it("34. with no eligible talent at all, the result is empty — not an error", async () => {
    db().prepare("UPDATE skill_signals SET status = 'Pending Verification'").run()
    const r = await talent("")
    expect(r.status).toBe(200)
    expect(r.body.candidates).toEqual([])
    expect(r.body.facets).toEqual({ skills: [], universities: [], industries: [] })
  })
})

describe("searching", () => {
  it("9. several skills mean AND: every one must be currently verified", async () => {
    expect(ids(await talent("skills=Python,Machine Learning"))).toEqual(["stu-ju-omar"])
    // Nobody in the seed has both Python and SQL verified.
    expect(ids(await talent("skills=Python,SQL"))).toEqual([])
    await confirmEnergyWise()
    const both = await talent("skills=Python,SQL")
    expect(ids(both)).toEqual(["stu-ju-ahmad"])
    // Each requested skill is proven by that student's own project, and matched lists exactly the requested ones.
    expect(both.body.candidates[0].matched.map((m) => m.skill)).toEqual(["Python", "SQL"])
    // A student with only one of the two (Omar has Python, Tala has SQL) is not a partial match.
    expect(both.raw).not.toContain("stu-ju-omar")
    expect(both.raw).not.toContain("stu-ju-tala")
  })

  it("11. matching is exact and case-insensitive", async () => {
    const lower = await talent("skills=sql")
    const upper = await talent("skills=SQL")
    expect(ids(lower)).toEqual(ids(upper))
    expect(ids(await talent("skills=  Machine   learning "))).toEqual(["stu-ju-omar"])
    // A prefix, a word from a skill, or a longer string is not that skill.
    for (const q of ["Data", "Machine", "Learning", "Java", "Script", "Net", "Python 3", "Pytho"]) {
      const r = await talent(`skills=${encodeURIComponent(q)}`)
      if (q === "Java") expect(ids(r), q).toEqual(["stu-just-ahmad"]) // a real skill: exactly Java
      else expect(ids(r), q).toEqual([])
    }
    expect(ids(await talent("skills=Data Analysis"))).toEqual(["stu-ju-omar"])
  })

  /** A verified skill whose name merely contains a common one, with its analysis cache re-keyed so it stays current. */
  function renameSkill(projectId: string, studentId: string, from: string, to: string) {
    const skills = JSON.parse((db().prepare("SELECT c.required_skills AS s FROM projects p JOIN challenges c ON c.id = p.challenge_id WHERE p.id = ?").get(projectId) as { s: string }).s) as string[]
    const next = skills.map((s) => (s === from ? to : s))
    db().prepare("UPDATE challenges SET required_skills = ? WHERE id = (SELECT challenge_id FROM projects WHERE id = ?)").run(JSON.stringify(next), projectId)
    db().prepare("UPDATE skill_signals SET skill = ? WHERE project_id = ? AND student_id = ? AND skill = ?").run(to, projectId, studentId, from)
    const evidence = (db().prepare("SELECT id, type, title, description, content, fetched_content FROM evidence WHERE project_id = ? AND student_id = ? AND type NOT IN ('Contribution Statement','Video Walkthrough','Screenshot')").all(projectId, studentId) as Record<string, string | null>[]).map((e) => ({
      id: String(e.id), type: String(e.type), title: String(e.title), description: String(e.description), content: [e.content, e.fetched_content].filter(Boolean).join("\n\n") || undefined,
    }))
    const run = db().prepare("SELECT model FROM analysis_runs WHERE project_id = ? AND student_id = ?").get(projectId, studentId) as { model: string }
    db().prepare("UPDATE analysis_runs SET evidence_hash = ? WHERE project_id = ? AND student_id = ?").run(hashEvidenceSet(next, evidence, run.model), projectId, studentId)
  }

  it("12. Python does not match a larger skill that contains it", async () => {
    renameSkill("prj-iris-ssh-yazan", "stu-aau-yazan", "Python", "Pythonic Scripting")
    expect(ids(await talent("skills=Pythonic Scripting"))).toEqual(["stu-aau-yazan"]) // the fixture is eligible…
    expect(ids(await talent("skills=Python"))).toEqual(["stu-ju-omar"]) // …but is not "Python"
    expect(ids(await talent("skills=Pythonic"))).toEqual([])
  })

  it("13. SQL does not match a larger skill that contains it", async () => {
    renameSkill("prj-echo-helpdesk-leen", "stu-hu-leen", "SQL", "NoSQL")
    expect(ids(await talent("skills=NoSQL"))).toEqual(["stu-hu-leen"])
    expect(sorted(ids(await talent("skills=SQL")))).toEqual(["stu-ju-tala", "stu-just-ahmad"])
    expect(ids(await talent("skills=No"))).toEqual([])
  })

  it("14. duplicate skills normalize", async () => {
    const one = await talent("skills=SQL")
    const many = await talent("skills=sql, SQL ,Sql,,sql")
    expect(ids(many)).toEqual(ids(one))
    expect(many.body.query.skills).toEqual(["SQL"])
    const repeated = await talent("skills=SQL&skills=sql")
    expect(repeated.body.query.skills).toEqual(["SQL"])
    expect(ids(repeated)).toEqual(ids(one))
  })

  it("15. an unknown skill returns no one — and with AND, neither does a known skill next to it", async () => {
    const r = await talent("skills=Underwater Basket Weaving")
    expect(r.status).toBe(200)
    expect(r.body.candidates).toEqual([])
    expect(ids(await talent("skills=SQL,Underwater Basket Weaving"))).toEqual([])
  })

  it("16. the university filter is an exact id", async () => {
    expect(ids(await talent("skills=SQL&university=uni-hu"))).toEqual(["stu-hu-leen"])
    expect(sorted(ids(await talent("university=uni-ju")))).toEqual(["stu-ju-omar", "stu-ju-tala"])
    expect(ids(await talent("skills=SQL&university=uni-ju"))).toEqual(["stu-ju-tala"])
    expect(ids(await talent("university=UNI-HU"))).toEqual([])
    expect(ids(await talent("university=uni-h"))).toEqual([])
  })

  it("17. an unknown university returns empty results, not an error", async () => {
    const r = await talent("university=uni-atlantis")
    expect(r.status).toBe(200)
    expect(r.body.candidates).toEqual([])
  })

  it("18. the industry filter is an exact facet value and applies to each requested skill's proof", async () => {
    const all = await talent("")
    const facet = all.body.facets.industries
    expect(facet.length).toBeGreaterThan(1)
    const tala = all.body.candidates.find((c) => c.studentId === "stu-ju-tala")!
    const industry = tala.matched[0].industry
    const inIndustry = await talent(`industry=${encodeURIComponent(industry)}`)
    expect(ids(inIndustry)).toContain("stu-ju-tala")
    for (const c of inIndustry.body.candidates) for (const m of c.matched) expect(m.industry).toBe(industry)
    // Not a fuzzy match: a fragment, other case, or a longer string finds nothing.
    for (const q of [industry.slice(0, 8), industry.toLowerCase(), `${industry} and more`]) {
      if (q === industry) continue
      expect(ids(await talent(`industry=${encodeURIComponent(q)}`)), q).toEqual([])
    }
    // Both requested skills must be proven in that industry.
    expect(ids(await talent(`skills=SQL,Data Visualization&industry=${encodeURIComponent(industry)}`))).toEqual(["stu-ju-tala"])
    const other = facet.find((f) => f.industry !== industry)!.industry
    expect(ids(await talent(`skills=SQL,Data Visualization&industry=${encodeURIComponent(other)}`))).toEqual([])
  })

  it("facets come from eligible talent only, and reveal nothing about hidden talent", async () => {
    const before = await talent("")
    expect(before.body.facets.skills.map((f) => f.skill)).not.toContain("Data Visualization" + "-hidden")
    // Sara's unverified work is invisible: before confirmation she adds nothing to any count.
    const ml = before.body.facets.skills.find((f) => f.skill === "Machine Learning")!
    expect(ml.count).toBe(1)
    await confirmEnergyWise()
    const after = await talent("")
    expect(after.body.facets.skills.find((f) => f.skill === "Machine Learning")!.count).toBe(2)
    expect(after.body.facets.universities.find((u) => u.id === "uni-ju")!.count).toBe(4) // Omar, Tala, Ahmad, Sara
    expect(after.body.facets.industries.some((f) => f.industry === "Energy & Technology")).toBe(true)
    // A skill nobody verified is not a facet — acknowledged-insufficient skills never appear.
    expect(after.body.facets.skills.map((f) => f.skill)).not.toContain("Cooking")
  })
})

describe("ordering", () => {
  it("19. is by verified skills, then most recent verification, then name — and is stable", async () => {
    const r = await talent("")
    const expected = [...r.body.candidates].sort(
      (a, b) => b.verifiedSkillCount - a.verifiedSkillCount || (a.latestVerifiedAt < b.latestVerifiedAt ? 1 : a.latestVerifiedAt > b.latestVerifiedAt ? -1 : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.studentId < b.studentId ? -1 : 1),
    )
    expect(ids(r)).toEqual(expected.map((c) => c.studentId))
    expect(ids(await talent(""))).toEqual(ids(r))
    // The count is what the card shows, so the order can be explained from the screen.
    for (const c of r.body.candidates) expect(c.verifiedSkillCount).toBe(c.matched.length + c.otherVerifiedSkills.length)
  })

  it("19. a more recent verification wins when the skill counts tie", async () => {
    const r = await talent("")
    const four = r.body.candidates.filter((c) => c.verifiedSkillCount === 4)
    expect(four.length).toBeGreaterThanOrEqual(2)
    const [a, b] = four
    db().prepare("UPDATE skill_signals SET verified_at = '2998-01-01T00:00:00.000Z' WHERE student_id = ? AND status = 'Verified'").run(b.studentId)
    db().prepare("UPDATE skill_signals SET verified_at = '2999-01-01T00:00:00.000Z' WHERE student_id = ? AND status = 'Verified'").run(a.studentId)
    const swapped = await talent("")
    const order = ids(swapped).filter((id) => id === a.studentId || id === b.studentId)
    expect(order).toEqual([a.studentId, b.studentId])
    db().prepare("UPDATE skill_signals SET verified_at = '2999-06-01T00:00:00.000Z' WHERE student_id = ? AND status = 'Verified'").run(b.studentId)
    expect(ids(await talent("")).filter((id) => id === a.studentId || id === b.studentId)).toEqual([b.studentId, a.studentId])
  })

  it("20. the student id is the final tie-break", async () => {
    // Same skill count, same verification time, same name: only the id can decide.
    const stamp = "2999-01-01T00:00:00.000Z"
    for (const id of ["stu-hu-leen", "stu-just-ahmad"]) {
      db().prepare("UPDATE skill_signals SET verified_at = ? WHERE student_id = ? AND status = 'Verified'").run(stamp, id)
      db().prepare("UPDATE students SET name = 'Same Name' WHERE id = ?").run(id)
    }
    const r = await talent("")
    const both = ids(r).filter((id) => id === "stu-hu-leen" || id === "stu-just-ahmad")
    expect(both).toEqual(["stu-hu-leen", "stu-just-ahmad"])
    expect(ids(r)).toEqual(ids(await talent("")))
  })
})

describe("what a company receives", () => {
  const CANDIDATE_KEYS = ["initials", "latestVerifiedAt", "matched", "name", "otherVerifiedSkills", "program", "studentId", "university", "verifiedSkillCount", "year"]
  const MATCHED_KEYS = ["contribution", "industry", "projectId", "projectTitle", "skill", "verifiedAt", "verifyingUniversity"]

  it("21. is a purpose-built shape with exactly these keys", async () => {
    await confirmEnergyWise()
    const r = await talent("")
    expect(Object.keys(r.body).sort()).toEqual(["candidates", "facets", "query"])
    expect(Object.keys(r.body.facets).sort()).toEqual(["industries", "skills", "universities"])
    expect(r.body.candidates.length).toBeGreaterThan(0)
    for (const c of r.body.candidates) {
      expect(Object.keys(c).sort()).toEqual(CANDIDATE_KEYS)
      for (const m of c.matched) expect(Object.keys(m).sort()).toEqual(MATCHED_KEYS)
    }
    const detail = await talent("", JES).then(() => server.call("GET", "/talent/stu-ju-ahmad", JES))
    expect(detail.status).toBe(200)
    expect(Object.keys(detail.json).sort()).toEqual(["candidate"])
    expect(Object.keys(detail.json.candidate as object).sort()).toEqual(CANDIDATE_KEYS)
  })

  it("22–28. never carries reviewer identity, reviewer notes, AI scores or reasoning, student numbers, or any non-verified skill", async () => {
    await confirmEnergyWise()
    // A rejected and a more-evidence-requested skill, after confirmation: they must disappear without a trace.
    const sara = await signalOf("stu-ju-sara", "Machine Learning")
    await review(sara.id, { decision: "reject", reviewerNotes: "SECRET-REJECTION-NOTE" })
    const omarDv = await signalOf("stu-ju-omar", "Data Visualization")
    await review(omarDv.id, { decision: "request-more-evidence", reviewerNotes: "SECRET-MORE-NOTE" })

    const staff = (await snapshot(JU)).staff.map((s) => s.name)
    const numbers = (await snapshot(JU)).students.map((s) => s.studentNumber).filter(Boolean) as string[]
    expect(staff.length).toBeGreaterThan(0)
    const responses = [(await talent("")).raw, (await talent("skills=Python")).raw, JSON.stringify((await server.call("GET", "/talent/stu-ju-ahmad", JES)).json)]
    for (const raw of responses) {
      for (const name of staff) expect(raw, name).not.toContain(name)
      for (const n of numbers) expect(raw, n).not.toContain(n)
      expect(raw).not.toMatch(/reviewerNotes|REVIEWER-ONLY|SECRET-|evidenceConfidence|aiNote|gradedSource|studentNumber|"verifiedBy"|suggestedLevel|"score"|criteria|aiQuotes/)
    }
    // Sara's rejected skill and Omar's requested-more skill are in no list, and neither are acknowledged ones.
    const all = (await talent("")).body.candidates
    const skillsOf = (id: string) => all.find((c) => c.studentId === id)!.matched.map((m) => m.skill).concat(all.find((c) => c.studentId === id)!.otherVerifiedSkills)
    expect(skillsOf("stu-ju-sara")).not.toContain("Machine Learning")
    expect(skillsOf("stu-ju-omar")).not.toContain("Data Visualization")
    expect(skillsOf("stu-ju-ahmad")).not.toContain("Machine Learning")
    expect(skillsOf("stu-ju-ahmad")).not.toContain("Data Visualization")
  })

  it("29. never carries another student's evidence, in the search or in the snapshot behind it", async () => {
    await confirmEnergyWise()
    const raw = (await talent("")).raw
    expect(raw).not.toMatch(/ev-energy|"evidenceIds"|"link"|"content"/)
    const company = await snapshot(JES)
    const author = new Map(company.evidence.map((e) => [e.id, e.studentId]))
    for (const s of company.skillSignals) {
      expect(s.status).toBe("Verified")
      for (const id of s.evidenceIds) expect(author.get(id), `${s.studentId} ${s.skill}`).toBe(s.studentId)
    }
  })

  it("the company snapshot no longer carries AI scores, model reasoning or reviewer identity", async () => {
    await confirmEnergyWise()
    const company = await snapshot(JES)
    expect(company.skillSignals.length).toBeGreaterThan(0)
    const raw = JSON.stringify(company)
    expect(raw).not.toMatch(/evidenceConfidence|aiNote|gradedSource|"verifiedBy"|reviewerNotes|REVIEWER-ONLY/)
    expect(company.staff).toEqual([])
    const staff = (await snapshot(JU)).staff.map((s) => s.name)
    for (const name of staff) expect(raw, name).not.toContain(name)
    // The university's confirmation note reaches the company as the university's, not a person's.
    const project = company.projects.find((p) => p.id === PROJECT)!
    expect(project.feedback.filter((f) => f.authorKind === "staff").every((f) => f.author === "University of Jordan")).toBe(true)
    // Other actors keep what they had.
    const ju = await snapshot(JU)
    expect(JSON.stringify(ju)).toMatch(/evidenceConfidence/)
  })

  it("the company snapshot lists only students with eligible verified proof", async () => {
    const company = await snapshot(ESTARTA)
    expect(sorted(company.students.map((s) => s.id))).toEqual(["stu-aau-yazan", "stu-hu-leen", "stu-ju-omar", "stu-ju-tala", "stu-just-ahmad"])
    await confirmEnergyWise()
    expect(sorted((await snapshot(ESTARTA)).students.map((s) => s.id))).toEqual(
      ["stu-aau-yazan", "stu-hu-leen", "stu-ju-ahmad", "stu-ju-omar", "stu-ju-sara", "stu-ju-tala", "stu-just-ahmad"],
    )
    // Profile information (GPA, bio…) stays for those students, never the student number.
    const ahmad = (await snapshot(ESTARTA)).students.find((s) => s.id === "stu-ju-ahmad")!
    expect(typeof ahmad.gpa).toBe("number")
    expect(ahmad.studentNumber).toBeUndefined()
  })

  it("30. query parameters cannot widen what is eligible", async () => {
    // Sara has nothing verified and confirmed, so no parameter can surface her.
    const probes = [
      "skills=Machine Learning&status=Pending Verification",
      "skills=Machine Learning&includeUnverified=true",
      "skills=Machine Learning&verified=false",
      "skills=Machine Learning&student=stu-ju-sara",
      "studentId=stu-ju-sara",
      "skills[]=Machine Learning&skills[]=SQL",
      "university[]=uni-ju&university=uni-ju&all=1",
      "skills=Machine Learning&project=prj-jes-energywise",
      "skills=%5B%22Machine%20Learning%22%5D",
      "skills=Machine Learning'%20OR%201=1--",
      "skills=.*&industry=.*",
      "skills=%25&university=%25",
      "__proto__=x&constructor=y&skills=Python",
    ]
    for (const q of probes) {
      const r = await talent(q)
      expect(r.status, q).toBeLessThan(500)
      expect(r.raw, q).not.toContain("stu-ju-sara")
      expect(r.raw, q).not.toContain("stu-ju-ahmad")
    }
    // A repeated skills parameter still means AND.
    expect(ids(await talent("skills=Python&skills=Machine Learning"))).toEqual(["stu-ju-omar"])
    // And too many skills at once is refused plainly.
    const many = Array.from({ length: 12 }, (_, i) => `Skill${i}`).join(",")
    expect((await talent(`skills=${many}`)).status).toBe(400)
    expect((await talent(`skills=${"x".repeat(2000)}`)).status).toBe(400)
  })
})

describe("who may search", () => {
  it("31. a guest gets 403", async () => {
    expect((await talent("", null)).status).toBe(403)
    expect((await server.call("GET", "/talent/stu-ju-omar")).status).toBe(403)
  })
  it("32. a student gets 403", async () => {
    expect((await talent("", AHMAD)).status).toBe(403)
    expect((await server.call("GET", "/talent/stu-ju-omar", AHMAD)).status).toBe(403)
  })
  it("33. a university gets 403", async () => {
    expect((await talent("", JU)).status).toBe(403)
    expect((await server.call("GET", "/talent/stu-ju-omar", JU)).status).toBe(403)
  })
  it("any company may search — discovery is not limited to its own challenges", async () => {
    expect(ids(await talent("skills=SQL", "company:org-echo"))).toEqual(ids(await talent("skills=SQL", JES)))
  })
})

describe("a candidate's verified proof profile", () => {
  it("returns the candidate with every skill currently verified for them", async () => {
    const res = await server.call("GET", "/talent/stu-ju-omar", ESTARTA)
    expect(res.status).toBe(200)
    const c = (res.json as unknown as { candidate: Candidate }).candidate
    expect(c.studentId).toBe("stu-ju-omar")
    expect(sorted(c.matched.map((m) => m.skill))).toEqual(["Data Analysis", "Machine Learning", "Natural Language Processing", "Python"])
    expect(c.otherVerifiedSkills).toEqual([])
  })

  it("35. is a 404 for a student with no eligible verified proof, and for one who does not exist", async () => {
    for (const id of ["stu-ju-sara", "stu-hu-dana", "stu-nobody"]) {
      const res = await server.call("GET", `/talent/${id}`, JES)
      expect(res.status, id).toBe(404)
      expect(JSON.stringify(res.json)).not.toMatch(/Sara|Dana/)
    }
    // …and a student who was discoverable stops being found once nothing of theirs is current.
    expect((await server.call("GET", "/talent/stu-hu-leen", JES)).status).toBe(200)
    db().prepare("UPDATE skill_signals SET status = 'Rejected' WHERE student_id = 'stu-hu-leen'").run()
    expect((await server.call("GET", "/talent/stu-hu-leen", JES)).status).toBe(404)
  })
})

describe("company actions", () => {
  const act = (studentId: string, body: Record<string, unknown>, actor = ESTARTA) => server.call("POST", `/students/${studentId}/company-actions`, actor, body)
  const mine = async (actor = ESTARTA) => (await snapshot(actor)).companyActions

  it("36. cannot target a student who is not currently discoverable", async () => {
    for (const body of [{ kind: "saved" }, { kind: "interested" }, { kind: "invited", opportunityId: "opp-estarta-cx", note: "Hello" }]) {
      const res = await act("stu-ju-sara", body)
      expect(res.status, JSON.stringify(body)).toBe(404)
    }
    expect((await act("stu-hu-dana", { kind: "saved" })).status).toBe(404)
    expect((await act("stu-nobody", { kind: "saved" })).status).toBe(404)
    expect((await mine()).some((a) => ["stu-ju-sara", "stu-hu-dana"].includes(a.studentId))).toBe(false)
    // No notification reaches the student either.
    const sara = (await server.call("GET", "/snapshot", "student:stu-ju-sara")).json.snapshot as unknown as { notifications: { title: string }[] }
    expect(sara.notifications.some((n) => /invited/i.test(n.title))).toBe(false)
  })

  it("36. cannot target a student whose proof has stopped being current", async () => {
    expect((await act("stu-hu-leen", { kind: "saved" })).status).toBe(200)
    db().prepare("UPDATE skill_signals SET status = 'More Evidence Requested' WHERE student_id = 'stu-hu-leen'").run()
    expect((await act("stu-hu-leen", { kind: "interested" })).status).toBe(404)
  })

  it("37. a discoverable student can be saved, marked, and invited", async () => {
    expect((await act("stu-hu-leen", { kind: "saved" })).status).toBe(200)
    expect((await act("stu-hu-leen", { kind: "interested" })).status).toBe(200)
    expect((await act("stu-hu-leen", { kind: "invited", opportunityId: "opp-estarta-cx", note: "Let's talk." })).status).toBe(200)
    expect((await mine()).filter((a) => a.studentId === "stu-hu-leen").map((a) => a.kind).sort()).toEqual(["interested", "invited", "saved"])
  })

  it("only a company may act", async () => {
    expect((await act("stu-hu-leen", { kind: "saved" }, JU)).status).toBe(403)
    expect((await act("stu-hu-leen", { kind: "saved" }, AHMAD)).status).toBe(403)
  })
})

describe("evidence routes stay inside eligible proof", () => {
  const attach = (evidenceId: string) =>
    db().prepare("INSERT OR REPLACE INTO evidence_files (evidence_id, name, mime, size, data) VALUES (?, 'work.txt', 'text/plain', 4, ?)").run(evidenceId, Buffer.from("work"))
  const download = (evidenceId: string, actor: string | null = JES) => server.fetch(`/evidence/${evidenceId}/file`, actor ?? undefined).then((r) => r.status)

  it("a company can download only evidence behind a skill that is eligible right now", async () => {
    await confirmEnergyWise()
    const company = await snapshot(JES)
    const cited = company.skillSignals.find((s) => s.studentId === "stu-ju-sara" && s.evidenceIds.length > 0)!.evidenceIds[0]
    attach(cited)
    expect(await download(cited)).toBe(200)
    // Evidence that no eligible skill cites is not a company's to read, even on the same confirmed project.
    const uncited = (await snapshot(JU)).evidence.find((e) => e.projectId === PROJECT && !company.evidence.some((x) => x.id === e.id))!
    attach(uncited.id)
    expect(await download(uncited.id)).toBe(403)
    // A student, another university's account and a guest never could.
    for (const actor of ["student:stu-aau-yazan", "university:uni-aau", null]) expect(await download(cited, actor)).toBe(403)
    // And once Sara's verification stops being current, her evidence stops being downloadable.
    await sleep(5)
    db().prepare(
      "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late-3', ?, 'stu-ju-sara', 'Contribution Statement', 'Late', '', '', 'Written after the decision.', ?)",
    ).run(PROJECT, new Date().toISOString())
    expect(await download(cited)).toBe(403)
  })

  it("a malformed student id in the path is a plain 404", async () => {
    expect((await server.call("GET", "/talent/%E0%A4%A", JES)).status).toBe(404)
  })

  it("a company cannot download evidence of a stale verification", async () => {
    await confirmEnergyWise()
    const company = await snapshot(JES)
    const file = company.evidence.find((e) => e.projectId === PROJECT && e.studentId === "stu-ju-sara")
    expect(file).toBeDefined()
    await sleep(5)
    db().prepare(
      "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late-2', ?, 'stu-ju-sara', 'Contribution Statement', 'Late', '', '', 'Written after the decision.', ?)",
    ).run(PROJECT, new Date().toISOString())
    const after = await snapshot(JES)
    expect(after.evidence.some((e) => e.projectId === PROJECT && e.studentId === "stu-ju-sara")).toBe(false)
    expect(after.skillSignals.some((s) => s.projectId === PROJECT && s.studentId === "stu-ju-sara")).toBe(false)
  })
})
