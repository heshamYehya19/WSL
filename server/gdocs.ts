// Reads a Google Docs link so the document's text can be analyzed, not just linked.
// Only works for documents shared as "Anyone with the link can view": Google answers a
// private document with a sign-in page or a 404, which is reported as "not shared" — the link
// is still saved for the reviewer, and the student is told how to make it readable.
import { parseGoogleDocLink } from "../src/lib/googleDocs.ts"

export { parseGoogleDocLink }

/** Swappable for tests, so they never reach the network. */
export const docsDeps = {
  fetch: (input: string, init?: RequestInit): Promise<Response> => fetch(input, init),
}

const TIMEOUT_MS = 8_000
const MAX_CHARS = 20_000

/** Why a document couldn't be read, so the student is told the right thing to do about it. */
export type DocProblem = "not-shared" | "unreachable" | "empty"

export type DocRead = { ok: true; text: string } | { ok: false; problem: DocProblem }

export const DOC_PROBLEM_MESSAGE: Record<DocProblem, string> = {
  "not-shared":
    "WSL couldn't open this Google Doc because it isn't shared publicly. In Google Docs choose Share → General access → “Anyone with the link” (Viewer), then press “Check again”. Or download it (File → Download → Microsoft Word) and attach the file instead.",
  unreachable: "WSL couldn't reach Google just now, so it couldn't read this document. Press “Check again” in a moment, or attach the file instead.",
  empty: "This Google Doc is empty or too short for WSL to analyze. Add content to it and press “Check again”, or attach a different file.",
}

/** The document's plain text, or why Google wouldn't hand it over. */
export async function readGoogleDoc(link: string): Promise<DocRead> {
  const id = parseGoogleDocLink(link)
  if (!id) return { ok: false, problem: "not-shared" }
  let res: Response
  try {
    res = await docsDeps.fetch(`https://docs.google.com/document/d/${id}/export?format=txt`, {
      headers: { "User-Agent": "wsl-evidence-reader" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return { ok: false, problem: "unreachable" }
  }
  // A private document comes back as a sign-in page, a 403, or a 404 — never as the document.
  if (!res.ok || !/^text\/plain/i.test(res.headers.get("content-type") ?? "")) {
    return { ok: false, problem: res.status >= 500 ? "unreachable" : "not-shared" }
  }
  const text = (await res.text()).replace(/^﻿/, "").trim()
  return text.length >= 20 ? { ok: true, text: text.slice(0, MAX_CHARS) } : { ok: false, problem: "empty" }
}
