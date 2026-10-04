# WSL architecture

![WSL architecture](../public/architecture.svg)

The same diagram as an image for slides: [`public/architecture.svg`](../public/architecture.svg) and
[`public/architecture.png`](../public/architecture.png) (regenerate both with `npm run docs:architecture`
after editing the diagram below).

```mermaid
flowchart LR
  subgraph roles["Three roles · demo sign-in"]
    S["Student<br/>submits evidence"]
    U["University mentor<br/>verifies each skill"]
    C["Company<br/>posts challenges ·<br/>finds verified talent"]
  end

  APP["React app<br/>Vite · React Router · Tailwind"]
  API["Node API<br/>server/api.ts<br/>ownership checks · transactions"]
  DB[("SQLite<br/>data/wsl.db")]

  S --> APP
  U --> APP
  C --> APP
  APP -->|"JSON over /api<br/>X-WSL-Actor header"| API
  API --> DB

  API -->|"company challenges"| PII["PII screener<br/>server/screening.ts"]
  API -->|"evidence intake"| REL["Relevance gate<br/>brief echo · off-topic<br/>English + Arabic"]
  API -->|"GitHub links"| GH["GitHub reader<br/>server/github.ts"]
  GH --> GHAPI(["api.github.com"])

  API -->|"Analyze evidence"| GR["Evidence grader<br/>server/ai.ts"]
  GR --> CACHE["Result cache<br/>hash of evidence + skills + model"]
  GR --> LLM["Model grader<br/>quotes checked against the work"]
  LLM --> GROQ(["Groq · Gemini"])
  GR --> OFF["Offline rubric scorer<br/>only when no model result exists"]
```

## Components

| Component | Where | What it does |
|---|---|---|
| React app | `src/` | One app for all three roles. Every page reads one snapshot from the API; nothing is hard-coded. |
| Node API | `server/api.ts` | The only writer. Resolves the acting account from the `X-WSL-Actor` header, checks ownership, runs each write in a transaction, notifies affected accounts, returns a fresh snapshot. |
| SQLite | `server/db.ts`, `data/wsl.db` | Single-file database via `node:sqlite`. Schema migrations run on start; `server/seed.ts` loads the demo data. |
| PII screener | `server/screening.ts` | Scans a company's challenge text and attached files for personal data before any university can see it. |
| Relevance gate | `server/ml/analyze.ts` (`checkRelevance`) | Rejects evidence that mostly repeats the brief or has nothing to do with it. Normalizes Arabic; work in a different script than the brief is passed to the grader instead of rejected. |
| GitHub reader | `server/github.ts` | Reads a public repository's README and top source files so the work itself can be graded. |
| Evidence grader | `server/ai.ts`, `server/ml/llm-grader.ts` | Grades each required skill against named rubric criteria and must quote the student's own lines; quotes and criteria the model invents are dropped. |
| Result cache | `projects.graded_evidence_hash` | Unchanged evidence returns the stored result without a model call, so re-analysis is repeatable. |
| Offline scorer | `server/ml/analyze.ts` | Deterministic regex rubric used only when there is no model result to keep; clearly labeled as an estimate. |

## Key flows

**Evidence → verified skill**

1. A student submits evidence. The relevance gate rejects copied or off-topic work with a specific reason; a GitHub link is read.
2. The student presses *Analyze*. The grader hashes the evidence, skills and model. A matching hash returns the stored result instantly; otherwise the model grades it.
3. If the model is unavailable (quota, outage), any skill it graded before keeps that result. Only a skill with no result yet gets an offline estimate, labeled "Estimated offline" with a Retry button. A failed run is never cached.
4. A university mentor reviews each skill — the AI's assessment, its quotes, met and missing criteria — and verifies, rejects, or asks for more evidence. Only *Verify* adds the skill to the student's record.
5. Companies discover students by verified skills and can give feedback, which never changes a verification.

**Demo resilience.** `npm run db:grade-seed` grades the seeded demo projects with the live model once and stores the result in `server/ml/seed-grades.json`. Seeding uses a stored result only while its evidence hash still matches, so the tour shows model-graded results without ever calling the model. `GET /api/health` reports the provider, model, and whether the key works.
