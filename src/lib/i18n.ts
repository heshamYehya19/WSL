import { useState } from "react"
import type { SuggestedLevel } from "../types.ts"

// English / Arabic for the two pages that offer it — the landing page and a student's
// Living Skill Record. Everything else in WSL is English-only. Data (names, project
// titles, skills, quoted code) is shown as stored; only the interface is translated.

export type Lang = "en" | "ar"

const STORAGE_KEY = "wsl-lang"

/** The viewer's chosen language, remembered in this browser only. */
export function useLanguage(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en"
    } catch {
      return "en"
    }
  })
  const choose = (next: Lang) => {
    setLang(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just won't be remembered.
    }
  }
  return [lang, choose]
}

/**
 * Wraps an embedded name or title (usually English data inside an Arabic sentence) in
 * Unicode bidi isolates, so it can't pull neighbouring numbers or punctuation into its
 * own direction — e.g. the day of a date ending up glued to an English name.
 */
export const isolate = (text: string) => `⁨${text}⁩`

/** dir/lang/font for a translated page's root element. */
export function langProps(lang: Lang) {
  return { dir: lang === "ar" ? "rtl" : "ltr", lang, className: lang === "ar" ? "font-arabic" : "" } as const
}

export const LEVEL_AR: Record<SuggestedLevel, string> = {
  Insufficient: "أدلة غير كافية",
  Foundational: "أساسي",
  Intermediate: "متوسط",
  Advanced: "متقدّم",
  Demonstrated: "مُثبَت عمليًا",
}

export function levelLabel(level: SuggestedLevel, lang: Lang): string {
  return lang === "ar" ? LEVEL_AR[level] : level
}

const STATUS_AR: Record<string, string> = {
  Draft: "مسودة",
  "Sent to University": "أُرسل إلى الجامعة",
  "University Assigned": "أسندته الجامعة",
  "In Progress": "قيد التنفيذ",
  "Evidence Under Review": "الأدلة قيد المراجعة",
  "Skills Pending Verification": "المهارات بانتظار التوثيق",
  Verified: "موثّق",
  Completed: "مكتمل",
  "Company Feedback Received": "وصلت ملاحظات الشركة",
  "Pending Verification": "بانتظار التوثيق",
  "More Evidence Requested": "طُلبت أدلة إضافية",
  Rejected: "مرفوض",
}

export function statusLabel(status: string, lang: Lang): string {
  return lang === "ar" ? (STATUS_AR[status] ?? status) : status
}

const EVIDENCE_TYPE_AR: Record<string, string> = {
  "Project Report": "تقرير المشروع",
  "GitHub Repository": "مستودع GitHub",
  Code: "شيفرة برمجية",
  Presentation: "عرض تقديمي",
  Prototype: "نموذج أولي",
  Documentation: "توثيق",
  Analysis: "تحليل",
  "Dataset / Model": "بيانات / نموذج",
  "Video Walkthrough": "فيديو شرح",
}

export function evidenceTypeLabel(type: string, lang: Lang): string {
  return lang === "ar" ? (EVIDENCE_TYPE_AR[type] ?? type) : type
}

/** A date in the page's language, with Western digits in both. */
export function formatDateIn(lang: Lang, iso: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", { ...options, numberingSystem: "latn" }).format(new Date(iso))
}
