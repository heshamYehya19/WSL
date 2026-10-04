import { afterAll, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { canonicalSkillName } from "../ml/analyze.ts"

const server = await startServer()

describe("canonicalSkillName", () => {
  it("fixes casing for WSL's known skill vocabulary", () => {
    expect(canonicalSkillName("python")).toBe("Python")
    expect(canonicalSkillName("PYTHON")).toBe("Python")
    expect(canonicalSkillName("sql")).toBe("SQL")
    expect(canonicalSkillName("rest api design")).toBe("REST API Design")
    expect(canonicalSkillName("  python  ")).toBe("Python")
  })

  it("leaves already-correct and unknown mixed-case names alone", () => {
    expect(canonicalSkillName("JavaScript")).toBe("JavaScript")
    expect(canonicalSkillName("Node.js")).toBe("Node.js")
    expect(canonicalSkillName("GraphQL")).toBe("GraphQL")
  })

  it("title-cases unknown all-lowercase skills as a generic fallback", () => {
    expect(canonicalSkillName("kubernetes")).toBe("Kubernetes")
    expect(canonicalSkillName("figma design")).toBe("Figma Design")
  })
})

describe("challenge creation normalizes required skills", () => {
  afterAll(() => server.close())

  it("canonicalizes casing and dedupes case-insensitively", async () => {
    resetDatabase()
    const res = await server.call("POST", "/challenges", "company:org-echo", {
      title: "Test skill casing",
      problemDescription: "A real-enough problem description for validation purposes, long enough to pass the length check.",
      requiredSkills: ["python", "SQL", "python", "sql", "kubernetes"],
      visibility: "Public",
      industry: "IT",
      difficulty: "Foundational",
      learningOutcomes: ["Learn something"],
      datasetAvailability: "None needed",
      dataSensitivity: "Low",
      deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      preferredUniversityId: null,
      contactId: "",
      asDraft: true,
    })
    expect(res.status).toBe(200)
    const challenge = (res.json.snapshot as { challenges: { id: string; requiredSkills: string[] }[] }).challenges.find((c) => c.id === (res.json.result as { id: string }).id)
    expect(challenge?.requiredSkills).toEqual(["Python", "SQL", "Kubernetes"])
  })
})
