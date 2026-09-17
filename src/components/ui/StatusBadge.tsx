const TONE: Record<string, string> = {
  Draft: "bg-ink-100 text-ink-600 border-ink-200",
  Submitted: "bg-ink-100 text-ink-700 border-ink-200",
  "Under WSL Review": "bg-amber-100 text-amber-600 border-amber-400/40",
  Approved: "bg-teal-100 text-teal-700 border-teal-400/40",
  "Sent to University": "bg-teal-100 text-teal-700 border-teal-400/40",
  "University Accepted": "bg-teal-100 text-teal-700 border-teal-400/40",
  "Open to Students": "bg-teal-100 text-teal-700 border-teal-500/50",
  "In Progress": "bg-sky-100 text-sky-700 border-sky-400/40",
  Completed: "bg-ink-700 text-ink-50 border-ink-700",
  "Evidence Under Review": "bg-amber-100 text-amber-600 border-amber-400/40",
  Verified: "bg-verified-100 text-verified-600 border-verified-500/40",
  "Pending Verification": "bg-amber-100 text-amber-600 border-amber-400/40",
  "More Evidence Requested": "bg-amber-100 text-amber-600 border-amber-400/40",
  Rejected: "bg-danger-100 text-danger-600 border-danger-600/30",
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const tone = TONE[status] ?? "bg-ink-100 text-ink-700 border-ink-200"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone} ${className}`}
    >
      {status}
    </span>
  )
}
