import { useState } from "react"
import { useStore } from "../../state/store"
import { formatBytes } from "../../lib/format"
import type { Challenge, ChallengeFileKind } from "../../types"

const extOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toUpperCase()

/** A challenge's attached files of one kind, each downloadable by anyone who can see the challenge. */
export function ChallengeFileList({ challenge, kind }: { challenge: Challenge; kind: ChallengeFileKind }) {
  const { downloadFile } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const files = challenge.files.filter((f) => f.kind === kind)
  if (files.length === 0) return null

  return (
    <ul className="mt-3 space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2">
          <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-[10px] font-bold text-teal-700">{extOf(f.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{f.name}</p>
            <p className="text-xs text-ink-400">{formatBytes(f.size)}</p>
          </div>
          <button
            type="button"
            disabled={busy === f.id}
            onClick={async () => {
              setBusy(f.id)
              await downloadFile(challenge.id, f.id, f.name)
              setBusy(null)
            }}
            className="shrink-0 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
          >
            {busy === f.id ? "Downloading…" : "Download"}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Shown wherever a challenge is reviewed: what WSL's screen flagged that the company chose to share anyway. */
export function SharedDataNotice({ challenge, companyName }: { challenge: Challenge; companyName?: string }) {
  if (!challenge.sharedSensitiveData) return null
  return (
    <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-100 px-3 py-2 text-xs text-ink-800">
      <p className="font-semibold text-amber-600">Contains personal data, shared with the company's confirmation</p>
      <p className="mt-1">
        WSL's automatic screen found{" "}
        {challenge.sharedSensitiveData
          .map((f) => (f.kind === "unreadable" ? `${f.count} file${f.count === 1 ? "" : "s"} it couldn't fully check` : `${f.count} × ${f.label.toLowerCase()}`))
          .join(", ")}
        . {companyName ?? "The company"} confirmed it's OK to share. Handle it confidentially and only for this challenge.
      </p>
    </div>
  )
}
