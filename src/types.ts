export type Role = "guest" | "student" | "university" | "company"

export type EvidenceType =
  | "Project Report"
  | "GitHub Repository"
  | "Code"
  | "Presentation"
  | "Prototype"
  | "Documentation"
  | "Analysis"
  | "Dataset / Model"
  | "Video Walkthrough"
  | "Notebook"
  | "Screenshot"
  | "Contribution Statement"

// A lean, linear pipeline: company submits -> WSL's private-data screen (automatic,
// invisible) -> university assigns it college-wide -> a student (or a team from one
// university) works it, each student submitting their own evidence ->
// AI surfaces evidence-backed skill signals for each student -> a university mentor
// verifies/rejects/requests more evidence on each one individually -> once every skill
// with evidence has a final decision, the mentor confirms the evidence for the company to see -> the
// company may leave structured feedback (never affects verification).
// "Verified" and "Completed" are parallel terminal branches (see src/lib/pipeline.ts):
// Verified = every required skill was Verified; Completed = confirmed, but at least
// one required skill was Rejected rather than Verified.
export type ChallengeStatus =
  | "Draft"
  | "Sent to University"
  | "University Assigned"
  | "In Progress"
  | "Evidence Under Review"
  | "Skills Pending Verification"
  | "Verified"
  | "Completed"
  | "Company Feedback Received"

export type ChallengeVisibility = "Public" | "University Only" | "Restricted"

export type DataSensitivity = "None (Public Dataset)" | "Low" | "Moderate" | "High (NDA Required)"

export type Difficulty = "Foundational" | "Intermediate" | "Advanced"

/** "description" replaces/accompanies the written problem description; "dataset" is data for students to work with. */
export type ChallengeFileKind = "description" | "dataset"

/** A file a company attached to a challenge. The bytes are fetched separately, with an access check. */
export interface ChallengeFile {
  id: string
  kind: ChallengeFileKind
  name: string
  mime: string
  size: number
  uploadedAt: string
}

export type ScreeningKind = "phone" | "email" | "nationalId" | "address" | "birthDate" | "card" | "iban" | "personName" | "unreadable"

/** Personal data WSL's automatic screening found in a challenge's text or attached files. */
export interface ScreeningFinding {
  kind: ScreeningKind
  label: string
  count: number
  /** Where it was found: a field label, a file name, or a file + column. */
  sources: string[]
  /** Up to three masked samples, e.g. "07•••••567". */
  examples: string[]
}

export type StudentMajor =
  | "Artificial Intelligence"
  | "Software Engineering"
  | "Cyber Security"
  | "Computer Science"
  | "Business Information Technology"

export interface Program {
  id: string
  universityId: string
  name: string
  major: StudentMajor
  /** The faculty member who mentors students in this program and confirms their work. */
  coordinatorId: string
}

/** A university faculty member — the human reviewer behind feedback and confirmations. */
export interface Staff {
  id: string
  universityId: string
  name: string
  title: string
}

export interface University {
  id: string
  name: string
  shortName: string
  city: string
  type: "Public" | "Private"
  established: number
  website: string
  faculty: string
  about: string
  programs: Program[]
}

/** A named person at a company who submits challenges and reviews student work. */
export interface CompanyContact {
  id: string
  organizationId: string
  name: string
  role: string
  isPrimary: boolean
}

export interface Organization {
  id: string
  name: string
  industry: string
  city: string
  logoInitials: string
  about: string
}

export interface ChallengeAssignment {
  universityId: string
  programId: string
  /** The college/program the university assigned this to — not a specific course. */
  program: string
  assignedAt: string
}

