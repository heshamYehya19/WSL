import type { EvidenceQuote } from "../../types"

/** The exact lines of a student's work an AI signal relies on, each with what it shows. */
export function EvidenceQuotes({ quotes, evidenceTitle }: { quotes: EvidenceQuote[]; evidenceTitle?: (id: string) => string | undefined }) {
  if (quotes.length === 0) return null
  return (
    <ul className="space-y-2">
      {quotes.map((q) => (
        <li key={`${q.evidenceId}-${q.text}`} className="border-l-2 border-teal-400 pl-2.5">
          <code className="block rounded-md bg-ink-50 px-2 py-1 font-mono text-[11px] whitespace-pre-wrap [overflow-wrap:anywhere] text-ink-800">{q.text}</code>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {q.why}
            {evidenceTitle?.(q.evidenceId) ? <span className="text-ink-400"> · {evidenceTitle(q.evidenceId)}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  )
}
