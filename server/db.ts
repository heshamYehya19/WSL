import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { EVIDENCE_LINKS, seedDatabase } from "./seed.ts"
import { canonicalSkillName } from "./ml/analyze.ts"

// The single source of truth for WSL. Every page reads from here (through the API)
// and every action writes here — nothing in the client is hard-coded.
const DB_PATH = resolve(process.cwd(), process.env.WSL_DB_PATH ?? "data/wsl.db")

const CHALLENGE_COLUMNS = `
  id                      TEXT PRIMARY KEY,
  company_id              TEXT NOT NULL REFERENCES companies(id),
  contact_id              TEXT NOT NULL REFERENCES company_contacts(id),
  title                   TEXT NOT NULL,
  problem_description     TEXT NOT NULL,
  objectives              TEXT NOT NULL, -- JSON array of strings
  expected_output         TEXT NOT NULL,
  industry                TEXT NOT NULL,
  difficulty              TEXT NOT NULL CHECK (difficulty IN ('Foundational', 'Intermediate', 'Advanced')),
  required_skills         TEXT NOT NULL, -- JSON array of strings
  learning_outcomes       TEXT NOT NULL, -- JSON array of strings
  dataset_availability    TEXT NOT NULL,
  data_sensitivity        TEXT NOT NULL,
  -- JSON summary of personal data WSL's screening found and the company chose to share anyway (NULL = none found).
  shared_sensitive_data   TEXT,
  deadline                TEXT NOT NULL,
  preferred_university_id TEXT REFERENCES universities(id),
  visibility              TEXT NOT NULL CHECK (visibility IN ('Public', 'University Only', 'Restricted')),
  submission_requirements TEXT NOT NULL, -- JSON array of strings
  status                  TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  submitted_at            TEXT`

const CHALLENGE_COLUMN_NAMES = CHALLENGE_COLUMNS.split("\n")
  .map((line) => line.trim().split(/\s+/)[0])
  .filter(Boolean)

const SKILL_SIGNALS_COLUMNS = `
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id       TEXT NOT NULL REFERENCES students(id),
  skill            TEXT NOT NULL,
  -- How strongly WSL's analysis of submitted evidence supports this skill (0-100).
  -- Not a measure of proficiency — see suggested_level/status for the human-facing read.
  evidence_confidence INTEGER NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 100),
  -- A short, concrete statistic behind the confidence score, e.g. "Detected Python code (92% confidence)...".
  ai_note          TEXT NOT NULL DEFAULT '',
  -- JSON list of { evidenceId, text, why }: the exact lines of the student's work behind the score.
  ai_quotes        TEXT NOT NULL DEFAULT '[]',
  -- JSON list of { label, met }: the named rubric criteria this signal was checked
  -- against, met ones first — what the "what the evidence demonstrates" / "evidence
  -- gaps" checklist is built from.
  ai_criteria      TEXT NOT NULL DEFAULT '[]',
  -- Deprecated pre-verification-rework columns: a company rating was never a university
  -- verification, even under the old model. Kept only so historical seed rows still read
  -- back; no new code writes or reads them for verification purposes.
  company_rating   INTEGER CHECK (company_rating BETWEEN 0 AND 100),
  company_rated_at TEXT,
  status           TEXT NOT NULL DEFAULT 'Pending Verification'
                     CHECK (status IN ('Pending Verification', 'Verified', 'More Evidence Requested', 'Rejected')),
  -- "Insufficient" is not a low tier: it means too few rubric criteria were met to
  -- claim any tier at all. See gateByCriteria in server/ml/analyze.ts.
  suggested_level  TEXT NOT NULL DEFAULT 'Foundational'
                     CHECK (suggested_level IN ('Insufficient', 'Foundational', 'Intermediate', 'Advanced', 'Demonstrated')),
  verified_by      TEXT REFERENCES staff(id),
  verified_at      TEXT,
  reviewer_notes   TEXT,
  analyzed_at      TEXT NOT NULL,
  UNIQUE (project_id, skill)`

const SKILL_SIGNALS_COLUMN_NAMES = SKILL_SIGNALS_COLUMNS.split("\n")
  .map((line) => line.trim().split(/\s+/)[0])
  .filter((name) => name && name !== "UNIQUE" && name !== "CHECK" && !name.startsWith("--"))

