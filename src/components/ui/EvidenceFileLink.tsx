import { useState } from "react"
import { useStore } from "../../state/store"
import { formatBytes } from "../../lib/format"
import type { Evidence } from "../../types"

/** A document attached to an evidence item, downloadable by anyone who can read that evidence. */
export function EvidenceFileLink({ evidence }: { evidence: Evidence }) {
  const { downloadEvidenceFile } = useStore()
  const [busy, setBusy] = useState(false)
  if (!evidence.file) return null
  const { name, size } = evidence.file
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-ink-200 px-2.5 py-1.5">
      <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-[10px] font-bold text-teal-700">
        {name.slice(name.lastIndexOf(".") + 1).toUpperCase().slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink-800">{name}</p>
        <p className="text-[11px] text-ink-400">{formatBytes(size)}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await downloadEvidenceFile(evidence.id, name)
          setBusy(false)
        }}
        className="shrink-0 rounded-md border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
      >
        {busy ? "Downloading…" : "Download"}
      </button>
    </div>
  )
}
