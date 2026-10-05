# WSL | وصل

**Don't Just Graduate With a Degree. Graduate With Proof.**

WSL is an education-to-employment evidence infrastructure, built for the Jordan 2076 Hackathon
(Amman track — Innovation in Education & Learning Systems).

Industry need → real-world challenge → student work → evidence → university verification →
verified proof → talent. A company's real problem becomes a university project. Students — alone or
in a team from one university — each record what they contributed and submit their own evidence. AI
helps organize that evidence for review; a human university reviewer decides, skill by skill and
student by student, what is verified. Verified proof joins each student's profile, discoverable by
companies looking for demonstrated capability, not claimed skills.

> The project isn't the product. The evidence infrastructure is.

**Live demo:** _not deployed yet — add the URL here once it's live (see [Deploying on Replit](#deploying-on-replit))._

## The EnergyWise walkthrough (one project, three students, three bodies of proof)

The seed contains a complete team scenario you can follow in about five minutes. **Jordan Energy
Solutions** posted *Smart Campus Energy Optimization* (Energy & Technology · Intermediate · 4–6
weeks; required skills Python, Data Analysis, SQL, Machine Learning, Data Visualization). The
University of Jordan assigned it to its Computer Science students, and three of them work on one
project, *EnergyWise*:

| Student | Contribution (their own words) | Their evidence |
|---|---|---|
| Ahmad Al-Khatib | Database design, SQL analysis, the data-processing pipeline | SQL schema and reports (Documentation), data pipeline (GitHub), contribution statement |
| Sara Al-Najjar | Feature engineering, the machine-learning model, model evaluation | Anomaly-detection notebook, model evaluation report, contribution statement |
| Omar Al-Fayez | Dashboard, visualizations, the presentation | Dashboard (GitHub), walkthrough (Presentation), demo video, contribution statement |

WSL has analyzed each student's **own** evidence separately — Ahmad's SQL is never credited to Sara or
Omar — and nothing is verified yet. To walk the loop (open `/login` and pick the accounts):

1. **Company** — *Jordan Energy Solutions*: the challenge brief (deliverables, duration, constraints)
   and the lifecycle stepper. **University** — *University of Jordan* → *Submissions* → the EnergyWise
   card.
2. **Reviewer** (University of Jordan): the project page has one section per student — their
   contribution, their evidence, and one card per required skill showing what the evidence demonstrates,
   the lines behind it, and the gaps. Verify Ahmad's SQL; ask Omar for more evidence on Python; leave
   the rest. Skills the evidence doesn't show read *Insufficient evidence* and need no decision.
3. **Students** — sign in as Ahmad, Sara or Omar: each sees the shared project but only their own
   evidence and skills, records their contribution, and sees *Verified by University of Jordan* only
   for what the reviewer verified for them. The owner (Ahmad) can add classmates from his university.
4. **Reviewer** — decide the rest, then **Confirm to Company**. **Company** — *Talent Discovery* now
   finds each student through their own verified skills; open one to follow *skill → project → their
   contribution → evidence → university verification*.

The demo database only reseeds when it is empty: after pulling this version, run `npm run db:reset`
(or the reset in the account menu) to get the scenario.

## Running locally

Requires **Node.js 22.18+** (uses the built-in `node:sqlite` module — no database server to install).

```bash
npm install
npm run dev          # app + API on the Vite dev server
npm run db:reset     # wipe the database and restore the demo data
npm test             # API test suite (never calls a live model or GitHub)
npm run lint
npm run build && npm start   # production: serves dist/ + API on http://localhost:3000
```

Before a demo, open `/api/health` to check which model is configured and whether its key works.

The SQLite database lives at `data/wsl.db` (git-ignored). It is created and seeded automatically
on first run; set `WSL_DB_PATH` to use a different file. Use **Demo Access** (or `/login`) to
pick an account — no passwords are required in this MVP.

## Deploying on Replit

The repository includes a [`.replit`](.replit) file, so it can be imported and deployed as is.

1. **Import** the GitHub repository into Replit (*Create Repl → Import from GitHub*).
2. **Node.js 22.18 or newer.** WSL runs its TypeScript server directly and uses the built-in
   `node:sqlite`, both of which need 22.18+. `.replit` asks for the `nodejs-22` module; run
   `node --version` in the Shell, and if it's older than 22.18, switch `.replit` to a newer Node module.
3. **API key as a Secret.** Add `GROQ_API_KEY` in Replit's *Secrets* tool; it reaches the server as
   an environment variable. Never put a key in a file in the repository — `.env` is git-ignored and
   is only for local development.
