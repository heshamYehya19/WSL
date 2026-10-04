import type { Lang } from "../../lib/i18n"

/** Switches a translated page between English and Arabic. */
export function LanguageToggle({ lang, onChange, tone = "light" }: { lang: Lang; onChange: (lang: Lang) => void; tone?: "light" | "dark" }) {
  const next: Lang = lang === "en" ? "ar" : "en"
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      lang={next}
      aria-label={next === "ar" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        tone === "dark" ? "border-white/20 text-white hover:border-teal-300 hover:text-teal-300" : "border-ink-200 text-ink-600 hover:border-teal-400 hover:text-teal-600"
      } ${next === "ar" ? "font-arabic" : ""}`}
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  )
}
