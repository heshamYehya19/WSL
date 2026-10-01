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
- Challenges at every pipeline stage, plus projects, evidence, AI/company ratings, feedback, and
  per-account notifications that are consistent with each other.

Seed timestamps are relative to when the database was seeded, so deadlines stay realistic.

## How writes work

The API (`server/api.ts`) is the only thing that writes. Every request carries the acting account,
and the server checks ownership before changing anything — a company can only manage its own
challenges, a university only its own students' work, a student only their own projects and
profile. Each change runs in a transaction, notifies the affected accounts, and returns a fresh
snapshot so every page reflects the database immediately.

The "AI evidence analysis" is a deterministic, clearly-labeled simulation — there is no external
AI API call.

## Stack

- React + TypeScript + Vite, React Router, Tailwind CSS v4
- Node.js API (`server/`) mounted into Vite in development, standalone in production
- SQLite via `node:sqlite` — schema in `server/db.ts`, demo data in `server/seed.ts`
