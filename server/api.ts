import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { DatabaseSync } from "node:sqlite"
import { getDb, resetDatabase, transaction } from "./db.ts"
import { analyzeEvidence, checkRelevance } from "./ai.ts"
import type { ChallengeContext, EvidenceQuote, SimulatedRating } from "./ai.ts"
import { parseGithubLink, readGithubRepo } from "./github.ts"
import type { RepoSnapshot } from "./github.ts"
import { rank } from "../src/lib/pipeline.ts"
import { MAX_DATASET_FILES, MAX_FILE_BYTES, prepareFile, screenChallenge, summarizeFindings, UploadError } from "./screening.ts"
import type { PreparedFile } from "./screening.ts"
import type {
  AppNotification,
  Challenge,
  ChallengeFile,
  ChallengeFileKind,
  ChallengeStatus,
  CompanyAction,
  CompanyContact,
  CompanyFeedback,
  Evidence,
  EvidenceType,
  FeedbackEntry,
  Opportunity,
  Organization,
  Program,
  Project,
  ProjectMember,
  ScreeningFinding,
  SkillSignal,
  SkillSignalStatus,
  Snapshot,
  Staff,
  Student,
  University,
} from "../src/types.ts"

// ---------------------------------------------------------------- shared rules

/** The history note recorded when a challenge is sent on, reflecting what the privacy screen actually found. */
function screenNote(sharedSensitiveData: unknown, companyName: string): string {
  const shared = sharedSensitiveData ? (JSON.parse(String(sharedSensitiveData)) as ScreeningFinding[]) : []
  if (shared.length === 0) return "WSL automatically screened this challenge for private or confidential data — none found."
  return `WSL's automatic screen flagged possible personal data (${summarizeFindings(shared)}). ${companyName} reviewed the warning and confirmed it's OK to share.`
}

// The full EvidenceType union (src/types.ts) still covers older evidence types
// still on record (Project Report, Presentation, ...) so historical data keeps
// rendering; only these four are offered for new submissions.
const SUBMITTABLE_EVIDENCE_TYPES: EvidenceType[] = ["GitHub Repository", "Code", "Documentation", "Dataset / Model"]
const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"]
const SENSITIVITIES = ["None (Public Dataset)", "Low", "Moderate", "High (NDA Required)"]
const VISIBILITIES = ["Public", "University Only", "Restricted"]
const AVAILABILITIES = ["Open to Opportunities", "Not Available", "Open to Internships"]
const SUGGESTED_LEVELS = ["Foundational", "Intermediate", "Advanced", "Demonstrated"]
const REVIEW_DECISIONS = ["verify", "request-more-evidence", "reject"] as const
const COMPANY_ACTION_KINDS = ["saved", "interested", "invited"]

/**
 * DEMO AUTH, not production auth: `x-wsl-actor: role:id` (see resolveActor below) is
 * trusted as-is once the id is confirmed to exist in the database — there is no
 * password, session, or signed token anywhere in this app. A real deployment would
 * need server-issued session cookies/JWTs and CSRF protection on mutating routes
 * instead of a client-supplied header. This flag only gates the one genuinely
 * destructive action (reset); it does not make resolveActor() itself secure.
 */
