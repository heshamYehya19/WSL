import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

interface Showcase {
  studentName: string
  projectTitle: string
  skills: { skill: string; level: string; quote: { text: string; evidenceTitle: string }; verifiedBy: string }[]
}
interface Snap {
  showcase: Showcase | null
  evidence: unknown[]
  skillSignals: { projectId: string; skill: string; status: string; aiQuotes: { text: string }[] }[]
  projects: { id: string; title: string; status: string; studentId: string }[]
  students: { id: string; name: string }[]
}

const server = await startServer()
afterAll(() => server.close())

const snapshot = async (actor?: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as Snap

describe("landing page showcase record", () => {
  beforeEach(() => resetDatabase())

  it("is available to signed-out visitors, with verified skills, quoted work and the mentor", async () => {
    const guest = await snapshot()
    expect(guest.showcase).not.toBeNull()
    expect(guest.showcase!.skills.length).toBeGreaterThanOrEqual(2)
    expect(guest.showcase!.skills.length).toBeLessThanOrEqual(3)
    for (const s of guest.showcase!.skills) {
      expect(s.quote.text.length).toBeGreaterThan(0)
      expect(s.verifiedBy.length).toBeGreaterThan(0)
    }
  })

  it("only ever shows mentor-verified skills from work already confirmed to the company", async () => {
    const { showcase } = await snapshot()
    // A company sees exactly the confirmed work, so every showcased skill must be verified there.
    const company = await snapshot("company:org-estarta")
    const project = company.projects.find((p) => p.title === showcase!.projectTitle && company.students.find((st) => st.id === p.studentId)?.name === showcase!.studentName)!
    expect(["Verified", "Completed", "Company Feedback Received"]).toContain(project.status)
    for (const s of showcase!.skills) {
      const signal = company.skillSignals.find((sig) => sig.projectId === project.id && sig.skill === s.skill)!
      expect(signal.status).toBe("Verified")
      expect(signal.aiQuotes.map((q) => q.text)).toContain(s.quote.text)
    }
  })

  it("doesn't widen what signed-out visitors can see otherwise", async () => {
    const guest = await snapshot()
    expect(guest.evidence).toHaveLength(0)
    expect(guest.skillSignals).toHaveLength(0)
  })
})
