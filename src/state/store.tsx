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
import { simulateEvidenceAnalysis } from "../lib/ai"

interface DataState {
  challenges: Challenge[]
  projects: Project[]
  evidence: Evidence[]
  skillSignals: SkillSignal[]
}

const STORAGE_KEY = "wsl-demo-state-v1"

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

type Action =
  | { type: "RESET" }
  | { type: "CREATE_CHALLENGE"; payload: Challenge }
  | { type: "ADVANCE_CHALLENGE"; id: string; status: ChallengeStatus; note?: string }
  | {
      type: "UNIVERSITY_DECISION"
      id: string
      decision: "accept" | "changes" | "reject"
      courseMapping?: Challenge["courseMapping"]
      note?: string
    }
  | { type: "START_PROJECT"; challengeId: string; studentId: string }
  | { type: "ADD_EVIDENCE"; projectId: string; contributorId: string; evType: EvidenceType; title: string; description: string; link: string }
  | { type: "RUN_AI_ANALYSIS"; projectId: string; studentId: string }
  | {
      type: "REVIEW_SIGNAL"
      signalId: string
      action: "verify" | "more_evidence" | "reject"
      reviewerName: string
      notes?: string
    }
  | { type: "ADD_FEEDBACK"; projectId: string; author: string; role: string; note: string }