const SCHEMA = `
CREATE TABLE IF NOT EXISTS universities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  short_name  TEXT NOT NULL,
  city        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('Public', 'Private')),
  established INTEGER NOT NULL,
  website     TEXT NOT NULL,
  faculty     TEXT NOT NULL,
  about       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  title         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS programs (
  id             TEXT PRIMARY KEY,
  university_id  TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  major          TEXT NOT NULL CHECK (major IN ('Artificial Intelligence', 'Software Engineering', 'Cyber Security', 'Computer Science', 'Business Information Technology')),
  coordinator_id TEXT NOT NULL REFERENCES staff(id),
  UNIQUE (university_id, name)
);

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  industry      TEXT NOT NULL,
  city          TEXT NOT NULL,
  logo_initials TEXT NOT NULL,
  about         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id             TEXT PRIMARY KEY,
  university_id  TEXT NOT NULL REFERENCES universities(id),
  program_id     TEXT NOT NULL REFERENCES programs(id),
  student_number TEXT NOT NULL,
  name           TEXT NOT NULL,
  year           TEXT NOT NULL,
  gpa            REAL NOT NULL CHECK (gpa BETWEEN 0 AND 4),
  city           TEXT NOT NULL,
  bio            TEXT NOT NULL,
  availability   TEXT NOT NULL CHECK (availability IN ('Open to Opportunities', 'Not Available', 'Open to Internships')),
  UNIQUE (university_id, student_number)
);

CREATE TABLE IF NOT EXISTS challenges (
${CHALLENGE_COLUMNS}
);

-- Files a company attached: a challenge description document and/or datasets for students.
CREATE TABLE IF NOT EXISTS challenge_files (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('description', 'dataset')),
  name         TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  data         BLOB NOT NULL,
  -- Text extracted at upload; a description file's text feeds the AI relevance check.
  text         TEXT NOT NULL DEFAULT '',
  uploaded_at  TEXT NOT NULL
);

-- An open challenge can be assigned independently by several universities, each to one
-- of its own programs. A university's students only see challenges their university assigned.
CREATE TABLE IF NOT EXISTS challenge_assignments (
  challenge_id  TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  university_id TEXT NOT NULL REFERENCES universities(id),
  program_id    TEXT NOT NULL REFERENCES programs(id),
  assigned_at   TEXT NOT NULL,
  PRIMARY KEY (challenge_id, university_id)
);

CREATE TABLE IF NOT EXISTS challenge_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,
  at           TEXT NOT NULL,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  student_id   TEXT NOT NULL REFERENCES students(id),
  status       TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  -- Identifies the exact (evidence content + required skills + model) a grading run
  -- was based on (server/ai.ts's hashEvidenceSet). Re-analyzing with an unchanged
  -- hash skips the model call entirely and returns the existing skill_signals as-is.
  graded_evidence_hash TEXT,
  graded_model         TEXT,
  graded_at            TEXT,
  UNIQUE (challenge_id, student_id)
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('staff', 'contact')),
  author_id   TEXT NOT NULL,
  note        TEXT NOT NULL,
  at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES students(id),
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  link         TEXT NOT NULL,
  -- Optional pasted content (code, write-up, etc.) — what the AI rating actually analyzes.
  content      TEXT,
  -- What WSL read from a linked GitHub repository (README and top source files), and which files.
  fetched_content TEXT,
  fetched_from    TEXT,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_signals (
${SKILL_SIGNALS_COLUMNS}
);

CREATE TABLE IF NOT EXISTS skill_signal_evidence (
  signal_id   TEXT NOT NULL REFERENCES skill_signals(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (signal_id, evidence_id)
);

-- Extra contributors on a team project. The project's own student_id (and the
-- UNIQUE(challenge_id, student_id) constraint on projects) stays the "owner" row —
-- this table only adds attribution, never a second project row for the same work.
-- Solo projects (the default) simply have zero rows here.
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  role_note  TEXT NOT NULL,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (project_id, student_id)
);

-- One structured feedback snapshot per project, from the company — kept separate from
-- skill_signals by construction, so company feedback can never alter a verification.
CREATE TABLE IF NOT EXISTS company_feedback (
  id                          TEXT PRIMARY KEY,
  project_id                  TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  contact_id                  TEXT NOT NULL REFERENCES company_contacts(id),
  strong_technical_execution  INTEGER NOT NULL DEFAULT 0,
  relevant_for_internship     INTEGER NOT NULL DEFAULT 0,
  interested_in_speaking      INTEGER NOT NULL DEFAULT 0,
  note                        TEXT NOT NULL DEFAULT '',
  submitted_at                TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES companies(id),
  title           TEXT NOT NULL,
  type            TEXT NOT NULL,
  location        TEXT NOT NULL,
  required_skills TEXT NOT NULL, -- JSON array of strings
  description     TEXT NOT NULL,
  posted_at       TEXT NOT NULL
);

-- Lightweight company engagement actions on a candidate — no email, no accept/reject flow.
CREATE TABLE IF NOT EXISTS company_actions (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL REFERENCES students(id),
  kind           TEXT NOT NULL CHECK (kind IN ('saved', 'interested', 'invited')),
  opportunity_id TEXT REFERENCES opportunities(id),
  note           TEXT,
  created_at     TEXT NOT NULL
);

-- Each notification belongs to exactly one account (student, university, or company).
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('student', 'university', 'company')),
  recipient_id   TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  link           TEXT,
  read           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_role, recipient_id);
CREATE INDEX IF NOT EXISTS idx_projects_student ON projects (student_id);
CREATE INDEX IF NOT EXISTS idx_evidence_project ON evidence (project_id);
CREATE INDEX IF NOT EXISTS idx_signals_project ON skill_signals (project_id);
CREATE INDEX IF NOT EXISTS idx_company_actions_company ON company_actions (company_id);
CREATE INDEX IF NOT EXISTS idx_challenge_files_challenge ON challenge_files (challenge_id);
`

