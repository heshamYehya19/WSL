import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { checkRelevance, simulateAIReview } from "../ml/analyze.ts"
import { geminiDeps } from "../ml/gemini.ts"
import { githubDeps } from "../github.ts"

// The IRIS "Detect Anomalies in Network Traffic Logs" challenge, as seeded.
const IRIS = {
  problemDescription:
    "IRIS Technology Jordan monitors network infrastructure for several clients and wants to catch unusual traffic earlier. It is providing a labeled, anonymized set of firewall and NetFlow logs and wants a prototype that flags anomalous behavior with an explanation an analyst can act on.",
  objectives: [
    "Explore the anonymized firewall and NetFlow logs",
    "Engineer features that describe normal traffic behavior",
    "Build and evaluate an anomaly detection model against the labeled incidents",
    "Produce analyst-friendly alerts with a short explanation",
  ],
  expectedOutput: "A detection prototype, an evaluation notebook, and a report on false-positive trade-offs.",
}
const SKILLS = ["Python", "Machine Learning", "Network Security", "Data Analysis"]
const BRIEF_LINES = [IRIS.problemDescription, ...IRIS.objectives, IRIS.expectedOutput]

const REAL_SCRIPT = `import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

def extract_features(flows: pd.DataFrame) -> pd.DataFrame:
    flows["bytes_per_sec"] = flows["bytes"] / flows["duration"].clip(lower=1)
    flows["is_offhours"] = flows["hour"].between(0, 5).astype(int)
    return flows[["bytes_per_sec", "packets", "is_offhours", "unique_dst_ports"]]

flows = pd.read_parquet("netflow_logs.parquet")
X_scaled = StandardScaler().fit_transform(extract_features(flows))
model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)
flows["anomaly_score"] = model.fit_predict(X_scaled)
alerts = flows[flows["anomaly_score"] == -1]
print(f"Flagged {len(alerts)} anomalous flows out of {len(flows)}")`

const BRIEF_AS_COMMENTS = `${BRIEF_LINES.map((l) => `# ${l}`).join("\n")}\nprint("hello world")`
const BRIEF_AS_PROSE = BRIEF_LINES.join(" ")

const evidence = (content: string) => [{ id: "ev-1", type: "Code", title: "Submission", description: "Isolation Forest anomaly detector", content }]

describe("offline scorer (the review's failing cases)", () => {
  it("scores the real Isolation Forest script well and quotes its lines", () => {
    const results = simulateAIReview(SKILLS, evidence(REAL_SCRIPT), IRIS)
    const by = Object.fromEntries(results.map((r) => [r.skill, r]))
    expect(by["Machine Learning"].rating).toBeGreaterThanOrEqual(60)
    for (const skill of SKILLS) expect(by[skill].rating).toBeGreaterThanOrEqual(40)
    expect(by["Machine Learning"].quotes.map((q) => q.text)).toContain("model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)")
    for (const r of results) for (const q of r.quotes) expect(REAL_SCRIPT).toContain(q.text)
  })

  it("scores the brief pasted back low, as comments or as prose", () => {
    for (const content of [BRIEF_AS_COMMENTS, BRIEF_AS_PROSE]) {
      for (const r of simulateAIReview(SKILLS, evidence(content), IRIS)) expect(r.rating).toBeLessThanOrEqual(15)
    }
  })

  it("never lets an evidence title or description raise a score", () => {
    const linkOnly = [{ id: "ev-1", type: "Project Report", title: "Machine Learning with sklearn IsolationForest", description: "Python, pandas, precision and recall" }]
    for (const r of simulateAIReview(SKILLS, linkOnly, IRIS)) expect(r.rating).toBeLessThanOrEqual(15)
  })

  it("rejects submissions that mostly repeat the brief, and accepts the real work", () => {
    expect(checkRelevance(IRIS, BRIEF_AS_COMMENTS)).toMatchObject({ relevant: false, reason: "echoes-brief" })
    expect(checkRelevance(IRIS, BRIEF_AS_PROSE)).toMatchObject({ relevant: false, reason: "echoes-brief" })
    expect(checkRelevance(IRIS, REAL_SCRIPT)).toEqual({ relevant: true })
  })
})

const PROJECT = "prj-iris-anomaly-yazan"
const YAZAN = "student:stu-aau-yazan"
const realFetchGemini = geminiDeps.fetch
const realFetchGithub = githubDeps.fetch

interface Signal {
  projectId: string
  skill: string
  evidenceConfidence: number
  aiNote: string
  aiQuotes: { evidenceId: string; text: string; why: string }[]
}

const server = await startServer()

async function yazanSignals() {
  const res = await server.call("GET", "/snapshot", YAZAN)
  return (res.json.snapshot as { skillSignals: Signal[] }).skillSignals.filter((s) => s.projectId === PROJECT)
}

function geminiReply(payload: unknown, calls: { url: string; init: RequestInit }[]) {
  geminiDeps.fetch = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 })
  }
}

