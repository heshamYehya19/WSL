/**
 * The deployed app's public address, from VITE_PUBLIC_URL at build time. Returns null
 * until it's set (or if it isn't a real http(s) URL), so nothing links anywhere before
 * the app is actually live.
 */
export function parseLiveUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}
