import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { downloadChallengeFile, fetchSnapshot, mutate } from "../lib/api"
import { useSession } from "./session"
import type { Availability, ChallengeFileKind, ChallengeVisibility, CompanyActionKind, DataSensitivity, Difficulty, EvidenceType, ScreeningFinding, SuggestedLevel, Snapshot } from "../types"

export interface NewChallengeInput {
  title: string
  problemDescription: string
  requiredSkills: string[]
  visibility: ChallengeVisibility
  industry: string
  difficulty: Difficulty
  learningOutcomes: string[]
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

interface StoreContextValue extends Snapshot {
  getOrg: (id: string) => Snapshot["organizations"][number] | undefined
  getUniversity: (id: string) => Snapshot["universities"][number] | undefined
  getStudent: (id: string) => Snapshot["students"][number] | undefined
  getProgram: (id: string) => Snapshot["universities"][number]["programs"][number] | undefined
  getStaff: (id: string) => Snapshot["staff"][number] | undefined
  studentsOfUniversity: (universityId: string) => Snapshot["students"]
  isUniversityStudent: (studentId: string, universityId: string) => boolean

  // Every action writes to the database and resolves once the fresh snapshot is in.
  // On failure the error is shown to the user and the promise resolves to undefined.
  createChallenge: (input: NewChallengeInput) => Promise<CreateChallengeResult | undefined>
  submitDraft: (id: string) => Promise<boolean>
  assignChallenge: (id: string, programId: string) => Promise<boolean>
  startProject: (challengeId: string) => Promise<string | undefined>
  addEvidence: (projectId: string, input: { type: EvidenceType; title: string; link: string; content: string }) => Promise<boolean>
  runAIReview: (projectId: string) => Promise<boolean>
  reviewSignal: (
    projectId: string,
    signalId: string,
    decision: "verify" | "request-more-evidence" | "reject",
    options?: { suggestedLevel?: SuggestedLevel; reviewerNotes?: string },
  ) => Promise<boolean>
  confirmToCompany: (projectId: string, note: string) => Promise<boolean>
  submitCompanyFeedback: (
    projectId: string,
    feedback: { strongTechnicalExecution: boolean; relevantForInternship: boolean; interestedInSpeaking: boolean; note: string },
  ) => Promise<boolean>
  toggleSavedStudent: (studentId: string) => Promise<boolean>
  toggleInterested: (studentId: string) => Promise<boolean>
  inviteStudent: (studentId: string, opportunityId: string, note: string) => Promise<boolean>
  addFeedback: (projectId: string, note: string) => Promise<boolean>
  toggleTask: (projectId: string, taskId: string, done: boolean) => Promise<boolean>
  updateStudentProfile: (studentId: string, input: { bio: string; availability: Availability }) => Promise<boolean>
  markNotificationsRead: () => Promise<boolean>
  resetDemo: () => Promise<boolean>
  downloadFile: (challengeId: string, fileId: string, name: string) => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Requests can resolve out of order (e.g. a focus refresh racing a write), so only
  // apply a snapshot if no newer request has already been applied.
  const requestSeq = useRef(0)
  const appliedSeq = useRef(0)
  const apply = useCallback((seq: number, s: Snapshot) => {
    if (seq < appliedSeq.current) return
    appliedSeq.current = seq
    setSnapshot(s)
  }, [])

  const refresh = useCallback(() => {
    const seq = ++requestSeq.current
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

  const value = useMemo<StoreContextValue | null>(() => {
    if (!snapshot) return null

    async function run<R>(method: "POST" | "PATCH", path: string, body?: unknown): Promise<{ ok: true; result: R } | { ok: false }> {
      const seq = ++requestSeq.current
      try {
        const res = await mutate<R>(method, path, session, body)
        apply(seq, res.snapshot)
        return { ok: true, result: res.result }
      } catch (err) {
        setToast((err as Error).message)
        return { ok: false }
      }
    }
    const ok = (p: Promise<{ ok: boolean }>) => p.then((r) => r.ok)

    const studentById = new Map(snapshot.students.map((s) => [s.id, s]))
    const programs = snapshot.universities.flatMap((u) => u.programs)

    return {
      ...snapshot,
      getOrg: (id) => snapshot.organizations.find((o) => o.id === id),
      getUniversity: (id) => snapshot.universities.find((u) => u.id === id),
      getStudent: (id) => studentById.get(id),
      getProgram: (id) => programs.find((p) => p.id === id),
      getStaff: (id) => snapshot.staff.find((s) => s.id === id),
      studentsOfUniversity: (universityId) => snapshot.students.filter((s) => s.universityId === universityId),
      isUniversityStudent: (studentId, universityId) => studentById.get(studentId)?.universityId === universityId,

      createChallenge: (input) => run<CreateChallengeResult>("POST", "/challenges", input).then((r) => (r.ok ? r.result : undefined)),
      submitDraft: (id) => ok(run("POST", `/challenges/${id}/submit`)),
      assignChallenge: (id, programId) => ok(run("POST", `/challenges/${id}/assign`, { programId })),
      startProject: (challengeId) => run<{ id: string }>("POST", `/challenges/${challengeId}/start`).then((r) => (r.ok ? r.result.id : undefined)),
      addEvidence: (projectId, input) => ok(run("POST", `/projects/${projectId}/evidence`, input)),
      runAIReview: (projectId) =>
        run<{ unchanged: boolean }>("POST", `/projects/${projectId}/ai-review`).then((r) => {
          if (r.ok && r.result.unchanged) setToast("No new evidence since the last analysis.")
          return r.ok
        }),
      reviewSignal: (projectId, signalId, decision, options) =>
        ok(run("POST", `/projects/${projectId}/signals/${signalId}/review`, { decision, ...options })),
      confirmToCompany: (projectId, note) => ok(run("POST", `/projects/${projectId}/confirm`, { note })),
      submitCompanyFeedback: (projectId, feedback) => ok(run("POST", `/projects/${projectId}/company-feedback`, feedback)),
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
    }
  }, [snapshot, session, apply])

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
