import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ApiRequestError, downloadChallengeFile, downloadEvidenceFile, fetchCandidate, fetchIndustryInsights, fetchSnapshot, fetchTalent, mutate } from "../lib/api"
import { useSession } from "./session"
import type { Availability, ChallengeFileKind, ChallengeVisibility, CompanyActionKind, DataSensitivity, Difficulty, EvidenceType, ScreeningFinding, SuggestedLevel, Snapshot, TalentCandidate, TalentSearchResult, IndustryInsights } from "../types"

export interface NewChallengeInput {
  title: string
  problemDescription: string
  requiredSkills: string[]
  visibility: ChallengeVisibility
  industry: string
  difficulty: Difficulty
  learningOutcomes: string[]
  /** What students hand back. Blank lets the server use its default wording. */
  deliverables: string
  duration: string
  constraints: string
  datasetAvailability: string
  dataSensitivity: DataSensitivity
  deadline: string
  preferredUniversityId: string | null
  contactId: string
  asDraft: boolean
  /** Base64-encoded file contents. */
  files: { kind: ChallengeFileKind; name: string; data: string }[]
  /** Set once the company has seen WSL's screening findings and chosen to share anyway. */
  confirmSensitiveData: boolean
}

/** Either the new challenge's id, or — if WSL's screening flagged personal data that wasn't confirmed yet — what it found. */
export type CreateChallengeResult = { id: string } | { findings: ScreeningFinding[] }

/** Lets a form show a server validation error next to the field it belongs to, instead of as a toast. */
export type FieldErrorHandler = (field: string, message: string) => void
export type ReviewDecision = "verify" | "request-more-evidence" | "reject" | "insufficient"

interface StoreContextValue extends Snapshot {
  getOrg: (id: string) => Snapshot["organizations"][number] | undefined
  getUniversity: (id: string) => Snapshot["universities"][number] | undefined
  /** `undefined` for an id that is absent — a company is not told who every project's owner is. */
  getStudent: (id: string | undefined) => Snapshot["students"][number] | undefined
  getProgram: (id: string) => Snapshot["universities"][number]["programs"][number] | undefined
  getStaff: (id: string) => Snapshot["staff"][number] | undefined
  studentsOfUniversity: (universityId: string) => Snapshot["students"]
  isUniversityStudent: (studentId: string | undefined, universityId: string) => boolean

  // Every action writes to the database and resolves once the fresh snapshot is in.
  // On failure the error is shown to the user and the promise resolves to undefined.
  createChallenge: (input: NewChallengeInput, onFieldError?: FieldErrorHandler) => Promise<CreateChallengeResult | undefined>
  submitDraft: (id: string) => Promise<boolean>
  assignChallenge: (id: string, programId: string) => Promise<boolean>
  startProject: (challengeId: string) => Promise<string | undefined>
  addTeammate: (projectId: string, studentId: string, onFieldError?: FieldErrorHandler) => Promise<boolean>
  removeTeammate: (projectId: string, studentId: string) => Promise<boolean>
  recordContribution: (projectId: string, text: string, onFieldError?: FieldErrorHandler) => Promise<boolean>
  addEvidence: (
    projectId: string,
    input: { type: EvidenceType; title: string; link: string; content: string; file?: { name: string; data: string } },
    onFieldError?: FieldErrorHandler,
  ) => Promise<boolean>
  runAIReview: (projectId: string) => Promise<boolean>
  rereadEvidence: (projectId: string, evidenceId: string) => Promise<boolean>
  reviewSignal: (
    projectId: string,
    signalId: string,
    decision: ReviewDecision,
    options?: { suggestedLevel?: SuggestedLevel; reviewerNotes?: string },
  ) => Promise<boolean>
  /** A decision on a required skill that has no signal yet (nothing analyzed): ask for more evidence, or acknowledge insufficient evidence. */
  reviewSkill: (projectId: string, studentId: string, skill: string, decision: "request-more-evidence" | "insufficient", options?: { reviewerNotes?: string }) => Promise<boolean>
  confirmToCompany: (projectId: string, note: string) => Promise<boolean>
  submitCompanyFeedback: (
    projectId: string,
    feedback: { strongTechnicalExecution: boolean; relevantForInternship: boolean; interestedInSpeaking: boolean; note: string },
  ) => Promise<boolean>
  /** Verified Talent Discovery. Rejects with the server's message; the page decides how to show it. */
  searchTalent: (filters: { skills: string[]; university: string; industry: string }) => Promise<TalentSearchResult>
  getCandidate: (studentId: string) => Promise<TalentCandidate>
  /** A university's Industry Insights. Rejects with the server's message. */
  getIndustryInsights: () => Promise<IndustryInsights>
  toggleSavedStudent: (studentId: string) => Promise<boolean>
  toggleInterested: (studentId: string) => Promise<boolean>
  inviteStudent: (studentId: string, opportunityId: string, note: string) => Promise<boolean>
  addFeedback: (projectId: string, note: string) => Promise<boolean>
  toggleTask: (projectId: string, taskId: string, done: boolean) => Promise<boolean>
  updateStudentProfile: (studentId: string, input: { bio: string; availability: Availability }) => Promise<boolean>
  markNotificationsRead: () => Promise<boolean>
  resetDemo: () => Promise<boolean>
  downloadFile: (challengeId: string, fileId: string, name: string) => Promise<void>
  downloadEvidenceFile: (evidenceId: string, name: string) => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

// Request numbers only need to keep increasing, so a plain counter is enough — no ref to
// read during render.
let lastRequestSeq = 0
const nextRequestSeq = () => ++lastRequestSeq

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  // Requests can resolve out of order (e.g. a focus refresh racing a write), so a snapshot
  // is only applied if no newer request's snapshot has been applied already.
  const [current, setCurrent] = useState<{ seq: number; snapshot: Snapshot | null }>({ seq: 0, snapshot: null })
  const snapshot = current.snapshot
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const apply = useCallback((seq: number, s: Snapshot) => {
    setCurrent((prev) => (seq < prev.seq ? prev : { seq, snapshot: s }))
  }, [])

