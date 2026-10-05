// helpers.ts must load first: it points WSL_DB_PATH at a throwaway database before db.ts reads it.
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { getDb } from "../db.ts"
import { proofByProject } from "../../src/lib/selectors.ts"
import type { Evidence, Project, SkillSignal, TalentCandidate } from "../../src/types.ts"

// Level 3B. A candidate's Verified Proof Profile is the server's list of what is currently verified for them
// (GET /talent/:id), grouped by project and joined to the evidence it cites. These tests run the real grouping function
// over real API responses, so they check exactly what the profile page renders.
const JES = "company:org-jes"
const JU = "university:uni-ju"
const PROJECT = "prj-jes-energywise"
const TEAM = { ahmad: "stu-ju-ahmad", sara: "stu-ju-sara", omar: "stu-ju-omar" }

interface Snap {
  projects: Project[]
  skillSignals: SkillSignal[]
  evidence: Evidence[]
  universities: { id: string; name: string }[]
  staff: { name: string }[]
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())

const db = () => getDb()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const candidate = async (id: string, actor = JES) => {
  const res = await server.call("GET", `/talent/${id}`, actor)
  return { status: res.status, c: (res.json as { candidate?: TalentCandidate }).candidate as TalentCandidate, raw: JSON.stringify(res.json) }
}
const profile = async (id: string) => {
  const { c } = await candidate(id)
  const snap = await snapshot(JES)
  return { c, snap, proof: proofByProject(c, snap.projects, snap.skillSignals, snap.evidence) }
}

async function confirmEnergyWise() {
  const snap = await snapshot(JU)
  for (const s of snap.skillSignals.filter((x) => x.projectId === PROJECT)) {
    const body = s.suggestedLevel === "Insufficient" ? { decision: "insufficient" } : { decision: "verify", reviewerNotes: "REVIEWER-ONLY-NOTE" }
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, body)).status).toBe(200)
  }
  expect((await server.call("POST", `/projects/${PROJECT}/confirm`, JU, { note: "Confirmed." })).status).toBe(200)
}