export interface Challenge {
  id: string
  title: string
  organizationId: string
  problemDescription: string
  objectives: string[]
  /** What students are expected to hand back (the deliverables). */
  expectedOutput: string
  /** How long the work should take, e.g. "4–6 weeks". Empty if the company didn't say. */
  duration: string
  /** Anything students must respect: tools, data handling, scope. Empty if none. */
  constraints: string
  industry: string
  difficulty: Difficulty
  requiredSkills: string[]
  learningOutcomes: string[]
  datasetAvailability: string
  dataSensitivity: DataSensitivity
  files: ChallengeFile[]
  /**
   * What WSL's screening flagged and the company confirmed was OK to share anyway —
   * null when the screening found nothing.
   */
  sharedSensitiveData: { kind: ScreeningKind; label: string; count: number }[] | null
  deadline: string
  preferredUniversityId: string | null
  contactId: string
  /** Resolved from the contact record — never stored on the challenge itself. */
  contactPerson: string
  contactRole: string
  visibility: ChallengeVisibility
  submissionRequirements: string[]
  status: ChallengeStatus
  /**
   * One entry per university that assigned this challenge to its students. A challenge sent
   * to a specific university has at most one; an open challenge can have one per university.
   */
  assignments: ChallengeAssignment[]
  createdAt: string
  submittedAt: string | null
  history: { status: ChallengeStatus; at: string; note?: string }[]
}

export interface Evidence {
  id: string
  projectId: string
  studentId: string
  type: EvidenceType
  title: string
  description: string
  link: string
  /** Optional pasted content (code, write-up, etc.) — what WSL's AI model actually analyzes. */
  content?: string
  /** What WSL read and analyzed: a GitHub link's files (README and top source files), an attached document, or a shared Google Doc. */
  analyzedFiles?: string[]
  /** A document the student attached (Documentation evidence); download it with downloadEvidenceFile. */
  file?: { name: string; size: number }
  submittedAt: string
}

export interface EvidenceQuote {
  evidenceId: string
  text: string
  why: string
}

/** One named rubric criterion a skill was checked against, and whether this submission showed it. */
export interface SkillCriterion {
  label: string
  met: boolean
}

/**
 * "Insufficient Evidence" is a reviewer's explicit decision: WSL found nothing that demonstrates the
 * skill and the university acknowledged it. It is distinct from a signal whose suggestedLevel is
 * "Insufficient" and still "Pending Verification" — that is only WSL's analysis result, not yet a decision.
 */
export type SkillSignalStatus = "Pending Verification" | "Verified" | "More Evidence Requested" | "Rejected" | "Insufficient Evidence"
// "Insufficient" is not a low tier — it means too few rubric criteria were met to
// claim any real tier at all, so WSL says so instead of forcing one.
export type SuggestedLevel = "Insufficient" | "Foundational" | "Intermediate" | "Advanced" | "Demonstrated"

export interface SkillSignal {
  id: string
  projectId: string
  studentId: string
  skill: string
  /**
   * How strongly WSL's analysis of submitted evidence supports this skill (0-100).
   * Generated the moment evidence is submitted. This is NOT a measure of proficiency —
   * it only reflects how much the evidence looks like it addresses the skill. Only a
   * university mentor's decision (status/verifiedBy/verifiedAt below) means the skill
   * is actually verified.
   */
  evidenceConfidence: number
  /** AI's starting-point read of level, shown to the mentor — never shown as a verdict on its own. */
  suggestedLevel: SuggestedLevel
  /** Short, concrete statements behind the confidence score, e.g. "Detected Python code (92% confidence)...". */
  aiNote: string
  /** The exact lines of the student's own work the AI relied on, each with what it shows. */
  aiQuotes: EvidenceQuote[]
  /** Named rubric criteria this signal was checked against, met ones first. */
  criteria: SkillCriterion[]
  /** "model" when a live grader produced this result; "offline" when the deterministic
   * fallback did — e.g. no key configured, or a model outage that couldn't be retried
   * because this skill had no prior model-graded result to protect. */
  gradedSource: "model" | "offline"
  status: SkillSignalStatus
  /** Set once a mentor verifies/rejects/requests more evidence — resolves to a staff id. */
  verifiedBy?: string
  verifiedAt?: string
  /** The mentor's own note — required for "More Evidence Requested"/"Rejected", optional for "Verified". */
  reviewerNotes?: string
  /** Deprecated — a per-skill company number from before this rework. Never written or read by new code; kept only so historical seed rows still read back. */
  companyRating?: number
  companyRatedAt?: string
  evidenceIds: string[]
  analyzedAt: string
}

export interface ProjectTask {
  id: string
  title: string
  done: boolean
}

export interface FeedbackEntry {
  id: string
  /** Resolved from the staff/contact record that wrote it. */
  author: string
  role: string
  authorKind: "staff" | "contact"
  note: string
  at: string
}