function pushHistory(challenge: Challenge, status: ChallengeStatus, note?: string): Challenge {
  return {
    ...challenge,
    status,
    history: [...challenge.history, { status, at: new Date().toISOString(), note }],
  }
}

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "RESET":
      return seedState()

    case "CREATE_CHALLENGE":
      return { ...state, challenges: [action.payload, ...state.challenges] }

    case "ADVANCE_CHALLENGE":
      return {
        ...state,
        challenges: state.challenges.map((c) => (c.id === action.id ? pushHistory(c, action.status, action.note) : c)),
      }

    case "UNIVERSITY_DECISION": {
      if (action.decision === "reject") {
        return {
          ...state,
          challenges: state.challenges.map((c) =>
            c.id === action.id ? pushHistory(c, "Draft", action.note ?? "Returned to company: not accepted by university.") : c,
          ),
        }
      }
      if (action.decision === "changes") {
        return {
          ...state,
          challenges: state.challenges.map((c) =>
            c.id === action.id ? pushHistory(c, "Approved", action.note ?? "University requested changes before acceptance.") : c,
          ),
        }
      }
      return {
        ...state,
        challenges: state.challenges.map((c) => {
          if (c.id !== action.id) return c
          const withMapping = { ...c, courseMapping: action.courseMapping ?? c.courseMapping }
          const accepted = pushHistory(withMapping, "University Accepted", "Accepted and mapped to a course.")
          return pushHistory(accepted, "Open to Students")
        }),
      }
    }

    case "START_PROJECT": {
      const challenge = state.challenges.find((c) => c.id === action.challengeId)
      if (!challenge) return state

      const existing = state.projects.find((p) => p.challengeId === action.challengeId)
      if (existing) {
        if (existing.teamStudentIds.includes(action.studentId)) return state
        return {
          ...state,
          projects: state.projects.map((p) =>
            p.id === existing.id ? { ...p, teamStudentIds: [...p.teamStudentIds, action.studentId] } : p,
          ),
        }
      }

      const newProject: Project = {
        id: `proj-${action.challengeId}-${Date.now()}`,
        challengeId: action.challengeId,
        title: challenge.title,
        organizationId: challenge.organizationId,
        teamStudentIds: [action.studentId],
        status: "In Progress",
        startedAt: new Date().toISOString(),
        tasks: [],
        individualContributions: {},
        feedback: [],
      }

      return {
        ...state,
        projects: [...state.projects, newProject],
        challenges: state.challenges.map((c) => (c.id === action.challengeId ? pushHistory(c, "In Progress") : c)),
      }
    }

    case "ADD_EVIDENCE": {
      const newEvidence: Evidence = {
        id: `ev-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        projectId: action.projectId,
        contributorId: action.contributorId,
        type: action.evType,
        title: action.title,
        description: action.description,
        link: action.link,
        submittedAt: new Date().toISOString(),
      }
      return { ...state, evidence: [...state.evidence, newEvidence] }
    }

    case "RUN_AI_ANALYSIS": {
      const project = state.projects.find((p) => p.id === action.projectId)
      const challenge = project ? state.challenges.find((c) => c.id === project.challengeId) : undefined
      if (!project || !challenge) return state

      const studentEvidence = state.evidence.filter(
        (e) => e.projectId === action.projectId && e.contributorId === action.studentId,
      )
      if (studentEvidence.length === 0) return state

      const already = new Set(
        state.skillSignals.filter((s) => s.projectId === action.projectId && s.studentId === action.studentId).map((s) => s.skill),
      )
      const results = simulateEvidenceAnalysis(challenge.requiredSkills, studentEvidence).filter((r) => !already.has(r.skill))

      const newSignals: SkillSignal[] = results.map((r, i) => ({
        id: `sig-${Date.now()}-${i}`,
        projectId: action.projectId,
        studentId: action.studentId,
        skill: r.skill,
        level: r.level,
        confidence: r.confidence,
        evidenceIds: r.evidenceIds,
        status: "Pending Verification",
        analyzedAt: new Date().toISOString(),
      }))

      return {
        ...state,
        skillSignals: [...state.skillSignals, ...newSignals],
        projects: state.projects.map((p) => (p.id === action.projectId ? { ...p, status: "Evidence Under Review" } : p)),
        challenges: state.challenges.map((c) =>
          c.id === challenge.id && c.status !== "Evidence Under Review" ? pushHistory(c, "Evidence Under Review") : c,
        ),
      }
    }

    case "REVIEW_SIGNAL": {
      const target = state.skillSignals.find((s) => s.id === action.signalId)
      if (!target) return state

      const statusMap = {
        verify: "Verified" as const,
        more_evidence: "More Evidence Requested" as const,
        reject: "Rejected" as const,
      }
      const skillSignals = state.skillSignals.map((s) =>
        s.id === action.signalId
          ? {
              ...s,
              status: statusMap[action.action],
              verifiedBy: action.action === "verify" ? action.reviewerName : s.verifiedBy,
              verifiedAt: action.action === "verify" ? new Date().toISOString() : s.verifiedAt,
              reviewerNotes: action.notes ?? s.reviewerNotes,
            }
          : s,
      )

      // Once every skill signal produced for a project has been resolved (no more
      // pending review), the project — and the challenge it belongs to — moves on:
      // "Verified" if every signal was verified, otherwise "Completed" (review
      // finished, but not every signal made it in as a verified skill).
      const projectSignals = skillSignals.filter((s) => s.projectId === target.projectId)
      const stillPending = projectSignals.some((s) => s.status === "Pending Verification")
      const allVerified = projectSignals.every((s) => s.status === "Verified")
      const project = state.projects.find((p) => p.id === target.projectId)

      let projects = state.projects
      let challenges = state.challenges
      if (project && !stillPending) {
        const rolledUpStatus: ChallengeStatus = allVerified ? "Verified" : "Completed"
        if (project.status !== rolledUpStatus) {
          projects = state.projects.map((p) => (p.id === project.id ? { ...p, status: rolledUpStatus } : p))
          challenges = state.challenges.map((c) =>
            c.id === project.challengeId
              ? pushHistory(
                  c,
                  rolledUpStatus,
                  allVerified
                    ? "Every skill signal from this project's evidence was verified."
                    : "Evidence review is complete — not every skill signal was verified.",
                )
              : c,
          )
        }
      }

      return { ...state, skillSignals, projects, challenges }
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
  advanceChallenge: (id: string, status: ChallengeStatus, note?: string) => void
  universityDecision: (
    id: string,
    decision: "accept" | "changes" | "reject",
    courseMapping?: Challenge["courseMapping"],
    note?: string,
  ) => void
  startProject: (challengeId: string, studentId: string) => void
  addEvidence: (projectId: string, contributorId: string, evType: EvidenceType, title: string, description: string, link: string) => void
  runAIAnalysis: (projectId: string, studentId: string) => void
  reviewSignal: (signalId: string, action: "verify" | "more_evidence" | "reject", reviewerName: string, notes?: string) => void
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
      advanceChallenge: (id, status, note) => dispatch({ type: "ADVANCE_CHALLENGE", id, status, note }),
      universityDecision: (id, decision, courseMapping, note) =>
        dispatch({ type: "UNIVERSITY_DECISION", id, decision, courseMapping, note }),
      startProject: (challengeId, studentId) => dispatch({ type: "START_PROJECT", challengeId, studentId }),
      addEvidence: (projectId, contributorId, evType, title, description, link) =>
        dispatch({ type: "ADD_EVIDENCE", projectId, contributorId, evType, title, description, link }),
      runAIAnalysis: (projectId, studentId) => dispatch({ type: "RUN_AI_ANALYSIS", projectId, studentId }),
      reviewSignal: (signalId, action, reviewerName, notes) =>
        dispatch({ type: "REVIEW_SIGNAL", signalId, action, reviewerName, notes }),
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