  const refresh = useCallback(() => {
    const seq = nextRequestSeq()
    fetchSnapshot(session)
      .then((s) => {
        apply(seq, s)
        setLoadError(null)
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [session, apply])

  // Notifications are per account, so re-read whenever the signed-in account changes,
  // and whenever the tab regains focus (another tab may have changed the database).
  useEffect(refresh, [refresh])
  useEffect(() => {
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const run = useCallback(
    async <R,>(method: "POST" | "PATCH", path: string, body?: unknown, onFieldError?: FieldErrorHandler): Promise<{ ok: true; result: R } | { ok: false }> => {
      const seq = nextRequestSeq()
      try {
        const res = await mutate<R>(method, path, session, body)
        apply(seq, res.snapshot)
        return { ok: true, result: res.result }
      } catch (err) {
        if (onFieldError && err instanceof ApiRequestError && err.field) onFieldError(err.field, err.message)
        else setToast((err as Error).message)
        return { ok: false }
      }
    },
    [session, apply],
  )

  const value = useMemo<StoreContextValue | null>(() => {
    if (!snapshot) return null

    const ok = (p: Promise<{ ok: boolean }>) => p.then((r) => r.ok)

    const studentById = new Map(snapshot.students.map((s) => [s.id, s]))
    const programs = snapshot.universities.flatMap((u) => u.programs)

    return {
      ...snapshot,
      getOrg: (id) => snapshot.organizations.find((o) => o.id === id),
      getUniversity: (id) => snapshot.universities.find((u) => u.id === id),
      getStudent: (id) => (id === undefined ? undefined : studentById.get(id)),
      getProgram: (id) => programs.find((p) => p.id === id),
      getStaff: (id) => snapshot.staff.find((s) => s.id === id),
      studentsOfUniversity: (universityId) => snapshot.students.filter((s) => s.universityId === universityId),
      isUniversityStudent: (studentId, universityId) => studentId !== undefined && studentById.get(studentId)?.universityId === universityId,

      createChallenge: (input, onFieldError) =>
        run<CreateChallengeResult>("POST", "/challenges", input, onFieldError).then((r) => (r.ok ? r.result : undefined)),
      submitDraft: (id) => ok(run("POST", `/challenges/${id}/submit`)),
      assignChallenge: (id, programId) => ok(run("POST", `/challenges/${id}/assign`, { programId })),
      startProject: (challengeId) => run<{ id: string }>("POST", `/challenges/${challengeId}/start`).then((r) => (r.ok ? r.result.id : undefined)),
      addTeammate: (projectId, studentId, onFieldError) => ok(run("POST", `/projects/${projectId}/members`, { studentId }, onFieldError)),
      removeTeammate: (projectId, studentId) => ok(run("POST", `/projects/${projectId}/members/${studentId}/remove`)),
      recordContribution: (projectId, text, onFieldError) => ok(run("POST", `/projects/${projectId}/contribution`, { text }, onFieldError)),
      addEvidence: (projectId, input, onFieldError) =>
        run<{ notice?: string } | null>("POST", `/projects/${projectId}/evidence`, input, onFieldError).then((r) => {
          if (r.ok && r.result?.notice) setToast(r.result.notice)
          return r.ok
        }),
      rereadEvidence: (projectId, evidenceId) =>
        run<{ read: boolean; notice: string }>("POST", `/projects/${projectId}/evidence/${evidenceId}/reread`, undefined, (_key, message) => setToast(message)).then((r) => {
          if (r.ok) setToast(r.result.notice)
          return r.ok && r.result.read
        }),
      runAIReview: (projectId) =>
        run<{ unchanged: boolean; failed?: boolean }>("POST", `/projects/${projectId}/ai-review`).then((r) => {
          if (r.ok && r.result.unchanged) setToast("No new evidence since the last analysis.")
          else if (r.ok && r.result.failed) setToast("Analysis unavailable right now. Any earlier results are unchanged — try again in a moment.")
          return r.ok
        }),
      reviewSignal: (projectId, signalId, decision, options) =>
        ok(run("POST", `/projects/${projectId}/signals/${signalId}/review`, { decision, ...options })),
      reviewSkill: (projectId, studentId, skill, decision, options) =>
        ok(run("POST", `/projects/${projectId}/students/${encodeURIComponent(studentId)}/skills/${encodeURIComponent(skill)}/review`, { decision, ...options })),
      confirmToCompany: (projectId, note) => ok(run("POST", `/projects/${projectId}/confirm`, { note })),
      submitCompanyFeedback: (projectId, feedback) => ok(run("POST", `/projects/${projectId}/company-feedback`, feedback)),
      searchTalent: (filters) => fetchTalent(session, filters),
      getCandidate: (studentId) => fetchCandidate(session, studentId),
      getIndustryInsights: () => fetchIndustryInsights(session),
      toggleSavedStudent: (studentId) => ok(run("POST", `/students/${studentId}/company-actions`, { kind: "saved" satisfies CompanyActionKind })),
      toggleInterested: (studentId) => ok(run("POST", `/students/${studentId}/company-actions`, { kind: "interested" satisfies CompanyActionKind })),
      inviteStudent: (studentId, opportunityId, note) =>
        ok(run("POST", `/students/${studentId}/company-actions`, { kind: "invited" satisfies CompanyActionKind, opportunityId, note })),
      addFeedback: (projectId, note) => ok(run("POST", `/projects/${projectId}/feedback`, { note })),
      toggleTask: (projectId, taskId, done) => ok(run("PATCH", `/projects/${projectId}/tasks/${taskId}`, { done })),
      updateStudentProfile: (studentId, input) => ok(run("PATCH", `/students/${studentId}`, input)),
      markNotificationsRead: () => ok(run("POST", "/notifications/read")),
      resetDemo: () => ok(run("POST", "/reset")),
      downloadFile: (challengeId, fileId, name) =>
        downloadChallengeFile(session, challengeId, fileId, name).catch((err: Error) => setToast(err.message)),
      downloadEvidenceFile: (evidenceId, name) => downloadEvidenceFile(session, evidenceId, name).catch((err: Error) => setToast(err.message)),
    }
  }, [snapshot, session, run])

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        {loadError ? (
          <div className="max-w-sm rounded-2xl border border-ink-200 bg-surface p-6 text-center">
            <h1 className="font-semibold text-ink-900">Couldn't load WSL data</h1>
            <p className="mt-2 text-sm text-ink-500">{loadError}</p>
            <button onClick={refresh} className="mt-4 rounded-lg bg-night px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">
              Try again
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-400">Loading WSL data…</p>
        )}
      </div>
    )
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && (
        <div role="alert" className="animate-toast-in fixed right-4 bottom-4 left-4 z-[100] mx-auto max-w-md rounded-xl border border-danger-100 bg-surface px-4 py-3 text-sm text-ink-800 shadow-xl sm:left-auto">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger-600" />
            <p className="flex-1">{toast}</p>
            <button onClick={() => setToast(null)} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
