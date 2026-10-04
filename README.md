# WSL | وصل

**Your Degree Says You Know. Your Work Should Prove It.**

WSL is an education-to-employment evidence infrastructure, built for the Jordan 2076 Hackathon
(Amman track — Innovation in Education & Learning Systems).

Real-world problems become university learning projects. Learning projects produce student work.
Student work becomes evidence. AI analyzes that evidence for skill signals. A human university
mentor verifies each signal. Verified skills join a student's living skill record — discoverable
by companies looking for demonstrated capability, not claimed skills.

> The project isn't the product. The evidence infrastructure is.

## Running locally

Requires **Node.js 22.18+** (uses the built-in `node:sqlite` module — no database server to install).

```bash
npm install
npm run dev          # app + API on the Vite dev server
npm run db:reset     # wipe the database and restore the demo data
npm run build && npm start   # production: serves dist/ + API on http://localhost:3000
```

The SQLite database lives at `data/wsl.db` (git-ignored). It is created and seeded automatically
on first run; set `WSL_DB_PATH` to use a different file. Use **Demo Access** (or `/login`) to
pick an account — no passwords are required in this MVP.

## Data

Everything the app shows is read from the database — no names, counts, or ratings are hard-coded
in the UI. The seed contains:

- **5 universities** (real): Amman Arab University, The Hashemite University, University of Jordan,
  Jordan University of Science and Technology, Applied Science Private University — each with its
  IT faculty, programs, and faculty mentors.
- **15 students** (fictional), 3 per university, majoring in AI, Software Engineering, Cyber Security,
  Computer Science, or Business Information Technology.
- **5 companies** (real): Estarta HQ, Echo Technology, IRIS Technology Jordan, SkyTech Enterprise
  Systems, Advanced Business Solutions — each with fictional contact people, challenges, and job
  opportunities.
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

- **Model grading (Groq or Gemini).** The evidence is sent to the configured model with structured JSON output: one of five
  fixed levels per skill (none, basic, solid, strong, exceptional, which WSL turns into 5, 30, 55, 75 or 90) plus the
  exact lines of the student's work that prove it. WSL checks every quoted line
  against the real content and drops any that aren't there or only repeat the brief; a skill with no
  confirmed quote is capped at 20. The quotes appear in the mentor's "Why WSL found this" box.
- **The same work gets the same score.** Calls run at temperature 0 with a fixed seed, each grade is the
  median of three calls, and results are cached by a hash of the evidence, challenge, skills and model, so
  re-analyzing unchanged evidence returns the same scores. `node scripts/ml/grader-bench.ts` measures the
  spread per model (on 2026-10-04 `openai/gpt-oss-120b` was the most stable and discriminating Groq model).
- **Brief echo is never evidence.** Lines copied from the challenge brief are ignored when scoring,
  and a submission that mostly repeats the brief is rejected when it's submitted.
- **Only real content counts.** An evidence title or description is the student's own claim and
  never raises a score. Public GitHub links are read automatically (the README and the top few
  source files, `server/github.ts`); other links are left for the mentor.
- **Personal data stays on WSL.** The same personal-data screen used for company challenges runs
  first; if it finds anything, the evidence is not sent to the model.
- **Offline fallback.** Without a key, on a failed call, or when personal data was found, a stricter
  local scorer (`server/ml/analyze.ts`) looks for concrete, skill-specific signs and quotes the lines
  it found. It never suggests "Demonstrated". The seeded demo data is scored with it.

AI signals are informational only. A skill reaches a student's record only when a university mentor
verifies it, and companies only see verified skills unless they choose to include unverified signals.

| Environment variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables grading with Groq. Used first when both keys are set. |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b` (supports strict JSON schema output). |
| `GROQ_REASONING_EFFORT` | Optional, for gpt-oss models: `low`, `medium` (default) or `high`. |
| `GEMINI_API_KEY` | Enables grading with Gemini. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-flash-latest`, Google's alias for its newest Flash model. |
| `WSL_AI_PROVIDER` | Optional, `groq` or `gemini`, to choose when both keys are set. With neither key, the offline scorer is used. |
| `WSL_AI_SAMPLES` | Optional. How many model calls each grade takes the median of (default 3, 1-5). Use 1 on a tight rate limit. |
| `GITHUB_TOKEN` | Optional. Raises the GitHub API rate limit for reading repository links. |

## Demo tour

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

## Stack

- React + TypeScript + Vite, React Router, Tailwind CSS v4
- Node.js API (`server/`) mounted into Vite in development, standalone in production
- SQLite via `node:sqlite` — schema in `server/db.ts`, demo data in `server/seed.ts`
