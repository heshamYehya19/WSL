// Reads a public GitHub repository link so its work can be analyzed, not just
// linked: the README plus a few of the most relevant source files. A link to a
// single file (".../blob/main/path") reads that file first.
//
// Uses the public GitHub API without a token. Set GITHUB_TOKEN on the server for
// a higher rate limit; it's only ever sent to api.github.com.

/** Swappable for tests, so they never reach the network. */
export const githubDeps = {
  fetch: (input: string, init?: RequestInit): Promise<Response> => fetch(input, init),
}

const TIMEOUT_MS = 8_000
const MAX_SOURCE_FILES = 4
const MAX_FILE_BYTES = 80_000
const MAX_CHARS_PER_FILE = 6_000
const MAX_TOTAL_CHARS = 20_000

const SOURCE_EXTENSIONS = new Set([
  "py", "ipynb", "js", "jsx", "ts", "tsx", "java", "kt", "go", "rs", "cs", "cpp", "cc", "c", "h", "rb", "php",
  "swift", "dart", "sql", "sh", "r", "scala", "vue", "svelte", "html", "css",
])
const SKIP_PATH = /(^|\/)(node_modules|dist|build|vendor|\.git|\.github|__pycache__|venv|\.venv|target|out|coverage|migrations\/versions)\//i
const SKIP_FILE = /(\.min\.(js|css)$|\.lock$|package-lock\.json$|\.d\.ts$|setup\.py$|conftest\.py$|__init__\.py$)/i

export interface RepoRef {
  owner: string
  repo: string
  ref?: string
  path?: string
}

export function parseGithubLink(link: string): RepoRef | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/?#]+)(?:\/([^?#]*))?)?\/?(?:[?#].*)?$/i.exec(link.trim())
  if (!m) return null
  return { owner: m[1], repo: m[2], ...(m[3] ? { ref: m[3] } : {}), ...(m[4] ? { path: decodeURIComponent(m[4]) } : {}) }
}

export interface RepoSnapshot {
  /** Repository-relative paths that were read, in the order they appear in `text`. */
  files: string[]
  text: string
}

async function getJson<T>(url: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim()
  const res = await githubDeps.fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "wsl-evidence-reader",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}

async function getRaw(ref: RepoRef & { ref: string }, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(ref.ref)}/${path.split("/").map(encodeURIComponent).join("/")}`
  const res = await githubDeps.fetch(url, { headers: { "User-Agent": "wsl-evidence-reader" }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} for ${path}`)
  return res.text()
}

/** A notebook's code and markdown cells, without outputs or metadata. */
function notebookText(raw: string): string {
  try {
    const nb = JSON.parse(raw) as { cells?: { cell_type?: string; source?: string | string[] }[] }
    return (nb.cells ?? [])
      .filter((c) => c.cell_type === "code" || c.cell_type === "markdown")
      .map((c) => (Array.isArray(c.source) ? c.source.join("") : (c.source ?? "")))
      .join("\n\n")
  } catch {
    return ""
  }
}

const extension = (path: string) => path.split(".").pop()?.toLowerCase() ?? ""

/** Ranks likely "main" source files first: shallow, in src/ or the root, with telling names, not tests. */
function rankSource(path: string, size: number): number {
  const depth = path.split("/").length - 1
  const name = path.split("/").pop()!.toLowerCase()
  let score = 10 - Math.min(depth, 5) * 1.5
  if (/^(src|app|lib|server|notebooks?|backend|api)\//i.test(path)) score += 3
  if (/^(main|app|index|server|model|train|detect\w*|pipeline|features?|analysis|api)\./.test(name)) score += 3
  if (/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\./i.test(path)) score -= 4
  if (/^(config|settings|constants)\./.test(name)) score -= 3
  if (/\.(css|html)$/.test(name)) score -= 4
  score += Math.min(size, 20_000) / 10_000
  return score
}

/**
 * Fetches the README and the most relevant source files from a GitHub link.
 * Returns null when the link isn't a GitHub repository or nothing could be read.
 */
export async function readGithubRepo(link: string): Promise<RepoSnapshot | null> {
  const parsed = parseGithubLink(link)
  if (!parsed) return null
  const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`
  try {
    const ref = parsed.ref ?? (await getJson<{ default_branch: string }>(api)).default_branch
    const tree = await getJson<{ tree: { path: string; type: string; size?: number }[] }>(`${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
    const blobs = tree.tree.filter((t) => t.type === "blob")

    const picks: string[] = []
    if (parsed.path && blobs.some((b) => b.path === parsed.path)) picks.push(parsed.path)
    const readme = blobs.find((b) => /^readme(\.(md|rst|txt))?$/i.test(b.path))
    if (readme && !picks.includes(readme.path)) picks.push(readme.path)
    const scope = parsed.path && !blobs.some((b) => b.path === parsed.path) ? `${parsed.path.replace(/\/$/, "")}/` : ""
    const sources = blobs
      .filter((b) => (!scope || b.path.startsWith(scope)) && SOURCE_EXTENSIONS.has(extension(b.path)))
      .filter((b) => !SKIP_PATH.test(b.path) && !SKIP_FILE.test(b.path) && (b.size ?? 0) > 0 && (b.size ?? 0) <= MAX_FILE_BYTES)
      .filter((b) => !picks.includes(b.path))
      .sort((a, b) => rankSource(b.path, b.size ?? 0) - rankSource(a.path, a.size ?? 0))
      .slice(0, MAX_SOURCE_FILES)
    picks.push(...sources.map((b) => b.path))

    const files: string[] = []
    const parts: string[] = []
    let total = 0
    for (const path of picks) {
      if (total >= MAX_TOTAL_CHARS) break
      let body: string
      try {
        body = await getRaw({ ...parsed, ref }, path)
      } catch {
        continue
      }
      if (extension(path) === "ipynb") body = notebookText(body)
      body = body.replace(/\r\n/g, "\n").trim()
      if (!body) continue
      const room = Math.min(MAX_CHARS_PER_FILE, MAX_TOTAL_CHARS - total)
      const clipped = body.length > room ? `${body.slice(0, room)}\n[… truncated]` : body
      parts.push(`# File: ${path}\n${clipped}`)
      files.push(path)
      total += clipped.length
    }
    return files.length > 0 ? { files, text: parts.join("\n\n") } : null
  } catch (err) {
    console.warn("[wsl-github] Couldn't read", link, "-", err instanceof Error ? err.message : err)
    return null
  }
}