4. **A persistent disk for the database.** All data lives in one SQLite file (`WSL_DB_PATH`, default
   `data/wsl.db`). Deploy as a **Reserved VM** — a single always-on instance (already set in `.replit`)
   — not Autoscale, where each instance would get its own copy of the database. Point `WSL_DB_PATH` at
   storage that survives restarts and redeploys. If the file is ever lost, WSL recreates and re-seeds
   the demo database on the next start, so the demo keeps working, but anything created since is gone;
   don't redeploy during judging.
5. **Demo mode.** `WSL_DEMO_MODE` is on unless set to `false`. In demo mode anyone can reset the
   database from the account menu — useful between judges. Turning it off only disables the reset; it
   doesn't add authentication (see the limitations below).
6. **Build and start.** Build with `npm ci && npm run build`, start with `npm start`, which serves the
   built app and the API on `$PORT` (default 3000, mapped to port 80 in `.replit`).
7. **Before judging:** open `/api/health` and check `keyWorks` is `true`; run `npm run db:grade-seed`
   with your key and commit `server/ml/seed-grades.json` so the tour shows model-graded results
   without spending quota; then reset the demo.
8. **Once it's live:** put the URL at the top of this README, and add a `VITE_PUBLIC_URL` Secret with
   the same URL before building — the site footer then shows a QR code that opens the live demo.

| Environment variable | Purpose |
|---|---|
| `GROQ_API_KEY` | The grading model's key (Secret). See the AI section for the other model settings. |
| `WSL_DB_PATH` | Path of the SQLite file; put it on persistent storage. Default `data/wsl.db`. |
| `WSL_DEMO_MODE` | `false` disables the database reset. On by default. |
| `PORT` | Port the server listens on. Default `3000`. |
| `VITE_PUBLIC_URL` | The live URL, at build time; shows a QR code for it in the footer. |

## Data

Everything the app shows is read from the database — no names, counts, or ratings are hard-coded
in the UI. The seed contains:

- **5 universities** (real): Amman Arab University, The Hashemite University, University of Jordan,
  Jordan University of Science and Technology, Applied Science Private University — each with its
  IT faculty, programs, and faculty mentors.
- **16 students** (fictional), 3–4 per university, majoring in AI, Software Engineering, Cyber Security,
  Computer Science, or Business Information Technology.
- **6 companies** (real): Estarta HQ, Echo Technology, IRIS Technology Jordan, SkyTech Enterprise
  Systems, Jordan Energy Solutions, Advanced Business Solutions — each with fictional contact people,
  challenges, and job opportunities.
- Challenges at every pipeline stage, plus projects, evidence, AI evidence signals, university
  verification decisions, company feedback, and per-account notifications that are all consistent
  with each other.

Seed timestamps are relative to when the database was seeded, so deadlines stay realistic.

## How writes work

The API (`server/api.ts`) is the only thing that writes. Every request carries the acting account,
and the server checks ownership before changing anything — a company can only manage its own
challenges, a university only its own students' work, a student only their own projects and
profile. Each change runs in a transaction, notifies the affected accounts, and returns a fresh
snapshot so every page reflects the database immediately.

## AI evidence analysis

When a student asks WSL to analyze their evidence, `server/ai.ts` grades it against each skill the
challenge requires:

- **Model grading (Groq or Gemini).** The evidence is sent to the configured model with structured JSON output: a 0-100 score per
  skill plus the exact lines of the student's work that prove it. WSL checks every quoted line
  against the real content and drops any that aren't there or only repeat the brief; a skill with no
  confirmed quote is capped at 20. The quotes appear in the mentor's "Why WSL found this" box.
- **Brief echo is never evidence.** Lines copied from the challenge brief are ignored when scoring,
  and a submission that mostly repeats the brief is rejected when it's submitted.
- **Only real content counts.** An evidence title or description is the student's own claim and
  never raises a score. Public GitHub links are read automatically (the README and the top few
  source files, `server/github.ts`); other links are left for the mentor.
- **Repeatable results.** Each analysis is keyed by a hash of the exact evidence content, the
  required skills and the model. Re-analyzing unchanged evidence returns the stored result instantly
  ("No new evidence since the last analysis.") instead of calling the model again, and the evidence
  page shows which model produced the result and when. Calls use temperature 0.
