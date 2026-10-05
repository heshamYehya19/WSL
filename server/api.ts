import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { DatabaseSync } from "node:sqlite"
import { getDb, resetDatabase, transaction } from "./db.ts"
import { analyzeEvidence, canonicalSkillName, checkRelevance, currentGradingModel, hashEvidenceSet, noEvidenceResults } from "./ai.ts"
import { checkProviderHealth, configuredProvider, lastGradingOutcome } from "./ml/llm-grader.ts"
import type { ChallengeContext, EvidenceQuote, SimulatedRating, SkillCriterion } from "./ai.ts"
import { parseGithubLink, readGithubRepo } from "./github.ts"
import { EVIDENCE_INPUT, NOT_ANALYZED_TYPES, SUBMITTABLE_EVIDENCE_TYPES, evidenceTypeLabel } from "../src/lib/evidenceTypes.ts"
import type { EvidenceFileKind } from "../src/lib/evidenceTypes.ts"
import { DOC_PROBLEM_MESSAGE, parseGoogleDocLink, readGoogleDoc } from "./gdocs.ts"
import type { DocRead } from "./gdocs.ts"
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
  ProjectReview,
  ReviewItem,
  ReviewState,
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

// The full EvidenceType union (src/types.ts) also covers older evidence types still on record
// (Code, Dataset / Model, ...) so historical data keeps rendering; what new submissions may use
// is SUBMITTABLE_EVIDENCE_TYPES in src/lib/evidenceTypes.ts, shared with the form.
const MAX_TEAM_SIZE = 5
const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"]
const SENSITIVITIES = ["None (Public Dataset)", "Low", "Moderate", "High (NDA Required)"]
const VISIBILITIES = ["Public", "University Only", "Restricted"]
const AVAILABILITIES = ["Open to Opportunities", "Not Available", "Open to Internships"]
const SUGGESTED_LEVELS = ["Foundational", "Intermediate", "Advanced", "Demonstrated"]
const REVIEW_DECISIONS = ["verify", "request-more-evidence", "reject", "insufficient"] as const
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
  /** The form field this error belongs to, so the client can show it inline next to that field. */
  field?: string
  constructor(status: number, message: string, field?: string) {
    super(message)
    this.status = status
    this.field = field
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

/** The evidence a verified skill cites — the only evidence a company ever sees. */
function verifiedEvidenceIds(db: DatabaseSync): Set<string> {
  return new Set(
    all(db, "SELECT DISTINCT se.evidence_id FROM skill_signal_evidence se JOIN skill_signals s ON s.id = se.signal_id WHERE s.status = 'Verified'").map((r) =>
      String(r.evidence_id),
    ),
  )
}

/**
 * The privacy boundary for evidence, enforced where data leaves the server rather than in the UI.
 * A student reads only what they wrote — a teammate's work is private to its author and the
 * university. A university reads the evidence of its own students' projects. A company, once a
 * project is confirmed to it, reads only evidence that a university-verified skill is built on.
 */
function evidenceReadableBy(actor: Actor, visible: Set<string>, e: { id: string; projectId: string; studentId: string }, cited: Set<string>): boolean {
  if (!visible.has(e.projectId)) return false
  if (actor.role === "student") return e.studentId === actor.id
  if (actor.role === "company") return cited.has(e.id)
  return actor.role === "university"
}

function isProjectMember(db: DatabaseSync, projectId: string, studentId: string): boolean {
  return !!one(db, "SELECT 1 FROM project_members WHERE project_id = ? AND student_id = ?", projectId, studentId)
}

/** The project's owner or one of its members. */
function isOnTeam(db: DatabaseSync, projectId: string, studentId: string): boolean {
  return !!one(db, "SELECT 1 FROM projects WHERE id = ? AND student_id = ?", projectId, studentId) || isProjectMember(db, projectId, studentId)
}

/** Everyone on a project — owner first — with the id each notification should go to. */
function teamIds(db: DatabaseSync, projectId: string): string[] {
  const owner = String(one(db, "SELECT student_id FROM projects WHERE id = ?", projectId)?.student_id ?? "")
  return [owner, ...all(db, "SELECT student_id FROM project_members WHERE project_id = ? ORDER BY added_at", projectId).map((r) => String(r.student_id))].filter(Boolean)
}

function studentRow(db: DatabaseSync, studentId: string) {
  const r = one(db, "SELECT id, name, university_id, program_id FROM students WHERE id = ?", studentId)
  if (!r) throw new ApiError(404, "Student not found.")
  return { id: String(r.id), name: String(r.name), universityId: String(r.university_id), programId: String(r.program_id) }
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
    duration: String(r.duration ?? ""),
    constraints: String(r.constraints_note ?? ""),
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
  const analysisRows = all(db, "SELECT project_id, student_id, model, graded_at FROM analysis_runs")
  const companyFeedbackRows = all(db, "SELECT * FROM company_feedback")
  const evidenceCountRows = all(db, "SELECT project_id, student_id, COUNT(*) AS n FROM evidence GROUP BY project_id, student_id")
  // A company learns who contributed to a project only through verified skills: for a student with none
  // on a project, their own account of their contribution is not shared either.
  const verifiedPairs = new Set(all(db, "SELECT DISTINCT project_id, student_id FROM skill_signals WHERE status = 'Verified'").map((r) => `${r.project_id}|${r.student_id}`))
  const shareNote = (projectId: unknown, studentId: unknown, note: unknown) =>
    actor.role === "company" && !verifiedPairs.has(`${projectId}|${studentId}`) ? "" : String(note ?? "")
  // The confirmation check, for a project not yet confirmed: all of it for the university that decides, only
  // the student's own skills for a student, nothing for a company.
  const reviewFor = (r: Row): ProjectReview | null => {
    if (!visible.has(String(r.id)) || (actor.role !== "university" && actor.role !== "student")) return null
    if (rank(String(r.status)) >= rank("Verified")) return null
    const review = reviewReadiness(db, String(r.id))
    return actor.role === "student" ? { ready: review.ready, problems: [], items: review.items.filter((i) => i.studentId === actor.id) } : review
  }
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
      ownerRoleNote: shareNote(r.id, r.student_id, r.owner_role_note),
      members: memberRows
        .filter((m) => m.project_id === r.id)
        .map((m): ProjectMember => ({ studentId: String(m.student_id), roleNote: shareNote(r.id, m.student_id, m.role_note) })),
      analysis: analysisRows.filter((a) => a.project_id === r.id).map((a) => ({ studentId: String(a.student_id), model: String(a.model), gradedAt: String(a.graded_at) })),
      // Counts only, so a student sees how far their teammates are without seeing their work. A company needs neither.
      evidenceCounts:
        actor.role === "company" || !visible.has(String(r.id))
          ? []
          : [String(r.student_id), ...memberRows.filter((m) => m.project_id === r.id).map((m) => String(m.student_id))].map((studentId) => ({
              studentId,
              count: Number(evidenceCountRows.find((c) => c.project_id === r.id && c.student_id === studentId)?.n ?? 0),
            })),
      review: reviewFor(r),
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

  // Metadata only — a file's bytes are served one at a time by GET /evidence/:id/file.
  const evidenceFiles = new Map(all(db, "SELECT evidence_id, name, size FROM evidence_files").map((f) => [String(f.evidence_id), { name: String(f.name), size: Number(f.size) }]))
  const citedByVerified = actor.role === "company" ? verifiedEvidenceIds(db) : new Set<string>()
  const evidence: Evidence[] = all(db, "SELECT * FROM evidence ORDER BY submitted_at DESC")
    .filter((r) => evidenceReadableBy(actor, visible, { id: String(r.id), projectId: String(r.project_id), studentId: String(r.student_id) }, citedByVerified))
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
      ...(evidenceFiles.has(String(r.id)) ? { file: evidenceFiles.get(String(r.id)) } : {}),
      submittedAt: String(r.submitted_at),
    }))

  const signalEvidence = all(db, "SELECT * FROM skill_signal_evidence")
  // A student reads their own signals only; a company reads only what a university verified, and never the
  // reviewer's internal notes. (Evidence a verified skill cites is exactly the evidence a company may read.)
  const skillSignals: SkillSignal[] = all(db, "SELECT * FROM skill_signals ORDER BY analyzed_at DESC")
    .filter(
      (r) =>
        visible.has(String(r.project_id)) &&
        (actor.role === "student" ? r.student_id === actor.id : actor.role === "company" ? r.status === "Verified" : true),
    )
    .map((r) => ({
      id: String(r.id),
      projectId: String(r.project_id),
      studentId: String(r.student_id),
      skill: String(r.skill),
      evidenceConfidence: Number(r.evidence_confidence),
      suggestedLevel: r.suggested_level as SkillSignal["suggestedLevel"],
      aiNote: String(r.ai_note ?? ""),
      aiQuotes: parseQuotes(r.ai_quotes),
      criteria: parseCriteria(r.ai_criteria),
      gradedSource: r.graded_source as SkillSignal["gradedSource"],
      status: r.status as SkillSignalStatus,
      ...(r.verified_by ? { verifiedBy: String(r.verified_by), verifiedAt: String(r.verified_at) } : {}),
      ...(r.reviewer_notes && actor.role !== "company" ? { reviewerNotes: String(r.reviewer_notes) } : {}),
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

/** One student's evidence that WSL's analysis reads — statements, videos and screenshots are kept for the reviewer, never analyzed. */
function analyzableEvidenceOf(db: DatabaseSync, projectId: string, studentId: string) {
  return all(db, "SELECT * FROM evidence WHERE project_id = ? AND student_id = ? ORDER BY submitted_at", projectId, studentId)
    .filter((r) => !NOT_ANALYZED_TYPES.includes(String(r.type)))
    .map((r) => ({ id: String(r.id), type: String(r.type), title: String(r.title), description: String(r.description), content: analyzableText(r) }))
}

/** A decision a reviewer made (as opposed to WSL's own analysis result). */
const DECIDED_STATUSES: SkillSignalStatus[] = ["Verified", "Rejected", "Insufficient Evidence"]

/**
 * THE confirmation invariant: every team member × every required skill needs an explicit, CURRENT
 * university decision — Verified, Not Verified, or Insufficient Evidence the university acknowledged.
 * Not decisions: Pending Verification, More Evidence Requested, a skill nobody has reviewed (no signal
 * at all, or WSL's "found nothing" with no acknowledgement), and anything stale. A decision is stale
 * when the student added evidence after it, WSL re-analyzed after it, or the student's current
 * evidence hasn't been analyzed yet. Absence of evidence is never silently treated as a decision.
 */
function reviewReadiness(db: DatabaseSync, projectId: string): ProjectReview {
  const p = projectContext(db, projectId)
  const skills = parseList(one(db, "SELECT required_skills FROM challenges WHERE id = ?", p.challengeId)!.required_skills)
  const signals = all(db, "SELECT student_id, skill, status, suggested_level, verified_at, analyzed_at FROM skill_signals WHERE project_id = ?", projectId)
  const items: ReviewItem[] = []
  const problems: string[] = []

  for (const studentId of teamIds(db, projectId)) {
    const who = studentRow(db, studentId)
    if (who.universityId !== p.universityId) {
      problems.push(`${who.name} studies at a different university than the rest of the team, so ${p.universityName} cannot review ${who.name}'s work. Remove them from the team before confirming.`)
    }
    const latestEvidenceAt = String(one(db, "SELECT MAX(submitted_at) AS at FROM evidence WHERE project_id = ? AND student_id = ?", projectId, studentId)?.at ?? "")
    const run = one(db, "SELECT evidence_hash, model, graded_at FROM analysis_runs WHERE project_id = ? AND student_id = ?", projectId, studentId)
    const analyzable = analyzableEvidenceOf(db, projectId, studentId)
    // Evidence WSL reads must have been analyzed in its current form; with nothing to analyze there is nothing to wait for.
    const analysisCurrent = analyzable.length === 0 || (!!run && run.evidence_hash === hashEvidenceSet(skills, analyzable, String(run.model)))

    for (const skill of skills) {
      const s = signals.find((x) => x.student_id === studentId && x.skill === skill)
      let state: ReviewState
      if (!s) state = "unreviewed"
      else if (s.status === "Verified") state = "verified"
      else if (s.status === "Rejected") state = "not-verified"
      else if (s.status === "Insufficient Evidence") state = "acknowledged"
      else if (s.status === "More Evidence Requested") state = "more-evidence"
      else state = s.suggested_level === "Insufficient" ? "unreviewed" : "pending"

      const decided = !!s && DECIDED_STATUSES.includes(s.status as SkillSignalStatus)
      const decidedAt = decided ? String(s!.verified_at ?? s!.analyzed_at) : ""
      const stale = !analysisCurrent || (decided && (latestEvidenceAt > decidedAt || (!!run && String(run.graded_at) > decidedAt)))
      items.push({ studentId, skill, state, stale, resolved: decided && !stale })
    }
  }
  return { ready: problems.length === 0 && items.length > 0 && items.every((i) => i.resolved), problems, items }
}

const REVIEW_STATE_WORDS: Record<ReviewState, string> = {
  verified: "verified",
  "not-verified": "not verified",
  acknowledged: "insufficient evidence acknowledged",
  pending: "awaiting a decision",
  "more-evidence": "more evidence requested",
  unreviewed: "not reviewed yet",
}

/** A one-paragraph, specific reason confirmation is blocked: who still needs what. */
function reviewBlockers(db: DatabaseSync, review: ProjectReview): string {
  const parts: string[] = [...review.problems]
  const open = review.items.filter((i) => !i.resolved)
  if (open.length > 0) {
    const shown = open.slice(0, 4).map((i) => `${studentRow(db, i.studentId).name} — ${i.skill} (${i.stale ? "new evidence since the last review or analysis" : REVIEW_STATE_WORDS[i.state]})`)
    parts.push(`${open.length} of ${review.items.length} required skills still need a current decision: ${shown.join("; ")}${open.length > shown.length ? `; and ${open.length - shown.length} more` : ""}.`)
  }
  return `Every student on the team needs a current university decision on every required skill before this can be confirmed to the company. ${parts.join(" ")}`.trim()
}

/**
 * One reviewer decision on one student's one skill — the only way a skill is verified, declined, or
 * acknowledged as insufficient. It is made by the student's own university, notifies only that student,
 * and (for a skill with no signal yet) can only ask for more evidence or acknowledge insufficient evidence:
 * there is no analysis to verify. Acknowledging "Insufficient Evidence" is only for a skill WSL found
 * nothing for; where WSL found evidence the reviewer verifies it, asks for more, or declines to verify it.
 */
function decideSkill(db: DatabaseSync, universityId: string, p: ReturnType<typeof projectContext>, studentId: string, skill: string, body: Record<string, unknown>) {
  const subject = studentRow(db, studentId)
  if (subject.universityId !== universityId) throw new ApiError(403, "You can only review your own students' work.")
  const decision = oneOf(body.decision, [...REVIEW_DECISIONS], "decision", "")
  if (!decision) throw new ApiError(400, "Decision is required.")
  const reviewerNotes = text(body.reviewerNotes, "Reviewer notes", { max: 1000, required: decision === "reject" || decision === "request-more-evidence" })
  const mentor = coordinatorFor(db, subject.programId)
  const now = nowIso()
  const existing = one(db, "SELECT id, suggested_level FROM skill_signals WHERE project_id = ? AND student_id = ? AND skill = ?", p.id, studentId, skill)

  let signalId: string
  if (!existing) {
    if (decision !== "insufficient" && decision !== "request-more-evidence") {
      throw new ApiError(409, `There is no analysis of ${skill} for ${subject.name} to verify or decline. You can ask for more evidence, or acknowledge that the evidence is insufficient.`)
    }
    signalId = newId("sig")
    exec(
      db,
      `INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, ai_note, ai_quotes, ai_criteria, suggested_level, graded_source, status, analyzed_at)
       VALUES (?, ?, ?, ?, 0, ?, '[]', '[]', 'Insufficient', 'offline', 'Pending Verification', ?)`,
      signalId, p.id, studentId, skill, `No ${skill} evidence was found in the submitted evidence.`, now,
    )
  } else {
    signalId = String(existing.id)
    if (decision === "insufficient" && existing.suggested_level !== "Insufficient") {
      throw new ApiError(409, `WSL found ${skill} evidence in ${subject.name}'s work, so decide on that evidence: verify it, ask for more, or decline to verify it.`)
    }
  }

  if (decision === "verify") {
    const suggestedLevel = oneOf(body.suggestedLevel, SUGGESTED_LEVELS, "suggested level", "")
    exec(
      db,
      `UPDATE skill_signals SET status = 'Verified', verified_by = ?, verified_at = ?, reviewer_notes = ?
       ${suggestedLevel ? ", suggested_level = ?" : ""} WHERE id = ?`,
      ...(suggestedLevel ? [mentor.id, now, reviewerNotes || null, suggestedLevel, signalId] : [mentor.id, now, reviewerNotes || null, signalId]),
    )
  } else {
    const status: SkillSignalStatus = decision === "reject" ? "Rejected" : decision === "insufficient" ? "Insufficient Evidence" : "More Evidence Requested"
    exec(db, "UPDATE skill_signals SET status = ?, verified_by = ?, verified_at = ?, reviewer_notes = ? WHERE id = ?", status, mentor.id, now, reviewerNotes || null, signalId)
  }

  notify(
    db,
    "student",
    subject.id,
    decision === "verify"
      ? `"${skill}" verified`
      : decision === "reject"
        ? `"${skill}" not verified`
        : decision === "insufficient"
          ? `"${skill}": insufficient evidence so far`
          : `More evidence requested for "${skill}"`,
    decision === "insufficient"
      ? `${mentor.name} reviewed your evidence for “${p.challengeTitle}” and found nothing yet that demonstrates ${skill}. That is about what was submitted, not about you.`
      : `${mentor.name} reviewed your ${skill} evidence for “${p.challengeTitle}”.`,
    `/student/projects/${p.id}`,
  )
  // First mentor touch moves the project from "evidence is sitting there" to
  // "actively being worked through" — it does not itself finish the review;
  // only an explicit /confirm (once every student's every skill has a current decision) does that.
  if (p.status === "In Progress" || p.status === "Evidence Under Review") {
    exec(db, "UPDATE projects SET status = 'Skills Pending Verification' WHERE id = ?", p.id)
    advanceIfFurther(db, p.challengeId, "Skills Pending Verification", `${mentor.name} began reviewing ${subject.name}'s skill signals.`)
  }
}

// Every validation message names the field and says what to do next. `key` tags the
// error with the form field it belongs to, so the client can show it inline.
function text(v: unknown, field: string, { required = false, max = 4000, key }: { required?: boolean; max?: number; key?: string } = {}): string {
  const s = typeof v === "string" ? v.trim() : ""
  if (required && !s) throw new ApiError(400, `${field} is required — fill it in and try again.`, key)
  if (s.length > max) throw new ApiError(400, `${field} is too long (${s.length} characters; the limit is ${max}). Shorten it and try again.`, key)
  return s
}

function textList(v: unknown, field: string, key?: string): string[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ApiError(400, `${field} must be a list of values.`, key)
  return v.map((x) => text(x, `Each item in ${field.toLowerCase()}`, { max: 300, key })).filter(Boolean).slice(0, 20)
}

function oneOf(v: unknown, allowed: string[], field: string, fallback: string): string {
  if (v === undefined || v === null || v === "") return fallback
  if (typeof v !== "string" || !allowed.includes(v)) {
    throw new ApiError(400, `“${String(v)}” isn't a valid ${field}. Choose one of: ${allowed.join(", ")}.`)
  }
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

/** What the evidence route reads before its transaction: a repository, a shared Google Doc, and/or an attached document. */
interface EvidencePrep {
  repo: RepoSnapshot | null
  doc: DocRead | null
  file: PreparedFile | null
}

/** Validates an attached file (sent as { name, data: base64 }) for the kind of evidence it belongs to, and extracts its text. */
async function prepareEvidenceUpload(type: string, raw: unknown): Promise<PreparedFile | null> {
  const rule = EVIDENCE_INPUT[type]
  if (raw === undefined || raw === null) return null
  if (!rule?.file) {
    throw new ApiError(400, `${evidenceTypeLabel(type)} evidence is ${rule?.link === "none" ? "written text" : "a link"}, not a file — remove the attachment.`, "file")
  }
  const f = raw as { name?: unknown; data?: unknown }
  if (typeof f !== "object" || typeof f.name !== "string" || typeof f.data !== "string") {
    throw new ApiError(400, "The attached file couldn't be read. Choose it again and try again.", "file")
  }
  const kind: Record<EvidenceFileKind, "evidence" | "notebook" | "presentation" | "image"> = { document: "evidence", notebook: "notebook", presentation: "presentation", image: "image" }
  try {
    return await prepareFile(kind[rule.file], f.name, Buffer.from(f.data, "base64"))
  } catch (err) {
    if (err instanceof UploadError) throw new ApiError(400, err.message, "file")
    throw err
  }
}

/** The student-side checks shared by adding evidence and requesting analysis. */
function requireEvidenceAccess(db: DatabaseSync, actor: Actor, projectId: string, action: string) {
  const student = requireRole(actor, "student")
  const p = projectContext(db, projectId)
  if (!isOnTeam(db, projectId, student.id)) throw new ApiError(403, `You can only ${action} projects you're on.`)
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

function parseCriteria(raw: unknown): SkillCriterion[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"))
    return Array.isArray(parsed) ? (parsed as SkillCriterion[]) : []
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
      const title = text(body.title, "Challenge title", { required: true, max: 160, key: "title" })
      const descriptionFile = files.find((f) => f.kind === "description")
      let problem = text(body.problemDescription, "Problem description", { required: !descriptionFile, key: "problemDescription" })
      if (!problem && descriptionFile) {
        if (descriptionFile.text.replace(/\s/g, "").length < 20) {
          throw new ApiError(
            400,
            `WSL couldn't read the text in “${descriptionFile.name}”, so add a short written description too — it's what students' work is matched against.`,
            "problemDescription",
          )
        }
        problem = summaryFromDocument(descriptionFile.text)
      }
      // Canonicalized once, here, so "python" and "Python" are never two different skills
      // across a student's record, a university's dashboard, or Talent Discovery search —
      // and deduped case-insensitively, in case a company typed the same skill twice.
      const rawSkills = textList(body.requiredSkills, "Required skills", "requiredSkills")
      const seenSkills = new Set<string>()
      const skills = rawSkills
        .map((s) => canonicalSkillName(s))
        .filter((s) => {
          const key = s.toLowerCase()
          if (seenSkills.has(key)) return false
          seenSkills.add(key)
          return true
        })
      // Skills are what every student's evidence is graded against, and outcomes are what the
      // challenge teaches — a challenge without either can't be assessed, so neither is ever
      // silently filled in with a placeholder. Required for drafts too: there's no draft
      // editor, so a draft saved without them could never be submitted.
      if (skills.length === 0) {
        throw new ApiError(400, "Add at least one required skill students will be assessed on, separated by commas (e.g. Python, SQL).", "requiredSkills")
      }
      const outcomes = textList(body.learningOutcomes, "Learning outcomes", "learningOutcomes")
      if (outcomes.length === 0) {
        throw new ApiError(400, "Add at least one learning outcome, one per line (e.g. Build and evaluate a forecasting model).", "learningOutcomes")
      }
      const preferred = typeof body.preferredUniversityId === "string" && body.preferredUniversityId ? body.preferredUniversityId : null
      if (preferred && !one(db, "SELECT id FROM universities WHERE id = ?", preferred)) {
        throw new ApiError(400, "That preferred university isn't on WSL — choose one from the list, or leave it unset.", "preferredUniversityId")
      }

      const contactId =
        typeof body.contactId === "string" && body.contactId
          ? body.contactId
          : String(one(db, "SELECT id FROM company_contacts WHERE company_id = ? ORDER BY is_primary DESC LIMIT 1", company.id)?.id ?? "")
      if (!one(db, "SELECT id FROM company_contacts WHERE id = ? AND company_id = ?", contactId, company.id)) {
        throw new ApiError(400, "Choose a contact person from your company — they review submissions and sign your feedback.", "contactId")
      }

      const deadlineRaw = text(body.deadline, "Deadline", { key: "deadline" })
      const deadline = deadlineRaw ? new Date(deadlineRaw) : new Date(Date.now() + 30 * 86_400_000)
      if (Number.isNaN(deadline.getTime())) throw new ApiError(400, "That deadline isn't a valid date — pick one from the date picker.", "deadline")
      if (deadline.getTime() < Date.now()) throw new ApiError(400, "The deadline has to be in the future — pick a later date, or leave it blank for 30 days from today.", "deadline")

      const companyRow = one(db, "SELECT name, industry FROM companies WHERE id = ?", company.id)!
      const industry = text(body.industry, "Industry", { max: 120 }) || String(companyRow.industry)
      const datasetAvailability = text(body.datasetAvailability, "Dataset availability", { max: 300 })
      // What the company expects handed back, how long it should take, and anything students must respect.
      const deliverables = text(body.deliverables, "Deliverables", { max: 1200, key: "deliverables" })
      const duration = text(body.duration, "Duration", { max: 80, key: "duration" })
      const constraintsNote = text(body.constraints, "Constraints", { max: 1200, key: "constraints" })

      // Screened whatever sensitivity level the company declared — "Low" is a claim, not a check.
      const findings = screenChallenge({
        fields: [
          { label: "Title", text: title },
          { label: "Problem description", text: text(body.problemDescription, "Problem description") },
          { label: "Required skills", text: skills.join(", ") },
          { label: "Learning outcomes", text: outcomes.join("\n") },
          { label: "Dataset availability", text: datasetAvailability },
          { label: "Industry", text: industry },
          { label: "Deliverables", text: deliverables },
          { label: "Constraints", text: constraintsNote },
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
          visibility, submission_requirements, status, created_at, submitted_at, duration, constraints_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, company.id, contactId, title, problem,
        JSON.stringify(outcomes),
        deliverables || "A working prototype or analysis plus a short report, as detailed in submission requirements.",
        industry,
        oneOf(body.difficulty, DIFFICULTIES, "difficulty", "Intermediate"),
        JSON.stringify(skills),
        JSON.stringify(outcomes),
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
        duration,
        constraintsNote,
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
      const existing = one(
        db,
        `SELECT pr.id FROM projects pr WHERE pr.challenge_id = ? AND (pr.student_id = ? OR EXISTS
           (SELECT 1 FROM project_members m WHERE m.project_id = pr.id AND m.student_id = ?))`,
        id, student.id, student.id,
      )
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
    pattern: /^\/projects\/([^/]+)\/members$/,
    // The student who started a project adds classmates to it. Teams stay inside one university so
    // there's a single university that can verify what each member did.
    handler: (db, actor, [id], body) => {
      const owner = requireRole(actor, "student")
      const p = projectContext(db, id)
      if (p.studentId !== owner.id) throw new ApiError(403, "Only the student who started the project can add teammates.")
      if (rank(p.status) >= rank("Verified")) throw new ApiError(409, "This project was already confirmed to the company, so its team is closed.")
      const mateId = text(body.studentId, "Teammate", { required: true, key: "studentId" })
      const mate = one(db, "SELECT id, name, university_id FROM students WHERE id = ?", mateId)
      if (!mate) throw new ApiError(400, "That student wasn't found. Choose a classmate from the list.", "studentId")
      if (String(mate.university_id) !== p.universityId) {
        throw new ApiError(400, "Teammates have to study at your university, so a single university can verify the whole team's work.", "studentId")
      }
      if (isOnTeam(db, id, mateId)) throw new ApiError(409, `${mate.name} is already on this team.`, "studentId")
      const elsewhere = one(
        db,
        `SELECT pr.id FROM projects pr WHERE pr.challenge_id = ? AND (pr.student_id = ? OR EXISTS
           (SELECT 1 FROM project_members m WHERE m.project_id = pr.id AND m.student_id = ?))`,
        p.challengeId, mateId, mateId,
      )
      if (elsewhere) throw new ApiError(409, `${mate.name} is already working on this challenge in another project.`, "studentId")
      if (teamIds(db, id).length >= MAX_TEAM_SIZE) throw new ApiError(409, `A team can have up to ${MAX_TEAM_SIZE} students.`, "studentId")
      exec(db, "INSERT INTO project_members (project_id, student_id, role_note, added_at) VALUES (?, ?, '', ?)", id, mateId, nowIso())
      notify(db, "student", mateId, "You were added to a team project", `${p.studentName} added you to “${p.challengeTitle}”. Record what you're contributing, then submit your own evidence.`, `/student/projects/${id}`)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/members\/([^/]+)\/remove$/,
    // The owner removes a teammate, or a teammate leaves. Someone who has already submitted evidence
    // stays: their work and any review of it belong to the project's record.
    handler: (db, actor, [id, mateId]) => {
      const student = requireRole(actor, "student")
      const p = projectContext(db, id)
      if (mateId === p.studentId) throw new ApiError(400, "The student who started the project can't be removed from it.")
      if (student.id !== p.studentId && student.id !== mateId) throw new ApiError(403, "Only the project owner, or the teammate themselves, can remove a teammate.")
      if (!isProjectMember(db, id, mateId)) throw new ApiError(404, "That student isn't a teammate on this project.")
      if (rank(p.status) >= rank("Verified")) throw new ApiError(409, "This project was already confirmed to the company, so its team is closed.")
      if (one(db, "SELECT 1 FROM evidence WHERE project_id = ? AND student_id = ?", id, mateId) || one(db, "SELECT 1 FROM skill_signals WHERE project_id = ? AND student_id = ?", id, mateId)) {
        throw new ApiError(409, "This teammate has already submitted evidence on the project, so they can't be removed.")
      }
      exec(db, "DELETE FROM project_members WHERE project_id = ? AND student_id = ?", id, mateId)
      if (student.id !== mateId) notify(db, "student", mateId, "You were removed from a team project", `${p.studentName} removed you from “${p.challengeTitle}”.`, null)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/contribution$/,
    // Each team member says, in their own words, what they contributed. It is a claim for the
    // reviewer to check against that student's evidence, never proof in itself.
    handler: (db, actor, [id], body) => {
      const { student } = requireEvidenceAccess(db, actor, id, "record a contribution on")
      const contribution = text(body.text, "Your contribution", { required: true, max: 400, key: "text" })
      if (contribution.length < 10) {
        throw new ApiError(400, "Describe what you contributed in a sentence or two (at least 10 characters) — for example “Database design and SQL analysis.”", "text")
      }
      if (one(db, "SELECT 1 FROM projects WHERE id = ? AND student_id = ?", id, student.id)) {
        exec(db, "UPDATE projects SET owner_role_note = ? WHERE id = ?", contribution, id)
      } else {
        exec(db, "UPDATE project_members SET role_note = ? WHERE project_id = ? AND student_id = ?", contribution, id, student.id)
      }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/evidence$/,
    // Everything slow or async happens before the transaction: a GitHub repository or a shared
    // Google Doc is read, and an attached file has its text extracted, so it can be analyzed.
    prepare: async (actor, body, [id]): Promise<EvidencePrep> => {
      requireEvidenceAccess(getDb(), actor, id, "add evidence to")
      const type = typeof body.type === "string" ? body.type : ""
      const link = typeof body.link === "string" ? body.link : ""
      const reads = type === "GitHub Repository" || type === "Notebook"
      const googleDoc = type === "Documentation" || type === "Project Report"
      return {
        repo: reads && parseGithubLink(link) ? await readGithubRepo(link) : null,
        doc: googleDoc && parseGoogleDocLink(link) ? await readGoogleDoc(link) : null,
        file: EVIDENCE_INPUT[type] ? await prepareEvidenceUpload(type, body.file) : null,
      }
    },
    handler: (db, actor, [id], body, prep: EvidencePrep) => {
      const { repo, doc, file } = prep
      const { p, student } = requireEvidenceAccess(db, actor, id, "add evidence to")
      const evType = SUBMITTABLE_EVIDENCE_TYPES.find((t) => t === body.type)
      if (!evType) throw new ApiError(400, `Choose what kind of evidence this is (${SUBMITTABLE_EVIDENCE_TYPES.map(evidenceTypeLabel).join(", ")}) and try again.`, "type")
      const rule = EVIDENCE_INPUT[evType]
      const label = evidenceTypeLabel(evType)
      const title = text(body.title, "Title", { required: true, max: 200, key: "title" })

      // A contribution statement is the student's own account of what they did. It is kept for the
      // reviewer next to the student's real work, and is never analyzed as if it were that work.
      if (evType === "Contribution Statement") {
        const statement = text(body.content, "Contribution statement", { required: true, max: 1500, key: "content" })
        if (statement.length < 20) throw new ApiError(400, "Write a few sentences about what you contributed (at least 20 characters), then submit again.", "content")
        exec(
          db,
          "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, fetched_content, fetched_from, submitted_at) VALUES (?, ?, ?, ?, ?, '', '', ?, NULL, NULL, ?)",
          newId("ev"), id, student.id, evType, title, statement, nowIso(),
        )
        return null
      }

      const isRepo = evType === "GitHub Repository"
      const link = rule.link === "none" ? "" : text(body.link, isRepo ? "Repository link" : "Link", { required: rule.link === "required", max: 500, key: "link" })
      if (rule.link === "either" && !link && !file) {
        throw new ApiError(400, `Add a link to your ${label.toLowerCase()} or attach the file itself, then submit again.`, "link")
      }
      if (rule.file === "image" && !file) throw new ApiError(400, "Attach the screenshot (PNG, JPG or WebP), then submit again.", "file")
      if (isRepo && !parseGithubLink(link)) {
        throw new ApiError(400, "That isn't a GitHub repository link. Use the repository's address, like https://github.com/owner/repo, and try again.", "link")
      }
      if (!isRepo && link && (/\s/.test(link) || !/\.[a-z]{2,}/i.test(link))) {
        throw new ApiError(400, "Link must be a web address your mentor can open, like https://docs.google.com/document/… — check it and try again.", "link")
      }
      // A caption describes a video or screenshot for the reviewer; it is not analyzed as work. An excerpt is.
      const note = text(body.content, rule.text === "caption" ? "Caption" : "Excerpt", { max: rule.text === "caption" ? 300 : 20000, key: "content" })
      const caption = rule.text === "caption" ? note : ""
      const content = rule.text === "excerpt" ? note || null : null

      // What WSL read from the work itself, beyond anything pasted: repository files, an attached
      // file's text, or a shared Google Doc's text.
      const docText = doc?.ok ? doc.text : null
      const fromRepo = isRepo || evType === "Notebook" ? repo : null
      const readText = fromRepo ? fromRepo.text : [file?.text, docText].filter(Boolean).join("\n\n").slice(0, 20_000) || undefined
      const readFrom = fromRepo ? fromRepo.files : ([file && file.text ? file.name : null, docText ? "Google Doc" : null].filter(Boolean) as string[])
      const analyzable = rule.text === "excerpt"
      const readable = Boolean(content) || (readText ?? "").replace(/\s/g, "").length >= 20

      let notice: string | undefined
      if (isRepo && !repo) {
        // A repository WSL can't read (private, misspelled, deleted, or GitHub's rate limit)
        // would otherwise be accepted as "evidence" with nothing in it to analyze.
        if (!content) {
          throw new ApiError(
            400,
            "WSL could not read this repository — it may be private, misspelled, or GitHub's rate limit was reached. Paste a representative excerpt (a key file or section) so WSL can analyze it, then submit again.",
            "content",
          )
        }
        notice = "WSL could not read this repository, so only your pasted excerpt will be analyzed."
      } else if (analyzable && !readable) {
        // Saved anyway — the reviewer can open the link or download the file — but say why nothing was analyzed.
        if (file) notice = `${file.unreadable ?? "WSL couldn't read any text in this file."} It's attached for your reviewer, but WSL couldn't analyze it.`
        else if (parseGoogleDocLink(link)) {
          notice = `${DOC_PROBLEM_MESSAGE[doc && !doc.ok ? doc.problem : "not-shared"]} Meanwhile it's linked for your reviewer.`
        } else notice = `WSL can read GitHub repositories and shared Google Docs. This ${label.toLowerCase()} link is saved for your reviewer; paste an excerpt or attach the file to have it analyzed.`
      } else if (file?.unreadable && analyzable) {
        notice = file.unreadable
      }

      if (analyzable) {
        const checkText = [title, content, readText].filter(Boolean).join(". ")
        const relevance = checkRelevance(challengeContextFor(db, p.challengeId), checkText)
        const where = content ? "content" : file ? "file" : "link"
        if (!relevance.relevant && relevance.reason === "echoes-brief") {
          throw new ApiError(
            400,
            `Most of this submission repeats the “${p.challengeTitle}” brief back (${relevance.echoPct}% of its phrases come from the challenge). WSL only counts work you produced, so submit your own code, analysis or write-up.`,
            where,
          )
        }
        if (!relevance.relevant) {
          throw new ApiError(
            400,
            `This doesn't look like it addresses “${p.challengeTitle}” — WSL found almost no overlap (${relevance.overlapPct}%) between what you submitted and the challenge's stated problem. Check you picked the right project, then submit the code or write-up you made for this challenge.`,
            where,
          )
        }
      }

      const evidenceId = newId("ev")
      exec(
        db,
        "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, fetched_content, fetched_from, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        evidenceId, id, student.id, evType, title, caption, link, content, readText ?? null, readFrom && readFrom.length > 0 ? JSON.stringify(readFrom) : null, nowIso(),
      )
      if (file) {
        db.prepare("INSERT INTO evidence_files (evidence_id, name, mime, size, data) VALUES (?, ?, ?, ?, ?)").run(evidenceId, file.name, file.mime, file.data.length, file.data)
      }
      return notice ? { notice } : null
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/evidence\/([^/]+)\/reread$/,
    // For a Google Doc WSL couldn't open when it was added (usually because it wasn't shared yet):
    // read it again after the student fixes the sharing, without adding the evidence a second time.
    prepare: async (actor, _body, [id, evidenceId]): Promise<DocRead> => {
      const db = getDb()
      requireEvidenceAccess(db, actor, id, "re-read evidence on")
      const me = requireRole(actor, "student")
      const row = one(db, "SELECT link, type FROM evidence WHERE id = ? AND project_id = ? AND student_id = ?", evidenceId, id, me.id)
      if (!row) throw new ApiError(404, "That evidence item wasn't found among your evidence on this project.")
      if ((row.type !== "Documentation" && row.type !== "Project Report") || !parseGoogleDocLink(String(row.link))) {
        throw new ApiError(400, "Only a Google Docs link can be read again. For anything else, add the content as an excerpt or attach the file.")
      }
      return readGoogleDoc(String(row.link))
    },
    handler: (db, actor, [id, evidenceId], _body, doc: DocRead) => {
      const { p } = requireEvidenceAccess(db, actor, id, "re-read evidence on")
      const row = one(db, "SELECT title, content FROM evidence WHERE id = ? AND project_id = ? AND student_id = ?", evidenceId, id, requireRole(actor, "student").id)
      if (!row) throw new ApiError(404, "That evidence item wasn't found among your evidence on this project.")
      if (one(db, "SELECT 1 FROM evidence_files WHERE evidence_id = ?", evidenceId)) {
        throw new ApiError(400, "This item already has an attached file, which WSL has read. Add the Google Doc as its own evidence item to have it read too.")
      }
      if (!doc.ok) return { read: false, notice: DOC_PROBLEM_MESSAGE[doc.problem] }

      // The same gate as when evidence is first added: a document that just repeats the brief, or has
      // nothing to do with the challenge, doesn't become evidence because it can now be read.
      const relevance = checkRelevance(challengeContextFor(db, p.challengeId), [String(row.title), row.content, doc.text].filter(Boolean).join(". "))
      if (!relevance.relevant && relevance.reason === "echoes-brief") {
        throw new ApiError(400, `Most of this document repeats the “${p.challengeTitle}” brief back (${relevance.echoPct}% of its phrases come from the challenge). WSL only counts work you produced.`, "link")
      }
      if (!relevance.relevant) {
        throw new ApiError(400, `This document doesn't look like it addresses “${p.challengeTitle}” — WSL found almost no overlap (${relevance.overlapPct}%) with the challenge's stated problem.`, "link")
      }
      exec(db, "UPDATE evidence SET fetched_content = ?, fetched_from = ? WHERE id = ?", doc.text, JSON.stringify(["Google Doc"]), evidenceId)
      return { read: true, notice: "WSL can now read this Google Doc. Re-analyze to include it." }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/ai-review$/,
    // Analysis is per student: it reads only the evidence the calling student submitted, so a
    // teammate's work never becomes part of anyone else's skills. Grading calls a model, so it runs
    // before the database transaction; the handler only saves the results. If the student's
    // evidence is unchanged since their last analysis (same content, same required skills, same
    // model), the model is never called at all.
    prepare: async (actor, _body, [id]) => {
      const db = getDb()
      const { p, student } = requireEvidenceAccess(db, actor, id, "request analysis for")
      if (!one(db, "SELECT 1 FROM evidence WHERE project_id = ? AND student_id = ?", id, student.id)) throw new ApiError(409, "Submit at least one piece of evidence first.")
      // A contribution statement is a claim, not work: it is shown to the reviewer, not analyzed.
      const ev = analyzableEvidenceOf(db, id, student.id)
      const skills = parseList(one(db, "SELECT required_skills FROM challenges WHERE id = ?", p.challengeId)!.required_skills)
      const model = currentGradingModel()
      const hash = hashEvidenceSet(skills, ev, model)
      const run = one(db, "SELECT evidence_hash, model, graded_at FROM analysis_runs WHERE project_id = ? AND student_id = ?", id, student.id)
      if (run && run.evidence_hash === hash && run.model === model) {
        return { unchanged: true as const, model, hash, gradedAt: String(run.graded_at) }
      }
      // Re-analyzing recomputes every required skill against ALL of this student's current evidence
      // and overwrites their prior results, so evidence added later is always picked up.
      const result = ev.length === 0 ? { results: noEvidenceResults(skills), failed: false } : await analyzeEvidence(skills, ev, challengeContextFor(db, p.challengeId))
      return { unchanged: false as const, model, hash, ...result }
    },
    handler: (
      db,
      actor,
      [id],
      _body,
      prepared: { unchanged: true; model: string; hash: string; gradedAt: string } | { unchanged: false; model: string; hash: string; results: SimulatedRating[]; failed: boolean },
    ) => {
      const { p, student } = requireEvidenceAccess(db, actor, id, "request analysis for")
      if (prepared.unchanged) return { unchanged: true, model: prepared.model, gradedAt: prepared.gradedAt }

      const now = nowIso()
      for (const r of prepared.results) {
        const existing = one(db, "SELECT id, status, graded_source FROM skill_signals WHERE project_id = ? AND student_id = ? AND skill = ?", id, student.id, r.skill)
        // A mentor's decision is durable — new evidence never silently re-scores a
        // skill the mentor already verified out from under them.
        if (existing && existing.status === "Verified") continue
        // The model failing this run must never downgrade a skill it already graded
        // before — keep that result untouched rather than overwrite it with a weaker
        // offline estimate. A skill with no prior model-graded result still gets the
        // offline estimate, clearly labeled by graded_source for the UI.
        if (existing && existing.graded_source === "model" && r.source === "offline" && prepared.failed) continue
        const sigId = existing ? String(existing.id) : newId("sig")
        if (existing) {
          exec(db, "DELETE FROM skill_signal_evidence WHERE signal_id = ?", sigId)
          exec(
            db,
            "UPDATE skill_signals SET evidence_confidence = ?, ai_note = ?, ai_quotes = ?, ai_criteria = ?, suggested_level = ?, graded_source = ?, status = 'Pending Verification', analyzed_at = ? WHERE id = ?",
            r.rating, r.note, JSON.stringify(r.quotes), JSON.stringify(r.criteria), r.suggestedLevel, r.source, now, sigId,
          )
        } else {
          exec(
            db,
            "INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, ai_note, ai_quotes, ai_criteria, suggested_level, graded_source, status, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification', ?)",
            sigId, id, student.id, r.skill, r.rating, r.note, JSON.stringify(r.quotes), JSON.stringify(r.criteria), r.suggestedLevel, r.source, now,
          )
        }
        for (const evId of r.evidenceIds) exec(db, "INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, ?)", sigId, evId)
      }
      // A failed model call is not a stable, cacheable outcome — leave the cache alone so the
      // next re-analysis attempt can reach the model again instead of being short-circuited.
      if (!prepared.failed) {
        exec(
          db,
          `INSERT INTO analysis_runs (project_id, student_id, evidence_hash, model, graded_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (project_id, student_id) DO UPDATE SET evidence_hash = excluded.evidence_hash, model = excluded.model, graded_at = excluded.graded_at`,
          id, student.id, prepared.hash, prepared.model, now,
        )
      }
      const who = studentRow(db, student.id).name
      if (p.status === "In Progress") {
        exec(db, "UPDATE projects SET status = 'Evidence Under Review' WHERE id = ?", id)
        notify(db, "university", p.universityId, "Evidence ready for review", `WSL analyzed ${who}'s evidence for “${p.challengeTitle}”.`, `/university/projects/${id}`)
      }
      advanceIfFurther(db, p.challengeId, "Evidence Under Review", `WSL analyzed ${who}'s submitted evidence automatically.`)
      if (prepared.failed) {
        const row = one(db, "SELECT model, graded_at FROM analysis_runs WHERE project_id = ? AND student_id = ?", id, student.id)
        return { unchanged: false, failed: true, model: row?.model ?? null, gradedAt: row?.graded_at ?? null }
      }
      return { unchanged: false, failed: false, model: prepared.model, gradedAt: now }
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/signals\/([^/]+)\/review$/,
    handler: (db, actor, [id, signalId], body) => {
      const uni = requireRole(actor, "university")
      const p = projectContext(db, id)
      if (p.universityId !== uni.id) throw new ApiError(403, "You can only review your own students' work.")
      // The signal must belong to THIS project: its student and skill, not the caller's say-so, decide what is reviewed.
      const signal = one(db, "SELECT student_id, skill FROM skill_signals WHERE id = ? AND project_id = ?", signalId, id)
      if (!signal) throw new ApiError(404, "Skill signal not found.")
      decideSkill(db, uni.id, p, String(signal.student_id), String(signal.skill), body)
    },
  },
  {
    method: "POST",
    // For a required skill that has no signal yet — nothing was analyzed, or the student submitted nothing
    // WSL reads. It still needs an explicit decision before the project can be confirmed.
    pattern: /^\/projects\/([^/]+)\/students\/([^/]+)\/skills\/([^/]+)\/review$/,
    handler: (db, actor, [id, studentId, skill], body) => {
      const uni = requireRole(actor, "university")
      const p = projectContext(db, id)
      if (p.universityId !== uni.id) throw new ApiError(403, "You can only review your own students' work.")
      if (!isOnTeam(db, id, studentId)) throw new ApiError(404, "That student isn't on this project.")
      const required = parseList(one(db, "SELECT required_skills FROM challenges WHERE id = ?", p.challengeId)!.required_skills)
      if (!required.includes(skill)) throw new ApiError(404, `“${skill}” isn't one of this challenge's required skills.`)
      decideSkill(db, uni.id, p, studentId, skill, body)
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
      // Server-side, every time: every team member x every required skill has a current, explicit decision.
      const review = reviewReadiness(db, id)
      if (!review.ready) throw new ApiError(409, reviewBlockers(db, review))
      // "Verified" is only ever the label for a project where every skill of every student was verified;
      // any Not Verified or acknowledged-insufficient skill makes it "Completed" — reviewed, with a mixed result.
      const finalStatus: ChallengeStatus = review.items.every((i) => i.state === "verified") ? "Verified" : "Completed"
      const mentor = coordinatorFor(db, p.programId)
      const note = text(body.note, "Note", { max: 1000 }) || `Reviewed and confirmed to ${p.companyName}.`
      exec(db, "INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, 'staff', ?, ?, ?)", newId("fb"), id, mentor.id, note, nowIso())
      exec(db, "UPDATE projects SET status = ? WHERE id = ?", finalStatus, id)
      advanceIfFurther(db, p.challengeId, finalStatus, `Reviewed by ${mentor.name} and confirmed to ${p.companyName}.`)
      notify(db, "company", p.companyId, "Evidence ready for your review", `${p.universityName} shared verified evidence for ${p.studentName}'s work on “${p.challengeTitle}”.`, `/company/submissions/${id}`)
      for (const memberId of teamIds(db, id)) {
        notify(db, "student", memberId, `Evidence confirmed to ${p.companyName}`, `${mentor.name} confirmed your team's evidence for “${p.challengeTitle}”.`, `/student/projects/${id}`)
      }
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

function sendAttachment(res: ServerResponse, file: Record<string, unknown>) {
  const name = String(file.name)
  res.statusCode = 200
  res.setHeader("Content-Type", String(file.mime))
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "no-store")
  res.end(Buffer.from(file.data as Uint8Array))
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

  if (req.method === "GET" && path === "/health") {
    const provider = configuredProvider()
    const health = provider ? await checkProviderHealth(provider) : { ok: false, message: "No GROQ_API_KEY or GEMINI_API_KEY configured — using the offline scorer." }
    send(res, 200, { provider: provider?.id ?? null, model: provider?.model ?? "offline", keyWorks: health.ok, message: health.message, lastGrading: lastGradingOutcome() })
    return true
  }

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
      sendAttachment(res, file)
      return true
    }

    // A student's attached document: readable by whoever can read that project's evidence.
    const evidenceFileMatch = req.method === "GET" ? /^\/evidence\/([^/]+)\/file$/.exec(path) : null
    if (evidenceFileMatch) {
      const file = one(
        db,
        "SELECT e.project_id, f.name, f.mime, f.data FROM evidence_files f JOIN evidence e ON e.id = f.evidence_id WHERE f.evidence_id = ?",
        decodeURIComponent(evidenceFileMatch[1]),
      )
      if (!file) throw new ApiError(404, "File not found.")
      const evidenceId = decodeURIComponent(evidenceFileMatch[1])
      const owner = one(db, "SELECT student_id FROM evidence WHERE id = ?", evidenceId)
      const readable = evidenceReadableBy(
        actor,
        visibleProjectIds(db, actor),
        { id: evidenceId, projectId: String(file.project_id), studentId: String(owner?.student_id ?? "") },
        actor.role === "company" ? verifiedEvidenceIds(db) : new Set<string>(),
      )
      if (!readable) throw new ApiError(403, "You don't have access to this file.")
      sendAttachment(res, file)
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
    if (err instanceof ApiError) send(res, err.status, { error: err.message, ...(err.field ? { field: err.field } : {}) })
    else {
      console.error("[wsl-api]", err)
      send(res, 500, { error: "Something went wrong on the server." })
    }
  }
  return true
}
