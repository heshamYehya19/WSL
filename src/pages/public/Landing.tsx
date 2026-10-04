import { Link } from "react-router-dom"
import { FlowLoop } from "../../components/ui/FlowLoop"
import { SkillChip } from "../../components/ui/SkillChip"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { HeroSkillRecord } from "../../components/ui/HeroSkillRecord"
import { LanguageToggle } from "../../components/ui/LanguageToggle"
import { Reveal } from "../../components/ui/Reveal"
import { langProps, statusLabel, useLanguage } from "../../lib/i18n"
import { useShowcase } from "../../lib/showcase"
import { useStore } from "../../state/store"

const TEXT = {
  en: {
    event: "Jordan 2076 Hackathon · Amman — Innovation in Education & Learning Systems",
    taglineKnow: "University teaches you what to know.",
    taglineProve: "WSL proves what you can do.",
    intro: "WSL connects universities, students, and organizations through real-world projects and evidence-backed skills.",
    start: "Start with WSL",
    howItWorks: "See How It Works",
    claimedTitle: "Claimed on a CV",
    claimed: [
      "“Proficient in Python” — a line the student wrote about themselves",
      "Nobody checked it",
      "No link to any work",
      "Reads the same on hundreds of CVs",
    ],
    provenTitle: "Proven on WSL",
    proven: [
      "Python · Intermediate — assessed against named criteria, not a self-rating",
      "Verified by a named university mentor",
      "Quotes the exact lines of the student's own work",
      "Tied to a real problem a company set",
    ],
    loopEyebrow: "The WSL Loop",
    loopTitle: "From Learning → Doing → Proving",
    loopBody:
      "A company submits a real problem → a university assigns it → a student submits real evidence → WSL surfaces AI skill signals → a university mentor verifies them → verified skills reach the student's record → companies discover evidence, not claims.",
    learnMore: "Learn more →",
    audiences: [
      {
        eyebrow: "For Students",
        title: "Turn your work into evidence of what you can do.",
        body: "Every real project you complete becomes verified, evidence-backed proof — not just another line on a CV.",
        to: "/for-students",
      },
      {
        eyebrow: "For Universities",
        title: "Connect learning with authentic real-world challenges.",
        body: "Assign real company problems to your students, and confirm their work before it ever reaches the company.",
        to: "/for-universities",
      },
      {
        eyebrow: "For Companies",
        title: "Discover talent through demonstrated capability.",
        body: "Post safe, structured challenges — no confidential data required — and find people by evidence, not claims.",
        to: "/for-companies",
      },
    ],
    gapEyebrow: "The missing layer",
    gapTitle1: "Learning produces grades.",
    gapTitle2: "Employment requires evidence.",
    gapBody:
      "Nothing today reliably connects what a university teaches to what an employer can verify. WSL closes that gap: real problems become learning projects, projects produce evidence, and evidence becomes verified, living proof of capability.",
    quote: "“The project isn't the product. The evidence infrastructure is.”",
    confidence: "Evidence confidence",
    showcaseNote: "WSL analyzes each skill signal automatically the moment evidence is submitted — informational only, it never blocks anything.",
    ctaTell: "Don't just tell employers what you know.",
    ctaShow: "Show them what you've done.",
    about: "About WSL",
  },
  ar: {
    event: "هاكاثون الأردن 2076 · عمّان — الابتكار في التعليم وأنظمة التعلّم",
    taglineKnow: "الجامعة تعلّمك ما يجب أن تعرفه.",
    taglineProve: "ووصل يُثبت ما تستطيع فعله.",
    intro: "يربط وصل الجامعات والطلاب والمؤسسات عبر مشاريع من الواقع ومهارات مدعومة بالأدلة.",
    start: "ابدأ مع وصل",
    howItWorks: "اكتشف كيف يعمل",
    claimedTitle: "مُدّعى في السيرة الذاتية",
    claimed: [
      "«متمكّن من Python» — سطر كتبه الطالب عن نفسه",
      "لم يتحقق منه أحد",
      "لا يرتبط بأي عمل",
      "يتكرر بالصياغة نفسها في مئات السير الذاتية",
    ],
    provenTitle: "مُثبَت على وصل",
    proven: [
      "Python · متوسط — مُقيَّم وفق معايير محددة، لا تقييمًا ذاتيًا",
      "موثّق من مرشد جامعي معروف بالاسم",
      "يقتبس الأسطر الفعلية من عمل الطالب نفسه",
      "مرتبط بمشكلة حقيقية طرحتها شركة",
    ],
    loopEyebrow: "حلقة وصل",
    loopTitle: "من التعلّم ← إلى التطبيق ← إلى الإثبات",
    loopBody:
      "تطرح شركة مشكلة حقيقية ← تُسندها جامعة إلى طلابها ← يقدّم الطالب أدلة حقيقية ← يستخرج وصل مؤشرات المهارات بالذكاء الاصطناعي ← يوثّقها مرشد جامعي ← تنضم المهارات الموثّقة إلى سجل الطالب ← تكتشف الشركات الأدلة لا الادعاءات.",
    learnMore: "اعرف المزيد ←",
    audiences: [
      {
        eyebrow: "للطلاب",
        title: "حوّل عملك إلى دليل على ما تستطيع فعله.",
        body: "كل مشروع حقيقي تُنجزه يصبح إثباتًا موثّقًا مدعومًا بالأدلة — لا مجرد سطر آخر في سيرتك الذاتية.",
        to: "/for-students",
      },
      {
        eyebrow: "للجامعات",
        title: "اربط التعلّم بتحديات حقيقية من الواقع.",
        body: "أسند مشكلات الشركات الحقيقية إلى طلابك، وراجع عملهم قبل أن يصل إلى الشركة.",
        to: "/for-universities",
      },
      {
        eyebrow: "للشركات",
        title: "اكتشف المواهب من خلال قدرات مُثبَتة.",
        body: "اطرح تحديات آمنة ومنظّمة — دون الحاجة إلى بيانات سرية — واعثر على الأشخاص بالأدلة لا بالادعاءات.",
        to: "/for-companies",
      },
    ],
    gapEyebrow: "الحلقة المفقودة",
    gapTitle1: "التعلّم يُنتج درجات.",
    gapTitle2: "والتوظيف يتطلب أدلة.",
    gapBody:
      "لا يوجد اليوم ما يربط بشكل موثوق بين ما تعلّمه الجامعة وما يستطيع صاحب العمل التحقق منه. يسدّ وصل هذه الفجوة: تتحول المشكلات الحقيقية إلى مشاريع تعليمية، وتُنتج المشاريع أدلة، وتصبح الأدلة إثباتًا حيًا وموثّقًا على القدرة.",
    quote: "«المشروع ليس هو المنتج، بل البنية التحتية للأدلة.»",
    confidence: "ثقة الأدلة",
    showcaseNote: "يحلل وصل كل مؤشر مهارة تلقائيًا فور تقديم الأدلة — للاستئناس فقط، ولا يوقف أي شيء.",
    ctaTell: "لا تكتفِ بإخبار أصحاب العمل بما تعرفه.",
    ctaShow: "أرِهم ما أنجزته.",
    about: "عن وصل",
  },
}

