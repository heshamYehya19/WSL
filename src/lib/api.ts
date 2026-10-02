import type { DemoUserState, Snapshot } from "../types"

export class ApiRequestError extends Error {}

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
  if (!res.ok) throw new ApiRequestError(data?.error ?? `Request failed (${res.status}).`)
  return data as T
}

export function fetchSnapshot(session: DemoUserState) {
  return request<{ snapshot: Snapshot }>("GET", "/snapshot", session).then((d) => d.snapshot)
}

/** Every write returns the fresh database snapshot, so the UI never drifts from what's stored. */
export function mutate<R = null>(method: "POST" | "PATCH", path: string, session: DemoUserState, body?: unknown) {
  return request<{ result: R; snapshot: Snapshot }>(method, path, session, body ?? {})
}
