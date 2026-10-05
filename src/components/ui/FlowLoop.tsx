const STEPS = [
  { label: "Real Problem", detail: "A company submits a real operational challenge" },
  { label: "Learning Project", detail: "A university assigns it to students of the relevant college" },
  { label: "Student Work", detail: "A student works the challenge and submits real evidence" },
  { label: "Evidence", detail: "Code, documents, and data — not just claims" },
  { label: "AI Signals", detail: "WSL analyzes evidence for each required skill — informational, never blocking" },
  { label: "Human Verification", detail: "A university mentor verifies, rejects, or requests more evidence on each signal" },
  { label: "Verified Skills", detail: "Only a mentor's decision adds a skill to the student's living record" },
  { label: "Talent Discovery", detail: "Companies search and discover verified evidence, not claimed skills" },
  { label: "Opportunity", detail: "Verified work becomes discoverable for real opportunities" },
]

export function FlowLoop({ compact = false }: { compact?: boolean }) {
  return (
    // Two columns on phones: three left too little room for labels like "Opportunity" and
    // pushed the page into sideways scroll.
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${compact ? "lg:grid-cols-9" : ""}`}>
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          className="relative flex min-w-0 flex-col gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-md hover:shadow-ink-950/5 sm:px-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-night text-[11px] font-bold text-teal-300">
              {i + 1}
            </span>
            <span className="text-sm font-semibold text-ink-900">{step.label}</span>
          </div>
          {!compact && <p className="text-xs leading-relaxed text-ink-500">{step.detail}</p>}
          {i < STEPS.length - 1 && (
            <span className="pointer-events-none absolute top-1/2 -right-3 hidden -translate-y-1/2 text-teal-400 sm:block lg:block">
              {(i + 1) % 3 !== 0 ? "→" : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