const TABLES_IN_DROP_ORDER = [
  "notifications",
  "company_actions",
  "opportunities",
  "skill_signal_evidence",
  "skill_signals",
  "project_members",
  "company_feedback",
  "evidence",
  "feedback",
  "project_tasks",
  "projects",
  "challenge_history",
  "challenge_assignments",
  "challenge_files",
  "challenges",
  "students",
  "company_contacts",
  "companies",
  "programs",
  "staff",
  "universities",
]

let instance: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (instance) return instance
  mkdirSync(dirname(DB_PATH), { recursive: true })
  const db = new DatabaseSync(DB_PATH)
  // node:sqlite enables foreign keys by default; keep them off until migrations have run,
  // since rebuilding a table is only safe with them disabled.
  db.exec("PRAGMA foreign_keys = OFF; PRAGMA journal_mode = WAL;")
  db.exec(SCHEMA)
  migrate(db)
  db.exec("PRAGMA foreign_keys = ON;")
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM universities").get() as { n: number }
  if (n === 0) transaction(db, () => seedDatabase(db))
  instance = db
  return db
}

const SCHEMA_VERSION = 11

/**
 * Brings databases created by older versions up to date without losing their data.
 * v2: a challenge's single assigned university/program moved into challenge_assignments,
 *     so an open challenge can be assigned independently by several universities.
 * v3: seeded evidence that still points at the old placeholder links gets its real link.
 * v4: evidence types "Video / Demo Link" and "Prototype / Demo" renamed to
 *     "Video Walkthrough" and "Prototype".
 * v5: evidence gained an optional `content` column, and skill_signals gained
 *     `ai_note` — the AI rating now runs a real ML model over actual submitted
 *     text instead of a hash of evidence type/count, and explains itself.
 * v6: replaced the rating/confirm model with evidence verification. skill_signals'
 *     `ai_rating` renamed to `evidence_confidence` (a number was never a statement of
 *     skill — just how strongly evidence supports a signal) and gained `status`,
 *     `suggested_level`, `verified_by`, `verified_at`, `reviewer_notes` so a university
 *     mentor can decide each skill individually instead of one whole-project rubber
 *     stamp. `company_rating`/`company_rated_at` are deprecated in place (never written
 *     or read by new code — a company rating was never a verification). Challenge/
 *     project statuses remapped: "Submissions Under Review" -> "Evidence Under Review",
 *     "Confirmed to Company" -> "Skills Pending Verification", "Company Reviewed" ->
 *     "Completed" (a one-time best-effort approximation — the old rows have no
 *     per-skill resolution data to map from; `npm run db:reset` is the clean path).
 * v7: challenges gained `shared_sensitive_data` (what the privacy screen flagged and the
 *     company confirmed sharing). Attached files live in the new challenge_files table,
 *     which CREATE TABLE IF NOT EXISTS adds on its own.
 * v8: skill_signals gained `ai_quotes` (the lines of evidence each AI signal cites), and
 *     evidence gained `fetched_content`/`fetched_from` (what WSL read from a GitHub link).
 * v9: skill_signals gained `ai_criteria` (the named rubric criteria a signal was checked
 *     against, met and unmet), and `suggested_level` can now be `'Insufficient'` — too few
 *     criteria met to claim any real tier, rather than forcing a low tier regardless.
 *     Widening that CHECK constraint needs a table rebuild (SQLite can't ALTER a CHECK in
 *     place), so skill_signals is rebuilt the same way challenges was in v7.
 * v10: skill names are canonicalized (server/ml/analyze.ts's canonicalSkillName) wherever
 *     they're stored, so a company typing "python" instead of "Python" at challenge
 *     creation no longer fragments into a second, separate skill across dashboards,
 *     a student's record, and Talent Discovery search. One-time best-effort cleanup of
 *     challenges.required_skills and skill_signals.skill for existing rows below; every
 *     new challenge is canonicalized going forward at the point it's created.
 * v11: projects gained `graded_evidence_hash`/`graded_model`/`graded_at`, so re-analyzing
 *     unchanged evidence can skip the model call and return the existing result instantly.
 */