describe("A. the profile lists only skills that are currently verified", () => {
  it("shows exactly the verified skills — never the ones the university acknowledged as insufficient, rejected, or sent back", async () => {
    await confirmEnergyWise()
    let { proof, c } = await profile(TEAM.ahmad)
    const shown = proof.flatMap((g) => g.skills.map((k) => k.skill)).sort()
    expect(shown).toEqual(["Data Analysis", "Python", "SQL"]) // his Machine Learning and Data Visualization were acknowledged as insufficient
    expect(c.verifiedSkillCount).toBe(3)
    // Sara's verified skills, then a post-confirmation rejection and a request for more evidence take two away.
    const before = (await profile(TEAM.sara)).proof.flatMap((g) => g.skills.map((k) => k.skill))
    expect(before).toContain("Machine Learning")
    const sig = (await snapshot(JU)).skillSignals.filter((s) => s.projectId === PROJECT && s.studentId === TEAM.sara)
    const ml = sig.find((s) => s.skill === "Machine Learning")!
    const py = sig.find((s) => s.skill === "Python")!
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${ml.id}/review`, JU, { decision: "reject", reviewerNotes: "No." })).status).toBe(200)
    expect((await server.call("POST", `/projects/${PROJECT}/signals/${py.id}/review`, JU, { decision: "request-more-evidence", reviewerNotes: "More." })).status).toBe(200)
    const after = (await profile(TEAM.sara)).proof.flatMap((g) => g.skills.map((k) => k.skill))
    expect(after).not.toContain("Machine Learning")
    expect(after).not.toContain("Python")
    expect(after.length).toBe(before.length - 2)
    ;({ proof, c } = await profile(TEAM.sara))
    expect(JSON.stringify(proof.map((g) => g.skills.map((k) => [k.skill, k.signal?.status])))).not.toMatch(/Rejected|More Evidence|Pending|Insufficient/)
  })

  it("lists nothing for a student whose proof is not eligible: the API refuses, so there is no profile to build", async () => {
    expect((await candidate(TEAM.sara)).status).toBe(404) // EnergyWise not confirmed yet
    expect((await candidate("stu-hu-dana")).status).toBe(404)
  })
})

describe("B. every displayed skill traces to its project and its evidence", () => {
  it("each skill has a verified signal on that project, evidence that is the student's own on that project, and the right verifier and date", async () => {
    await confirmEnergyWise()
    const snap = await snapshot(JES)
    const browse = (await server.call("GET", "/talent", JES)).json as unknown as { candidates: TalentCandidate[] }
    expect(browse.candidates.length).toBe(7) // the five seeded students, plus Ahmad and Sara
    const uni = new Map(snap.universities.map((u) => [u.id, u.name]))
    let skills = 0
    for (const cand of browse.candidates) {
      const proof = proofByProject(cand, snap.projects, snap.skillSignals, snap.evidence)
      expect(proof.flatMap((g) => g.skills).length).toBe(cand.matched.length)
      for (const g of proof) {
        expect(snap.projects.find((p) => p.id === g.projectId)!.title).toBe(g.projectTitle)
        expect(g.organizationId).toBe(snap.projects.find((p) => p.id === g.projectId)!.organizationId)
        for (const k of g.skills) {
          skills++
          expect(k.signal, `${cand.studentId} ${k.skill}`).toBeDefined()
          expect(k.signal).toMatchObject({ studentId: cand.studentId, projectId: g.projectId, skill: k.skill, status: "Verified" })
          expect(k.signal!.verifiedAt).toBe(k.verifiedAt)
          expect(uni.get(k.signal!.verifiedByUniversityId!)).toBe(k.verifyingUniversity)
          expect(k.evidence.length, `${cand.studentId} ${k.skill}`).toBeGreaterThan(0)
          expect(k.evidence.map((e) => e.id).sort()).toEqual([...k.signal!.evidenceIds].sort())
          for (const e of k.evidence) expect(e).toMatchObject({ studentId: cand.studentId, projectId: g.projectId })
        }
      }
    }
    expect(skills).toBeGreaterThanOrEqual(20)
  })

  it("a skill is shown only with the project that proves it: a candidate cannot be paired with someone else's proof", async () => {
    await confirmEnergyWise()
    const snap = await snapshot(JES)
    const ahmad = (await candidate(TEAM.ahmad)).c
    // Pretend the page were handed Ahmad's proof under Sara's name. Sara has her own verified Python and Data Analysis on the
    // same project, so her evidence attaches there — but none of Ahmad's does, and she gains no skill she was not verified for.
    const forged = proofByProject({ ...ahmad, studentId: TEAM.sara }, snap.projects, snap.skillSignals, snap.evidence)
    const attached = forged.flatMap((g) => g.skills.flatMap((k) => k.evidence))
    const ahmadEvidence = new Set(snap.evidence.filter((e) => e.studentId === TEAM.ahmad).map((e) => e.id))
    expect(ahmadEvidence.size).toBeGreaterThan(0)
    expect(attached.length).toBeGreaterThan(0)
    for (const e of attached) {
      expect(e.studentId).toBe(TEAM.sara)
      expect(ahmadEvidence.has(e.id)).toBe(false)
    }
    // His SQL was verified; hers was not (acknowledged as insufficient), so it comes with no evidence at all.
    expect(forged.flatMap((g) => g.skills).find((k) => k.skill === "SQL")!.evidence).toEqual([])
  })
})

describe("C. a team project's contribution is each student's own", () => {
  it("attributes the right contribution to the right student, and never another teammate's", async () => {
    await confirmEnergyWise()
    const ju = await snapshot(JU)
    const project = ju.projects.find((p) => p.id === PROJECT)!
    const own: Record<string, string> = { [TEAM.ahmad]: project.ownerRoleNote, ...Object.fromEntries(project.members.map((m) => [m.studentId, m.roleNote])) }
    expect(new Set(Object.values(own)).size).toBe(3)
    for (const id of Object.values(TEAM)) {
      const { proof } = await profile(id)
      const group = proof.find((g) => g.projectId === PROJECT)!
      expect(group.contribution, id).toBe(own[id])
      expect(group.contribution.length).toBeGreaterThan(10)
      const others = Object.entries(own).filter(([k]) => k !== id).map(([, v]) => v)
      for (const note of others) expect(JSON.stringify(proof), id).not.toContain(note)
    }
  })

  it("the contribution is a claim, not evidence: it never appears among the supporting evidence", async () => {
    await confirmEnergyWise()
    const { proof } = await profile(TEAM.sara)
    const evidenceTypes = proof.flatMap((g) => g.skills.flatMap((k) => k.evidence.map((e) => e.type)))
    expect(evidenceTypes.length).toBeGreaterThan(0)
    expect(evidenceTypes).not.toContain("Contribution Statement")
  })
})

describe("D. another student's evidence cannot appear", () => {
  it("a profile's evidence is only the student's own, even on a shared project", async () => {
    await confirmEnergyWise()
    const ev = new Map((await snapshot(JES)).evidence.map((e) => [e.id, e]))
    for (const id of Object.values(TEAM)) {
      const { proof } = await profile(id)
      for (const e of proof.flatMap((g) => g.skills.flatMap((k) => k.evidence))) expect(ev.get(e.id)!.studentId, `${id} ${e.title}`).toBe(id)
    }
    const sara = await profile(TEAM.sara)
    const ahmadTitles = [...ev.values()].filter((e) => e.studentId === TEAM.ahmad).map((e) => e.title)
    for (const t of ahmadTitles) expect(JSON.stringify(sara.proof)).not.toContain(t)
  })
})

describe("E. stale proof cannot appear", () => {
  it("disappears when the verification stops being current, and returns after the university verifies again", async () => {
    await confirmEnergyWise()
    expect((await profile(TEAM.ahmad)).proof.length).toBeGreaterThan(0)
    await sleep(5)
    db().prepare("INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES ('ev-late-b', ?, ?, 'Contribution Statement', 'Late', '', '', 'Written after the decision.', ?)").run(PROJECT, TEAM.ahmad, new Date().toISOString())
    expect((await candidate(TEAM.ahmad)).status).toBe(404)
    const snap = await snapshot(JES)
    expect(snap.skillSignals.filter((s) => s.studentId === TEAM.ahmad)).toEqual([])
    expect(snap.evidence.filter((e) => e.studentId === TEAM.ahmad)).toEqual([])
    await sleep(5)
    for (const s of (await snapshot(JU)).skillSignals.filter((x) => x.projectId === PROJECT && x.studentId === TEAM.ahmad && x.status === "Verified")) {
      expect((await server.call("POST", `/projects/${PROJECT}/signals/${s.id}/review`, JU, { decision: "verify" })).status).toBe(200)
    }
    expect((await profile(TEAM.ahmad)).proof.flatMap((g) => g.skills.map((k) => k.skill)).sort()).toEqual(["Data Analysis", "Python", "SQL"])
  })
})

describe("F/G. no reviewer identity and no AI scoring in what the profile is built from", () => {
  it("carries the university and a date, never a person, a score, or model reasoning", async () => {
    await confirmEnergyWise()
    const staff = (await snapshot(JU)).staff.map((s) => s.name)
    expect(staff.length).toBeGreaterThan(0)
    const { raw } = await candidate(TEAM.ahmad)
    const { snap } = await profile(TEAM.ahmad)
    const built = JSON.stringify([snap.skillSignals.filter((s) => s.studentId === TEAM.ahmad), snap.evidence.filter((e) => e.studentId === TEAM.ahmad), snap.projects.find((p) => p.id === PROJECT)])
    for (const text of [raw, built]) {
      for (const n of staff) expect(text, n).not.toContain(n)
      expect(text).not.toMatch(/REVIEWER-ONLY|reviewerNotes|"verifiedBy"|evidenceConfidence|aiNote|gradedSource|studentNumber|"score"/)
    }
    expect(built).toContain("verifiedByUniversityId")
    expect(built).toContain("verifiedAt")
  })
})

describe("H/I. Talent Discovery and company authorization are unchanged", () => {
  it("search still works, and only a signed-in company may open a profile", async () => {
    expect(((await server.call("GET", "/talent?skills=SQL", JES)).json as { candidates: unknown[] }).candidates).toHaveLength(3)
    for (const actor of [undefined, "student:stu-ju-sara", JU]) {
      expect((await server.call("GET", `/talent/${"stu-ju-omar"}`, actor)).status).toBe(403)
    }
    expect((await candidate("stu-ju-omar")).status).toBe(200)
    // The company that owns no project of the student's can open it too: discovery is not limited to its own challenges.
    expect((await candidate("stu-ju-omar", "company:org-echo")).status).toBe(200)
  })
})
