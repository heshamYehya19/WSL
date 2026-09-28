import { createContext, useContext, useEffect, useMemo, useReducer } from "react"
import type { ReactNode } from "react"
import {
  challenges as seedChallenges,
  evidence as seedEvidence,
  mentors,
  projects as seedProjects,
  skillSignals as seedSkillSignals,
} from "../data/seed"
import type { Challenge, ChallengeStatus, Evidence, EvidenceType, Project, SkillSignal } from "../types"
import { simulateAIReview } from "../lib/ai"

interface DataState {
  challenges: Challenge[]
  projects: Project[]
  evidence: Evidence[]
  skillSignals: SkillSignal[]
}

const STORAGE_KEY = "wsl-demo-state-v2"

function seedState(): DataState {
  return {
    challenges: structuredClone(seedChallenges),
    projects: structuredClone(seedProjects),
    evidence: structuredClone(seedEvidence),
    skillSignals: structuredClone(seedSkillSignals),
  }
}

function loadState(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw) as DataState
    if (!parsed.challenges || !parsed.projects) return seedState()
    return parsed
  } catch {
    return seedState()
  }
}

// The pipeline is a single linear track. Several students can independently work
// the same challenge at different paces, so a challenge's own status is always the
// furthest-along state reached by any of its projects — it only ever moves forward.
const PIPELINE_ORDER: ChallengeStatus[] = [
  "Draft",
  "Sent to University",
  "University Assigned",
  "In Progress",
  "Submissions Under Review",
  "Confirmed to Company",
  "Company Reviewed",
]
const rank = (s: ChallengeStatus) => PIPELINE_ORDER.indexOf(s)

type Action =
  | { type: "RESET" }
  | { type: "CREATE_CHALLENGE"; payload: Challenge }
  | { type: "SUBMIT_DRAFT"; id: string }
  | { type: "ASSIGN_CHALLENGE"; id: string; program: string }
  | { type: "START_PROJECT"; challengeId: string; studentId: string }
  | { type: "ADD_EVIDENCE"; projectId: string; studentId: string; evType: EvidenceType; title: string; description: string; link: string }
  | { type: "RUN_AI_REVIEW"; projectId: string; studentId: string }
  | { type: "CONFIRM_TO_COMPANY"; projectId: string }
  | { type: "SUBMIT_COMPANY_FEEDBACK"; projectId: string; ratings: Record<string, number> }
  | { type: "ADD_FEEDBACK"; projectId: string; author: string; role: string; note: string }

function pushHistory(challenge: Challenge, status: ChallengeStatus, note?: string): Challenge {
  return {
    ...challenge,
    status,
    history: [...challenge.history, { status, at: new Date().toISOString(), note }],
  }
}

