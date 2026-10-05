// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { getDb } from "../db.ts"
import { canonicalSkillName } from "../ml/analyze.ts"
import { demandSummary } from "../../src/lib/selectors.ts"
import type { IndustryInsights } from "../../src/types.ts"

// Level 3D. A university's Industry Insights: counts of what companies ask for across the challenges sent to it, and how
// many of ITS students have each skill currently verified (the same authority Talent Discovery uses). Counts only.
const JU = "university:uni-ju"
const HU = "university:uni-hu"
const AAU = "university:uni-aau"
const JES = "company:org-jes"
const ESTARTA = "company:org-estarta"
const PROJECT = "prj-jes-energywise"
const JU_NAME = "University of Jordan"

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const db = () => getDb()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const insights = async (actor?: string) => {
  const res = await server.call("GET", "/university/industry-insights", actor)
  return { status: res.status, body: res.json as unknown as IndustryInsights, raw: JSON.stringify(res.json) }
}
const skill = (r: { body: IndustryInsights }, name: string) => r.body.skills.find((s) => s.skill === name)
const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as {
  students: { id: string; name: string }[]
  staff: { name: string }[]
  organizations: { name: string }[]
  challenges: { title: string }[]
  skillSignals: { id: string; projectId: string; studentId: string; skill: string; suggestedLevel: string }[]
}

/** What the company side (the authority for "currently verified") says about one university's students and one skill. */
async function verifiedAccordingToTalent(universityName: string, name: string) {
  const res = (await server.call("GET", "/talent", JES)).json as unknown as { candidates: { studentId: string; university: string; matched: { skill: string }[] }[] }
  return new Set(res.candidates.filter((c) => c.university === universityName && c.matched.some((m) => m.skill === name)).map((c) => c.studentId)).size
}

/** An independent count of demand straight from the challenge rows, to compare the whole result against. */
function expectedDemand(universityId: string) {
  const rows = db().prepare("SELECT industry, required_skills FROM challenges WHERE status <> 'Draft' AND (preferred_university_id IS NULL OR preferred_university_id = ?)").all(universityId) as { industry: string; required_skills: string }[]
  const skills = new Map<string, number>()
  const industries = new Map<string, number>()
  for (const r of rows) {
    industries.set(r.industry, (industries.get(r.industry) ?? 0) + 1)
    for (const k of new Set((JSON.parse(r.required_skills) as string[]).map((s) => canonicalSkillName(s).toLowerCase()))) skills.set(k, (skills.get(k) ?? 0) + 1)
  }
  return { challenges: rows.length, skills, industries }
}

const brief = (over: Record<string, unknown>) => ({
  title: "Map campus footfall",
  problemDescription: "A university wants to understand how people move between its lecture halls during the day, using door counters and timetable data.",
  requiredSkills: ["Python"],
  learningOutcomes: ["Analyze movement data"],
  ...over,
})
const createChallenge = async (over: Record<string, unknown>, actor = ESTARTA) => {
  const res = await server.call("POST", "/challenges", actor, brief(over))
  expect(res.status, JSON.stringify(res.json)).toBe(200)
  return (res.json.result as { id: string }).id
}

async function confirmEnergyWise() {
  const snap = await snapshot(JU)
  for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
    const body = s.suggestedLevel === "Insufficient" ? { decision: "insufficient" } : { decision: "verify" }
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, body)).status).toBe(200)
  }
  expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Confirmed." })).status).toBe(200)
}
const ahmadSql = async () => (await snapshot(JU)).skillSignals.find((s) => s.projectId === PROJECT && s.studentId === "stu-ju-ahmad" && s.skill === "SQL")!

describe("who may read Industry Insights", () => {
  it("1. a university can — and each university sees its own view", async () => {
    const ju = await insights(JU)
    const hu = await insights(HU)
    expect(ju.status).toBe(200)
    expect(hu.status).toBe(200)
    expect(ju.body.challengeCount).toBeGreaterThan(hu.body.challengeCount)
    expect(JSON.stringify(ju.body.skills)).not.toBe(JSON.stringify(hu.body.skills))
  })
  it("2. a guest cannot", async () => expect((await insights(undefined)).status).toBe(403))
  it("3. a student cannot", async () => expect((await insights("student:stu-ju-omar")).status).toBe(403))
  it("4. a company cannot", async () => {
    for (const actor of [JES, ESTARTA]) expect((await insights(actor)).status, actor).toBe(403)
  })
})

