import { afterAll, afterEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { githubDeps } from "../github.ts"
import { notebook, pptx, upload } from "./fixtures.ts"

// The whole mechanism, from nothing, through the API: a company's real problem becomes a team
// project; each student records their own contribution and submits their own evidence; WSL
// analyzes each student's evidence separately; the university reviews each skill on its own; and
// each student ends with their own verified proof, which the company can discover.

const JES = "company:org-jes"
const JU = "university:uni-ju"
const AAU = "university:uni-aau"
const AHMAD = "student:stu-ju-ahmad"
const SARA = "student:stu-ju-sara"
const OMAR = "student:stu-ju-omar"
const YAZAN = "student:stu-aau-yazan"
const SKILLS = ["Python", "Data Analysis", "SQL", "Machine Learning", "Data Visualization"]
const realGithubFetch = githubDeps.fetch

const PROBLEM =
  "Jordan Energy Solutions installs smart meters across university campuses, but the hourly readings sit in spreadsheets nobody has time to read. Facilities teams cannot see which buildings use the most energy or when consumption is unusual. JES wants a small analytics prototype: a clean database of the meter readings, SQL reports for everyday questions, a model that flags abnormal consumption, and a dashboard a facilities manager could open without help."

const SQL_REPORTS = `CREATE TABLE buildings (building_id INTEGER PRIMARY KEY, name TEXT NOT NULL, faculty TEXT);
CREATE TABLE energy_usage (
  reading_id INTEGER PRIMARY KEY,
  building_id INTEGER NOT NULL REFERENCES buildings(building_id),
  recorded_at TIMESTAMP NOT NULL,
  energy_kwh REAL NOT NULL
);
SELECT
    building_id,
    SUM(energy_kwh) AS total_energy
FROM energy_usage
GROUP BY building_id
ORDER BY total_energy DESC;`

const PIPELINE = `import pandas as pd

def load_readings(path: str) -> pd.DataFrame:
    readings = pd.read_csv(path, parse_dates=["recorded_at"])
    readings = readings.dropna(subset=["energy_kwh"])
    readings["hour"] = readings["recorded_at"].dt.hour
    return readings

readings = load_readings("campus_meter_readings.csv")
print(f"Loaded {len(readings)} readings")`

const MODEL_CODE = `import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score
from sklearn.preprocessing import StandardScaler

def build_features(usage: pd.DataFrame) -> pd.DataFrame:
    usage["hour"] = usage["recorded_at"].dt.hour
    usage["rolling_mean_24h"] = usage.groupby("building_id")["energy_kwh"].transform(lambda s: s.rolling(24).mean())
    return usage.dropna()

features = build_features(usage)
detector = IsolationForest(n_estimators=300, contamination=0.02, random_state=7)
features["flagged"] = detector.fit_predict(StandardScaler().fit_transform(features[["hour", "rolling_mean_24h"]])) == -1
print("recall", recall_score(features["is_incident"], features["flagged"]))
print("precision", precision_score(features["is_incident"], features["flagged"]))`

const DASHBOARD = `import pandas as pd
import plotly.express as px
from dash import Dash, Input, Output, dcc, html

usage = pd.read_csv("energy_by_building.csv")
app = Dash(__name__)
app.layout = html.Div([html.H1("EnergyWise campus energy dashboard"), dcc.Dropdown(id="faculty", options=sorted(usage["faculty"].unique())), dcc.Graph(id="usage-bar")])

@app.callback(Output("usage-bar", "figure"), Input("faculty", "value"))
def update_bar(faculty: str):
    # tooltip shows the building and its total kWh
    chosen = usage[usage["faculty"] == faculty]
    fig = px.bar(chosen, x="building", y="energy_kwh")
    fig.update_layout(xaxis_title="Building", yaxis_title="Energy (kWh)")
    return fig`

interface Signal {
  id: string
  projectId: string
  studentId: string
  skill: string
  status: string
  suggestedLevel: string
  evidenceIds: string[]
}
interface Snap {
  challenges: { id: string; title: string; duration: string; status: string }[]
  projects: { id: string; challengeId: string; status: string; studentId: string; ownerRoleNote: string; members: { studentId: string; roleNote: string }[] }[]
  evidence: { id: string; projectId: string; studentId: string; type: string; title: string }[]
  skillSignals: Signal[]
  notifications: { title: string }[]
}

const server = await startServer()
afterAll(() => server.close())
afterEach(() => {
  githubDeps.fetch = realGithubFetch
})

const snapshot = async (actor: string) => (await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as Snap
const ok = async (res: Promise<{ status: number; json: Record<string, unknown> }>) => {
  const r = await res
  expect(r.status, JSON.stringify(r.json)).toBe(200)
  return r.json
}

describe("Smart Campus Energy Optimization, start to finish", () => {
  it("turns a company's challenge into three students' individually verified proof", async () => {
    resetDatabase()
    githubDeps.fetch = async () => new Response("Not Found", { status: 404 })

    // 1. Jordan Energy Solutions creates the challenge — brief, skills, deliverables, duration, constraints.
    const created = await ok(
      server.call("POST", "/challenges", JES, {
        title: "Smart Campus Energy Optimization (live run)",
        problemDescription: PROBLEM,
        requiredSkills: SKILLS,
        learningOutcomes: ["Turn raw meter data into a clean, queryable database", "Choose and evaluate a model for a real anomaly-detection problem"],
        deliverables: "A documented database, SQL reports, an anomaly-detection model with an evaluation, and a dashboard.",
        duration: "4–6 weeks",
        constraints: "Anonymized sample data only. Record each team member's contribution.",
        difficulty: "Intermediate",
        industry: "Energy & Technology",
        preferredUniversityId: "uni-ju",
      }),
    )
    const challengeId = (created.result as { id: string }).id
    expect((await snapshot(JES)).challenges.find((c) => c.id === challengeId)!.status).toBe("Sent to University")

    // 2. Nobody can start it until a university makes it available — and only that university's students can.
    expect((await server.call("POST", `/challenges/${challengeId}/start`, AHMAD)).status).toBe(403)
    await ok(server.call("POST", `/challenges/${challengeId}/assign`, JU, { programId: "prg-ju-cs" }))
    expect((await server.call("POST", `/challenges/${challengeId}/start`, YAZAN)).status).toBe(403)

    // 3. Ahmad starts the project and builds the team from his own university.
    const started = await ok(server.call("POST", `/challenges/${challengeId}/start`, AHMAD))
    const project = (started.result as { id: string }).id
    await ok(server.call("POST", `/projects/${project}/members`, AHMAD, { studentId: "stu-ju-sara" }))
    await ok(server.call("POST", `/projects/${project}/members`, AHMAD, { studentId: "stu-ju-omar" }))
    expect((await server.call("POST", `/projects/${project}/members`, AHMAD, { studentId: "stu-aau-yazan" })).status).toBe(400)

    // 4. Each of them records what they contributed — in their own words, still unverified.
    await ok(server.call("POST", `/projects/${project}/contribution`, AHMAD, { text: "Database design, SQL analysis, and the data-processing pipeline." }))
    await ok(server.call("POST", `/projects/${project}/contribution`, SARA, { text: "Feature engineering, the machine-learning model, and model evaluation." }))
    await ok(server.call("POST", `/projects/${project}/contribution`, OMAR, { text: "Dashboard, visualizations, and the presentation." }))

    // 5. Each submits their own evidence.
    const evidence = (actor: string, body: Record<string, unknown>) => ok(server.call("POST", `/projects/${project}/evidence`, actor, body))
    await evidence(AHMAD, { type: "Documentation", title: "Database schema and SQL reports", link: "https://docs.example.com/ahmad/sql", content: SQL_REPORTS })
    await evidence(AHMAD, { type: "GitHub Repository", title: "Data pipeline", link: "https://github.com/ahmad/energywise-pipeline", content: PIPELINE })
    await evidence(AHMAD, { type: "Contribution Statement", title: "What I contributed", content: "I designed the database and wrote the SQL reports and the pipeline that loads the meter data." })
    await evidence(SARA, { type: "Notebook", title: "Anomaly detection notebook", file: upload("anomaly.ipynb", notebook([{ type: "code", source: MODEL_CODE }])) })
    await evidence(SARA, { type: "Contribution Statement", title: "What I contributed", content: "I engineered the features, trained the isolation forest and evaluated how many incidents it catches." })
    await evidence(OMAR, { type: "GitHub Repository", title: "Dashboard", link: "https://github.com/omar/energywise-dashboard", content: DASHBOARD })
    await evidence(OMAR, {
      type: "Presentation",
      title: "Dashboard walkthrough",
      file: upload("walkthrough.pptx", pptx([["Slide 2: a bar chart ranks the buildings by total kWh so the largest consumers stand out and a heat map shows when each peaks"]])),
    })
    await evidence(OMAR, { type: "Video Walkthrough", title: "Dashboard demo", link: "https://youtube.com/watch?v=energywise" })

    // 6. WSL analyzes each student's own evidence.
    for (const actor of [AHMAD, SARA, OMAR]) await ok(server.call("POST", `/projects/${project}/ai-review`, actor))

    const analyzed = await snapshot(JU)
    const signalsOf = (snap: Snap, studentId: string) => snap.skillSignals.filter((s) => s.projectId === project && s.studentId === studentId)
    const found = (studentId: string) => signalsOf(analyzed, studentId).filter((s) => s.suggestedLevel !== "Insufficient").map((s) => s.skill)

    // Required skills are not demonstrated skills: every student is assessed on all five, and each
    // has evidence for only what their own work shows.
    for (const id of ["stu-ju-ahmad", "stu-ju-sara", "stu-ju-omar"]) expect(signalsOf(analyzed, id).map((s) => s.skill).sort()).toEqual([...SKILLS].sort())
    expect(found("stu-ju-ahmad")).toEqual(expect.arrayContaining(["SQL", "Python", "Data Analysis"]))
    expect(found("stu-ju-ahmad")).not.toContain("Machine Learning")
    expect(found("stu-ju-ahmad")).not.toContain("Data Visualization")
    expect(found("stu-ju-sara")).toContain("Machine Learning")
    expect(found("stu-ju-sara")).not.toContain("SQL")
    expect(found("stu-ju-omar")).toContain("Data Visualization")
    expect(found("stu-ju-omar")).not.toContain("SQL")
    expect(found("stu-ju-omar")).not.toContain("Machine Learning")

    // Each signal draws only on its own student's evidence.
    const author = new Map(analyzed.evidence.map((e) => [e.id, e.studentId]))
    for (const sig of analyzed.skillSignals.filter((s) => s.projectId === project)) {
      for (const evidenceId of sig.evidenceIds) expect(author.get(evidenceId)).toBe(sig.studentId)
      expect(sig.status).toBe("Pending Verification")
    }
    expect((await snapshot(JU)).projects.find((p) => p.id === project)!.status).toBe("Evidence Under Review")
    expect((await snapshot(JU)).notifications.some((n) => n.title === "Evidence ready for review")).toBe(true)

    // 7. The reviewer decides skill by skill, student by student.
    const review = (studentId: string, skill: string, body: Record<string, unknown>) =>
      ok(server.call("POST", `/projects/${project}/signals/${signalsOf(analyzed, studentId).find((s) => s.skill === skill)!.id}/review`, JU, body))
    await review("stu-ju-ahmad", "SQL", { decision: "verify", reviewerNotes: "Schema and reports match the contribution." })
    await review("stu-ju-sara", "Machine Learning", { decision: "verify" })
    await review("stu-ju-omar", "Data Visualization", { decision: "verify" })
    await review("stu-ju-ahmad", "Python", { decision: "request-more-evidence", reviewerNotes: "Add the code that cleans the readings." })

    // Not everything with evidence has a decision yet, so nothing is shared with the company.
    expect((await server.call("POST", `/projects/${project}/confirm`, JU, {})).status).toBe(409)
    expect((await snapshot(JES)).evidence.filter((e) => e.projectId === project)).toHaveLength(0)

    const mid = await snapshot(AHMAD)
    expect(signalsOf(mid, "stu-ju-ahmad").find((s) => s.skill === "SQL")!.status).toBe("Verified")
    expect(signalsOf(mid, "stu-ju-ahmad").find((s) => s.skill === "Python")!.status).toBe("More Evidence Requested")
    // Sara's signals are hers alone: Ahmad's own snapshot carries none of them, and hers shows the review of her skills untouched.
    expect(signalsOf(mid, "stu-ju-sara")).toHaveLength(0)
    expect(signalsOf(await snapshot(SARA), "stu-ju-sara").find((s) => s.skill === "SQL")!.status).toBe("Pending Verification")

    // 8. Ahmad answers the request with the code, is re-analyzed, and the rest of the team is untouched.
    await evidence(AHMAD, { type: "Project Report", title: "Cleaning notes", link: "https://docs.example.com/ahmad/cleaning", content: PIPELINE + "\n# The cleaning step drops rows without a kWh reading and adds an hour column." })
    await ok(server.call("POST", `/projects/${project}/ai-review`, AHMAD))
    expect(signalsOf(await snapshot(AHMAD), "stu-ju-ahmad").find((s) => s.skill === "SQL")!.status).toBe("Verified")

    // 9. Every student x every required skill gets a current, explicit decision — verified where the work shows it,
    // acknowledged as insufficient where it doesn't — and only then does the university confirm to the company.
    expect((await server.call("POST", `/projects/${project}/confirm`, JU, {})).status).toBe(409)
    const latest = await snapshot(JU)
    for (const sig of signalsOf(latest, "stu-ju-ahmad").concat(signalsOf(latest, "stu-ju-sara"), signalsOf(latest, "stu-ju-omar"))) {
      await ok(server.call("POST", `/projects/${project}/signals/${sig.id}/review`, JU, { decision: sig.suggestedLevel === "Insufficient" ? "insufficient" : "verify" }))
    }
    await ok(server.call("POST", `/projects/${project}/confirm`, JU, { note: "Reviewed each student's evidence against their own contribution." }))

    // 10. Each student has their own verified proof — and only their own.
    const company = await snapshot(JES)
    const verified = (studentId: string) => signalsOf(company, studentId).filter((s) => s.status === "Verified").map((s) => s.skill)
    expect(verified("stu-ju-ahmad")).toContain("SQL")
    expect(verified("stu-ju-ahmad")).not.toContain("Machine Learning")
    expect(verified("stu-ju-ahmad")).not.toContain("Data Visualization")
    expect(verified("stu-ju-sara")).toContain("Machine Learning")
    expect(verified("stu-ju-sara")).not.toContain("SQL")
    expect(verified("stu-ju-omar")).toContain("Data Visualization")
    expect(verified("stu-ju-omar")).not.toContain("SQL")
    // A skill nobody could show is not verified for anyone.
    for (const id of ["stu-ju-ahmad", "stu-ju-sara", "stu-ju-omar"]) {
      for (const sig of signalsOf(company, id).filter((s) => s.suggestedLevel === "Insufficient")) expect(sig.status).not.toBe("Verified")
    }

    // 11. The company discovers each student through that proof: who has verified SQL, ML, visualization.
    const whoVerified = (skill: string) => company.skillSignals.filter((s) => s.projectId === project && s.skill === skill && s.status === "Verified").map((s) => s.studentId)
    expect(whoVerified("SQL")).toEqual(["stu-ju-ahmad"])
    expect(whoVerified("Machine Learning")).toEqual(["stu-ju-sara"])
    expect(whoVerified("Data Visualization")).toEqual(["stu-ju-omar"])

    // …and follow each skill back to the student's own evidence and contribution.
    const energy = company.projects.find((p) => p.id === project)!
    expect(energy.ownerRoleNote).toMatch(/SQL analysis/)
    expect(energy.members.find((m) => m.studentId === "stu-ju-sara")!.roleNote).toMatch(/machine-learning model/)
    const sqlProof = company.skillSignals.find((s) => s.projectId === project && s.studentId === "stu-ju-ahmad" && s.skill === "SQL")!
    expect(sqlProof.evidenceIds.length).toBeGreaterThan(0)
    for (const evidenceId of sqlProof.evidenceIds) expect(company.evidence.find((e) => e.id === evidenceId)!.studentId).toBe("stu-ju-ahmad")

    // 12. Everyone on the team heard about it; the other university saw none of it.
    for (const actor of [AHMAD, SARA, OMAR]) expect((await snapshot(actor)).notifications.some((n) => n.title.startsWith("Evidence confirmed to"))).toBe(true)
    expect((await snapshot(AAU)).evidence.filter((e) => e.projectId === project)).toHaveLength(0)
  })
})

describe("the seeded EnergyWise project is the same story, ready to review", () => {
  it("has one project, three students, three contributions, three bodies of evidence, nothing verified yet", async () => {
    resetDatabase()
    const snap = await snapshot(JU)
    const project = snap.projects.find((p) => p.id === "prj-jes-energywise")!
    expect(project.status).toBe("Evidence Under Review")
    const authors = new Set(snap.evidence.filter((e) => e.projectId === project.id).map((e) => e.studentId))
    expect(authors).toEqual(new Set(["stu-ju-ahmad", "stu-ju-sara", "stu-ju-omar"]))
    expect(snap.skillSignals.filter((s) => s.projectId === project.id && s.status === "Verified")).toHaveLength(0)
    expect((await snapshot(JES)).evidence.filter((e) => e.projectId === project.id)).toHaveLength(0)
  })
})
