import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { fetchSnapshot, mutate } from "../lib/api"
import { useSession } from "./session"
import type { Availability, ChallengeVisibility, DataSensitivity, Difficulty, EvidenceType, Snapshot } from "../types"

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
}

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
  createChallenge: (input: NewChallengeInput) => Promise<string | undefined>
  submitDraft: (id: string) => Promise<boolean>
  assignChallenge: (id: string, programId: string) => Promise<boolean>
  startProject: (challengeId: string) => Promise<string | undefined>
  addEvidence: (projectId: string, input: { type: EvidenceType; title: string; description: string; link: string }) => Promise<boolean>
  runAIReview: (projectId: string) => Promise<boolean>
  confirmToCompany: (projectId: string, note: string) => Promise<boolean>
  submitCompanyReview: (projectId: string, ratings: Record<string, number>, note: string) => Promise<boolean>
  addFeedback: (projectId: string, note: string) => Promise<boolean>
  toggleTask: (projectId: string, taskId: string, done: boolean) => Promise<boolean>
  updateStudentProfile: (studentId: string, input: { bio: string; availability: Availability }) => Promise<boolean>
  markNotificationsRead: () => Promise<boolean>
  resetDemo: () => Promise<boolean>
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

      createChallenge: (input) => run<{ id: string }>("POST", "/challenges", input).then((r) => (r.ok ? r.result.id : undefined)),
      submitDraft: (id) => ok(run("POST", `/challenges/${id}/submit`)),
      assignChallenge: (id, programId) => ok(run("POST", `/challenges/${id}/assign`, { programId })),
      startProject: (challengeId) => run<{ id: string }>("POST", `/challenges/${challengeId}/start`).then((r) => (r.ok ? r.result.id : undefined)),
      addEvidence: (projectId, input) => ok(run("POST", `/projects/${projectId}/evidence`, input)),
      runAIReview: (projectId) => ok(run("POST", `/projects/${projectId}/ai-review`)),
      confirmToCompany: (projectId, note) => ok(run("POST", `/projects/${projectId}/confirm`, { note })),
      submitCompanyReview: (projectId, ratings, note) => ok(run("POST", `/projects/${projectId}/company-review`, { ratings, note })),
      addFeedback: (projectId, note) => ok(run("POST", `/projects/${projectId}/feedback`, { note })),
      toggleTask: (projectId, taskId, done) => ok(run("PATCH", `/projects/${projectId}/tasks/${taskId}`, { done })),
      updateStudentProfile: (studentId, input) => ok(run("PATCH", `/students/${studentId}`, input)),
      markNotificationsRead: () => ok(run("POST", "/notifications/read")),
      resetDemo: () => ok(run("POST", "/reset")),
    }
  }, [snapshot, session, apply])

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        {loadError ? (
          <div className="max-w-sm rounded-2xl border border-ink-200 bg-white p-6 text-center">
            <h1 className="font-semibold text-ink-900">Couldn't load WSL data</h1>
            <p className="mt-2 text-sm text-ink-500">{loadError}</p>
            <button onClick={refresh} className="mt-4 rounded-lg bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">
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
        <div role="alert" className="fixed right-4 bottom-4 left-4 z-[100] mx-auto max-w-md rounded-xl border border-danger-100 bg-white px-4 py-3 text-sm text-ink-800 shadow-xl sm:left-auto">
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