export default function Landing() {
  const showcase = useShowcase()
  const { showcase: heroRecord } = useStore()
  const [lang, setLang] = useLanguage()
  const t = TEXT[lang]

  return (
    <div {...langProps(lang)}>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-night">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute end-4 top-4 z-10 sm:end-6">
          <LanguageToggle lang={lang} onChange={setLang} tone="dark" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
            <div className="text-center lg:text-start">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-teal-300 lg:mx-0">
                {t.event}
              </div>
              <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
                <span className="text-3xl font-extrabold tracking-tight text-white">WSL</span>
                <span className="font-arabic text-3xl font-bold text-teal-300">وصل</span>
              </div>
              <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance text-white sm:text-5xl">
                <span className="block">{t.taglineKnow}</span>
                <span className="block text-teal-300">{t.taglineProve}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-300 lg:mx-0">{t.intro}</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  to="/login"
                  className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
                >
                  {t.start}
                </Link>
                <Link
                  to="/how-it-works"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-300 active:translate-y-0"
                >
                  {t.howItWorks}
                </Link>
              </div>
            </div>
            {heroRecord && <HeroSkillRecord record={heroRecord} lang={lang} />}
          </div>
        </div>
      </section>

      {/* CLAIMED VS PROVEN */}
      <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6">
        <Reveal className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink-200 bg-surface p-6">
            <div className="text-xs font-semibold tracking-wide text-ink-400 uppercase">{t.claimedTitle}</div>
            <ul className="mt-4 space-y-2.5">
              {t.claimed.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-ink-600">
                  <span className="text-ink-300" aria-hidden="true">–</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-teal-400/50 bg-teal-50 p-6">
            <div className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{t.provenTitle}</div>
            <ul className="mt-4 space-y-2.5">
              {t.proven.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-ink-800">
                  <span className="font-bold text-verified-600" aria-hidden="true">✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* CORE FLOW */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">{t.loopEyebrow}</div>
          <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">{t.loopTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-ink-500">{t.loopBody}</p>
        </Reveal>
        <Reveal delay={100}>
          <FlowLoop lang={lang} />
        </Reveal>
      </section>

      {/* THREE AUDIENCES */}
      <section className="border-y border-ink-100 bg-surface py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3">
          {t.audiences.map((a, i) => (
            <Reveal
              key={a.to}
              delay={i * 100}
              className="rounded-2xl border border-ink-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5"
            >
              <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">{a.eyebrow}</div>
              <h3 className="text-lg font-bold text-ink-950">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{a.body}</p>
              <Link to={a.to} className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
                {t.learnMore}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* GAP EXPLAINER */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">{t.gapEyebrow}</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
              {t.gapTitle1}
              <br />
              {t.gapTitle2}
            </h2>
            <p className="mt-4 leading-relaxed text-ink-600">{t.gapBody}</p>
            <div className="mt-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-4">
              <p className="font-semibold text-ink-900">{t.quote}</p>
            </div>
          </Reveal>
          {showcase && (
            <Reveal delay={150} className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink-800">{showcase.project.title}</span>
                <StatusBadge status={showcase.project.status} label={statusLabel(showcase.project.status, lang)} />
              </div>
              <p className="mb-4 text-xs text-ink-400">
                {showcase.org?.name} · {showcase.student?.name}, {showcase.university?.shortName} {showcase.student?.field}
              </p>
              <div className="space-y-3">
                {showcase.signals.slice(0, 3).map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 text-sm font-medium text-ink-800">{s.skill}</div>
                    <ConfidenceMeter value={s.evidenceConfidence} label={t.confidence} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink-400">{t.showcaseNote}</p>
            </Reveal>
          )}
        </div>
      </section>

      {/* SKILLS PREVIEW / EMPLOYER TRUST */}
      <section className="border-t border-ink-100 bg-night py-20">
        <Reveal className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t.ctaTell}</h2>
          <h2 className="text-2xl font-bold text-teal-300 sm:text-3xl">{t.ctaShow}</h2>
          <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {showcase?.signals.map((s) => <SkillChip key={s.id} skill={s.skill} rating={s.evidenceConfidence} />)}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
            >
              {t.start}
            </Link>
            <Link
              to="/about"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 active:translate-y-0"
            >
              {t.about}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
