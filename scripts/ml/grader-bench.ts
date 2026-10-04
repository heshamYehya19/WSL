// Grades the same evidence many times with each Groq model and prints how much
// the scores move between runs, so the default model can be picked on data.
//
//   GROQ_API_KEY=... node scripts/ml/grader-bench.ts [runs] [model ...]
//
// It calls the live API directly (no cache). BENCH_SAMPLES sets how many calls
// each grade takes the median of (default 1, to show the raw per-call spread).

import { gradeWithModel } from "../../server/ml/llm-grader.ts"
import type { ChallengeContext, EvidenceLike } from "../../server/ml/analyze.ts"

const runs = Number(process.argv[2] ?? 10)
const models = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

const IRIS: ChallengeContext = {
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

const SCRIPT = `import pandas as pd
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

const NOTEBOOK = `labels = pd.read_csv("labeled_incidents.csv")
scored = flows.merge(labels, on="flow_id", how="left").fillna({"is_incident": 0})
for threshold in [0.01, 0.02, 0.05]:
    model = IsolationForest(n_estimators=300, contamination=threshold, random_state=42)
    pred = (model.fit_predict(X_scaled) == -1).astype(int)
    p = precision_score(scored["is_incident"], pred)
    r = recall_score(scored["is_incident"], pred)
    print(f"contamination={threshold}: precision={p:.2f} recall={r:.2f} alerts/day={pred.sum() / 30:.0f}")
# contamination=0.02 catches 37 of the 41 incidents at about 55 alerts a day, which the SOC can review.`

const REPORT = `Recommendation: run the detector at a 2% contamination threshold, which catches 37 of the 41 labeled incidents at about 55 alerts a day.
The four missed incidents were slow port scans spread over several hours; a rolling 6-hour count of unique destination ports per source IP would catch them and is the next step.
False positives cluster around nightly backup jobs, so whitelisting the three backup servers removes roughly a third of them without losing any incident.
Each alert lists the top contributing features, for example: "10.4.2.17 sent 48x its usual bytes per second to an external IP at 03:10, outside working hours."`

const WEAK = `import pandas as pd
df = pd.read_csv("logs.csv")
print(df.head())
print(df.describe())
# TODO: build the model`

const ev = (id: string, type: string, content: string): EvidenceLike => ({ id, type, title: "Submission", description: "Anomaly detection work", content })

const CASES: { name: string; items: EvidenceLike[] }[] = [
  { name: "full project", items: [ev("ev-1", "Code", SCRIPT), ev("ev-2", "Analysis", NOTEBOOK), ev("ev-3", "Project Report", REPORT)] },
  { name: "script only", items: [ev("ev-1", "Code", SCRIPT)] },
  { name: "weak start", items: [ev("ev-1", "Code", WEAK)] },
  { name: "brief pasted", items: [ev("ev-1", "Code", `${BRIEF_LINES.map((l) => `# ${l}`).join("\n")}\nprint("hello world")`)] },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

for (const model of models) {
  const provider = { id: "groq" as const, label: "Groq", apiKey: process.env.GROQ_API_KEY ?? "", model }
  console.log(`\n=== ${model}`)
  for (const c of CASES) {
    const scores: Record<string, number[]> = Object.fromEntries(SKILLS.map((s) => [s, []]))
    let failures = 0
    const started = Date.now()
    for (let i = 0; i < runs; i++) {
      for (let attempt = 0; ; attempt++) {
        try {
          const out = await gradeWithModel(provider, SKILLS, c.items, IRIS, Number(process.env.BENCH_SAMPLES ?? 1))
          for (const r of out) scores[r.skill].push(r.rating)
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes("429") && attempt < 6) { await sleep(5000 * (attempt + 1)); continue }
          failures++
          console.log(`  ! ${c.name}: ${msg.slice(0, 160)}`)
          break
        }
      }
    }
    const secs = ((Date.now() - started) / 1000 / runs).toFixed(1)
    const line = SKILLS.map((s) => {
      const v = scores[s]
      if (v.length === 0) return `${s}: -`
      const sorted = [...v].sort((a, b) => a - b)
      return `${s}: ${sorted[0]}-${sorted.at(-1)} (median ${sorted[Math.floor(sorted.length / 2)]})`
    }).join(" | ")
    console.log(`  ${c.name.padEnd(13)} ${secs}s/run fail=${failures}  ${line}`)
  }
}
