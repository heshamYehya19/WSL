import { useState } from "react"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { SkillRecordBody } from "../../components/profile/SkillRecordBody"
import { CountUp } from "../../hooks/useCountUp"
import { LanguageToggle } from "../../components/ui/LanguageToggle"
import { isolate, langProps, useLanguage } from "../../lib/i18n"
import { studentProjects, studentSignals } from "../../lib/selectors"
import type { Availability } from "../../types"

const AVAILABILITIES: Availability[] = ["Open to Opportunities", "Open to Internships", "Not Available"]

const TEXT = {
  en: {
    eyebrow: "My Profile",
    title: "Living Skill Record",
    availability: { "Open to Opportunities": "Open to Opportunities", "Open to Internships": "Open to Internships", "Not Available": "Not Available" } as Record<Availability, string>,
    availabilityHint: {
      "Open to Opportunities": "Companies can reach out about jobs",
      "Open to Internships": "Internships and placements only",
      "Not Available": "Hidden from outreach for now",
    } as Record<Availability, string>,
    year: (y: string) => y,
    gpa: (g: string) => `GPA ${g}`,
    avgTitle: (n: number) => `Average evidence confidence: ${n}`,
    noBio: "No bio yet. Add a short intro so companies know what you're about.",
    notClaims: (first: string) => `Not what ${first} claims to know — what their work has demonstrated.`,
    edit: "Edit bio & availability",
    stats: ["Projects", "Skill signals", "University verified", "Evidence items"],
    availabilityHeading: "Availability",
    bio: "Bio",
    bioHelp: "Companies see this on your candidate profile. Your skill signals can't be edited — they come from your evidence.",
    saving: "Saving…",
    save: "Save changes",
    cancel: "Cancel",
  },
  ar: {
    eyebrow: "ملفي الشخصي",
    title: "سجل المهارات الحي",
    availability: { "Open to Opportunities": "متاح للفرص", "Open to Internships": "متاح للتدريب", "Not Available": "غير متاح" } as Record<Availability, string>,
    availabilityHint: {
      "Open to Opportunities": "يمكن للشركات التواصل معك بشأن الوظائف",
      "Open to Internships": "التدريب العملي فقط",
      "Not Available": "مخفي عن تواصل الشركات حاليًا",
    } as Record<Availability, string>,
    year: (y: string) => y.replace(/^Year (\d+)$/, "السنة $1"),
    gpa: (g: string) => `المعدل ${g}`,
    avgTitle: (n: number) => `متوسط ثقة الأدلة: ${n}`,
    noBio: "لا توجد نبذة بعد. أضف تعريفًا قصيرًا لتعرف الشركات من أنت.",
    notClaims: (first: string) => `ليس ما يدّعي ${isolate(first)} معرفته — بل ما أثبته عمله.`,
    edit: "تعديل النبذة والإتاحة",
    stats: ["المشاريع", "مؤشرات المهارات", "موثّقة من الجامعة", "عناصر الأدلة"],
    availabilityHeading: "الإتاحة",
    bio: "النبذة",
    bioHelp: "تظهر هذه النبذة للشركات في ملفك كمرشّح. لا يمكن تعديل مؤشرات مهاراتك — فهي مستمدة من أدلتك.",
    saving: "جارٍ الحفظ…",
    save: "حفظ التغييرات",
    cancel: "إلغاء",
  },
}

