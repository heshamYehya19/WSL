import { Link } from "react-router-dom"
import { Reveal } from "../../components/ui/Reveal"

const VISIBILITY = [
  {
    label: "Public",
    body: "Safe challenge that can be publicly displayed to any student on the platform.",
  },
  {
    label: "University Only",
    body: "Only participating universities and their eligible students can access it.",
  },
  {
    label: "Restricted",
    body: "Only selected teams can access it, potentially requiring additional approval or an NDA.",
  },
]

const VALUE = [
  {
    label: "Shape learning",
    body: "Tell universities which real-world challenges and skills matter, so coursework reflects what industry actually needs.",
  },
  {
    label: "Discover talent",
    body: "Find students by what they have demonstrated in real work, not by what their CV claims.",
  },
  {
    label: "Get better signals",
    body: "Inspect actual student work, who contributed what, and the university's verification — an evidence-based view of emerging talent.",
  },
]

const FLOW = ["Challenge", "WSL structures it", "University accepts", "Students work", "Evidence", "Verification", "Talent"]

export default function ForCompanies() {
  return (
    <div>
      <section className="border-b border-ink-100 bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Companies</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Shape learning. Discover talent. Get better signals.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            Contribute real-world challenges using appropriate public, anonymized, synthetic, or controlled data — and see what students can
            actually demonstrate, verified by their university.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUE.map((v, i) => (
            <Reveal
              key={v.label}
              delay={i * 80}
              className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5"
            >
              <div className="mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">{v.label}</div>
              <p className="text-sm leading-relaxed text-ink-600">{v.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs font-medium text-ink-500">
          {FLOW.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-2">
              <span className="rounded-full border border-ink-200 bg-surface px-2.5 py-1 text-ink-700">{step}</span>
              {i < FLOW.length - 1 && <span className="text-teal-500" aria-hidden="true">→</span>}
            </span>
          ))}
        </Reveal>

        <Reveal className="mt-10 rounded-2xl border border-teal-500/30 bg-teal-50 px-6 py-5 text-center">
          <p className="font-semibold text-ink-900">
            “WSL automatically checks every challenge for private data before students ever see it — companies shouldn't expose inappropriate confidential information, and nobody has to watch that happen.”
          </p>
        </Reveal>

        <div className="mt-10">
          <h2 className="mb-4 font-semibold text-ink-900">You control exactly who can see your challenge</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VISIBILITY.map((v, i) => (
              <Reveal
                key={v.label}
                delay={i * 80}
                className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5"
              >
                <div className="mb-2 inline-flex rounded-full bg-night px-3 py-1 text-xs font-semibold text-teal-300">
                  {v.label}
                </div>
                <p className="text-sm leading-relaxed text-ink-500">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Reveal className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5">
            <h3 className="font-semibold text-ink-900">Matched to a program, not a queue</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Accepted challenges are assigned to an entire college or program — not left waiting in a
              generic backlog for one student to pick up.
            </p>
          </Reveal>
          <Reveal delay={100} className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5">
            <h3 className="font-semibold text-ink-900">Proof, not an opaque score</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Talent Discovery never ranks candidates with a mystery score. You see which skills the university verified, the exact evidence behind them, and can leave your own feedback.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-night px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0"
          >
            Continue as a Company
          </Link>
        </div>
      </section>
    </div>
  )
}
