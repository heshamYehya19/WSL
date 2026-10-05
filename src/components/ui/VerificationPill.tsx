import type { SkillSignalStatus } from "../../types"

/**
 * Where a skill stands with the university — the one thing a student or company should read
 * first. "Insufficient evidence" is a statement about the submission, never about the student.
 */
export function VerificationPill({ status, insufficient = false }: { status: SkillSignalStatus; insufficient?: boolean }) {
  const [label, tone] =
    status === "Verified"
      ? ["✓ Verified", "bg-verified-100 text-verified-600 border-verified-500/40"]
      : status === "Rejected"
        ? ["Not verified", "bg-ink-100 text-ink-600 border-ink-200"]
        : status === "More Evidence Requested"
          ? ["More evidence requested", "bg-amber-100 text-amber-700 border-amber-400/40"]
          : insufficient
            ? ["Insufficient evidence", "bg-ink-100 text-ink-600 border-ink-200"]
            : ["Pending University Verification", "bg-amber-100 text-amber-700 border-amber-400/40"]
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{label}</span>
}