function isDemoMode(): boolean {
  return process.env.WSL_DEMO_MODE !== "false"
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Row = Record<string, unknown>
type Actor =
  | { role: "guest" }
  | { role: "student"; id: string }
  | { role: "university"; id: string }
  | { role: "company"; id: string }

const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`
const nowIso = () => new Date().toISOString()
const parseList = (v: unknown) => JSON.parse(String(v)) as string[]

function one(db: DatabaseSync, sql: string, ...params: (string | number | null)[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined
}
function all(db: DatabaseSync, sql: string, ...params: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...params) as Row[]
}
function exec(db: DatabaseSync, sql: string, ...params: (string | number | null)[]) {
  db.prepare(sql).run(...params)
}

// ------------------------------------------------------------------- snapshot

const COMPANY_VISIBLE_STATUSES = ["Verified", "Completed", "Company Feedback Received"]

/**
 * Which projects' evidence/signals/feedback an actor may read. A student sees their
 * own (owner or team member); a university sees every project any of its own
 * students is on; a company sees any project — any company's challenge — once a
 * mentor has confirmed it for sharing (that's the talent-discovery boundary, not an
 * own-challenge boundary). Guests see none. Project/challenge metadata itself (title,
 * status, required skills) is NOT filtered by this — only the evidence/signal content.
 */
function visibleProjectIds(db: DatabaseSync, actor: Actor): Set<string> {
  if (actor.role === "guest") return new Set()
  if (actor.role === "student") {
    return new Set(
      all(
        db,
        "SELECT pr.id FROM projects pr LEFT JOIN project_members pm ON pm.project_id = pr.id WHERE pr.student_id = ? OR pm.student_id = ?",
        actor.id,
        actor.id,
      ).map((r) => String(r.id)),
    )
  }
  if (actor.role === "university") {
    return new Set(
      all(db, "SELECT pr.id FROM projects pr JOIN students s ON s.id = pr.student_id WHERE s.university_id = ?", actor.id).map((r) => String(r.id)),
    )
  }
  return new Set(
    all(db, `SELECT id FROM projects WHERE status IN (${COMPANY_VISIBLE_STATUSES.map(() => "?").join(",")})`, ...COMPANY_VISIBLE_STATUSES).map((r) =>
      String(r.id),
    ),
  )
}

function isProjectMember(db: DatabaseSync, projectId: string, studentId: string): boolean {
  return !!one(db, "SELECT 1 FROM project_members WHERE project_id = ? AND student_id = ?", projectId, studentId)
}

function buildSnapshot(db: DatabaseSync, actor: Actor): Snapshot {
  const visible = visibleProjectIds(db, actor)
  const programs: Program[] = all(db, "SELECT * FROM programs ORDER BY name").map((r) => ({
    id: String(r.id),
    universityId: String(r.university_id),
    name: String(r.name),
    major: r.major as Program["major"],
    coordinatorId: String(r.coordinator_id),
  }))

  const universities: University[] = all(db, "SELECT * FROM universities ORDER BY name").map((r) => ({
    id: String(r.id),
    name: String(r.name),
    shortName: String(r.short_name),
    city: String(r.city),
    type: r.type as University["type"],
    established: Number(r.established),
    website: String(r.website),
    faculty: String(r.faculty),
    about: String(r.about),
    programs: programs.filter((p) => p.universityId === r.id),
  }))

  const staff: Staff[] = all(db, "SELECT * FROM staff ORDER BY name").map((r) => ({
    id: String(r.id),
    universityId: String(r.university_id),
    name: String(r.name),
    title: String(r.title),
  }))

  const organizations: Organization[] = all(db, "SELECT * FROM companies ORDER BY name").map((r) => ({
    id: String(r.id),
    name: String(r.name),
    industry: String(r.industry),
    city: String(r.city),
    logoInitials: String(r.logo_initials),
    about: String(r.about),
  }))

  const contacts: CompanyContact[] = all(db, "SELECT * FROM company_contacts ORDER BY is_primary DESC, name").map((r) => ({
    id: String(r.id),
    organizationId: String(r.company_id),
    name: String(r.name),
    role: String(r.role),
    isPrimary: Number(r.is_primary) === 1,
  }))

  const students: Student[] = all(
    db,
    // Students with the most verified skills first, so lists (and the sign-in page) open on a full record.
    `SELECT s.*, p.major FROM students s JOIN programs p ON p.id = s.program_id
     ORDER BY (SELECT COUNT(*) FROM skill_signals g WHERE g.student_id = s.id AND g.status = 'Verified') DESC,
              (SELECT COUNT(*) FROM projects pr WHERE pr.student_id = s.id) DESC, s.name`,
  ).map((r) => {
    const name = String(r.name)
    return {
      id: String(r.id),
      name,
      field: r.major as Student["field"],
      universityId: String(r.university_id),
      programId: String(r.program_id),
      studentNumber: String(r.student_number),
      year: String(r.year),
      gpa: Number(r.gpa),
      city: String(r.city),
      bio: String(r.bio),
      availability: r.availability as Student["availability"],
      initials: name
        .split(/\s+/)
        .filter((w) => !/^(al|abu|bani)-?$/i.test(w))
        .map((w) => w.replace(/^(Al|Abu)-/, "")[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    }
  })

  const historyRows = all(db, "SELECT * FROM challenge_history ORDER BY id")
  // Metadata only — file contents are served one at a time by GET /challenges/:id/files/:fileId.
  const fileRows = all(db, "SELECT id, challenge_id, kind, name, mime, size, uploaded_at FROM challenge_files ORDER BY uploaded_at, name")
  const assignmentRows = all(
    db,
    "SELECT a.*, p.name AS program_name FROM challenge_assignments a JOIN programs p ON p.id = a.program_id ORDER BY a.assigned_at",
  )
  const challenges: Challenge[] = all(
    db,
    `SELECT c.*, cc.name AS contact_name, cc.role AS contact_role
     FROM challenges c
     JOIN company_contacts cc ON cc.id = c.contact_id
     ORDER BY c.created_at DESC`,
  ).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    organizationId: String(r.company_id),
    problemDescription: String(r.problem_description),
    objectives: parseList(r.objectives),
    expectedOutput: String(r.expected_output),
    industry: String(r.industry),
    difficulty: r.difficulty as Challenge["difficulty"],
    requiredSkills: parseList(r.required_skills),
    learningOutcomes: parseList(r.learning_outcomes),
    datasetAvailability: String(r.dataset_availability),
    dataSensitivity: r.data_sensitivity as Challenge["dataSensitivity"],
    files: fileRows
      .filter((f) => f.challenge_id === r.id)
      .map((f): ChallengeFile => ({
        id: String(f.id),
        kind: f.kind as ChallengeFileKind,
        name: String(f.name),
        mime: String(f.mime),
        size: Number(f.size),
        uploadedAt: String(f.uploaded_at),
      })),
    sharedSensitiveData: r.shared_sensitive_data ? (JSON.parse(String(r.shared_sensitive_data)) as Challenge["sharedSensitiveData"]) : null,
    deadline: String(r.deadline),
    preferredUniversityId: (r.preferred_university_id as string | null) ?? null,
    contactId: String(r.contact_id),
    contactPerson: String(r.contact_name),
    contactRole: String(r.contact_role),
    visibility: r.visibility as Challenge["visibility"],
    submissionRequirements: parseList(r.submission_requirements),
    status: r.status as ChallengeStatus,
    assignments: assignmentRows
      .filter((a) => a.challenge_id === r.id)
      .map((a) => ({ universityId: String(a.university_id), programId: String(a.program_id), program: String(a.program_name), assignedAt: String(a.assigned_at) })),
    createdAt: String(r.created_at),
    submittedAt: (r.submitted_at as string | null) ?? null,
    history: historyRows
      .filter((h) => h.challenge_id === r.id)
      .map((h) => ({ status: h.status as ChallengeStatus, at: String(h.at), ...(h.note ? { note: String(h.note) } : {}) })),
  }))

  const taskRows = all(db, "SELECT * FROM project_tasks ORDER BY position")
  const feedbackRows = all(
    db,
    `SELECT f.*,
       COALESCE(st.name, cc.name) AS author_name,
       CASE f.author_kind
         WHEN 'staff' THEN st.title || ' · ' || u.short_name
         ELSE cc.role || ' · ' || co.name
       END AS author_role
     FROM feedback f
     LEFT JOIN staff st ON f.author_kind = 'staff' AND st.id = f.author_id
     LEFT JOIN universities u ON u.id = st.university_id
     LEFT JOIN company_contacts cc ON f.author_kind = 'contact' AND cc.id = f.author_id
     LEFT JOIN companies co ON co.id = cc.company_id
     ORDER BY f.at`,
  )
  const memberRows = all(db, "SELECT * FROM project_members")
  const companyFeedbackRows = all(db, "SELECT * FROM company_feedback")
  const projects: Project[] = all(
    db,
    `SELECT pr.*, c.title AS challenge_title, c.company_id
     FROM projects pr JOIN challenges c ON c.id = pr.challenge_id
     ORDER BY pr.started_at DESC`,
  ).map((r) => {
    const cf = companyFeedbackRows.find((f) => f.project_id === r.id)
    return {
      id: String(r.id),
      challengeId: String(r.challenge_id),
      title: String(r.challenge_title),
      organizationId: String(r.company_id),
      studentId: String(r.student_id),
      members: memberRows
        .filter((m) => m.project_id === r.id)
        .map((m): ProjectMember => ({ studentId: String(m.student_id), roleNote: String(m.role_note) })),
      status: r.status as ChallengeStatus,
      startedAt: String(r.started_at),
      tasks: taskRows.filter((t) => t.project_id === r.id).map((t) => ({ id: String(t.id), title: String(t.title), done: Number(t.done) === 1 })),
      feedback: feedbackRows
        .filter((f) => f.project_id === r.id && visible.has(String(r.id)))
        .map(
          (f): FeedbackEntry => ({
            id: String(f.id),
            author: String(f.author_name ?? "Unknown reviewer"),
            role: String(f.author_role ?? ""),
            authorKind: f.author_kind as FeedbackEntry["authorKind"],
            note: String(f.note),
            at: String(f.at),
          }),
        ),
      ...(cf
        ? {
            companyFeedback: {
              strongTechnicalExecution: Number(cf.strong_technical_execution) === 1,
              relevantForInternship: Number(cf.relevant_for_internship) === 1,
              interestedInSpeaking: Number(cf.interested_in_speaking) === 1,
              note: String(cf.note),
              submittedAt: String(cf.submitted_at),
            } satisfies CompanyFeedback,
          }
        : {}),
    }
  })

  const evidence: Evidence[] = all(db, "SELECT * FROM evidence ORDER BY submitted_at DESC")
    .filter((r) => visible.has(String(r.project_id)))
    .map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      studentId: String(r.student_id),
      type: r.type as EvidenceType,
      title: String(r.title),
      description: String(r.description),
      link: String(r.link),
      ...(r.content ? { content: String(r.content) } : {}),
      ...(r.fetched_from ? { analyzedFiles: parseList(r.fetched_from) } : {}),
      submittedAt: String(r.submitted_at),
    }))

  const signalEvidence = all(db, "SELECT * FROM skill_signal_evidence")
  const skillSignals: SkillSignal[] = all(db, "SELECT * FROM skill_signals ORDER BY analyzed_at DESC")
    .filter((r) => visible.has(String(r.project_id)))
    .map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      studentId: String(r.student_id),
      skill: String(r.skill),
      evidenceConfidence: Number(r.evidence_confidence),
      suggestedLevel: r.suggested_level as SkillSignal["suggestedLevel"],
      aiNote: String(r.ai_note ?? ""),
      aiQuotes: parseQuotes(r.ai_quotes),
      status: r.status as SkillSignalStatus,
      ...(r.verified_by ? { verifiedBy: String(r.verified_by), verifiedAt: String(r.verified_at) } : {}),
      ...(r.reviewer_notes ? { reviewerNotes: String(r.reviewer_notes) } : {}),
      ...(r.company_rating !== null ? { companyRating: Number(r.company_rating), companyRatedAt: String(r.company_rated_at) } : {}),
      evidenceIds: signalEvidence.filter((se) => se.signal_id === r.id).map((se) => String(se.evidence_id)),
      analyzedAt: String(r.analyzed_at),
    }))

  const opportunities: Opportunity[] = all(db, "SELECT * FROM opportunities ORDER BY posted_at DESC").map((r) => ({
    id: String(r.id),
    title: String(r.title),
    organizationId: String(r.company_id),
    type: String(r.type),
    location: String(r.location),
    requiredSkills: parseList(r.required_skills),
    description: String(r.description),
    postedAt: String(r.posted_at),
  }))

  const companyActions: CompanyAction[] =
    actor.role === "company"
      ? all(db, "SELECT * FROM company_actions WHERE company_id = ? ORDER BY created_at DESC", actor.id).map((r) => ({
          id: String(r.id),
          organizationId: String(r.company_id),
          studentId: String(r.student_id),
          kind: r.kind as CompanyAction["kind"],
          ...(r.opportunity_id ? { opportunityId: String(r.opportunity_id) } : {}),
          ...(r.note ? { note: String(r.note) } : {}),
          createdAt: String(r.created_at),
        }))
      : []

  const notifications: AppNotification[] =
    actor.role === "guest"
      ? []
      : all(
          db,
          "SELECT * FROM notifications WHERE recipient_role = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 30",
          actor.role,
          actor.id,
        ).map((r) => ({
          id: String(r.id),
          title: String(r.title),
          body: String(r.body),
          link: (r.link as string | null) ?? null,
          read: Number(r.read) === 1,
          createdAt: String(r.created_at),
        }))

  return { universities, staff, organizations, contacts, students, challenges, projects, evidence, skillSignals, opportunities, companyActions, notifications }
}

// --------------------------------------------------------------------- helpers

/**
 * DEMO AUTH ONLY — see the isDemoMode() comment above. This trusts whatever role:id
 * the client sends, with the one check that the id exists. Every write handler still
 * does its own ownership check against the resolved id (that part is real and stays
 * regardless of demo/production); what's missing for production is proof that the
 * request actually came from that account — a signed cookie/token, not a bare header.
 */
function resolveActor(db: DatabaseSync, header: string | undefined): Actor {
  if (!header) return { role: "guest" }
  const [role, id] = header.split(":")
  const table = role === "student" ? "students" : role === "university" ? "universities" : role === "company" ? "companies" : null
  if (!table || !id) return { role: "guest" }
  // An account that no longer exists (e.g. after a reset) is treated as signed out.
  if (!one(db, `SELECT id FROM ${table} WHERE id = ?`, id)) return { role: "guest" }
  return { role, id } as Actor
}

function requireRole<R extends Actor["role"]>(actor: Actor, role: R): Extract<Actor, { role: R }> {
  if (actor.role !== role) throw new ApiError(403, `Only a signed-in ${role} account can do this.`)
  return actor as Extract<Actor, { role: R }>
}

function notify(db: DatabaseSync, role: "student" | "university" | "company", recipientId: string, title: string, body: string, link: string | null) {
  exec(
    db,
    "INSERT INTO notifications (id, recipient_role, recipient_id, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
    newId("ntf"), role, recipientId, title, body, link, nowIso(),
  )
}

function pushHistory(db: DatabaseSync, challengeId: string, status: ChallengeStatus, note?: string) {
  exec(db, "UPDATE challenges SET status = ? WHERE id = ?", status, challengeId)
  exec(db, "INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, ?, ?, ?)", challengeId, status, nowIso(), note ?? null)
}

/** A challenge's status is the furthest state any of its projects reached — it only ever moves forward. */
function advanceIfFurther(db: DatabaseSync, challengeId: string, status: ChallengeStatus, note?: string) {
  const c = one(db, "SELECT status FROM challenges WHERE id = ?", challengeId)
  if (c && rank(status) > rank(String(c.status))) pushHistory(db, challengeId, status, note)
}

/** True once a mentor has made a final call (Verified or Rejected) on every required
 * skill — the precondition for confirming evidence to the company. A skill still
 * "Pending Verification" or "More Evidence Requested" means review isn't done. */
function allSignalsResolved(db: DatabaseSync, projectId: string): boolean {
  const rows = all(db, "SELECT status FROM skill_signals WHERE project_id = ?", projectId)
  return rows.length > 0 && rows.every((r) => r.status === "Verified" || r.status === "Rejected")
}

function text(v: unknown, field: string, { required = false, max = 4000 } = {}): string {
  const s = typeof v === "string" ? v.trim() : ""
  if (required && !s) throw new ApiError(400, `${field} is required.`)
  if (s.length > max) throw new ApiError(400, `${field} is too long (max ${max} characters).`)
  return s
}

function textList(v: unknown, field: string): string[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ApiError(400, `${field} must be a list.`)
  return v.map((x) => text(x, field, { max: 300 })).filter(Boolean).slice(0, 20)
}

function oneOf(v: unknown, allowed: string[], field: string, fallback: string): string {
  if (v === undefined || v === null || v === "") return fallback
  if (typeof v !== "string" || !allowed.includes(v)) throw new ApiError(400, `Invalid ${field}.`)
  return v
}

function projectContext(db: DatabaseSync, projectId: string) {
  const row = one(
    db,
    `SELECT pr.id, pr.status, pr.challenge_id, pr.student_id, s.name AS student_name, s.university_id, s.program_id,
            u.name AS university_name, u.short_name AS university_short, c.title AS challenge_title,
            c.company_id, c.contact_id, co.name AS company_name
     FROM projects pr
     JOIN students s ON s.id = pr.student_id
     JOIN universities u ON u.id = s.university_id
     JOIN challenges c ON c.id = pr.challenge_id
     JOIN companies co ON co.id = c.company_id
     WHERE pr.id = ?`,
    projectId,
  )
  if (!row) throw new ApiError(404, "Project not found.")
  return {
    id: String(row.id),
    status: String(row.status) as ChallengeStatus,
    challengeId: String(row.challenge_id),
    challengeTitle: String(row.challenge_title),
    studentId: String(row.student_id),
    studentName: String(row.student_name),
    universityId: String(row.university_id),
    universityName: String(row.university_name),
    universityShort: String(row.university_short),
    programId: String(row.program_id),
    companyId: String(row.company_id),
    companyName: String(row.company_name),
    contactId: String(row.contact_id),
  }
}

/** The student-side checks shared by adding evidence and requesting analysis. */
function requireEvidenceAccess(db: DatabaseSync, actor: Actor, projectId: string, action: string) {
  const student = requireRole(actor, "student")
  const p = projectContext(db, projectId)
  if (p.studentId !== student.id && !isProjectMember(db, projectId, student.id)) throw new ApiError(403, `You can only ${action} your own projects.`)
  if (rank(p.status) >= rank("Verified")) throw new ApiError(409, "This evidence was already confirmed to the company.")
  return { student, p }
}

function parseQuotes(raw: unknown): EvidenceQuote[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"))
    return Array.isArray(parsed) ? (parsed as EvidenceQuote[]) : []
  } catch {
    return []
  }
}

/** Everything WSL analyzes for one evidence item: the student's pasted content plus anything read from its link. */
function analyzableText(r: Record<string, unknown>): string | undefined {
  const text = [r.content, r.fetched_content].filter(Boolean).map(String).join("\n\n")
  return text || undefined
}

function challengeContextFor(db: DatabaseSync, challengeId: string): ChallengeContext {
  const row = one(db, "SELECT problem_description, objectives, expected_output FROM challenges WHERE id = ?", challengeId)!
  // A description document holds the full problem statement, so students' work is matched against it too.
  const docText = all(db, "SELECT text FROM challenge_files WHERE challenge_id = ? AND kind = 'description'", challengeId).map((f) => String(f.text))
  return {
    problemDescription: [String(row.problem_description), ...docText].join("\n"),
    objectives: parseList(row.objectives),
    expectedOutput: String(row.expected_output),
  }
}

/** The faculty member who mentors the student's program. */
function coordinatorFor(db: DatabaseSync, programId: string) {
  const row = one(db, "SELECT st.id, st.name FROM programs p JOIN staff st ON st.id = p.coordinator_id WHERE p.id = ?", programId)
  if (!row) throw new ApiError(500, "This program has no coordinator on record.")
  return { id: String(row.id), name: String(row.name) }
}

/** Who may download a challenge's attached files: the same accounts that can see the challenge itself. */
function canAccessChallengeFiles(db: DatabaseSync, actor: Actor, challengeId: string): boolean {
  const c = one(db, "SELECT company_id, status, preferred_university_id FROM challenges WHERE id = ?", challengeId)
  if (!c) return false
  switch (actor.role) {
    case "company":
      return c.company_id === actor.id
    case "university":
      return c.status !== "Draft" && (!c.preferred_university_id || c.preferred_university_id === actor.id)
    case "student":
      return !!one(
        db,
        "SELECT 1 FROM challenge_assignments a JOIN students s ON s.university_id = a.university_id WHERE a.challenge_id = ? AND s.id = ?",
        challengeId,
        actor.id,
      )
    default:
      return false
  }
}

const FILE_KINDS: ChallengeFileKind[] = ["description", "dataset"]

/** Decodes and validates a challenge's uploaded files (sent as base64 in the JSON body). */
async function prepareChallengeFiles(actor: Actor, body: Body): Promise<PreparedFile[]> {
  requireRole(actor, "company")
  if (body.files === undefined || body.files === null) return []
  if (!Array.isArray(body.files)) throw new ApiError(400, "Files must be a list.")
  const files: PreparedFile[] = []
  for (const f of body.files as Record<string, unknown>[]) {
    const kind = f?.kind as ChallengeFileKind
    if (!FILE_KINDS.includes(kind)) throw new ApiError(400, "Unknown file kind.")
    if (typeof f.name !== "string" || typeof f.data !== "string") throw new ApiError(400, "Each file needs a name and contents.")
    try {
      files.push(await prepareFile(kind, f.name, Buffer.from(f.data, "base64")))
    } catch (err) {
      if (err instanceof UploadError) throw new ApiError(400, err.message)
      throw err
    }
  }
  if (files.filter((f) => f.kind === "description").length > 1) throw new ApiError(400, "Attach one challenge description file at most.")
  if (files.filter((f) => f.kind === "dataset").length > MAX_DATASET_FILES) throw new ApiError(400, `Attach up to ${MAX_DATASET_FILES} dataset files.`)
  return files
}

/** A readable summary of a description document, for when the company didn't write one. */
function summaryFromDocument(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= 600) return flat
  const cut = flat.slice(0, 600)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 400))}…`
}