describe("what is counted as demand", () => {
  it("matches an independent count over the challenge rows, skill by skill and industry by industry", async () => {
    for (const [actor, id] of [[JU, "uni-ju"], [HU, "uni-hu"], [AAU, "uni-aau"]] as const) {
      const r = await insights(actor)
      const want = expectedDemand(id)
      expect(r.body.challengeCount).toBe(want.challenges)
      expect(new Map(r.body.skills.map((s) => [s.skill.toLowerCase(), s.challengeCount]))).toEqual(want.skills)
      expect(new Map(r.body.industries.map((i) => [i.industry, i.challengeCount]))).toEqual(want.industries)
    }
  })

  it("5. a skill counts once per challenge, however many times it is written", async () => {
    const before = skill(await insights(JU), "Python")!.challengeCount
    const target = (db().prepare("SELECT id FROM challenges WHERE status <> 'Draft' AND (preferred_university_id IS NULL OR preferred_university_id = 'uni-ju') AND required_skills NOT LIKE '%Python%' LIMIT 1").get() as { id: string }).id
    db().prepare("UPDATE challenges SET required_skills = ? WHERE id = ?").run(JSON.stringify(["Python", "python", " PYTHON ", "Python"]), target)
    const after = await insights(JU)
    expect(after.body.skills.filter((s) => s.skill.toLowerCase() === "python")).toHaveLength(1)
    expect(skill(after, "Python")!.challengeCount).toBe(before + 1) // one challenge, not four
  })

  it("6. spelling follows the existing canonical rules: 'sql', 'SQL' and ' Sql ' are one skill, shown in canonical form", async () => {
    const target = (db().prepare("SELECT id FROM challenges WHERE status <> 'Draft' AND (preferred_university_id IS NULL OR preferred_university_id = 'uni-ju') AND required_skills NOT LIKE '%SQL%' LIMIT 1").get() as { id: string }).id
    const before = skill(await insights(JU), "SQL")!.challengeCount
    db().prepare("UPDATE challenges SET required_skills = ? WHERE id = ?").run(JSON.stringify(["sql", "  Sql  ", "machine   learning"]), target)
    const r = await insights(JU)
    expect(r.body.skills.map((s) => s.skill).filter((s) => /^sql$/i.test(s))).toEqual(["SQL"])
    expect(skill(r, "SQL")!.challengeCount).toBe(before + 1)
    expect(skill(r, "Machine Learning")).toBeDefined()
    expect(r.body.skills.map((s) => s.skill)).not.toContain("machine   learning")
  })

  it("7. only challenges relevant to the university count: not another university's, and never a draft", async () => {
    const base = { ju: await insights(JU), aau: await insights(AAU) }
    await createChallenge({ title: "For AAU only", requiredSkills: ["Zymurgy Brewing"], preferredUniversityId: "uni-aau" })
    await createChallenge({ title: "Open to all", requiredSkills: ["Quantum Origami"] })
    expect((await server.call("POST", "/challenges", ESTARTA, brief({ title: "A draft", requiredSkills: ["Draft Only Skill"], asDraft: true }))).status).toBe(200)
    const ju = await insights(JU)
    const aau = await insights(AAU)
    expect(skill(ju, "Zymurgy Brewing")).toBeUndefined() // addressed to another university
    expect(skill(aau, "Zymurgy Brewing")).toMatchObject({ challengeCount: 1 })
    expect(skill(ju, "Quantum Origami")).toMatchObject({ challengeCount: 1 }) // open to every university
    expect(skill(aau, "Quantum Origami")).toMatchObject({ challengeCount: 1 })
    for (const r of [ju, aau]) expect(skill(r, "Draft Only Skill"), "a draft is private to its company").toBeUndefined()
    expect(ju.body.challengeCount).toBe(base.ju.body.challengeCount + 1)
    expect(aau.body.challengeCount).toBe(base.aau.body.challengeCount + 2)
  })

  it("14. is deterministic: the same call gives the same answer, skills by count then name, industries by count then name", async () => {
    await createChallenge({ title: "B", requiredSkills: ["Alpha Zeta"], industry: "Zeta Industry" })
    await createChallenge({ title: "C", requiredSkills: ["Alpha Beta"], industry: "Alpha Industry" })
    const a = await insights(JU)
    expect((await insights(JU)).raw).toBe(a.raw)
    const sorted = <T,>(xs: T[], count: (x: T) => number, name: (x: T) => string) =>
      [...xs].sort((p, q) => count(q) - count(p) || (name(p) < name(q) ? -1 : name(p) > name(q) ? 1 : 0))
    expect(a.body.skills).toEqual(sorted(a.body.skills, (s) => s.challengeCount, (s) => s.skill))
    expect(a.body.industries).toEqual(sorted(a.body.industries, (i) => i.challengeCount, (i) => i.industry))
    // Equal counts fall back to the name, so the order never depends on insertion order.
    const names = a.body.skills.filter((s) => s.challengeCount === 1).map((s) => s.skill)
    expect(names.indexOf("Alpha Beta")).toBeLessThan(names.indexOf("Alpha Zeta"))
    expect(a.body.industries.map((i) => i.industry).filter((i) => /Industry$/.test(i))).toEqual(["Alpha Industry", "Zeta Industry"])
    // Each industry lists its most requested skills in the same stable way.
    for (const i of a.body.industries) expect(i.topSkills.length).toBeLessThanOrEqual(5)
  })
})

