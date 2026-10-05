import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { llmDeps } from "../ml/llm-grader.ts"

const PROJECT = "prj-iris-anomaly-yazan"
const YAZAN = "student:stu-aau-yazan"
const SKILLS = ["Python", "Machine Learning", "Network Security", "Data Analysis"]
const QUOTE = "model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)"
const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "WSL_AI_PROVIDER"]
const realFetch = llmDeps.fetch

const server = await startServer()
afterAll(() => server.close())

const payload = (score: number) => ({
  restatesBrief: false,
  skills: SKILLS.map((skill) => ({ skill, score, criteriaMet: [], reason: "Working pipeline.", quotes: [{ evidenceId: "ev-yazan-1", text: QUOTE, why: "Fits a tuned model." }] })),
})
const groqOk = (score: number) => Response.json({ choices: [{ message: { content: JSON.stringify(payload(score)) } }] })
const geminiOk = (score: number) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload(score)) }] } }] })
const groqJsonFailure = () => Response.json({ error: { message: "Failed to generate JSON." } }, { status: 400 })
const groqQuota = () => Response.json({ error: { message: "Rate limit reached on tokens per day" } }, { status: 429 })

const isGroq = (url: string) => url.includes("groq.com")
const analyze = () => server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)
async function signals() {
  const snap = (await server.call("GET", "/snapshot", YAZAN)).json.snapshot as { skillSignals: { projectId: string; evidenceConfidence: number; aiNote: string; gradedSource: string }[] }
  return snap.skillSignals.filter((s) => s.projectId === PROJECT)
}

describe("grading falls back from Groq to Gemini", () => {
  beforeEach(() => {
    resetDatabase()
    for (const k of KEYS) delete process.env[k]
    process.env.GROQ_API_KEY = "groq-test"
    process.env.GEMINI_API_KEY = "gemini-test"
  })
  afterEach(() => {
    llmDeps.fetch = realFetch
    for (const k of KEYS) delete process.env[k]
  })

  it("retries Groq once when its answer is malformed, before using Gemini", async () => {
    const calls: string[] = []
    llmDeps.fetch = async (url) => {
      calls.push(url)
      return calls.length === 1 ? groqJsonFailure() : groqOk(70)
    }
    expect((await analyze()).json.result).toMatchObject({ failed: false })
    expect(calls.filter(isGroq)).toHaveLength(2)
    expect(calls.filter((u) => !isGroq(u))).toHaveLength(0)
    expect((await signals()).every((s) => s.gradedSource === "model" && s.evidenceConfidence >= 60)).toBe(true)
  })

  it("uses Gemini when Groq keeps returning malformed answers", async () => {
    const calls: string[] = []
    llmDeps.fetch = async (url) => {
      calls.push(url)
      return isGroq(url) ? groqJsonFailure() : geminiOk(66)
    }
    expect((await analyze()).json.result).toMatchObject({ failed: false })
    expect(calls.filter(isGroq)).toHaveLength(2)
    expect(calls.filter((u) => !isGroq(u))).toHaveLength(1)
    const after = await signals()
    expect(after.every((s) => s.gradedSource === "model")).toBe(true)
    expect(after.every((s) => s.aiNote.includes("gemini"))).toBe(true)
  })

  it("moves to Gemini straight away when Groq is out of quota, without retrying Groq", async () => {
    const calls: string[] = []
    llmDeps.fetch = async (url) => {
      calls.push(url)
      return isGroq(url) ? groqQuota() : geminiOk(66)
    }
    expect((await analyze()).json.result).toMatchObject({ failed: false })
    expect(calls.filter(isGroq)).toHaveLength(1)
    expect(calls.filter((u) => !isGroq(u))).toHaveLength(1)
    expect((await signals()).every((s) => s.gradedSource === "model")).toBe(true)
  })

  it("falls back to the offline check only when every provider fails", async () => {
    llmDeps.fetch = async () => groqQuota()
    expect((await analyze()).json.result).toMatchObject({ failed: true })
    expect((await signals()).every((s) => s.gradedSource === "offline")).toBe(true)
  })
})