export default function MyProfile() {
  const { student } = useDemoUser()
  const { projects, evidence, skillSignals, getUniversity, getProgram, updateStudentProfile } = useStore()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [availability, setAvailability] = useState<Availability>("Open to Opportunities")
  const [saving, setSaving] = useState(false)
  const [lang, setLang] = useLanguage()
  if (!student) return null
  const t = TEXT[lang]
  const uni = getUniversity(student.universityId)
  const program = getProgram(student.programId)

  const mySignals = studentSignals(skillSignals, student.id)
  const uniqueSkills = new Map<string, number>()
  for (const s of mySignals) uniqueSkills.set(s.skill, Math.max(uniqueSkills.get(s.skill) ?? 0, s.evidenceConfidence))
  const avgScore = uniqueSkills.size ? Math.round([...uniqueSkills.values()].reduce((a, b) => a + b, 0) / uniqueSkills.size) : 0
  const verifiedCount = new Set(mySignals.filter((s) => s.status === "Verified").map((s) => s.skill)).size
  const stats = [
    { label: t.stats[0], value: studentProjects(projects, student.id).length },
    { label: t.stats[1], value: uniqueSkills.size },
    { label: t.stats[2], value: verifiedCount },
    { label: t.stats[3], value: evidence.filter((e) => e.studentId === student.id).length },
  ]
  const isOpen = student.availability !== "Not Available"

  const startEditing = () => {
    setBio(student.bio)
    setAvailability(student.availability)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    const ok = await updateStudentProfile(student.id, { bio, availability })
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <div {...langProps(lang)} className={`mx-auto max-w-5xl ${langProps(lang).className}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-teal-600 uppercase">{t.eyebrow}</div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">{t.title}</h1>
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
      </div>

      {/* HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-night shadow-xl shadow-ink-950/10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-start gap-5">
            {/* Avatar with a ring that fills to the student's average score */}
            <div className="group relative h-20 w-20 shrink-0" title={t.avgTitle(avgScore)}>
              <div
                className="absolute inset-0 rounded-full transition-transform duration-500 group-hover:rotate-180"
                style={{ background: `conic-gradient(var(--color-teal-400) ${avgScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
              />
              <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-night">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xl font-bold text-ink-950 transition-transform duration-300 group-hover:scale-95">
                  {student.initials}
                </span>
              </div>
              {avgScore > 0 && (
                <span className="absolute -end-1 -bottom-1 rounded-full border-2 border-night bg-teal-300 px-1.5 text-[10px] font-bold text-ink-950">
                  {avgScore}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-white">{student.name}</h2>
              <p className="mt-0.5 text-sm text-white/70">
                {program?.name ?? student.field} · {uni?.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[t.year(student.year), t.gpa(student.gpa.toFixed(2)), student.city, `#${student.studentNumber}`].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isOpen ? "border-teal-400/40 bg-teal-500/10 text-teal-300" : "border-white/15 bg-white/5 text-white/55"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {isOpen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isOpen ? "bg-teal-400" : "bg-ink-400"}`} />
              </span>
              {t.availability[student.availability]}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              {student.bio ? (
                <p dir="auto" className="max-w-2xl text-sm leading-relaxed text-white/85">{student.bio}</p>
              ) : (
                <p className="max-w-2xl text-sm text-white/55 italic">{t.noBio}</p>
              )}
              <p className="mt-3 max-w-xl border-s-2 border-teal-400/50 ps-3 text-xs text-white/55">{t.notClaims(student.name.split(" ")[0])}</p>
            </div>
            {!editing && (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 self-start justify-self-start rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-200 active:translate-y-0 lg:justify-self-end"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {t.edit}
              </button>
            )}
          </div>

          {/* Stat strip */}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="group bg-night/90 px-4 py-3 transition-colors hover:bg-night/60">
                <div className="text-2xl font-bold text-white tabular-nums transition-colors group-hover:text-teal-300">
                  <CountUp value={s.value} />
                </div>
                <div className="text-[11px] font-medium tracking-wide text-white/55 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <div className="animate-fade-in-up mt-4 rounded-2xl border border-teal-400/40 bg-surface p-5 shadow-lg shadow-teal-500/5">
          <div className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">{t.availabilityHeading}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {AVAILABILITIES.map((a) => {
              const active = availability === a
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvailability(a)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-start transition-all duration-200 hover:-translate-y-0.5 ${
                    active ? "border-teal-500 bg-teal-100/60 ring-2 ring-teal-400/30" : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-ink-900">{t.availability[a]}</div>
                  <div className="mt-0.5 text-xs text-ink-500">{t.availabilityHint[a]}</div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{t.bio}</span>
            <span className="text-[11px] text-ink-400 tabular-nums">{bio.length}/600</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={600}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
          />
          <p className="mt-1 text-xs text-ink-400">{t.bioHelp}</p>
          <div className="mt-4 flex gap-3">
            <button onClick={save} disabled={saving} className="rounded-full bg-night px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm font-medium text-ink-400 hover:text-ink-700">{t.cancel}</button>
          </div>
        </div>
      )}

      <div className="mt-10">
        <SkillRecordBody studentId={student.id} projectHref={(pid) => `/student/projects/${pid}`} lang={lang} />
      </div>
    </div>
  )
}