/** An extra contributor on a team project, with their own attribution — see ProjectMember. */
export interface ProjectMember {
  studentId: string
  /** What this member specifically contributed, e.g. "Data visualisation, research, and presentation." */
  roleNote: string
}

/**
 * Where one student's one required skill stands for confirmation. Only "verified", "not-verified" and
 * "acknowledged" (Insufficient Evidence the university explicitly acknowledged) are decisions; and a
 * decision only counts while it is current — see ReviewItem.stale.
 */
export type ReviewState = "verified" | "not-verified" | "acknowledged" | "pending" | "more-evidence" | "unreviewed"

/** One cell of (team member × required skill) in the confirmation check. */
export interface ReviewItem {
  studentId: string
  skill: string
  state: ReviewState
  /** New evidence was added, or analysis re-run, after the decision — or the student's evidence isn't analyzed yet. */
  stale: boolean
  /** A current, explicit university decision. */
  resolved: boolean
}

/** What stands between a project and confirmation to the company. The server computes it; the client only displays it. */
export interface ProjectReview {
  /** Every team member × every required skill has a current decision (and nothing else blocks confirmation). */
  ready: boolean
  /** Non-empty when something other than a skill decision blocks confirmation (e.g. a teammate from another university). */
  problems: string[]
  items: ReviewItem[]
}

/** A company's structured, written reaction to a project's verified evidence — never a rating, and never able to change a skill's verified status. */
export interface CompanyFeedback {
  strongTechnicalExecution: boolean
  relevantForInternship: boolean
  interestedInSpeaking: boolean
  note: string
  submittedAt: string
}

export interface Project {
  id: string
  challengeId: string
  title: string
  organizationId: string
  /** The project's owner — the student who started it. */
  studentId: string
  /** What the owner says they contributed ("" until they write it). Members' statements are in `members`. */
  ownerRoleNote: string
  /** The other students on the team (same university as the owner). Empty on a solo project. */
  members: ProjectMember[]
  status: ChallengeStatus
  startedAt: string
  /** When each team member's evidence was last analyzed, and by which model ("offline" when the fallback scorer ran). Per student, never per project. */
  analysis: { studentId: string; model: string; gradedAt: string }[]
  /** How many pieces of evidence each team member has submitted — a count only; the evidence itself is private to its author and the university. */
  evidenceCounts: { studentId: string; count: number }[]
  /** The confirmation check: everything for a university, the caller's own skills for a student, nothing for a company. */
  review: ProjectReview | null
  tasks: ProjectTask[]
  feedback: FeedbackEntry[]
  companyFeedback?: CompanyFeedback
}

export type Availability = "Open to Opportunities" | "Not Available" | "Open to Internships"

export interface Student {
  id: string
  name: string
  /** The student's major — always one of the IT fields WSL supports. */
  field: StudentMajor
  universityId: string
  programId: string
  studentNumber: string
  year: string
  gpa: number
  city: string
  bio: string
  availability: Availability
  initials: string
}

export interface Opportunity {
  id: string
  title: string
  organizationId: string
  type: string
  location: string
  requiredSkills: string[]
  description: string
  postedAt: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

/** A lightweight company engagement action on a candidate — no email, no accept/reject flow. */
export type CompanyActionKind = "saved" | "interested" | "invited"

export interface CompanyAction {
  id: string
  organizationId: string
  studentId: string
  kind: CompanyActionKind
  /** Required for "invited" — which of the company's own opportunities. */
  opportunityId?: string
  note?: string
  createdAt: string
}

/** Everything the app renders, read fresh from the database. */
export interface Snapshot {
  universities: University[]
  staff: Staff[]
  organizations: Organization[]
  contacts: CompanyContact[]
  students: Student[]
  challenges: Challenge[]
  projects: Project[]
  evidence: Evidence[]
  skillSignals: SkillSignal[]
  opportunities: Opportunity[]
  /** Only the signed-in company's own actions. */
  companyActions: CompanyAction[]
  /** Only the signed-in account's own notifications. */
  notifications: AppNotification[]
}

export interface DemoUserState {
  role: Role
  studentId?: string
  universityId?: string
  companyId?: string
}
