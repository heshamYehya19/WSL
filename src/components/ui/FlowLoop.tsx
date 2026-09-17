const STEPS = [
  { label: "Real Problem", detail: "A company submits a real operational challenge" },
  { label: "Learn", detail: "University connects it to a real course" },
  { label: "Build", detail: "Students work the problem as a team" },
  { label: "Evidence", detail: "Work produces reports, code, and artifacts" },
  { label: "AI Signal", detail: "AI identifies evidence-backed skill signals" },
  { label: "Verify", detail: "A human mentor reviews and verifies" },
  { label: "Prove", detail: "Skill joins the student's living record" },
  { label: "Opportunity", detail: "Companies discover verified capability" },
]

export function FlowLoop({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${compact ? "lg:grid-cols-8" : "lg:grid-cols-4"}`}>
      {STEPS.map((step, i) => (
        <div key={step.label} className="relative flex flex-col gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-950 text-[11px] font-bold text-teal-300">
              {i + 1}
            </span>
            <span className="text-sm font-semibold text-ink-900">{step.label}</span>
          </div>
          {!compact && <p className="text-xs leading-relaxed text-ink-500">{step.detail}</p>}
          {i < STEPS.length - 1 && (
            <span className="pointer-events-none absolute top-1/2 -right-3 hidden -translate-y-1/2 text-teal-400 sm:block lg:block">
              {(i + 1) % 4 !== 0 ? "→" : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