function migrate(db: DatabaseSync) {
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number }
  if (version >= SCHEMA_VERSION) return

  const columns = (db.prepare("PRAGMA table_info(challenges)").all() as { name: string }[]).map((c) => c.name)
  if (version < 3) {
    // Only rows still holding a seeded placeholder are touched — links students added stay as they are.
    transaction(db, () => {
      const update = db.prepare("UPDATE evidence SET link = ? WHERE id = ? AND link LIKE '%.demo/wsl/%'")
      for (const [id, link] of Object.entries(EVIDENCE_LINKS)) update.run(link, id)
    })
  }
  if (version < 4) {
    transaction(db, () => {
      db.exec(`
        UPDATE evidence SET type = 'Video Walkthrough' WHERE type = 'Video / Demo Link';
        UPDATE evidence SET type = 'Prototype' WHERE type = 'Prototype / Demo';
        UPDATE challenges SET submission_requirements =
          replace(replace(submission_requirements, '"Video / Demo Link"', '"Video Walkthrough"'), '"Prototype / Demo"', '"Prototype"');
        UPDATE challenges SET expected_output = replace(expected_output, 'a short demo video', 'a short walkthrough video');
        UPDATE evidence SET title = 'Portal Walkthrough Video' WHERE id = 'ev-leen-3' AND title = 'Portal Walkthrough Demo';
      `)
    })
  }
  if (version < 5) {
    const evidenceColumns = (db.prepare("PRAGMA table_info(evidence)").all() as { name: string }[]).map((c) => c.name)
    const signalColumns = (db.prepare("PRAGMA table_info(skill_signals)").all() as { name: string }[]).map((c) => c.name)
    transaction(db, () => {
      if (!evidenceColumns.includes("content")) db.exec("ALTER TABLE evidence ADD COLUMN content TEXT")
      if (!signalColumns.includes("ai_note")) db.exec("ALTER TABLE skill_signals ADD COLUMN ai_note TEXT NOT NULL DEFAULT ''")
    })
  }
  if (version < 6) {
    transaction(db, () => {
      const cols = (db.prepare("PRAGMA table_info(skill_signals)").all() as { name: string }[]).map((c) => c.name)
      if (cols.includes("ai_rating") && !cols.includes("evidence_confidence")) {
        db.exec("ALTER TABLE skill_signals RENAME COLUMN ai_rating TO evidence_confidence")
      }
      const cols2 = (db.prepare("PRAGMA table_info(skill_signals)").all() as { name: string }[]).map((c) => c.name)
      if (!cols2.includes("status")) {
        db.exec(`ALTER TABLE skill_signals ADD COLUMN status TEXT NOT NULL DEFAULT 'Pending Verification'
          CHECK (status IN ('Pending Verification', 'Verified', 'More Evidence Requested', 'Rejected'))`)
      }
      if (!cols2.includes("suggested_level")) {
        db.exec(`ALTER TABLE skill_signals ADD COLUMN suggested_level TEXT NOT NULL DEFAULT 'Foundational'
          CHECK (suggested_level IN ('Foundational', 'Intermediate', 'Advanced', 'Demonstrated'))`)
      }
      if (!cols2.includes("verified_by")) db.exec("ALTER TABLE skill_signals ADD COLUMN verified_by TEXT REFERENCES staff(id)")
      if (!cols2.includes("verified_at")) db.exec("ALTER TABLE skill_signals ADD COLUMN verified_at TEXT")
      if (!cols2.includes("reviewer_notes")) db.exec("ALTER TABLE skill_signals ADD COLUMN reviewer_notes TEXT")

      // One-time best-effort status remap — see the v6 doc comment above.
      for (const table of ["challenges", "projects", "challenge_history"]) {
        db.exec(`UPDATE ${table} SET status = 'Evidence Under Review' WHERE status = 'Submissions Under Review'`)
        db.exec(`UPDATE ${table} SET status = 'Skills Pending Verification' WHERE status = 'Confirmed to Company'`)
        db.exec(`UPDATE ${table} SET status = 'Completed' WHERE status = 'Company Reviewed'`)
      }
    })
  }
  // Runs before the v2 rebuild below, which copies every CHALLENGE_COLUMNS column from the old table.
  if (version < 7 && !columns.includes("shared_sensitive_data")) {
    db.exec("ALTER TABLE challenges ADD COLUMN shared_sensitive_data TEXT")
  }
  if (columns.includes("assigned_university_id")) {
    // Rebuild the table without the old columns (foreign keys are still off at this point).
    transaction(db, () => {
      db.exec(`
        INSERT OR IGNORE INTO challenge_assignments (challenge_id, university_id, program_id, assigned_at)
        SELECT c.id, c.assigned_university_id, c.assigned_program_id,
               COALESCE((SELECT MIN(h.at) FROM challenge_history h WHERE h.challenge_id = c.id AND h.status = 'University Assigned'), c.created_at)
        FROM challenges c
        WHERE c.assigned_university_id IS NOT NULL AND c.assigned_program_id IS NOT NULL;
        CREATE TABLE challenges_v2 (${CHALLENGE_COLUMNS});
        INSERT INTO challenges_v2 SELECT ${CHALLENGE_COLUMN_NAMES.join(", ")} FROM challenges;
        DROP TABLE challenges;
        ALTER TABLE challenges_v2 RENAME TO challenges;
      `)
    })
    const problems = db.prepare("PRAGMA foreign_key_check").all()
    if (problems.length > 0) throw new Error(`Database migration left broken references: ${JSON.stringify(problems)}`)
  }
  if (version < 8) {
    const evidenceColumns = (db.prepare("PRAGMA table_info(evidence)").all() as { name: string }[]).map((c) => c.name)
    const signalColumns = (db.prepare("PRAGMA table_info(skill_signals)").all() as { name: string }[]).map((c) => c.name)
    transaction(db, () => {
      if (!evidenceColumns.includes("fetched_content")) db.exec("ALTER TABLE evidence ADD COLUMN fetched_content TEXT")
      if (!evidenceColumns.includes("fetched_from")) db.exec("ALTER TABLE evidence ADD COLUMN fetched_from TEXT")
      if (!signalColumns.includes("ai_quotes")) db.exec("ALTER TABLE skill_signals ADD COLUMN ai_quotes TEXT NOT NULL DEFAULT '[]'")
    })
  }
  if (version < 9) {
    const signalColumns = (db.prepare("PRAGMA table_info(skill_signals)").all() as { name: string }[]).map((c) => c.name)
    // Only the CHECK constraint actually needs the rebuild; skip it if a prior partial
    // run already got this database onto the wide suggested_level CHECK.
    const alreadyWide = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'skill_signals'").get() as { sql: string }).sql.includes(
      "'Insufficient'",
    )
    if (!alreadyWide) {
      transaction(db, () => {
        const selectCols = SKILL_SIGNALS_COLUMN_NAMES.map((name) => (name === "ai_criteria" && !signalColumns.includes("ai_criteria") ? "'[]'" : name)).join(", ")
        db.exec(`
          CREATE TABLE skill_signals_v2 (${SKILL_SIGNALS_COLUMNS});
          INSERT INTO skill_signals_v2 SELECT ${selectCols} FROM skill_signals;
          DROP TABLE skill_signals;
          ALTER TABLE skill_signals_v2 RENAME TO skill_signals;
          CREATE INDEX IF NOT EXISTS idx_signals_project ON skill_signals (project_id);
        `)
      })
      const problems = db.prepare("PRAGMA foreign_key_check").all()
      if (problems.length > 0) throw new Error(`Database migration left broken references: ${JSON.stringify(problems)}`)
    }
  }
  if (version < 10) {
    transaction(db, () => {
      const challengeRows = db.prepare("SELECT id, required_skills FROM challenges").all() as { id: string; required_skills: string }[]
      const updateChallenge = db.prepare("UPDATE challenges SET required_skills = ? WHERE id = ?")
      for (const row of challengeRows) {
        const skills: string[] = JSON.parse(row.required_skills)
        const canonical = skills.map((s) => canonicalSkillName(s))
        if (JSON.stringify(canonical) !== JSON.stringify(skills)) updateChallenge.run(JSON.stringify(canonical), row.id)
      }

      const signalRows = db.prepare("SELECT id, project_id, skill FROM skill_signals").all() as { id: string; project_id: string; skill: string }[]
      // Rows already in canonical form reserve their spot first, so a malformed sibling
      // ("python" alongside an already-correct "Python" in the same project — the
      // UNIQUE(project_id, skill) constraint means both can never coexist post-migration)
      // is the one left untouched, not the one that was already right.
      const claimed = new Map<string, Set<string>>() // project_id -> lowercase skill names already spoken for
      for (const row of signalRows) {
        if (row.skill !== canonicalSkillName(row.skill)) continue
        const set = claimed.get(row.project_id) ?? new Set<string>()
        set.add(row.skill.toLowerCase())
        claimed.set(row.project_id, set)
      }
      const updateSignal = db.prepare("UPDATE skill_signals SET skill = ? WHERE id = ?")
      for (const row of signalRows) {
        const canonical = canonicalSkillName(row.skill)
        if (canonical === row.skill) continue
        const set = claimed.get(row.project_id) ?? new Set<string>()
        if (set.has(canonical.toLowerCase())) continue // leave this one be — this is a one-time best-effort pass
        set.add(canonical.toLowerCase())
        claimed.set(row.project_id, set)
        updateSignal.run(canonical, row.id)
      }
    })
  }
  if (version < 11) {
    const projectColumns = (db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]).map((c) => c.name)
    transaction(db, () => {
      if (!projectColumns.includes("graded_evidence_hash")) db.exec("ALTER TABLE projects ADD COLUMN graded_evidence_hash TEXT")
      if (!projectColumns.includes("graded_model")) db.exec("ALTER TABLE projects ADD COLUMN graded_model TEXT")
      if (!projectColumns.includes("graded_at")) db.exec("ALTER TABLE projects ADD COLUMN graded_at TEXT")
    })
  }
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

/** Wipes every table and re-seeds the original data. */
export function resetDatabase(): void {
  const db = getDb()
  transaction(db, () => {
    for (const t of TABLES_IN_DROP_ORDER) db.exec(`DELETE FROM ${t}`)
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'challenge_history'")
    seedDatabase(db)
  })
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (err) {
    db.exec("ROLLBACK")
    throw err
  }
}

export { DB_PATH }
