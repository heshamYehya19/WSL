import { evidenceSources, hasReadableContent } from "../../lib/aiNote"
import type { Evidence } from "../../types"

/**
 * What an evidence item is made of and what WSL did with each part, so a linked document the
 * university will open is never confused with an excerpt WSL actually analyzed.
 */
export function EvidenceSources({ evidence }: { evidence: Evidence }) {
  const sources = evidenceSources(evidence)
  return (
    <ul className="mt-2 space-y-0.5 text-[11px]">
      {sources.map((s) => (
        <li key={s.label} className="flex flex-wrap gap-x-1.5">
          <span className="font-semibold text-ink-600">{s.label}:</span>
          <span className={s.analyzed ? "font-medium text-teal-600" : "text-ink-500"}>{s.detail}</span>
        </li>
      ))}
      {!hasReadableContent(evidence) && <li className="text-ink-400">No readable content was available for automatic analysis.</li>}
    </ul>
  )
}
