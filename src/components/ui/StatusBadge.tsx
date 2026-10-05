const TONE: Record<string, string> = {
  Draft: "bg-ink-100 text-ink-600 border-ink-200",
  "Sent to University": "bg-teal-100 text-teal-700 border-teal-400/40",
  "University Assigned": "bg-teal-100 text-teal-700 border-teal-500/50",
  "In Progress": "bg-sky-100 text-sky-700 border-sky-400/40",
  "Submissions Under Review": "bg-amber-100 text-amber-600 border-amber-400/40",
  "Confirmed to Company": "bg-ink-700 text-ink-50 border-ink-700",
  "Company Reviewed": "bg-verified-100 text-verified-600 border-verified-500/40",
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