describe("evidence grading through the API", () => {
  afterAll(() => server.close())
  beforeEach(() => {
    resetDatabase()
    delete process.env.GEMINI_API_KEY
  })
  afterEach(() => {
    geminiDeps.fetch = realFetchGemini
    githubDeps.fetch = realFetchGithub
    delete process.env.GEMINI_API_KEY
  })

  it("rejects the brief pasted back with print('hello world') at submission", async () => {
    const res = await server.call("POST", `/projects/${PROJECT}/evidence`, YAZAN, { type: "Code", title: "Detector", content: BRIEF_AS_COMMENTS })
    expect(res.status).toBe(400)
    expect(String(res.json.error)).toMatch(/repeats/)
  })

  it("grades with Gemini, keeps only quotes that are really in the work, and caps unproven skills", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const calls: { url: string; init: RequestInit }[] = []
    geminiReply(
      {
        restatesBrief: false,
        skills: [
          {
            skill: "Machine Learning",
            score: 88,
            reason: "Fits an Isolation Forest with a tuned contamination rate and evaluates precision and recall.",
            quotes: [
              { evidenceId: "ev-yazan-1", text: "model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)", why: "Chooses and tunes an anomaly model." },
              { evidenceId: "ev-yazan-1", text: "model.train_deep_autoencoder(epochs=500)", why: "Invented line that isn't in the code." },
            ],
          },
          {
            skill: "Network Security",
            score: 90,
            reason: "Claims strong security work.",
            quotes: [{ evidenceId: "ev-yazan-1", text: "Build and evaluate an anomaly detection model against the labeled incidents", why: "Quotes the brief." }],
          },
          { skill: "Python", score: 70, reason: "Idiomatic pandas.", quotes: [{ evidenceId: "ev-yazan-1", text: "def extract_features(flows: pd.DataFrame) -> pd.DataFrame:", why: "Typed helper function." }] },
          { skill: "Data Analysis", score: 65, reason: "Derives features.", quotes: [{ evidenceId: "ev-yazan-1", text: 'flows = pd.read_parquet("netflow_logs.parquet")', why: "Loads the logs." }] },
        ],
      },
      calls,
    )

    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain("generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent")
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key")
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.generationConfig.responseMimeType).toBe("application/json")
    expect(body.generationConfig.responseSchema.required).toContain("skills")

    const signals = await yazanSignals()
    const ml = signals.find((s) => s.skill === "Machine Learning")!
    expect(ml.evidenceConfidence).toBe(88)
    expect(ml.aiQuotes.map((q) => q.text)).toEqual(["model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)"])
    expect(ml.aiNote).toMatch(/Gemini/)
    // Its only "proof" was the brief itself, so the score is capped.
    const sec = signals.find((s) => s.skill === "Network Security")!
    expect(sec.aiQuotes).toHaveLength(0)
    expect(sec.evidenceConfidence).toBeLessThanOrEqual(20)
  })

  it("falls back to the offline check when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    geminiDeps.fetch = async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 })
    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)
    expect(res.status).toBe(200)
    const ml = (await yazanSignals()).find((s) => s.skill === "Machine Learning")!
    expect(ml.aiNote).toMatch(/Offline check \(Gemini was unavailable\)/)
    expect(ml.aiQuotes.length).toBeGreaterThan(0)
    expect(ml.evidenceConfidence).toBeLessThanOrEqual(75)
  })

  it("never sends evidence with personal data to Gemini", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const calls: { url: string; init: RequestInit }[] = []
    geminiReply({ restatesBrief: false, skills: [] }, calls)
    const add = await server.call("POST", `/projects/${PROJECT}/evidence`, YAZAN, {
      type: "Code",
      title: "Alert mailer",
      content: `import smtplib\n\ndef send_alert(flow_count: int) -> None:\n    # notify the on-call analyst\n    server = smtplib.SMTP("mail.local")\n    server.sendmail("soc@iris.example", "yazan.almasri.soc@gmail.com", f"{flow_count} anomalous flows flagged")`,
    })
    expect(add.status).toBe(200)
    const res = await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(0)
    const ml = (await yazanSignals()).find((s) => s.skill === "Machine Learning")!
    expect(ml.aiNote).toMatch(/personal data/)
  })

  it("reads a GitHub link's README and source files and analyzes them", async () => {
    const files: Record<string, string> = {
      "README.md": "# flow-guard\nAnomaly detection over NetFlow exports for the IRIS SOC.",
      "src/detect.py": REAL_SCRIPT,
    }
    githubDeps.fetch = async (url) => {
      if (url === "https://api.github.com/repos/yazan-almasri/flow-guard") return Response.json({ default_branch: "main" })
      if (url.startsWith("https://api.github.com/repos/yazan-almasri/flow-guard/git/trees/main")) {
        return Response.json({ tree: Object.entries(files).map(([path, text]) => ({ path, type: "blob", size: text.length })) })
      }
      const path = url.replace("https://raw.githubusercontent.com/yazan-almasri/flow-guard/main/", "")
      return files[path] ? new Response(files[path]) : new Response("", { status: 404 })
    }

    const add = await server.call("POST", `/projects/${PROJECT}/evidence`, YAZAN, {
      type: "GitHub Repository",
      title: "flow-guard",
      link: "https://github.com/yazan-almasri/flow-guard",
    })
    expect(add.status).toBe(200)
    const ev = (add.json.snapshot as { evidence: { title: string; analyzedFiles?: string[] }[] }).evidence.find((e) => e.title === "flow-guard")!
    expect(ev.analyzedFiles).toEqual(["README.md", "src/detect.py"])

    // Remove the seeded pasted code, so only what was read from GitHub can explain the score.
    const { getDb } = await import("../db.ts")
    getDb().prepare("UPDATE evidence SET content = NULL WHERE project_id = ?").run(PROJECT)
    await server.call("POST", `/projects/${PROJECT}/ai-review`, YAZAN)
    const ml = (await yazanSignals()).find((s) => s.skill === "Machine Learning")!
    expect(ml.evidenceConfidence).toBeGreaterThanOrEqual(60)
    expect(ml.aiQuotes.some((q) => q.text.includes("IsolationForest("))).toBe(true)
  })
})
