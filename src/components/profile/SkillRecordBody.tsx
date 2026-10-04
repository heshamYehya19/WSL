import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useStore } from "../../state/store"
import { SkillChip } from "../ui/SkillChip"
import { StatusBadge } from "../ui/StatusBadge"
import { evidenceTypeLabel, formatDateIn, isolate, levelLabel, statusLabel } from "../../lib/i18n"
import type { Lang } from "../../lib/i18n"
import { challengeFor, skillsForProject, studentProjects, studentSignals } from "../../lib/selectors"
import type { SkillSignal, SuggestedLevel } from "../../types"

interface SkillSummary {
  skill: string
  signal: SkillSignal
  projectId: string
  projects: number
}

const LEVEL_STYLE: Record<SuggestedLevel, { bar: string; text: string }> = {
  Demonstrated: { bar: "from-teal-500 to-teal-300", text: "text-teal-600" },
  Advanced: { bar: "from-teal-400 to-teal-300/70", text: "text-teal-500" },
  Intermediate: { bar: "from-amber-500 to-amber-400", text: "text-amber-500" },
  Foundational: { bar: "from-ink-400 to-ink-300", text: "text-ink-500" },
  Insufficient: { bar: "from-ink-300 to-ink-200", text: "text-ink-400" },
}

const TEXT = {
  en: {
    assessment: (level: SuggestedLevel) => (level === "Insufficient" ? "Insufficient Evidence" : `AI assessment: ${level}`),
    projects: (n: number) => `${n} project${n === 1 ? "" : "s"}`,
    signsFound: (n: number) => `${n} concrete sign${n === 1 ? "" : "s"} found`,
    universityVerified: "University Verified",
    verifiedBy: (name: string) => `Verified by ${name}`,
    viewEvidence: "View supporting evidence →",
    unverified: "Unverified · AI signal only",
    rejected: "A university mentor reviewed this and did not verify it.",
    insufficient: "Not enough evidence yet — add more evidence and ask for analysis again.",
    notChecked: "Not yet checked by a university mentor.",
    intro: "Evidence confidence indicates how strongly submitted work supports a skill signal. It does not represent proficiency — only a university mentor's verification does.",
    skillSignals: "Skill Signals",
    verifiedSkills: (n: number) => `Verified skills · ${n}`,
    includeUnverified: (n: number) => `Include unverified AI signals · ${n}`,
    allSignals: (n: number) => `All signals · ${n}`,
    noSignals: "No skill signals yet — submit evidence on a project to get WSL's AI evidence analysis.",
    noVerified: "No university-verified skills yet — they appear once a mentor verifies a skill signal.",
    timeline: "Project Timeline",
    team: "Team project — ",
    you: "you",
    teammate: "a teammate",
    tasks: (done: number, total: number) => `${done}/${total} tasks`,
    projectSignals: "Skill signals",
    noProjectSignals: "No signals yet.",
    evidence: "Evidence",
    noEvidence: "No evidence submitted yet.",
    confidenceTitle: (n: number, status: string) => `Evidence confidence ${n}% · ${status}`,
    noProjects: "No projects yet.",
  },
  ar: {
    assessment: (level: SuggestedLevel) => (level === "Insufficient" ? levelLabel(level, "ar") : `تقييم الذكاء الاصطناعي: ${levelLabel(level, "ar")}`),
    projects: (n: number) => `المشاريع: ${n}`,
    signsFound: (n: number) => `مؤشرات ملموسة: ${n}`,
    universityVerified: "موثّق من الجامعة",
    verifiedBy: (name: string) => `وثّقه ${isolate(name)}`,
    viewEvidence: "عرض الأدلة الداعمة ←",
    unverified: "غير موثّق · مؤشر من الذكاء الاصطناعي فقط",
    rejected: "راجع مرشد جامعي هذه المهارة ولم يوثّقها.",
    insufficient: "لا توجد أدلة كافية بعد — أضف أدلة أخرى واطلب التحليل من جديد.",
    notChecked: "لم يراجعها مرشد جامعي بعد.",
    intro: "تشير ثقة الأدلة إلى مدى دعم العمل المقدَّم لمؤشر المهارة، ولا تعبّر عن مستوى الإتقان — فتوثيق المرشد الجامعي وحده يفعل ذلك.",
    skillSignals: "مؤشرات المهارات",
    verifiedSkills: (n: number) => `المهارات الموثّقة · ${n}`,
    includeUnverified: (n: number) => `تضمين المؤشرات غير الموثّقة · ${n}`,
    allSignals: (n: number) => `كل المؤشرات · ${n}`,
    noSignals: "لا توجد مؤشرات مهارات بعد — قدّم أدلة في أحد المشاريع ليحللها وصل بالذكاء الاصطناعي.",
    noVerified: "لا توجد مهارات موثّقة من الجامعة بعد — تظهر هنا حين يوثّق مرشد مؤشر مهارة.",
    timeline: "الخط الزمني للمشاريع",
    team: "مشروع جماعي — ",
    you: "أنت",
    teammate: "زميل في الفريق",
    tasks: (done: number, total: number) => `المهام ${done}/${total}`,
    projectSignals: "مؤشرات المهارات",
    noProjectSignals: "لا مؤشرات بعد.",
    evidence: "الأدلة",
    noEvidence: "لم تُقدَّم أدلة بعد.",
    confidenceTitle: (n: number, status: string) => `ثقة الأدلة ${n}% · ${status}`,
    noProjects: "لا مشاريع بعد.",
  },
}

function ShieldIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SkillCard({
  s,
  index,
  mounted,
  projectHref,
  getStaff,
  lang,
}: {
  s: SkillSummary
  index: number
  mounted: boolean
  projectHref: (projectId: string) => string
  getStaff: (id: string) => { name: string } | undefined
  lang: Lang
}) {
  const t = TEXT[lang]
  const level = LEVEL_STYLE[s.signal.suggestedLevel]
  const verified = s.signal.status === "Verified"
  const verifier = s.signal.verifiedBy ? getStaff(s.signal.verifiedBy) : undefined
  const signsFound = s.signal.criteria.filter((c) => c.met).length
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-fade-in-up group rounded-2xl border border-ink-200 bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">
            {s.skill}
            {verified && <span className="ms-1 text-verified-600">✓</span>}
          </div>
          <div className={`mt-0.5 text-sm font-bold ${level.text}`}>{t.assessment(s.signal.suggestedLevel)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
            <span>{t.projects(s.projects)}</span>
            {s.signal.criteria.length > 0 && (
              <>
                <span>·</span>
                <span>{t.signsFound(signsFound)}</span>
              </>
            )}
          </div>
        </div>
        {/* Evidence confidence stays secondary to the assessment above. */}
        <span className="text-xs font-semibold text-ink-400 tabular-nums">{s.signal.evidenceConfidence}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${level.bar} transition-[width] duration-700 ease-out rtl:bg-gradient-to-l`}
          style={{ width: mounted ? `${s.signal.evidenceConfidence}%` : "0%", transitionDelay: `${index * 40}ms` }}
        />
      </div>
      {verified ? (
        <div className="mt-2.5 space-y-0.5 text-[11px] text-ink-500">
          <div className="inline-flex items-center gap-1 rounded-full bg-verified-100 px-2 py-0.5 text-[10px] font-semibold text-verified-600">
            <ShieldIcon className="h-3 w-3" />
            {t.universityVerified}
          </div>
          {verifier && (
            <p className="pt-1">
              {t.verifiedBy(verifier.name)}
              {s.signal.verifiedAt ? ` · ${isolate(formatDateIn(lang, s.signal.verifiedAt))}` : ""}
            </p>
          )}
          <Link to={projectHref(s.projectId)} className="inline-block pt-0.5 text-teal-600 hover:underline">
            {t.viewEvidence}
          </Link>
        </div>
      ) : (
        <div className="mt-2.5 space-y-1 text-[11px] text-ink-400">
          <div className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{t.unverified}</div>
          <p>{s.signal.status === "Rejected" ? t.rejected : s.signal.suggestedLevel === "Insufficient" ? t.insufficient : t.notChecked}</p>
        </div>
      )}
    </div>
  )
}

export function SkillRecordBody({
  studentId,
  projectHref,
  verifiedOnlyByDefault = false,
  lang = "en",
}: {
  studentId: string
  projectHref: (projectId: string) => string
  /** For companies: open on verified skills only, so an AI signal is never mistaken for a verified skill. */
  verifiedOnlyByDefault?: boolean
  /** Only a student's own Living Skill Record offers Arabic; every other view stays English. */
  lang?: Lang
}) {
  const t = TEXT[lang]
  const { projects, challenges, evidence, skillSignals, getOrg, getStaff, getStudent } = useStore()
  const [filter, setFilter] = useState<"all" | "verified">(verifiedOnlyByDefault ? "verified" : "all")
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const mySignals = studentSignals(skillSignals, studentId)
  const myProjects = studentProjects(projects, studentId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const bySkill = new Map<string, SkillSummary>()
  for (const s of mySignals) {
    const cur = bySkill.get(s.skill)
    // Prefer a verified signal over any other; among equally-verified (or equally
    // unverified) signals, the strongest evidence confidence wins.
    const better = !cur || (s.status === "Verified" && cur.signal.status !== "Verified") || (s.status === cur.signal.status && s.evidenceConfidence > cur.signal.evidenceConfidence)
    if (better) bySkill.set(s.skill, { skill: s.skill, signal: s, projectId: s.projectId, projects: (cur?.projects ?? 0) + 1 })
    else if (cur) cur.projects += 1
  }
  const allSkills = [...bySkill.values()].sort((a, b) => b.signal.evidenceConfidence - a.signal.evidenceConfidence)
  const shownSkills = filter === "verified" ? allSkills.filter((s) => s.signal.status === "Verified") : allSkills
  const verifiedCount = allSkills.filter((s) => s.signal.status === "Verified").length

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-ink-500">{t.intro}</p>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">{t.skillSignals}</h3>
          {allSkills.length > 0 && (
            <div className="inline-flex rounded-full border border-ink-200 bg-surface p-1 text-xs font-semibold">
              {(
                (verifiedOnlyByDefault
                  ? [
                      ["verified", t.verifiedSkills(verifiedCount)],
                      ["all", t.includeUnverified(allSkills.length - verifiedCount)],
                    ]
                  : [
                      ["all", t.allSignals(allSkills.length)],
                      ["verified", t.verifiedSkills(verifiedCount)],
                    ]) as readonly (readonly ["all" | "verified", string])[]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`rounded-full px-3 py-1 transition-all duration-200 ${filter === key ? "bg-night text-white shadow" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {allSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">{t.noSignals}</p>
        ) : shownSkills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-surface p-6 text-center text-sm text-ink-400">{t.noVerified}</p>
        ) : (
          <div key={filter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownSkills.map((s, i) => (
              <SkillCard key={s.skill} s={s} index={i} mounted={mounted} projectHref={projectHref} getStaff={getStaff} lang={lang} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h3 className="mb-5 text-lg font-semibold text-ink-900">{t.timeline}</h3>
        <div className="relative space-y-6 ps-8">
          <div className="absolute start-[9px] top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-teal-400 via-ink-200 to-transparent" />
          {myProjects.map((p, idx) => {
            const org = getOrg(p.organizationId)
            const challenge = challengeFor(challenges, p)
            const signals = skillsForProject(skillSignals, p.id).filter((s) => s.studentId === studentId && (filter === "all" || s.status === "Verified"))
            const myEv = evidence.filter((e) => e.projectId === p.id && e.studentId === studentId)
            const live = p.status === "In Progress" || p.status === "Evidence Under Review" || p.status === "Skills Pending Verification"
            const resolved = p.status === "Verified" || p.status === "Completed" || p.status === "Company Feedback Received"
            const done = p.tasks.filter((task) => task.done).length
            const memberName = (id: string) => (id === studentId ? t.you : (getStudent(id)?.name ?? t.teammate))
            return (
              <div key={p.id} style={{ animationDelay: `${idx * 70}ms` }} className="animate-fade-in-up group relative">
                <span className="absolute -start-8 top-5 flex h-5 w-5 items-center justify-center">
                  {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/50 motion-reduce:animate-none" />}
                  <span
                    className={`relative h-3.5 w-3.5 rounded-full border-[3px] border-ink-50 transition-transform duration-200 group-hover:scale-125 ${
                      resolved ? "bg-verified-500" : "bg-teal-500"
                    }`}
                  />
                </span>

                <div className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-200 group-hover:border-teal-400/60 group-hover:shadow-lg group-hover:shadow-teal-500/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-xs font-bold text-teal-300">
                        {org?.logoInitials ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <Link to={projectHref(p.id)} className="font-semibold text-ink-900 transition-colors hover:text-teal-600">
                          {p.title}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {org?.name} · {challenge?.industry} · {formatDateIn(lang, p.startedAt, { month: "short", year: "numeric" })}
                        </p>
                        {p.members.length > 0 && (
                          <p className="mt-0.5 text-xs text-ink-400">
                            {t.team}
                            {memberName(p.studentId)}
                            {p.members.map((m) => `${lang === "ar" ? "، " : ", "}${memberName(m.studentId)}: ${m.roleNote}`).join("")}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={p.status} label={statusLabel(p.status, lang)} />
                  </div>

                  {p.tasks.length > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                          style={{ width: mounted ? `${(done / p.tasks.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-ink-400 tabular-nums">{t.tasks(done, p.tasks.length)}</span>
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{t.projectSignals}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {signals.length === 0 && <span className="text-xs text-ink-400">{t.noProjectSignals}</span>}
                        {signals.map((s) => (
                          <span key={s.id} title={t.confidenceTitle(s.evidenceConfidence, statusLabel(s.status, lang))} className="inline-flex items-center gap-1">
                            <SkillChip skill={s.skill} rating={s.evidenceConfidence} size="sm" />
                            {s.status === "Verified" && <ShieldIcon className="h-3.5 w-3.5 text-verified-600" />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{t.evidence}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {myEv.length === 0 && <span className="text-xs text-ink-400">{t.noEvidence}</span>}
                        {myEv.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-600 transition-colors hover:border-teal-400"
                          >
                            <span className="font-semibold text-ink-800">{evidenceTypeLabel(e.type, lang)}</span>
                            <span className="text-ink-300">·</span>
                            <span dir="auto" className="max-w-[12rem] truncate">{e.title}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {myProjects.length === 0 && <p className="text-sm text-ink-400">{t.noProjects}</p>}
        </div>
      </div>
    </div>
  )
}
