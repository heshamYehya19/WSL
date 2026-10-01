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

// A lean, linear pipeline: company submits -> WSL's private-data screen (automatic,
// invisible) -> university assigns it college-wide -> a student works it solo ->
// WSL rates the submission automatically -> university reviews and confirms it to
// the company -> the company reviews and rates it too.
export type ChallengeStatus =
  | "Draft"
  | "Sent to University"
  | "University Assigned"
  | "In Progress"
  | "Submissions Under Review"
  | "Confirmed to Company"
  | "Company Reviewed"

export type ChallengeVisibility = "Public" | "University Only" | "Restricted"

export type DataSensitivity = "None (Public Dataset)" | "Low" | "Moderate" | "High (NDA Required)"

export type Difficulty = "Foundational" | "Intermediate" | "Advanced"

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
  expectedOutput: string
  industry: string
  difficulty: Difficulty
  requiredSkills: string[]
  learningOutcomes: string[]
  datasetAvailability: string
  dataSensitivity: DataSensitivity
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
  submittedAt: string
}

export interface SkillSignal {
  id: string
  projectId: string
  studentId: string
  skill: string
  /** WSL's automatic rating (0-100). Generated the moment evidence is submitted — informational only, never blocks anything. */
  aiRating: number
  /** The company's own rating (0-100), given after the university confirms the submission. */
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

export interface Project {
  id: string
  challengeId: string
  title: string
  organizationId: string
  /** Solo work only — one student per project. */
  studentId: string
  status: ChallengeStatus
  startedAt: string
  tasks: ProjectTask[]
  feedback: FeedbackEntry[]
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
  /** Only the signed-in account's own notifications. */
  notifications: AppNotification[]
}

export interface DemoUserState {
  role: Role
  studentId?: string
  universityId?: string
  companyId?: string
}
