import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { rmSync, writeFileSync } from "node:fs"
import { resetDatabase, startServer } from "./helpers.ts"
import { llmDeps } from "../ml/llm-grader.ts"
import { hashEvidenceSet } from "../ai.ts"
import { resetSeedGradesCache } from "../seed.ts"

const PROJECT = "prj-iris-anomaly-yazan"
const YAZAN = "student:stu-aau-yazan"
const SKILLS = ["Python", "Machine Learning", "Network Security", "Data Analysis"]
const QUOTE = "model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)"
const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "WSL_AI_PROVIDER"]
const realFetch = llmDeps.fetch

interface Signal {
  projectId: string
  skill: string
  evidenceConfidence: number
  aiNote: string
  gradedSource: string
}
interface Snap {
  skillSignals: Signal[]
  projects: { id: string; gradedModel?: string }[]
  evidence: { id: string; projectId: string; type: string; title: string; description: string; content?: string }[]
}

const server = await startServer()
afterAll(() => server.close())

async function snapshot(): Promise<Snap> {
  return (await server.call("GET", "/snapshot", YAZAN)).json.snapshot as Snap
}
async function yazanSignals() {
  return (await snapshot()).skillSignals.filter((s) => s.projectId === PROJECT)
}
const analyze = () => server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)

function geminiScores(score: number, calls: string[]) {
  llmDeps.fetch = async (url) => {
    calls.push(url)
    const payload = {
      restatesBrief: false,
      skills: SKILLS.map((skill) => ({ skill, score, criteriaMet: [], reason: "Working pipeline.", quotes: [{ evidenceId: "ev-yazan-1", text: QUOTE, why: "Fits a tuned model." }] })),
    }
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
  }
}
function geminiRateLimited(calls: string[]) {
  llmDeps.fetch = async (url) => {
    calls.push(url)
    return Response.json({ error: { message: "Rate limit reached for model on tokens per day" } }, { status: 429 })
  }
}

describe("grading survives quota limits and outages", () => {
  beforeEach(() => {
    resetDatabase()
    for (const k of KEYS) delete process.env[k]
  })
  afterEach(() => {
    llmDeps.fetch = realFetch
    for (const k of KEYS) delete process.env[k]
  })

  it("a model failure does not overwrite a previous model-graded result", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const calls: string[] = []
    geminiScores(81, calls)
    expect((await analyze()).json.result).toMatchObject({ unchanged: false, failed: false })
    const before = await yazanSignals()
    expect(before.every((s) => s.gradedSource === "model")).toBe(true)

    // A different model means a different cache key, so the model is called again — and fails.
    process.env.GEMINI_MODEL = "gemini-other"
    geminiRateLimited(calls)
    const res = await analyze()
    expect(res.status).toBe(200)
    expect(res.json.result).toMatchObject({ failed: true })
    expect(calls).toHaveLength(2)
    expect(await yazanSignals()).toEqual(before)
  })

  it("a retry after a failure reaches the model again instead of being cached as unchanged", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const calls: string[] = []
    geminiRateLimited(calls)
    expect((await analyze()).json.result).toMatchObject({ failed: true })

    geminiScores(64, calls)
    const retry = await analyze()
    expect(retry.json.result).toMatchObject({ unchanged: false, failed: false })
    expect(calls).toHaveLength(2)
    expect((await yazanSignals()).find((s) => s.skill === "Machine Learning")!.evidenceConfidence).toBe(64)
  })

  it("with no previous model result, a failure falls back to the offline scorer and is labeled as such", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    geminiRateLimited([])
    expect((await analyze()).json.result).toMatchObject({ failed: true })
    const signals = await yazanSignals()
    expect(signals.every((s) => s.gradedSource === "offline")).toBe(true)
    // The provider failure itself never leaks into what students and mentors read.
    for (const s of signals) expect(s.aiNote).not.toMatch(/429|rate limit|Gemini/i)
  })
})

