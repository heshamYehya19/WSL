import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { EVIDENCE_LINKS, seedDatabase } from "./seed.ts"

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
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_signals (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id       TEXT NOT NULL REFERENCES students(id),
  skill            TEXT NOT NULL,
  ai_rating        INTEGER NOT NULL CHECK (ai_rating BETWEEN 0 AND 100),
  company_rating   INTEGER CHECK (company_rating BETWEEN 0 AND 100),
  company_rated_at TEXT,
  analyzed_at      TEXT NOT NULL,
  UNIQUE (project_id, skill)
);

CREATE TABLE IF NOT EXISTS skill_signal_evidence (
  signal_id   TEXT NOT NULL REFERENCES skill_signals(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (signal_id, evidence_id)
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
`

const TABLES_IN_DROP_ORDER = [
  "notifications",
  "opportunities",
  "skill_signal_evidence",
  "skill_signals",
  "evidence",
  "feedback",
  "project_tasks",
  "projects",
  "challenge_history",
  "challenge_assignments",
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

const SCHEMA_VERSION = 4

/**
 * Brings databases created by older versions up to date without losing their data.
 * v2: a challenge's single assigned university/program moved into challenge_assignments,
 *     so an open challenge can be assigned independently by several universities.
 * v3: seeded evidence that still points at the old placeholder links gets its real link.
 * v4: evidence types "Video / Demo Link" and "Prototype / Demo" renamed to
 *     "Video Walkthrough" and "Prototype".
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