function notifyUniversitiesOfNewChallenge(db: DatabaseSync, challengeId: string) {
  const c = one(db, "SELECT c.title, c.preferred_university_id, co.name AS company FROM challenges c JOIN companies co ON co.id = c.company_id WHERE c.id = ?", challengeId)!
  const targets = c.preferred_university_id
    ? [String(c.preferred_university_id)]
    : all(db, "SELECT id FROM universities").map((r) => String(r.id))
  for (const uniId of targets) {
    notify(db, "university", uniId, "New challenge received", `${c.company} sent “${c.title}”.`, `/university/challenges/${challengeId}`)
  }
}

// ------------------------------------------------------------------- mutations

type Body = Record<string, unknown>
type Handler = (db: DatabaseSync, actor: Actor, params: string[], body: Body, prepared: never) => unknown

// `prepare` does any async work (e.g. reading uploaded files) before the handler's
// synchronous database transaction starts; its result is passed to the handler.
const routes: { method: string; pattern: RegExp; prepare?: (actor: Actor, body: Body, params: string[]) => Promise<unknown>; handler: Handler }[] = [
  {
    method: "POST",
    pattern: /^\/challenges$/,
    prepare: prepareChallengeFiles,
    // Runs WSL's privacy screen over the text and files first. If it finds personal data and the
    // company hasn't confirmed sharing it (confirmSensitiveData), nothing is saved and the findings
    // come back as { findings } so the company can review them and resubmit.
    handler: (db, actor, _p, body, files: PreparedFile[]) => {
      const company = requireRole(actor, "company")
      const title = text(body.title, "Title", { required: true, max: 160 })
      const descriptionFile = files.find((f) => f.kind === "description")
      let problem = text(body.problemDescription, "Problem description", { required: !descriptionFile })
      if (!problem && descriptionFile) {
        if (descriptionFile.text.replace(/\s/g, "").length < 20) {
          throw new ApiError(
            400,
            `WSL couldn't read the text in “${descriptionFile.name}”, so add a short written description too — it's what students' work is matched against.`,
          )
        }
        problem = summaryFromDocument(descriptionFile.text)
      }
      const skills = textList(body.requiredSkills, "Required skills")
      const outcomes = textList(body.learningOutcomes, "Learning outcomes")
      const preferred = typeof body.preferredUniversityId === "string" && body.preferredUniversityId ? body.preferredUniversityId : null
      if (preferred && !one(db, "SELECT id FROM universities WHERE id = ?", preferred)) throw new ApiError(400, "Unknown university.")

      const contactId =
        typeof body.contactId === "string" && body.contactId
          ? body.contactId
          : String(one(db, "SELECT id FROM company_contacts WHERE company_id = ? ORDER BY is_primary DESC LIMIT 1", company.id)?.id ?? "")
      if (!one(db, "SELECT id FROM company_contacts WHERE id = ? AND company_id = ?", contactId, company.id)) {
        throw new ApiError(400, "Choose a contact person from your company.")
      }

      const deadlineRaw = text(body.deadline, "Deadline")
      const deadline = deadlineRaw ? new Date(deadlineRaw) : new Date(Date.now() + 30 * 86_400_000)
      if (Number.isNaN(deadline.getTime())) throw new ApiError(400, "Invalid deadline.")
      if (deadline.getTime() < Date.now()) throw new ApiError(400, "The deadline must be in the future.")

      const companyRow = one(db, "SELECT name, industry FROM companies WHERE id = ?", company.id)!
      const industry = text(body.industry, "Industry", { max: 120 }) || String(companyRow.industry)
      const datasetAvailability = text(body.datasetAvailability, "Dataset availability", { max: 300 })

      // Screened whatever sensitivity level the company declared — "Low" is a claim, not a check.
      const findings = screenChallenge({
        fields: [
          { label: "Title", text: title },
          { label: "Problem description", text: text(body.problemDescription, "Problem description") },
          { label: "Required skills", text: skills.join(", ") },
          { label: "Learning outcomes", text: outcomes.join("\n") },
          { label: "Dataset availability", text: datasetAvailability },
          { label: "Industry", text: industry },
        ],
        files,
      })
      if (findings.length > 0 && body.confirmSensitiveData !== true) return { findings }
      const shared = findings.length > 0 ? JSON.stringify(findings.map(({ kind, label, count }) => ({ kind, label, count }))) : null

      const asDraft = body.asDraft === true
      const id = newId("chal")
      const now = nowIso()
      exec(
        db,
        `INSERT INTO challenges (id, company_id, contact_id, title, problem_description, objectives, expected_output, industry, difficulty,
          required_skills, learning_outcomes, dataset_availability, data_sensitivity, shared_sensitive_data, deadline, preferred_university_id,
          visibility, submission_requirements, status, created_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, company.id, contactId, title, problem,
        JSON.stringify(outcomes.length ? outcomes : ["Explore the problem", "Prototype a solution", "Present findings"]),
        "A working prototype or analysis plus a short report, as detailed in submission requirements.",
        industry,
        oneOf(body.difficulty, DIFFICULTIES, "difficulty", "Intermediate"),
        JSON.stringify(skills.length ? skills : ["Problem Solving"]),
        JSON.stringify(outcomes.length ? outcomes : ["Apply classroom concepts to a real operational problem"]),
        datasetAvailability ||
          (files.some((f) => f.kind === "dataset") ? "See the attached dataset files." : "To be confirmed during WSL's automatic screening."),
        oneOf(body.dataSensitivity, SENSITIVITIES, "data sensitivity", "Low"),
        shared,
        deadline.toISOString(),
        preferred,
        oneOf(body.visibility, VISIBILITIES, "visibility", "Public"),
        JSON.stringify(["Project report", "GitHub repository", "Presentation"]),
        asDraft ? "Draft" : "Sent to University",
        now,
        asDraft ? null : now,
      )
      const insertFile = db.prepare(
        "INSERT INTO challenge_files (id, challenge_id, kind, name, mime, size, data, text, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      for (const f of files) insertFile.run(newId("file"), id, f.kind, f.name, f.mime, f.data.length, f.data, f.text.slice(0, 200_000), now)
      exec(db, "INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, 'Draft', ?, NULL)", id, now)
      if (!asDraft) {
        exec(db, "INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, 'Sent to University', ?, ?)", id, now, screenNote(shared, String(companyRow.name)))
        notifyUniversitiesOfNewChallenge(db, id)
      }
      return { id }
    },
  },
  {
    method: "POST",
    pattern: /^\/challenges\/([^/]+)\/submit$/,
    handler: (db, actor, [id]) => {
      const company = requireRole(actor, "company")
      const c = one(
        db,
        "SELECT c.status, c.deadline, c.shared_sensitive_data, co.name AS company FROM challenges c JOIN companies co ON co.id = c.company_id WHERE c.id = ? AND c.company_id = ?",
        id,
        company.id,
      )
      if (!c) throw new ApiError(404, "Challenge not found.")
      if (c.status !== "Draft") throw new ApiError(409, "Only drafts can be submitted.")
      if (new Date(String(c.deadline)).getTime() < Date.now()) throw new ApiError(409, "This draft's deadline has already passed.")
      exec(db, "UPDATE challenges SET submitted_at = ? WHERE id = ?", nowIso(), id)
      pushHistory(db, id, "Sent to University", screenNote(c.shared_sensitive_data, String(c.company)))
      notifyUniversitiesOfNewChallenge(db, id)
    },
  },
  {
    method: "POST",
    pattern: /^\/challenges\/([^/]+)\/assign$/,
    handler: (db, actor, [id], body) => {
      const uni = requireRole(actor, "university")
      const c = one(db, "SELECT status, preferred_university_id, company_id, title, deadline FROM challenges WHERE id = ?", id)
      if (!c) throw new ApiError(404, "Challenge not found.")
      if (c.preferred_university_id && c.preferred_university_id !== uni.id) throw new ApiError(403, "This challenge was sent to a different university.")
      if (c.status === "Draft") throw new ApiError(409, "This challenge hasn't been submitted yet.")
      // Assignment is per university: another university assigning an open challenge doesn't affect this one.
      if (one(db, "SELECT 1 FROM challenge_assignments WHERE challenge_id = ? AND university_id = ?", id, uni.id)) {
        throw new ApiError(409, "Your university has already assigned this challenge.")
      }
      if (new Date(String(c.deadline)).getTime() < Date.now()) throw new ApiError(409, "This challenge's deadline has passed.")
      const program = one(db, "SELECT id, name FROM programs WHERE id = ? AND university_id = ?", String(body.programId ?? ""), uni.id)
      if (!program) throw new ApiError(400, "Choose one of your university's programs.")
      const uniRow = one(db, "SELECT name FROM universities WHERE id = ?", uni.id)!

      exec(
        db,
        "INSERT INTO challenge_assignments (challenge_id, university_id, program_id, assigned_at) VALUES (?, ?, ?, ?)",
        id, uni.id, String(program.id), nowIso(),
      )
      advanceIfFurther(db, id, "University Assigned", `Assigned to ${program.name} students at ${uniRow.name}.`)
      notify(db, "company", String(c.company_id), "Challenge assigned", `${uniRow.name} assigned “${c.title}” to ${program.name} students.`, `/company/challenges/${id}`)
      for (const s of all(db, "SELECT id FROM students WHERE program_id = ?", String(program.id))) {
        notify(db, "student", String(s.id), "New challenge available", `“${c.title}” was assigned to your program.`, `/student/challenges/${id}`)
      }
    },
  },
  {
    method: "POST",
    pattern: /^\/challenges\/([^/]+)\/start$/,
    handler: (db, actor, [id]) => {
      const student = requireRole(actor, "student")
      const c = one(db, "SELECT * FROM challenges WHERE id = ?", id)
      if (!c) throw new ApiError(404, "Challenge not found.")
      const s = one(db, "SELECT s.name, s.university_id, u.short_name FROM students s JOIN universities u ON u.id = s.university_id WHERE s.id = ?", student.id)!
      // Only challenges the student's own university assigned are open to them.
      if (!one(db, "SELECT 1 FROM challenge_assignments WHERE challenge_id = ? AND university_id = ?", id, String(s.university_id))) {
        throw new ApiError(403, "Your university hasn't assigned this challenge to its students.")
      }
      if (new Date(String(c.deadline)).getTime() < Date.now()) throw new ApiError(409, "This challenge's deadline has passed.")
      const existing = one(db, "SELECT id FROM projects WHERE challenge_id = ? AND student_id = ?", id, student.id)
      if (existing) return { id: String(existing.id) }

      const projectId = newId("prj")
      exec(db, "INSERT INTO projects (id, challenge_id, student_id, status, started_at) VALUES (?, ?, ?, 'In Progress', ?)", projectId, id, student.id, nowIso())
      parseList(c.objectives).forEach((title, i) => {
        exec(db, "INSERT INTO project_tasks (id, project_id, position, title, done) VALUES (?, ?, ?, ?, 0)", `${projectId}-t${i + 1}`, projectId, i, title)
      })
      advanceIfFurther(db, id, "In Progress", `${s.name} started the project.`)
      notify(db, "company", String(c.company_id), "Student started your challenge", `${s.name} (${s.short_name}) started “${c.title}”.`, `/company/challenges/${id}`)
      return { id: projectId }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/evidence$/,
    // A GitHub link is read (README and top source files) before the transaction, so it can be analyzed.
    prepare: async (actor, body, [id]) => {
      requireEvidenceAccess(getDb(), actor, id, "add evidence to")
      if (body.type === "Code" || typeof body.link !== "string" || !parseGithubLink(body.link)) return null
      return readGithubRepo(body.link)
    },
    handler: (db, actor, [id], body, repo: RepoSnapshot | null) => {
      const { p, student } = requireEvidenceAccess(db, actor, id, "add evidence to")
      const evType = oneOf(body.type, SUBMITTABLE_EVIDENCE_TYPES, "evidence type", "")
      if (!evType) throw new ApiError(400, "Evidence type is required.")
      const title = text(body.title, "Title", { required: true, max: 200 })
      // "Code" evidence is pasted directly and always analyzed. Everything else is a
      // link to where the work lives, with an optional excerpt a mentor can paste in
      // to also have it analyzed — otherwise it's just linked for mentor review.
      const isCode = evType === "Code"
      const link = isCode ? "" : text(body.link, "Link", { required: true, max: 500 })
      const content = isCode ? text(body.content, "Code", { required: true, max: 20000 }) : text(body.content, "Content", { max: 20000 }) || null

      const checkText = [title, content, repo?.text].filter(Boolean).join(". ")
      const relevance = checkRelevance(challengeContextFor(db, p.challengeId), checkText)
      if (!relevance.relevant && relevance.reason === "echoes-brief") {
        throw new ApiError(
          400,
          `Most of this submission repeats the “${p.challengeTitle}” brief back (${relevance.echoPct}% of its phrases come from the challenge). WSL only counts work you produced, so submit your own code, analysis or write-up.`,
        )
      }
      if (!relevance.relevant) {
        throw new ApiError(
          400,
          `This doesn't look like it addresses “${p.challengeTitle}” — WSL couldn't find a meaningful connection between what you submitted and this challenge's stated problem (${relevance.overlapPct}% match). Please submit evidence for this specific challenge.`,
        )
      }

      exec(
        db,
        "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, fetched_content, fetched_from, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        newId("ev"), id, student.id, evType, title, "", link, content, repo?.text ?? null, repo ? JSON.stringify(repo.files) : null, nowIso(),
      )
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/ai-review$/,
    // Grading calls Gemini, so it runs before the database transaction; the handler only saves the results.
    prepare: async (actor, _body, [id]) => {
      const db = getDb()
      const { p } = requireEvidenceAccess(db, actor, id, "request analysis for")
      const ev = all(db, "SELECT * FROM evidence WHERE project_id = ? ORDER BY submitted_at", id).map((r) => ({
        id: String(r.id),
        type: String(r.type),
        title: String(r.title),
        description: String(r.description),
        content: analyzableText(r),
      }))
      if (ev.length === 0) throw new ApiError(409, "Submit at least one piece of evidence first.")
      const skills = parseList(one(db, "SELECT required_skills FROM challenges WHERE id = ?", p.challengeId)!.required_skills)
      // Re-analyzing (e.g. after the student adds more evidence) recomputes every
      // required skill against ALL current evidence and overwrites prior results,
      // rather than only ever analyzing a skill once — otherwise evidence submitted
      // after the first analysis could never be picked up at all.
      return analyzeEvidence(skills, ev, challengeContextFor(db, p.challengeId))
    },
    handler: (db, actor, [id], _body, results: SimulatedRating[]) => {
      const { p, student } = requireEvidenceAccess(db, actor, id, "request analysis for")
      const now = nowIso()
      for (const r of results) {
        const existing = one(db, "SELECT id, status FROM skill_signals WHERE project_id = ? AND skill = ?", id, r.skill)
        // A mentor's decision is durable — new evidence never silently re-scores a
        // skill the mentor already verified out from under them.
        if (existing && existing.status === "Verified") continue
        const sigId = existing ? String(existing.id) : newId("sig")
        if (existing) {
          exec(db, "DELETE FROM skill_signal_evidence WHERE signal_id = ?", sigId)
          exec(
            db,
            "UPDATE skill_signals SET evidence_confidence = ?, ai_note = ?, ai_quotes = ?, suggested_level = ?, status = 'Pending Verification', analyzed_at = ? WHERE id = ?",
            r.rating, r.note, JSON.stringify(r.quotes), r.suggestedLevel, now, sigId,
          )
        } else {
          exec(
            db,
            "INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, ai_note, ai_quotes, suggested_level, status, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification', ?)",
            sigId, id, student.id, r.skill, r.rating, r.note, JSON.stringify(r.quotes), r.suggestedLevel, now,
          )
        }
        for (const evId of r.evidenceIds) exec(db, "INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, ?)", sigId, evId)
      }
      if (p.status === "In Progress") {
        exec(db, "UPDATE projects SET status = 'Evidence Under Review' WHERE id = ?", id)
        notify(db, "university", p.universityId, "Evidence ready for review", `WSL analyzed ${p.studentName}'s evidence for “${p.challengeTitle}”.`, `/university/projects/${id}`)
      }
      advanceIfFurther(db, p.challengeId, "Evidence Under Review", `WSL analyzed ${p.studentName}'s submitted evidence automatically.`)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/signals\/([^/]+)\/review$/,
    handler: (db, actor, [id, signalId], body) => {
      const uni = requireRole(actor, "university")
      const p = projectContext(db, id)
      if (p.universityId !== uni.id) throw new ApiError(403, "You can only review your own students' work.")
      const signal = one(db, "SELECT id, skill, status FROM skill_signals WHERE id = ? AND project_id = ?", signalId, id)
      if (!signal) throw new ApiError(404, "Skill signal not found.")
      const decision = oneOf(body.decision, [...REVIEW_DECISIONS], "decision", "")
      if (!decision) throw new ApiError(400, "Decision is required.")
      const reviewerNotes = text(body.reviewerNotes, "Reviewer notes", { max: 1000, required: decision !== "verify" })
      const mentor = coordinatorFor(db, p.programId)
      const now = nowIso()

      if (decision === "verify") {
        const suggestedLevel = oneOf(body.suggestedLevel, SUGGESTED_LEVELS, "suggested level", "")
        exec(
          db,
          `UPDATE skill_signals SET status = 'Verified', verified_by = ?, verified_at = ?, reviewer_notes = ?
           ${suggestedLevel ? ", suggested_level = ?" : ""} WHERE id = ?`,
          ...(suggestedLevel ? [mentor.id, now, reviewerNotes || null, suggestedLevel, signalId] : [mentor.id, now, reviewerNotes || null, signalId]),
        )
      } else {
        const status: SkillSignalStatus = decision === "reject" ? "Rejected" : "More Evidence Requested"
        exec(db, "UPDATE skill_signals SET status = ?, verified_by = ?, verified_at = ?, reviewer_notes = ? WHERE id = ?", status, mentor.id, now, reviewerNotes, signalId)
      }

      notify(
        db,
        "student",
        p.studentId,
        decision === "verify" ? `"${signal.skill}" verified` : decision === "reject" ? `"${signal.skill}" not verified` : `More evidence requested for "${signal.skill}"`,
        `${mentor.name} reviewed your ${signal.skill} evidence for “${p.challengeTitle}”.`,
        `/student/projects/${id}`,
      )
      // First mentor touch moves the project from "evidence is sitting there" to
      // "actively being worked through" — it does not itself finish the review;
      // only an explicit /confirm (once every skill has a final decision) does that.
      if (p.status === "Evidence Under Review") {
        exec(db, "UPDATE projects SET status = 'Skills Pending Verification' WHERE id = ?", id)
        advanceIfFurther(db, p.challengeId, "Skills Pending Verification", `${mentor.name} began reviewing ${p.studentName}'s skill signals.`)
      }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/confirm$/,
    handler: (db, actor, [id], body) => {
      const uni = requireRole(actor, "university")
      const p = projectContext(db, id)
      if (p.universityId !== uni.id) throw new ApiError(403, "You can only confirm your own students' work.")
      if (rank(p.status) >= rank("Verified")) throw new ApiError(409, "This evidence was already confirmed to the company.")
      if (!allSignalsResolved(db, id)) {
        throw new ApiError(409, "Every required skill needs a Verify or Reject decision before you can confirm this evidence to the company.")
      }
      const allVerified = all(db, "SELECT status FROM skill_signals WHERE project_id = ?", id).every((r) => r.status === "Verified")
      const finalStatus: ChallengeStatus = allVerified ? "Verified" : "Completed"
      const mentor = coordinatorFor(db, p.programId)
      const note = text(body.note, "Note", { max: 1000 }) || `Reviewed and confirmed to ${p.companyName}.`
      exec(db, "INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, 'staff', ?, ?, ?)", newId("fb"), id, mentor.id, note, nowIso())
      exec(db, "UPDATE projects SET status = ? WHERE id = ?", finalStatus, id)
      advanceIfFurther(db, p.challengeId, finalStatus, `Reviewed by ${mentor.name} and confirmed to ${p.companyName}.`)
      notify(db, "company", p.companyId, "Evidence ready for your review", `${p.universityName} shared verified evidence for ${p.studentName}'s work on “${p.challengeTitle}”.`, `/company/submissions/${id}`)
      notify(db, "student", p.studentId, `Evidence confirmed to ${p.companyName}`, `${mentor.name} confirmed your evidence for “${p.challengeTitle}”.`, `/student/projects/${id}`)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/company-feedback$/,
    handler: (db, actor, [id], body) => {
      const company = requireRole(actor, "company")
      const p = projectContext(db, id)
      if (p.companyId !== company.id) throw new ApiError(403, "You can only give feedback on submissions to your own challenges.")
      if (rank(p.status) < rank("Verified")) throw new ApiError(409, "This evidence isn't ready for your review yet.")
      const now = nowIso()
      const existing = one(db, "SELECT id FROM company_feedback WHERE project_id = ?", id)
      const feedbackId = existing ? String(existing.id) : newId("cf")
      const strongExecution = body.strongTechnicalExecution === true ? 1 : 0
      const relevantForInternship = body.relevantForInternship === true ? 1 : 0
      const interestedInSpeaking = body.interestedInSpeaking === true ? 1 : 0
      const note = text(body.note, "Feedback note", { max: 2000 })
      if (existing) {
        exec(
          db,
          "UPDATE company_feedback SET strong_technical_execution = ?, relevant_for_internship = ?, interested_in_speaking = ?, note = ?, updated_at = ? WHERE id = ?",
          strongExecution, relevantForInternship, interestedInSpeaking, note, now, feedbackId,
        )
      } else {
        exec(
          db,
          `INSERT INTO company_feedback (id, project_id, contact_id, strong_technical_execution, relevant_for_internship, interested_in_speaking, note, submitted_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          feedbackId, id, p.contactId, strongExecution, relevantForInternship, interestedInSpeaking, note, now, now,
        )
      }
      // Structured feedback is a company's reaction to evidence it already saw — it
      // never touches skill_signals, so it can never change what's verified.
      exec(db, "UPDATE projects SET status = 'Company Feedback Received' WHERE id = ?", id)
      advanceIfFurther(db, p.challengeId, "Company Feedback Received", `${p.companyName} left feedback on the submission.`)
      notify(db, "student", p.studentId, `${p.companyName} left feedback`, `Your evidence for “${p.challengeTitle}” received feedback${note ? " and a note" : ""}.`, `/student/projects/${id}`)
      notify(db, "university", p.universityId, "Company left feedback", `${p.companyName} left feedback on ${p.studentName}'s submission for “${p.challengeTitle}”.`, `/university/projects/${id}`)
    },
  },
  {
    method: "POST",
    pattern: /^\/students\/([^/]+)\/company-actions$/,
    handler: (db, actor, [studentId], body) => {
      const company = requireRole(actor, "company")
      if (!one(db, "SELECT id FROM students WHERE id = ?", studentId)) throw new ApiError(404, "Student not found.")
      const kind = oneOf(body.kind, COMPANY_ACTION_KINDS, "kind", "")
      if (!kind) throw new ApiError(400, "Kind is required.")
      const now = nowIso()

      if (kind === "invited") {
        const opportunityId = text(body.opportunityId, "Opportunity", { required: true })
        if (!one(db, "SELECT id FROM opportunities WHERE id = ? AND company_id = ?", opportunityId, company.id)) {
          throw new ApiError(400, "Choose one of your own opportunities.")
        }
        if (one(db, "SELECT 1 FROM company_actions WHERE company_id = ? AND student_id = ? AND kind = 'invited' AND opportunity_id = ?", company.id, studentId, opportunityId)) {
          throw new ApiError(409, "You already invited this student to that opportunity.")
        }
        const note = text(body.note, "Note", { max: 1000 })
        exec(
          db,
          "INSERT INTO company_actions (id, company_id, student_id, kind, opportunity_id, note, created_at) VALUES (?, ?, ?, 'invited', ?, ?, ?)",
          newId("cact"), company.id, studentId, opportunityId, note || null, now,
        )
        const opp = one(db, "SELECT title FROM opportunities WHERE id = ?", opportunityId)!
        notify(db, "student", studentId, "You've been invited to an opportunity", `A company invited you to apply for “${String(opp.title)}”.`, "/student/opportunities")
        return { removed: false }
      }

      // "saved"/"interested" are simple toggles: calling again undoes the action.
      const existing = one(db, "SELECT id FROM company_actions WHERE company_id = ? AND student_id = ? AND kind = ?", company.id, studentId, kind)
      if (existing) {
        exec(db, "DELETE FROM company_actions WHERE id = ?", String(existing.id))
        return { removed: true }
      }
      exec(db, "INSERT INTO company_actions (id, company_id, student_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", newId("cact"), company.id, studentId, kind, text(body.note, "Note", { max: 1000 }) || null, now)
      return { removed: false }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/feedback$/,
    handler: (db, actor, [id], body) => {
      const p = projectContext(db, id)
      const note = text(body.note, "Feedback", { required: true, max: 2000 })
      let kind: "staff" | "contact"
      let authorId: string
      let from: string
      if (actor.role === "university" && actor.id === p.universityId) {
        const mentor = coordinatorFor(db, p.programId)
        kind = "staff"
        authorId = mentor.id
        from = mentor.name
      } else if (actor.role === "company" && actor.id === p.companyId) {
        if (rank(p.status) < rank("Verified")) throw new ApiError(409, "You can leave feedback once the university confirms this evidence.")
        kind = "contact"
        authorId = p.contactId
        from = p.companyName
      } else {
        throw new ApiError(403, "Only the student's university or the challenge's company can leave feedback here.")
      }
      exec(db, "INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, ?, ?, ?, ?)", newId("fb"), id, kind, authorId, note, nowIso())
      notify(db, "student", p.studentId, "New feedback", `${from} left feedback on “${p.challengeTitle}”.`, `/student/projects/${id}`)
    },
  },
  {
    method: "PATCH",
    pattern: /^\/projects\/([^/]+)\/tasks\/([^/]+)$/,
    handler: (db, actor, [id, taskId], body) => {
      const student = requireRole(actor, "student")
      const p = projectContext(db, id)
      if (p.studentId !== student.id && !isProjectMember(db, id, student.id)) throw new ApiError(403, "You can only update your own project tasks.")
      if (rank(p.status) >= rank("Verified")) throw new ApiError(409, "This project was already confirmed to the company.")
      if (!one(db, "SELECT id FROM project_tasks WHERE id = ? AND project_id = ?", taskId, id)) throw new ApiError(404, "Task not found.")
      exec(db, "UPDATE project_tasks SET done = ? WHERE id = ?", body.done === true ? 1 : 0, taskId)
    },
  },
  {
    method: "PATCH",
    pattern: /^\/students\/([^/]+)$/,
    handler: (db, actor, [id], body) => {
      const student = requireRole(actor, "student")
      if (student.id !== id) throw new ApiError(403, "You can only edit your own profile.")
      const current = one(db, "SELECT bio, availability FROM students WHERE id = ?", id)!
      const bio = body.bio === undefined ? String(current.bio) : text(body.bio, "Bio", { max: 600 })
      const availability = oneOf(body.availability, AVAILABILITIES, "availability", String(current.availability))
      exec(db, "UPDATE students SET bio = ?, availability = ? WHERE id = ?", bio, availability, id)
    },
  },
  {
    method: "POST",
    pattern: /^\/notifications\/read$/,
    handler: (db, actor) => {
      if (actor.role === "guest") throw new ApiError(403, "Sign in first.")
      exec(db, "UPDATE notifications SET read = 1 WHERE recipient_role = ? AND recipient_id = ?", actor.role, actor.id)
    },
  },
]

// ---------------------------------------------------------------------- server

// Uploads arrive base64-encoded (~4/3 of their size): room for a description file plus every dataset.
const MAX_BODY_BYTES = Math.ceil(((MAX_DATASET_FILES + 1) * MAX_FILE_BYTES * 4) / 3) + 1024 * 1024

async function readBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size <= MAX_BODY_BYTES) chunks.push(chunk as Buffer)
  }
  if (size > MAX_BODY_BYTES) throw new ApiError(413, "That upload is too large.")
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    return parsed && typeof parsed === "object" ? (parsed as Body) : {}
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.")
  }
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(payload))
}

/** Handles any `/api/*` request. Returns false for anything else so the caller can fall through. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost")
  if (!url.pathname.startsWith("/api/")) return false
  const path = url.pathname.slice(4)

  try {
    const db = getDb()
    const rawHeader = req.headers["x-wsl-actor"]
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
    const actor = resolveActor(db, header)

    if (req.method === "GET" && path === "/snapshot") {
      send(res, 200, { snapshot: buildSnapshot(db, actor) })
      return true
    }

    const fileMatch = req.method === "GET" ? /^\/challenges\/([^/]+)\/files\/([^/]+)$/.exec(path) : null
    if (fileMatch) {
      const [challengeId, fileId] = fileMatch.slice(1).map(decodeURIComponent)
      if (!canAccessChallengeFiles(db, actor, challengeId)) throw new ApiError(403, "You don't have access to this challenge's files.")
      const file = one(db, "SELECT name, mime, data FROM challenge_files WHERE id = ? AND challenge_id = ?", fileId, challengeId)
      if (!file) throw new ApiError(404, "File not found.")
      const name = String(file.name)
      res.statusCode = 200
      res.setHeader("Content-Type", String(file.mime))
      res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`)
      res.setHeader("X-Content-Type-Options", "nosniff")
      res.setHeader("Cache-Control", "no-store")
      res.end(Buffer.from(file.data as Uint8Array))
      return true
    }

    if (req.method === "POST" && path === "/reset") {
      if (!isDemoMode()) throw new ApiError(403, "Reset is only available in demo mode.")
      resetDatabase()
      send(res, 200, { result: null, snapshot: buildSnapshot(db, resolveActor(db, header)) })
      return true
    }

    for (const route of routes) {
      const match = route.method === req.method ? route.pattern.exec(path) : null
      if (!match) continue
      const body = await readBody(req)
      const params = match.slice(1).map(decodeURIComponent)
      const prepared = route.prepare ? await route.prepare(actor, body, params) : undefined
      const result = transaction(db, () => route.handler(db, actor, params, body, prepared as never))
      send(res, 200, { result: result ?? null, snapshot: buildSnapshot(db, actor) })
      return true
    }

    send(res, 404, { error: "Not found." })
  } catch (err) {
    if (err instanceof ApiError) send(res, err.status, { error: err.message })
    else {
      console.error("[wsl-api]", err)
      send(res, 500, { error: "Something went wrong on the server." })
    }
  }
  return true
}
