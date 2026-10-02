import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { DatabaseSync } from "node:sqlite"
import { getDb, resetDatabase, transaction } from "./db.ts"
import { simulateAIReview } from "./ai.ts"
import type {
  AppNotification,
  Challenge,
  ChallengeStatus,
  CompanyContact,
  Evidence,
  EvidenceType,
  FeedbackEntry,
  Opportunity,
  Organization,
  Program,
  Project,
  SkillSignal,
  Snapshot,
  Staff,
  Student,
  University,
} from "../src/types.ts"

// ---------------------------------------------------------------- shared rules

const PIPELINE_ORDER: ChallengeStatus[] = [
  "Draft",
  "Sent to University",
  "University Assigned",
  "In Progress",
  "Submissions Under Review",
  "Confirmed to Company",
  "Company Reviewed",
]
const rank = (s: string) => PIPELINE_ORDER.indexOf(s as ChallengeStatus)

const SCREEN_NOTE = "WSL automatically screened this challenge for private or confidential data — none found."
const EVIDENCE_TYPES: EvidenceType[] = [
  "Project Report", "GitHub Repository", "Code", "Presentation", "Prototype",
  "Documentation", "Analysis", "Dataset / Model", "Video Walkthrough",
]
const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"]
const SENSITIVITIES = ["None (Public Dataset)", "Low", "Moderate", "High (NDA Required)"]
const VISIBILITIES = ["Public", "University Only", "Restricted"]
const AVAILABILITIES = ["Open to Opportunities", "Not Available", "Open to Internships"]

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

function buildSnapshot(db: DatabaseSync, actor: Actor): Snapshot {
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
    "SELECT s.*, p.major FROM students s JOIN programs p ON p.id = s.program_id ORDER BY s.name",
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
  const projects: Project[] = all(
    db,
    `SELECT pr.*, c.title AS challenge_title, c.company_id
     FROM projects pr JOIN challenges c ON c.id = pr.challenge_id
     ORDER BY pr.started_at DESC`,
  ).map((r) => ({
    id: String(r.id),
    challengeId: String(r.challenge_id),
    title: String(r.challenge_title),
    organizationId: String(r.company_id),
    studentId: String(r.student_id),
    status: r.status as ChallengeStatus,
    startedAt: String(r.started_at),
    tasks: taskRows.filter((t) => t.project_id === r.id).map((t) => ({ id: String(t.id), title: String(t.title), done: Number(t.done) === 1 })),
    feedback: feedbackRows
      .filter((f) => f.project_id === r.id)
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
  }))

  const evidence: Evidence[] = all(db, "SELECT * FROM evidence ORDER BY submitted_at DESC").map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    studentId: String(r.student_id),
    type: r.type as EvidenceType,
    title: String(r.title),
    description: String(r.description),
    link: String(r.link),
    ...(r.content ? { content: String(r.content) } : {}),
    submittedAt: String(r.submitted_at),
  }))

  const signalEvidence = all(db, "SELECT * FROM skill_signal_evidence")
  const skillSignals: SkillSignal[] = all(db, "SELECT * FROM skill_signals ORDER BY analyzed_at DESC").map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    studentId: String(r.student_id),
    skill: String(r.skill),
    aiRating: Number(r.ai_rating),
    aiNote: String(r.ai_note ?? ""),
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

  return { universities, staff, organizations, contacts, students, challenges, projects, evidence, skillSignals, opportunities, notifications }
}

// --------------------------------------------------------------------- helpers

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

