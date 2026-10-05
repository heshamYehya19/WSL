/** A skill label. `state` says where it stands with the university — never a score. */
export function SkillChip({
  skill,
  state,
  size = "md",
}: {
  skill: string
  state?: "verified" | "pending"
  size?: "sm" | "md"
}) {
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
  return (
    <span
      title={state === "verified" ? "Verified by the university" : state === "pending" ? "Awaiting university verification" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border bg-surface font-medium text-ink-800 ${
        state === "pending" ? "border-dashed border-ink-300" : "border-ink-200"
      } ${pad}`}
    >
      <span>{skill}</span>
      {state === "verified" && <span className="font-bold text-verified-600" aria-label="Verified">✓</span>}
      {state === "pending" && <span className="text-[10px] font-normal text-ink-400">pending</span>}
    </span>
  )
}
