import { ConstellationField } from "./ConstellationField"
import { formatDateIn, isolate, levelLabel } from "../../lib/i18n"
import type { Lang } from "../../lib/i18n"
import type { ShowcaseRecord } from "../../types"

const TEXT = {
  en: {
    badge: "Skill record",
    verified: "verified",
    verifiedBy: (name: string, date: string) => `Verified by mentor ${name} · ${date}`,
    from: (project: string, company: string) => `From “${project}”, a challenge set by ${company}.`,
    illustrative: "Illustrative demo data.",
  },
  ar: {
    badge: "سجل المهارات",
    verified: "موثّق",
    verifiedBy: (name: string, date: string) => `وثّقه المرشد ${isolate(name)} · ${isolate(date)}`,
    from: (project: string, company: string) => `من تحدي «${isolate(project)}» الذي طرحته ${isolate(company)}.`,
    illustrative: "بيانات توضيحية للعرض.",
  },
}

function ShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

/**
 * The landing hero's picture of what WSL produces: a real verified skill record from the
 * database — the student, a few mentor-verified skills, and the exact line of their work
 * that backs each one.
 */
export function HeroSkillRecord({ record, lang = "en" }: { record: ShowcaseRecord; lang?: Lang }) {
  const t = TEXT[lang]
  return (
    // min-w-0: as a grid item it would otherwise grow to fit the longest quoted line instead of truncating it.
    <div className="relative mx-auto w-full max-w-md min-w-0">
      {/* Kept inside the column's own box (inset, not negative offsets) so it can't cause sideways scroll. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-0 h-56 rounded-full bg-teal-500/20 blur-3xl" />
      <ConstellationField className="absolute inset-0 h-full w-full" />

      <figure className="relative rounded-2xl border border-white/10 bg-night/90 p-4 text-start shadow-2xl shadow-teal-950/40 backdrop-blur-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-sm font-bold text-teal-300">
            {initials(record.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{record.studentName}</p>
            <p className="truncate text-xs text-ink-400">
              {record.program} · {record.university}
            </p>
          </div>
          <span className="ms-auto shrink-0 rounded-full border border-teal-400/30 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-teal-300 uppercase">
            {t.badge}
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {record.skills.map((s) => (
            <li key={s.skill} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">{s.skill}</span>
                <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-200">{levelLabel(s.level, lang)}</span>
                <span className="text-xs font-semibold text-verified-500" aria-label={t.verified}>✓</span>
              </div>
              {/* Code is always left-to-right, even inside an Arabic page. */}
              <code dir="ltr" className="mt-2 block truncate rounded-md bg-black/30 px-2 py-1 text-left font-mono text-[11px] text-ink-200" title={s.quote.text}>
                {s.quote.text}
              </code>
              {/* English data, so it truncates at its own end even on an Arabic page. */}
              <p dir="auto" className="mt-1 truncate text-[11px] text-ink-400">
                {s.quote.why} · {s.quote.evidenceTitle}
              </p>
              <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-verified-500/15 px-2 py-0.5 text-[10px] font-semibold text-verified-500">
                <ShieldCheck />
                <span className="truncate">{t.verifiedBy(s.verifiedBy, formatDateIn(lang, s.verifiedAt))}</span>
              </p>
            </li>
          ))}
        </ul>

        <figcaption className="mt-4 text-[11px] leading-relaxed text-ink-400">
          {t.from(record.projectTitle, record.company)} <span className="text-ink-500">{t.illustrative}</span>
        </figcaption>
      </figure>
    </div>
  )
}
