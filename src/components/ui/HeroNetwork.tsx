import type { ReactNode } from "react"
import { ConstellationField } from "./ConstellationField"

function AudienceCard({
  icon,
  title,
  subtitle,
  children,
  className = "",
  highlighted = false,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  children?: ReactNode
  className?: string
  highlighted?: boolean
}) {
  return (
    <div
      className={`w-40 shrink-0 rounded-2xl border p-3 shadow-xl backdrop-blur-sm sm:w-44 ${
        highlighted ? "z-20 border-teal-400/40 bg-ink-900/95" : "z-10 border-white/10 bg-ink-900/80"
      } ${className}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              highlighted ? "bg-teal-500/20 text-teal-300" : "bg-white/5 text-teal-300"
            }`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="truncate text-[10px] leading-tight text-ink-400">{subtitle}</div>
          </div>
        </div>
        <span className="shrink-0 text-xs text-ink-500">›</span>
      </div>
      {children}
    </div>
  )
}

function MiniThumb({ label }: { label: string }) {
  return (
    <div className="rounded-md bg-white/5 p-1.5">
      <div className="h-8 rounded bg-gradient-to-br from-teal-500/25 to-white/5" />
      <div className="mt-1 text-[9px] leading-tight text-ink-400">{label}</div>
    </div>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3.1-6.4 7-6.4s7 2.8 7 6.4" />
    </svg>
  )
}

function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z" />
      <path d="M6 11.6v4.2c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9v-4.2" />
      <path d="M21.5 9.5v5.6" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3.5" width="10" height="17" rx="1" />
      <rect x="14" y="9.5" width="6" height="11" rx="1" />
      <path d="M7.5 7.5h1M11 7.5h1M7.5 11h1M11 11h1M7.5 14.5h1M11 14.5h1" />
    </svg>
  )
}

export function HeroNetwork() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="pointer-events-none absolute -top-16 -right-8 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

      <ConstellationField className="absolute inset-0 h-full w-full" />

      <div className="relative flex flex-col items-center gap-3 px-1 py-8 sm:flex-row sm:items-start sm:justify-center sm:gap-3 sm:py-14">
        <AudienceCard icon={<UserIcon />} title="Students" subtitle="Interactive skill cards" className="sm:mt-8">
          <div className="grid grid-cols-2 gap-1.5">
            <MiniThumb label="Proof of Project" />
            <MiniThumb label="Certificate" />
          </div>
        </AudienceCard>

        <AudienceCard highlighted icon={<CapIcon />} title="Universities" subtitle="Expand through skill cards">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] font-medium text-teal-200">Skill Alignment Tool</div>
            <div className="mt-1.5 h-10 rounded bg-gradient-to-r from-teal-500/30 via-teal-400/20 to-transparent" />
          </div>
        </AudienceCard>

        <AudienceCard icon={<BuildingIcon />} title="Organizations" subtitle="Expand their skill cards" className="sm:mt-8">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] font-medium text-teal-200">AI Talent Matcher</div>
            <div className="mt-1 text-[9px] leading-tight text-ink-400">
              Matches candidates by rated skill evidence.
            </div>
          </div>
        </AudienceCard>
      </div>
    </div>
  )
}
