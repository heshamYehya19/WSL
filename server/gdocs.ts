// Reads a Google Docs link so the document's text can be analyzed, not just linked.
// Only works for documents shared as "Anyone with the link can view": Google answers a
// private document with a sign-in page, which is treated as "couldn't read" — the link is
// still saved for the reviewer, and the student is told how to make it readable.

/** Swappable for tests, so they never reach the network. */
export const docsDeps = {
  fetch: (input: string, init?: RequestInit): Promise<Response> => fetch(input, init),
}

const TIMEOUT_MS = 8_000
const MAX_CHARS = 20_000

/** The document id of a docs.google.com/document link, or null for anything else. */
export function parseGoogleDocLink(link: string): string | null {
  const m = /^(?:https?:\/\/)?docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]+)/i.exec(link.trim())
  return m ? m[1] : null
}

/** The document's plain text, or null if Google wouldn't hand it over (private, deleted, offline). */
export async function readGoogleDoc(link: string): Promise<string | null> {
  const id = parseGoogleDocLink(link)
  if (!id) return null
  try {
    const res = await docsDeps.fetch(`https://docs.google.com/document/d/${id}/export?format=txt`, {
      headers: { "User-Agent": "wsl-evidence-reader" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok || !/^text\/plain/i.test(res.headers.get("content-type") ?? "")) return null
    const text = (await res.text()).replace(/^﻿/, "").trim()
    return text.length >= 20 ? text.slice(0, MAX_CHARS) : null
  } catch {
    return null
  }
}
