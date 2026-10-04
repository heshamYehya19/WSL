import type { DemoUserState, Snapshot } from "../types"

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

/** Every write returns the fresh database snapshot, so the UI never drifts from what's stored. */
export function mutate<R = null>(method: "POST" | "PATCH", path: string, session: DemoUserState, body?: unknown) {
  return request<{ result: R; snapshot: Snapshot }>(method, path, session, body ?? {})
}

/** Downloads a challenge's attached file. A plain link can't carry the actor header, so fetch it and hand the browser a blob. */
export async function downloadChallengeFile(session: DemoUserState, challengeId: string, fileId: string, name: string) {
  let res: Response
  try {
    res = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/files/${encodeURIComponent(fileId)}`, { headers: actorHeader(session) })
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