describe("verified students: only valid, current proof from the university's own students", () => {
  it("8. counts the university's students with a verified skill, exactly as Talent Discovery does", async () => {
    const r = await insights(JU)
    expect(skill(r, "SQL")).toMatchObject({ challengeCount: 4, verifiedStudentCount: 1 }) // Tala
    expect(skill(r, "Machine Learning")!.verifiedStudentCount).toBe(1) // Omar
    for (const s of r.body.skills) expect(s.verifiedStudentCount, s.skill).toBe(await verifiedAccordingToTalent(JU_NAME, s.skill))
    await confirmEnergyWise() // Ahmad, Sara and Omar's EnergyWise skills become verified proof
    const after = await insights(JU)
    expect(skill(after, "SQL")!.verifiedStudentCount).toBe(2) // Tala and Ahmad
    expect(skill(after, "Python")!.verifiedStudentCount).toBe(3) // Omar, Ahmad and Sara — Omar is one student, not two
    for (const s of after.body.skills) expect(s.verifiedStudentCount, s.skill).toBe(await verifiedAccordingToTalent(JU_NAME, s.skill))
  })

  it("9. pending is excluded", async () => {
    await confirmEnergyWise()
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(2)
    db().prepare("UPDATE skill_signals SET status = 'Pending Verification' WHERE project_id = ? AND student_id = 'stu-ju-ahmad' AND skill = 'SQL'").run(PROJECT)
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(1)
  })

  it("10. rejected is excluded", async () => {
    await confirmEnergyWise()
    const sql = await ahmadSql()
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${sql.id}/review`, JU, { decision: "reject", reviewerNotes: "No." })).status).toBe(200)
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(1)
  })

  it("11. insufficient is excluded — whether acknowledged, or still carrying the Insufficient level", async () => {
    await confirmEnergyWise()
    db().prepare("UPDATE skill_signals SET status = 'Insufficient Evidence' WHERE project_id = ? AND student_id = 'stu-ju-ahmad' AND skill = 'SQL'").run(PROJECT)
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(1)
    db().prepare("UPDATE skill_signals SET status = 'Verified', suggested_level = 'Insufficient' WHERE project_id = ? AND student_id = 'stu-ju-ahmad' AND skill = 'SQL'").run(PROJECT)
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(1)
  })

  it("12. stale is excluded, and returns after the university verifies again", async () => {
    await confirmEnergyWise()
    await sleep(5)
    db().prepare("INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late-i', ?, 'stu-ju-ahmad', 'Contribution Statement', 'Late', '', '', 'Written after the decision.', ?)").run(PROJECT, new Date().toISOString())
    const stale = await insights(JU)
    expect(skill(stale, "SQL")!.verifiedStudentCount).toBe(1)
    expect(skill(stale, "Python")!.verifiedStudentCount).toBe(2) // Omar and Sara; Ahmad's whole decision set is stale
    await sleep(5)
    for (const s of (await snapshot(JU)).skillSignals.filter((x) => x.projectId === PROJECT && x.studentId === "stu-ju-ahmad" && x.suggestedLevel !== "Insufficient")) {
      expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, { decision: "verify" })).status).toBe(200)
    }
    expect(skill(await insights(JU), "SQL")!.verifiedStudentCount).toBe(2)
  })

  it("13. students from another university are never counted", async () => {
    const ju = await insights(JU)
    const hu = await insights(HU)
    // Leen (Hashemite) and Ahmad Obeidat (JUST) have REST API Design verified; a Jordan challenge asks for it, no Jordan student has it.
    expect(skill(ju, "REST API Design")).toMatchObject({ challengeCount: 1, verifiedStudentCount: 0 })
    expect(skill(hu, "REST API Design")!.verifiedStudentCount).toBe(1) // Leen — her own university counts her
    expect(skill(ju, "SQL")!.verifiedStudentCount).toBe(1) // Tala only — not Leen, not Ahmad Obeidat
    expect(skill(hu, "SQL")!.verifiedStudentCount).toBe(1) // Leen only — not Tala
    expect(skill(ju, "Python")!.verifiedStudentCount).toBe(1) // Omar, not Yazan (Arab Amman)
    expect(skill(ju, "React")).toBeUndefined() // nobody asked Jordan for it, so it is not listed at all
    // After EnergyWise is confirmed, Jordan's numbers move and the Hashemite's do not.
    const huBefore = hu.raw
    await confirmEnergyWise()
    expect((await insights(HU)).raw).toBe(huBefore)
  })

  it("the sentence a university reads comes from the counts, not a model", async () => {
    const r = await insights(JU)
    expect(demandSummary(r.body.skills)).toBe("SQL, Data Visualization and Machine Learning are currently among the most requested skills across company challenges.")
    expect(demandSummary([{ skill: "Python" }, { skill: "SQL" }])).toBe("Python and SQL are currently among the most requested skills across company challenges.")
    expect(demandSummary([{ skill: "Python" }])).toBe("Python is currently the most requested skill across company challenges.")
    expect(demandSummary([])).toBe("No company challenges have been sent to your university yet.")
  })
})

describe("what the response may contain", () => {
  it("15. is counts only: exact keys, and nothing that names or describes a student, a company, a challenge or a reviewer", async () => {
    await confirmEnergyWise()
    const r = await insights(JU)
    expect(Object.keys(r.body).sort()).toEqual(["challengeCount", "industries", "skills"])
    for (const s of r.body.skills) expect(Object.keys(s).sort()).toEqual(["challengeCount", "skill", "verifiedStudentCount"])
    for (const i of r.body.industries) expect(Object.keys(i).sort()).toEqual(["challengeCount", "industry", "topSkills"])
    const ju = await snapshot(JU)
    const names = [...ju.students.map((s) => s.name), ...ju.students.map((s) => s.id), ...ju.staff.map((s) => s.name), ...ju.organizations.map((o) => o.name), ...ju.challenges.map((c) => c.title)]
    expect(names.length).toBeGreaterThan(40)
    for (const n of names) expect(r.raw, n).not.toContain(n)
    expect(r.raw).not.toMatch(/gpa|bio|city|availability|studentNumber|reviewer|verifiedBy|evidenceConfidence|aiNote|gradedSource|score|rank|studentId|evidence|prj-|stu-|chal-|org-/i)
  })
})