/** The faculty member who mentors the student's program. */
function coordinatorFor(db: DatabaseSync, programId: string) {
  const row = one(db, "SELECT st.id, st.name FROM programs p JOIN staff st ON st.id = p.coordinator_id WHERE p.id = ?", programId)
  if (!row) throw new ApiError(500, "This program has no coordinator on record.")
  return { id: String(row.id), name: String(row.name) }
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
type Handler = (db: DatabaseSync, actor: Actor, params: string[], body: Body) => unknown

const routes: { method: string; pattern: RegExp; handler: Handler }[] = [
  {
    method: "POST",
    pattern: /^\/challenges$/,
    handler: (db, actor, _p, body) => {
      const company = requireRole(actor, "company")
      const title = text(body.title, "Title", { required: true, max: 160 })
      const problem = text(body.problemDescription, "Problem description", { required: true })
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

      const companyRow = one(db, "SELECT industry FROM companies WHERE id = ?", company.id)!
      const asDraft = body.asDraft === true
      const id = newId("chal")
      const now = nowIso()
      exec(
        db,
        `INSERT INTO challenges (id, company_id, contact_id, title, problem_description, objectives, expected_output, industry, difficulty,
          required_skills, learning_outcomes, dataset_availability, data_sensitivity, deadline, preferred_university_id, visibility,
          submission_requirements, status, created_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, company.id, contactId, title, problem,
        JSON.stringify(outcomes.length ? outcomes : ["Explore the problem", "Prototype a solution", "Present findings"]),
        "A working prototype or analysis plus a short report, as detailed in submission requirements.",
        text(body.industry, "Industry", { max: 120 }) || String(companyRow.industry),
        oneOf(body.difficulty, DIFFICULTIES, "difficulty", "Intermediate"),
        JSON.stringify(skills.length ? skills : ["Problem Solving"]),
        JSON.stringify(outcomes.length ? outcomes : ["Apply classroom concepts to a real operational problem"]),
        text(body.datasetAvailability, "Dataset availability", { max: 300 }) || "To be confirmed during WSL's automatic screening.",
        oneOf(body.dataSensitivity, SENSITIVITIES, "data sensitivity", "Low"),
        deadline.toISOString(),
        preferred,
        oneOf(body.visibility, VISIBILITIES, "visibility", "Public"),
        JSON.stringify(["Project report", "GitHub repository", "Presentation"]),
        asDraft ? "Draft" : "Sent to University",
        now,
        asDraft ? null : now,
      )
      exec(db, "INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, 'Draft', ?, NULL)", id, now)
      if (!asDraft) {
        exec(db, "INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, 'Sent to University', ?, ?)", id, now, SCREEN_NOTE)
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
      const c = one(db, "SELECT status, deadline FROM challenges WHERE id = ? AND company_id = ?", id, company.id)
      if (!c) throw new ApiError(404, "Challenge not found.")
      if (c.status !== "Draft") throw new ApiError(409, "Only drafts can be submitted.")
      if (new Date(String(c.deadline)).getTime() < Date.now()) throw new ApiError(409, "This draft's deadline has already passed.")
      exec(db, "UPDATE challenges SET submitted_at = ? WHERE id = ?", nowIso(), id)
      pushHistory(db, id, "Sent to University", SCREEN_NOTE)
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
    handler: (db, actor, [id], body) => {
      const student = requireRole(actor, "student")
      const p = projectContext(db, id)
      if (p.studentId !== student.id) throw new ApiError(403, "You can only add evidence to your own projects.")
      if (rank(p.status) >= rank("Confirmed to Company")) throw new ApiError(409, "This submission was already confirmed to the company.")
      const evType = oneOf(body.type, EVIDENCE_TYPES, "evidence type", "")
      if (!evType) throw new ApiError(400, "Evidence type is required.")
      exec(
        db,
        "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        newId("ev"), id, student.id, evType,
        text(body.title, "Title", { required: true, max: 200 }),
        text(body.description, "Description", { max: 1000 }),
        text(body.link, "Link", { required: true, max: 500 }),
        text(body.content, "Content", { max: 20000 }) || null,
        nowIso(),
      )
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/ai-review$/,
    handler: (db, actor, [id]) => {
      const student = requireRole(actor, "student")
      const p = projectContext(db, id)
      if (p.studentId !== student.id) throw new ApiError(403, "You can only request a rating for your own projects.")
      if (rank(p.status) >= rank("Confirmed to Company")) throw new ApiError(409, "This submission was already confirmed to the company.")
      const ev = all(db, "SELECT * FROM evidence WHERE project_id = ? ORDER BY submitted_at", id).map((r) => ({
        id: String(r.id),
        projectId: id,
        studentId: student.id,
        type: r.type as EvidenceType,
        title: String(r.title),
        description: String(r.description),
        link: String(r.link),
        ...(r.content ? { content: String(r.content) } : {}),
        submittedAt: String(r.submitted_at),
      }))
      if (ev.length === 0) throw new ApiError(409, "Submit at least one piece of evidence first.")

      const skills = parseList(one(db, "SELECT required_skills FROM challenges WHERE id = ?", p.challengeId)!.required_skills)
      const rated = new Set(all(db, "SELECT skill FROM skill_signals WHERE project_id = ?", id).map((r) => String(r.skill)))
      const results = simulateAIReview(skills, ev).filter((r) => !rated.has(r.skill))
      const now = nowIso()
      for (const r of results) {
        const sigId = newId("sig")
        exec(db, "INSERT INTO skill_signals (id, project_id, student_id, skill, ai_rating, ai_note, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?)", sigId, id, student.id, r.skill, r.rating, r.note, now)
        for (const evId of r.evidenceIds) exec(db, "INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, ?)", sigId, evId)
      }
      if (p.status === "In Progress") {
        exec(db, "UPDATE projects SET status = 'Submissions Under Review' WHERE id = ?", id)
        notify(db, "university", p.universityId, "Submission awaiting confirmation", `WSL rated ${p.studentName}'s evidence for “${p.challengeTitle}”.`, `/university/projects/${id}`)
      }
      advanceIfFurther(db, p.challengeId, "Submissions Under Review", `WSL rated ${p.studentName}'s submitted evidence automatically.`)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/confirm$/,
    handler: (db, actor, [id], body) => {
      const uni = requireRole(actor, "university")
      const p = projectContext(db, id)
      if (p.universityId !== uni.id) throw new ApiError(403, "You can only confirm your own students' work.")
      if (p.status !== "Submissions Under Review") throw new ApiError(409, "This submission isn't awaiting confirmation.")
      const mentor = coordinatorFor(db, p.programId)
      const note = text(body.note, "Note", { max: 1000 }) || `Reviewed and confirmed to ${p.companyName}.`
      exec(db, "INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, 'staff', ?, ?, ?)", newId("fb"), id, mentor.id, note, nowIso())
      exec(db, "UPDATE projects SET status = 'Confirmed to Company' WHERE id = ?", id)
      advanceIfFurther(db, p.challengeId, "Confirmed to Company", `Reviewed by ${mentor.name} and confirmed to ${p.companyName}.`)
      notify(db, "company", p.companyId, "Submission ready for your review", `${p.universityName} confirmed ${p.studentName}'s submission for “${p.challengeTitle}”.`, `/company/submissions/${id}`)
      notify(db, "student", p.studentId, `Submission confirmed to ${p.companyName}`, `${mentor.name} confirmed your submission for “${p.challengeTitle}”.`, `/student/projects/${id}`)
    },
  },
  {
    method: "POST",
    pattern: /^\/projects\/([^/]+)\/company-review$/,
    handler: (db, actor, [id], body) => {
      const company = requireRole(actor, "company")
      const p = projectContext(db, id)
      if (p.companyId !== company.id) throw new ApiError(403, "You can only review submissions to your own challenges.")
      if (p.status !== "Confirmed to Company") throw new ApiError(409, "This submission isn't awaiting your review.")
      const ratings = (body.ratings ?? {}) as Record<string, unknown>
      const signals = all(db, "SELECT id FROM skill_signals WHERE project_id = ?", id).map((r) => String(r.id))
      if (signals.length === 0) throw new ApiError(409, "There are no rated skills to review.")
      const now = nowIso()
      for (const sigId of signals) {
        const v = Number(ratings[sigId])
        if (!Number.isInteger(v) || v < 0 || v > 100) throw new ApiError(400, "Give every skill a rating between 0 and 100.")
        exec(db, "UPDATE skill_signals SET company_rating = ?, company_rated_at = ? WHERE id = ?", v, now, sigId)
      }
      const note = text(body.note, "Feedback", { max: 2000 })
      if (note) exec(db, "INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, 'contact', ?, ?, ?)", newId("fb"), id, p.contactId, note, now)
      exec(db, "UPDATE projects SET status = 'Company Reviewed' WHERE id = ?", id)
      advanceIfFurther(db, p.challengeId, "Company Reviewed", `${p.companyName} reviewed the submission and gave its own rating.`)
      notify(db, "student", p.studentId, `${p.companyName} rated your work`, `Your submission for “${p.challengeTitle}” received company ratings${note ? " and feedback" : ""}.`, `/student/projects/${id}`)
      notify(db, "university", p.universityId, "Company rated your student's work", `${p.companyName} rated ${p.studentName}'s submission for “${p.challengeTitle}”.`, `/university/projects/${id}`)
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
        if (rank(p.status) < rank("Confirmed to Company")) throw new ApiError(409, "You can leave feedback once the university confirms this submission.")
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
      if (p.studentId !== student.id) throw new ApiError(403, "You can only update your own project tasks.")
      if (rank(p.status) >= rank("Confirmed to Company")) throw new ApiError(409, "This project was already confirmed to the company.")
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

async function readBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
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

    if (req.method === "POST" && path === "/reset") {
      resetDatabase()
      send(res, 200, { result: null, snapshot: buildSnapshot(db, resolveActor(db, header)) })
      return true
    }

    for (const route of routes) {
      const match = route.method === req.method ? route.pattern.exec(path) : null
      if (!match) continue
      const body = await readBody(req)
      const result = transaction(db, () => route.handler(db, actor, match.slice(1).map(decodeURIComponent), body))
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
