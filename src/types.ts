export type Role = "guest" | "student" | "university" | "company"

export type SkillLevel = "Foundational" | "Intermediate" | "Advanced" | "Demonstrated"

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

export type ChallengeStatus =
  | "Draft"
  | "Submitted"
  | "Under WSL Review"
  | "Approved"
  | "Sent to University"
  | "University Accepted"
  | "Open to Students"
  | "In Progress"
  | "Completed"
  | "Evidence Under Review"
  | "Verified"

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

export interface CourseMapping {
  course: string
  program: string
  semester: string
  studentGroup: string
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
  numTeams: number
  deadline: string
  preferredUniversityId: string | null
  contactPerson: string
  contactRole: string
  visibility: ChallengeVisibility
  submissionRequirements: string[]
  status: ChallengeStatus
  courseMapping: CourseMapping | null
  submittedAt: string | null
  history: { status: ChallengeStatus; at: string; note?: string }[]
}

export interface Evidence {
  id: string
  projectId: string
  contributorId: string
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
  level: SkillLevel
  confidence: number
  evidenceIds: string[]
  status: "Pending Verification" | "Verified" | "More Evidence Requested" | "Rejected"
  verifiedBy?: string
  verifiedAt?: string
  reviewerNotes?: string
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
  teamStudentIds: string[]
  status: ChallengeStatus
  startedAt: string
  tasks: ProjectTask[]
  individualContributions: Record<string, string[]>
  feedback: { author: string; role: string; note: string; at: string }[]
}

export interface VerifiedSkillRecord {
  skill: string
  level: SkillLevel
  evidenceConfidence: number
  projectId: string
  verifiedBy: string
  verifiedAt: string
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