- **Quota and outages.** If the model fails (a 429 from the free tier's daily limit, a timeout), a
  skill it graded before keeps that result — it is never overwritten with offline numbers. A failed
  run isn't cached, so *Retry* reaches the model again.
- **Offline fallback.** Only a skill with no model result yet (no key configured, or the model was
  unavailable on its first analysis) is scored by a stricter local scorer (`server/ml/analyze.ts`),
  which looks for concrete, skill-specific signs and quotes the lines it found. It never suggests
  "Demonstrated", and it's labeled "Estimated offline, not graded by the AI model".
- **Pre-graded demo data.** `npm run db:grade-seed` grades the seeded projects with the live model
  once and stores the result in `server/ml/seed-grades.json`. Seeding uses a stored result while its
  evidence still matches, so the tour shows model-graded results without any live call. Projects
  without a stored result are seeded with the offline scorer.

Student evidence is not run through the personal-data screen below — that screen exists to catch a
company accidentally posting sensitive data in a public challenge brief, not to gate a student's own
work, which is only ever sent to the grading provider the server is configured with.

AI signals are informational only. A skill reaches a student's record only when a university mentor
verifies it, and companies only see verified skills unless they choose to include unverified signals.

| Environment variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables grading with Groq. Used first when both keys are set. |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b` (supports strict JSON schema output). |
| `GEMINI_API_KEY` | Enables grading with Gemini. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-flash-latest`, Google's alias for its newest Flash model. |
| `WSL_AI_PROVIDER` | Optional, `groq` or `gemini`, to choose when both keys are set. With neither key, the offline scorer is used. |
| `GITHUB_TOKEN` | Optional. Raises the GitHub API rate limit for reading repository links. |

## Demo tour
(This is the single-student tour; for the team scenario see [the EnergyWise walkthrough](#the-energywise-walkthrough-one-project-three-students-three-bodies-of-proof).)

The sign-in page opens with **Yazan Al-Masri**, a student with a full record, and a **Take the
tour** button. The tour follows him through all three roles: IRIS's challenge, Amman Arab
University assigning it, Yazan's evidence (including a one-click attempt to game the AI by
submitting the brief, which is rejected), the mentor verifying quoted evidence, and IRIS finding
him in Talent Discovery. Run `npm run db:reset` (or the reset in the account menu) before
rehearsing, so his project is back to "Evidence Under Review".

**Demo auth, not production auth:** the signed-in account is a client-supplied `x-wsl-actor`
header, trusted once its id is confirmed to exist — there's no password, session, or signed token.
Ownership checks on every write are real and independent of this; what's missing for a real
deployment is proof the request came from that account. Set `WSL_DEMO_MODE=false` to disable the
one genuinely destructive action available in this mode, resetting the database.

## Teams, contribution and individual proof

A project is shared; proof is not. The student who starts a project can add classmates **from the same
university**, so one university is the verification authority for the whole team. Then, for every member:

- **Contribution.** Each member (owner included) records what they contributed, in their own words
  (`projects.owner_role_note`, `project_members.role_note`). It is a claim for the reviewer to check
  against that student's evidence — never proof by itself. An optional *Contribution Statement* piece of
  evidence says the same at length, and is kept for the reviewer, never analyzed as work.
- **Evidence.** Every item has one author (`evidence.student_id`). Types: GitHub, Documentation,
  Notebook, Report, Presentation, Demo / Video, Screenshot, Contribution Statement
  (`src/lib/evidenceTypes.ts`; what each takes — a link, a file, or text — is shared by the form and the
  API). Videos, screenshots and statements are kept for the reviewer and are not analyzed.
- **Analysis.** `POST /projects/:id/ai-review` reads only the calling student's own evidence and writes
  that student's signals (`skill_signals` is unique per project **and student** and skill). The analysis
  cache is per student (`analysis_runs`).
- **Verification.** A reviewer decides one student's one skill at a time; only that student is told, and the
  reviewer is the coordinator of that student's program. Skills the evidence doesn't show
  (*Insufficient evidence*) need no decision and are never shared. Confirming the project to the company
  needs every skill that has evidence decided, for every student.
- **Proof.** A student's profile, a company's Talent Discovery and the project pages all read the same
  per-student signals, so a skill is only ever shown for the student whose own evidence and verification
  back it. Required skills are never treated as demonstrated skills.

## Attached files & privacy screening

When submitting a challenge, a company can upload a challenge description document (PDF, DOC,
DOCX) instead of writing one, and up to three dataset files (CSV, TSV, XLSX, JSON, TXT; 10 MB
each). Files are stored in SQLite (`challenge_files`) and served by
`GET /api/challenges/:id/files/:fileId` only to accounts that can see the challenge.

Every challenge, both its text and its files, is screened in `server/screening.ts` for personal
data (phone numbers, emails, national ID / passport numbers, addresses, dates of birth, card and
IBAN numbers, and name/phone/address columns in tables), whatever sensitivity level the company
picked. If anything is found, nothing is saved: the company sees what was found (masked) and
either goes back to edit or confirms it's OK to share. A confirmed challenge carries a notice for
universities and students, and its history records what was shared. A file WSL can't read (a
scanned PDF, for example) is flagged the same way, because WSL can't vouch for what's in it.

## Architecture

![WSL architecture](public/architecture.svg)

See [docs/architecture.md](docs/architecture.md) for each component and the main flows. The diagram
is also available as [public/architecture.png](public/architecture.png) for slides; regenerate both
with `npm run docs:architecture` after editing it.

## Stack

- React + TypeScript + Vite, React Router, Tailwind CSS v4
- Node.js API (`server/`) mounted into Vite in development, standalone in production
- SQLite via `node:sqlite` — schema in `server/db.ts`, demo data in `server/seed.ts`

## Testing and known limitations

`npm test` runs the API suite (`server/test/`) against a real HTTP server and a throwaway SQLite
database. It never reaches a live model or GitHub: provider keys from `.env` are cleared and every
model or GitHub response a test needs is mocked. It covers, among others:

- ownership and visibility (who can read and change what), per-skill verification and the project
  status it rolls up to, and company feedback never changing a verification;
- repeat analysis of unchanged evidence returning the identical cached result without a model call;
- a model failure (429) leaving a previous model-graded result untouched, a retry reaching the model
  again, and the offline fallback being labeled;
- quotes and rubric criteria the model invents being dropped, and brief-copying evidence being
  rejected or scored low;
- invalid GitHub links, unreadable repositories, a challenge with no skills or learning outcomes, and
  Arabic evidence (normalized, accepted when relevant, rejected when copied or unrelated);
- `/api/health`, the pre-graded seed cache, and upgrading an older database (v13 → v14 keeps every
  signal and makes them per student);
- teams and individual proof: same-university teams, per-member contributions, one student's evidence
  never reaching another's analysis or skills, per-student review and notifications, a contribution
  statement never becoming proof, and the whole *EnergyWise* loop from a company's new challenge to each
  student's own verified proof and company discovery (`energywise-scenario.test.ts`);
- the eight evidence types and what each accepts (files, links, text), and Google Docs, notebooks,
  presentations and screenshots.

Things to try in the demo: follow the EnergyWise walkthrough above; press *Re-analyze* twice on the same project; submit a GitLab link as a
GitHub repository; submit a challenge with no skills; paste the challenge brief back as evidence;
submit evidence written in Arabic.

**Known limitations — said plainly:**

- **Demo auth.** The signed-in account is a client-supplied `X-WSL-Actor` header with no password,
  session or signed token. Ownership checks are real, but anyone can claim any account. Not
  production authentication.
- **AI results are signals, not certificates.** A model can misjudge work, and an evidence-confidence
  score measures how strongly the submitted work supports a skill, not the student's proficiency.
  Only a university mentor's verification puts a skill on a student's record.
- **Free-tier model quota.** Groq's free tier allows a fixed number of tokens per day (200,000 for
  `openai/gpt-oss-120b` — on the order of 60–100 analyses). When it runs out, existing model results are kept, but new
  projects only get offline estimates until the quota resets. New evidence is graded again by the
  model, so borderline skills can still move between analyses even at temperature 0.
- **The offline fallback is weaker.** It matches skill-specific patterns in the text; it can't judge
  whether the code is correct or the analysis is sound, and it caps below "Demonstrated".
- **Relevance check language coverage.** Word overlap works for English and Arabic. Evidence written
  in a different script than the brief (Arabic work on an English brief) isn't judged at intake and is
  left to the AI grader, and a translated copy of the brief isn't caught as copying.
- **Other checks are heuristic.** The personal-data screen is pattern-based and can miss or
  over-flag data; it screens company challenges, not student evidence. The GitHub reader only reads
  public repositories, and only the README plus a few source files.
- **Single-file database.** SQLite in one process, unencrypted on disk — fine for a demo, not for
  scale or sensitive data.
- **Seeded data is illustrative.** The universities and companies are real names, but every person,
  challenge, submission, verification and piece of feedback is fictional and doesn't represent them.
