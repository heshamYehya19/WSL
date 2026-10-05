const STEPS = [
  { label: "Industry Need", detail: "A company shares a real-world need and the skills it looks for" },
  { label: "Real-World Challenge", detail: "WSL structures it into a safe challenge a university can accept" },
  { label: "Student Work", detail: "Students work the challenge as part of their university coursework" },
  { label: "Evidence", detail: "Code, documents and data — organized by WSL, with AI helping surface what's relevant for review" },
  { label: "University Verification", detail: "The university verifies what each student actually demonstrated, or asks for more evidence" },
  { label: "Verified Proof", detail: "Only university-verified work is added to the student's proof profile" },
  { label: "Talent / Opportunity", detail: "Companies discover talent through verified proof, not CV claims" },
]

export function FlowLoop({ compact = false }: { compact?: boolean }) {
  return (
    // Two columns on phones: three left too little room for labels like "University Verification"
    // and pushed the page into sideways scroll. Seven steps: four across, then a row of three.
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${compact ? "lg:grid-cols-7" : ""}`}>
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          className="relative flex min-w-0 flex-col gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-md hover:shadow-ink-950/5 sm:px-4"
        >
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-night text-[11px] font-bold text-teal-300">
              {i + 1}
            </span>
            <span className="min-w-0 text-sm font-semibold text-ink-900 [overflow-wrap:anywhere]">{step.label}</span>
          </div>
          {!compact && <p className="text-xs leading-relaxed text-ink-500">{step.detail}</p>}
          {i < STEPS.length - 1 && (i + 1) % 4 !== 0 && (
            <span className="pointer-events-none absolute top-1/2 -right-3 hidden -translate-y-1/2 text-teal-400 sm:block">→</span>
          )}
        </div>
      ))}
    </div>
  )
}