describe("GET /api/health", () => {
  afterEach(() => {
    llmDeps.fetch = realFetch
    for (const k of KEYS) delete process.env[k]
  })

  it("reports the offline scorer when no key is configured", async () => {
    const res = await server.call("GET", "/health")
    expect(res.status).toBe(200)
    expect(res.json).toMatchObject({ provider: null, model: "offline", keyWorks: false })
  })

  it("checks that the grading model actually answers, and reuses the result for a minute", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const calls: string[] = []
    llmDeps.fetch = async (url) => {
      calls.push(url)
      return Response.json({ candidates: [{ content: { parts: [{ text: "OK" }] } }] })
    }
    const res = await server.call("GET", "/health")
    expect(res.json).toMatchObject({ provider: "gemini", model: "gemini-flash-latest", keyWorks: true })
    expect(calls[0]).toContain("/models/gemini-flash-latest:generateContent")
    // A public endpoint: a second check right away doesn't spend more tokens.
    await server.call("GET", "/health")
    expect(calls).toHaveLength(1)
  })

  it("reports a key the provider rejects", async () => {
    process.env.GEMINI_API_KEY = "bad-key"
    llmDeps.fetch = async () => Response.json({ error: { message: "API key not valid" } }, { status: 400 })
    const res = await server.call("GET", "/health")
    expect(res.json).toMatchObject({ provider: "gemini", keyWorks: false })
    expect(String(res.json.message)).toMatch(/HTTP 400/)
  })

  it("reports a used-up daily quota from the last grading call, even though the key itself works", async () => {
    resetDatabase()
    process.env.GROQ_API_KEY = "quota-key"
    // The free tier's daily limit refuses a grading-sized request but still answers a tiny one.
    llmDeps.fetch = async (_url, init) =>
      String(init.body).includes("response_format")
        ? Response.json(
            { error: { message: "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01abc123XYZ` on tokens per day (TPD)" } },
            { status: 429 },
          )
        : Response.json({ choices: [{ message: { content: "OK" } }] })
    expect((await analyze()).json.result).toMatchObject({ failed: true })

    const res = await server.call("GET", "/health")
    expect(res.json).toMatchObject({ provider: "groq", keyWorks: true, lastGrading: { ok: false } })
    const lastGrading = res.json.lastGrading as { message: string }
    expect(lastGrading.message).toMatch(/429: Rate limit reached/)
    expect(lastGrading.message).not.toContain("org_01abc123XYZ")
  })
})

describe("pre-graded seed results", () => {
  afterEach(() => {
    rmSync(process.env.WSL_SEED_GRADES_PATH!, { force: true })
    resetSeedGradesCache()
    resetDatabase()
  })

  async function writeSeedGrades(hashFor: (skills: string[], evidence: Snap["evidence"]) => string) {
    resetDatabase()
    const snap = await snapshot()
    const skills = snap.skillSignals.filter((s) => s.projectId === PROJECT).map((s) => s.skill)
    const evidence = snap.evidence.filter((e) => e.projectId === PROJECT)
    const results = skills.map((skill) => ({
      skill,
      rating: 77,
      suggestedLevel: "Advanced",
      note: "Graded by test-model against this challenge.",
      quotes: [],
      evidenceIds: [evidence[0].id],
      criteria: [],
      source: "model",
      model: "test-model",
    }))
    writeFileSync(process.env.WSL_SEED_GRADES_PATH!, JSON.stringify({ [PROJECT]: { model: "test-model", hash: hashFor(skills, evidence), gradedAt: "2026-10-01T00:00:00Z", results } }))
    resetSeedGradesCache()
    resetDatabase()
  }

  it("seeds a project from its pre-graded model result when the evidence still matches", async () => {
    await writeSeedGrades((skills, evidence) => hashEvidenceSet(skills, evidence, "test-model"))
    const snap = await snapshot()
    const signals = snap.skillSignals.filter((s) => s.projectId === PROJECT)
    expect(signals.every((s) => s.evidenceConfidence === 77 && s.gradedSource === "model")).toBe(true)
    expect(snap.projects.find((p) => p.id === PROJECT)!.gradedModel).toBe("test-model")
  })

  it("ignores a stale pre-graded result whose evidence no longer matches", async () => {
    await writeSeedGrades(() => "stale-hash")
    const snap = await snapshot()
    const signals = snap.skillSignals.filter((s) => s.projectId === PROJECT)
    expect(signals.every((s) => s.gradedSource === "offline")).toBe(true)
    expect(snap.projects.find((p) => p.id === PROJECT)!.gradedModel).toBe("offline")
  })
})