/** Advances a challenge to `status` only if that's further along than where it already is. */
function advanceIfFurther(challenges: Challenge[], challengeId: string, status: ChallengeStatus, note?: string): Challenge[] {
  return challenges.map((c) => (c.id === challengeId && rank(status) > rank(c.status) ? pushHistory(c, status, note) : c))
}

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "RESET":
      return seedState()

    case "CREATE_CHALLENGE":
      return { ...state, challenges: [action.payload, ...state.challenges] }

    case "SUBMIT_DRAFT":
      return {
        ...state,
        challenges: state.challenges.map((c) =>
          c.id === action.id && c.status === "Draft"
            ? pushHistory(
                { ...c, submittedAt: new Date().toISOString() },
                "Sent to University",
                "WSL automatically screened this challenge for private or confidential data — none found.",
              )
            : c,
        ),
      }

    case "ASSIGN_CHALLENGE": {
      return {
        ...state,
        challenges: state.challenges.map((c) => {
          if (c.id !== action.id) return c
          const withProgram = { ...c, assignedProgram: action.program }
          return pushHistory(withProgram, "University Assigned", `Assigned to ${action.program} students.`)
        }),
      }
    }

    case "START_PROJECT": {
      const challenge = state.challenges.find((c) => c.id === action.challengeId)
      if (!challenge) return state

      const existing = state.projects.find((p) => p.challengeId === action.challengeId && p.studentId === action.studentId)
      if (existing) return state

      const newProject: Project = {
        id: `proj-${action.challengeId}-${action.studentId}-${Date.now()}`,
        challengeId: action.challengeId,
        title: challenge.title,
        organizationId: challenge.organizationId,
        studentId: action.studentId,
        status: "In Progress",
        startedAt: new Date().toISOString(),
        tasks: [],
        feedback: [],
      }

      return {
        ...state,
        projects: [...state.projects, newProject],
        challenges: advanceIfFurther(state.challenges, action.challengeId, "In Progress"),
      }
    }

    case "ADD_EVIDENCE": {
      const newEvidence: Evidence = {
        id: `ev-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        projectId: action.projectId,
        studentId: action.studentId,
        type: action.evType,
        title: action.title,
        description: action.description,
        link: action.link,
        submittedAt: new Date().toISOString(),
      }
      return { ...state, evidence: [...state.evidence, newEvidence] }
    }

    case "RUN_AI_REVIEW": {
      const project = state.projects.find((p) => p.id === action.projectId)
      const challenge = project ? state.challenges.find((c) => c.id === project.challengeId) : undefined
      if (!project || !challenge) return state

      const studentEvidence = state.evidence.filter((e) => e.projectId === action.projectId && e.studentId === action.studentId)
      if (studentEvidence.length === 0) return state

      const already = new Set(
        state.skillSignals.filter((s) => s.projectId === action.projectId && s.studentId === action.studentId).map((s) => s.skill),
      )
      const results = simulateAIReview(challenge.requiredSkills, studentEvidence).filter((r) => !already.has(r.skill))

      const newSignals: SkillSignal[] = results.map((r, i) => ({
        id: `sig-${Date.now()}-${i}`,
        projectId: action.projectId,
        studentId: action.studentId,
        skill: r.skill,
        aiRating: r.rating,
        evidenceIds: r.evidenceIds,
        analyzedAt: new Date().toISOString(),
      }))

      return {
        ...state,
        skillSignals: [...state.skillSignals, ...newSignals],
        projects: state.projects.map((p) => (p.id === action.projectId ? { ...p, status: "Submissions Under Review" } : p)),
        challenges: advanceIfFurther(state.challenges, challenge.id, "Submissions Under Review", "WSL rated the submitted evidence automatically."),
      }
    }

    case "CONFIRM_TO_COMPANY": {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId ? { ...p, status: "Confirmed to Company" } : p)),
        challenges: advanceIfFurther(state.challenges, project.challengeId, "Confirmed to Company"),
      }
    }

    case "SUBMIT_COMPANY_FEEDBACK": {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const now = new Date().toISOString()
      return {
        ...state,
        skillSignals: state.skillSignals.map((s) =>
          s.projectId === action.projectId && action.ratings[s.id] !== undefined
            ? { ...s, companyRating: action.ratings[s.id], companyRatedAt: now }
            : s,
        ),
        projects: state.projects.map((p) => (p.id === action.projectId ? { ...p, status: "Company Reviewed" } : p)),
        challenges: advanceIfFurther(state.challenges, project.challengeId, "Company Reviewed"),
      }
    }

    case "ADD_FEEDBACK": {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, feedback: [...p.feedback, { author: action.author, role: action.role, note: action.note, at: new Date().toISOString() }] }
            : p,
        ),
      }
    }

    default:
      return state
  }
}

interface StoreContextValue extends DataState {
  createChallenge: (payload: Challenge) => void
  submitDraft: (id: string) => void
  assignChallenge: (id: string, program: string) => void
  startProject: (challengeId: string, studentId: string) => void
  addEvidence: (projectId: string, studentId: string, evType: EvidenceType, title: string, description: string, link: string) => void
  runAIReview: (projectId: string, studentId: string) => void
  confirmToCompany: (projectId: string) => void
  submitCompanyFeedback: (projectId: string, ratings: Record<string, number>) => void
  addFeedback: (projectId: string, author: string, role: string, note: string) => void
  resetDemo: () => void
  mentorFor: (universityId: string) => { name: string; role: string }
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      createChallenge: (payload) => dispatch({ type: "CREATE_CHALLENGE", payload }),
      submitDraft: (id) => dispatch({ type: "SUBMIT_DRAFT", id }),
      assignChallenge: (id, program) => dispatch({ type: "ASSIGN_CHALLENGE", id, program }),
      startProject: (challengeId, studentId) => dispatch({ type: "START_PROJECT", challengeId, studentId }),
      addEvidence: (projectId, studentId, evType, title, description, link) =>
        dispatch({ type: "ADD_EVIDENCE", projectId, studentId, evType, title, description, link }),
      runAIReview: (projectId, studentId) => dispatch({ type: "RUN_AI_REVIEW", projectId, studentId }),
      confirmToCompany: (projectId) => dispatch({ type: "CONFIRM_TO_COMPANY", projectId }),
      submitCompanyFeedback: (projectId, ratings) => dispatch({ type: "SUBMIT_COMPANY_FEEDBACK", projectId, ratings }),
      addFeedback: (projectId, author, role, note) => dispatch({ type: "ADD_FEEDBACK", projectId, author, role, note }),
      resetDemo: () => dispatch({ type: "RESET" }),
      mentorFor: (universityId) => mentors[universityId] ?? { name: "University Mentor", role: "Faculty Reviewer" },
    }),
    [state],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
