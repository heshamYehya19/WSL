export type Role = "guest" | "student" | "university" | "company"

export type EvidenceType =
  | "Project Report"
  | "GitHub Repository"
  | "Code"
  | "Presentation"
  | "Prototype / Demo"
  | "Documentation"
  | "Analysis"
  | "Dataset / Model"
  | "Video / Demo Link"

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

export interface University {
  id: string
  name: string
  shortName: string
  city: string
  programs: string[]
}

export interface Organization {
  id: string
  name: string
  industry: string
  city: string
  logoInitials: string
  about: string
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
  contactPerson: string
  contactRole: string
  visibility: ChallengeVisibility
  submissionRequirements: string[]
  status: ChallengeStatus
  /** The college/program the university assigned this to — not a specific course. */
  assignedProgram: string | null
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
  feedback: { author: string; role: string; note: string; at: string }[]
}

export interface Student {
  id: string
  name: string
  field: string
  universityId: string
  year: string
  bio: string
  availability: "Open to Opportunities" | "Not Available" | "Open to Internships"
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
}

export interface DemoUserState {
  role: Role
  studentId?: string
  universityId?: string
  companyId?: string
}
