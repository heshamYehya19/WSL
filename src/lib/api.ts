import type { DemoUserState, IndustryInsights, Snapshot, TalentCandidate, TalentSearchResult } from "../types"

export class ApiRequestError extends Error {
  /** The form field the server says this error belongs to, if any. */
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}

function actorHeader(session: DemoUserState): Record<string, string> {
  const id = session.role === "student" ? session.studentId : session.role === "university" ? session.universityId : session.companyId
  return session.role !== "guest" && id ? { "X-WSL-Actor": `${session.role}:${id}` } : {}
}

async function request<T>(method: string, path: string, session: DemoUserState, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...actorHeader(session), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiRequestError("Can't reach the WSL server. Is it running?")
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiRequestError(data?.error ?? `Request failed (${res.status}).`, typeof data?.field === "string" ? data.field : undefined)
  return data as T
}

export function fetchSnapshot(session: DemoUserState) {
  return request<{ snapshot: Snapshot }>("GET", "/snapshot", session).then((d) => d.snapshot)
}

/** A university's Industry Insights: what companies ask for, and how many of its students have it verified. */
export function fetchIndustryInsights(session: DemoUserState) {
  return request<IndustryInsights>("GET", "/university/industry-insights", session)
}

/** Verified Talent Discovery: the server decides who is eligible; this only says what was asked for. */
export function fetchTalent(session: DemoUserState, filters: { skills: string[]; university: string; industry: string }) {
  const params = new URLSearchParams()
  if (filters.skills.length > 0) params.set("skills", filters.skills.join(","))
  if (filters.university) params.set("university", filters.university)
  if (filters.industry) params.set("industry", filters.industry)
  const query = params.toString()
  return request<TalentSearchResult>("GET", `/talent${query ? `?${query}` : ""}`, session)
}

/** One discoverable student with their verified proof; a 404 means they have none a company can see. */
export function fetchCandidate(session: DemoUserState, studentId: string) {
  return request<{ candidate: TalentCandidate }>("GET", `/talent/${encodeURIComponent(studentId)}`, session).then((d) => d.candidate)
}

/** Every write returns the fresh database snapshot, so the UI never drifts from what's stored. */
export function mutate<R = null>(method: "POST" | "PATCH", path: string, session: DemoUserState, body?: unknown) {
  return request<{ result: R; snapshot: Snapshot }>(method, path, session, body ?? {})
}

/** Downloads an attached file. A plain link can't carry the actor header, so fetch it and hand the browser a blob. */
async function downloadBlob(session: DemoUserState, path: string, name: string) {
  let res: Response
  try {
    res = await fetch(path, { headers: actorHeader(session) })
  } catch {
    throw new ApiRequestError("Can't reach the WSL server. Is it running?")
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiRequestError(data?.error ?? `Download failed (${res.status}).`)
  }
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const downloadChallengeFile = (session: DemoUserState, challengeId: string, fileId: string, name: string) =>
  downloadBlob(session, `/api/challenges/${encodeURIComponent(challengeId)}/files/${encodeURIComponent(fileId)}`, name)

export const downloadEvidenceFile = (session: DemoUserState, evidenceId: string, name: string) =>
  downloadBlob(session, `/api/evidence/${encodeURIComponent(evidenceId)}/file`, name)
