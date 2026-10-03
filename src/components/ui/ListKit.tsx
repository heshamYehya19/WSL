import type { ReactNode } from "react"
import { CountUp } from "../../hooks/useCountUp"
import type { ChallengeStatus } from "../../types"
import { PIPELINE } from "../../lib/pipeline"

/* Shared building blocks for the list pages (challenges, projects, opportunities, talent),
   so they read as one family with the dashboards. */

/** Compact dark banner: eyebrow, title, subtitle, an optional action and a row of live stats. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  action,
  stats = [],
}: {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  stats?: { label: string; value: number; suffix?: string; accent?: boolean }[]
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl bg-night shadow-xl shadow-ink-950/10">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -top-24 right-10 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="relative p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="text-xs font-semibold tracking-wide text-teal-300 uppercase">{eyebrow}</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/65">{subtitle}</p>}
          </div>
          {action}
        </div>
        {stats.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`group rounded-2xl border px-4 py-2 transition-colors ${
                  s.accent ? "border-teal-400/40 bg-teal-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <span className={`text-lg font-bold tabular-nums ${s.accent ? "text-teal-300" : "text-white"}`}>
                  <CountUp value={s.value} suffix={s.suffix} />
                </span>
                <span className="ml-2 text-xs text-white/55">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Search field with a magnifier icon and a one-click clear. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="group relative min-w-56 flex-1">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-teal-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-ink-200 bg-surface py-2.5 pr-9 pl-10 text-sm shadow-sm outline-none transition-all focus:border-teal-400 focus:ring-4 focus:ring-teal-400/15"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          ✕
        </button>
      )}
    </div>
  )
}

/** A wrap-friendly row of filter pills, each optionally carrying a count. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {label && <span className="mr-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{label}</span>}
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              active
                ? "border-night bg-night text-white shadow-md shadow-ink-950/10"
                : "border-ink-200 bg-surface text-ink-600 hover:-translate-y-0.5 hover:border-teal-400 hover:text-ink-900"
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-teal-400 text-ink-950" : "bg-ink-100 text-ink-500"}`}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}


/** Segmented track showing how far along the pipeline a status is; `from` trims early stages. */
export function StageTrack({ status, from = 0, showLabel = false }: { status: ChallengeStatus; from?: number; showLabel?: boolean }) {
  const stages = PIPELINE.slice(from)
  const idx = stages.findIndex((s) => s.status === status)
  return (
    <div>
      <div className="flex gap-1" aria-label={`Stage ${idx + 1} of ${stages.length}: ${status}`}>
        {stages.map((s, i) => (
          <span
            key={s.status}
            title={s.status}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              i < idx ? "bg-teal-500" : i === idx ? (status === "Verified" || status === "Completed" ? "bg-verified-500" : "bg-teal-400 animate-pulse motion-reduce:animate-none") : "bg-ink-100"
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <div className="mt-1.5 flex justify-between text-[10px] font-medium text-ink-400">
          <span>{stages[0].short}</span>
          <span>{stages[stages.length - 1].short}</span>
        </div>
      )}
    </div>
  )
}

/** Three bars for Foundational / Intermediate / Advanced. */
export function DifficultyBars({ level }: { level: string }) {
  const n = level === "Advanced" ? 3 : level === "Intermediate" ? 2 : 1
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-500" title={`${level} difficulty`}>
      <span className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-1 rounded-sm ${i <= n ? "bg-teal-500" : "bg-ink-200"}`} style={{ height: `${4 + i * 3}px` }} />
        ))}
      </span>
      {level}
    </span>
  )
}

/** Days-left pill that warms up as the deadline approaches. */
export function DeadlinePill({ days }: { days: number }) {
  const tone = days <= 0 ? "bg-ink-100 text-ink-400" : days <= 7 ? "bg-danger-100 text-danger-600" : days <= 21 ? "bg-amber-100 text-amber-600" : "bg-ink-100 text-ink-500"
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {days <= 0 ? "Closed" : `${days}d left`}
    </span>
  )
}

/** Small circular match meter (0–100) used on opportunity and talent cards. */
export function MatchRing({ pct, label }: { pct: number; label?: string }) {
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center" title={label}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-ink-100" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${pct >= 75 ? "stroke-teal-500" : pct > 0 ? "stroke-teal-400" : "stroke-ink-200"}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className="text-[11px] font-bold text-ink-900 tabular-nums">{pct}</span>
    </span>
  )
}
