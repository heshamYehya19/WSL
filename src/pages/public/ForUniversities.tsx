import { Link } from "react-router-dom"
import { StatTile } from "../../components/ui/Card"
import { Reveal } from "../../components/ui/Reveal"
import { usePlatformTotals } from "../../lib/showcase"

const POINTS = [
  {
    title: "Verify student work",
    body: "You are the verification authority. Your reviewers check each skill against the student's own evidence, and nothing reaches a company until you confirm it.",
  },
  {
    title: "See what students can actually demonstrate",
    body: "Every student builds a proof profile from real work: the project, what they contributed, the evidence, and what you verified.",
  },
  {
    title: "Connect learning with real industry needs",
    body: "Accept pre-screened company challenges and assign each one to a whole college or program, so coursework meets real problems.",
  },
  {
    title: "Strengthen graduate employability",
    body: "Graduates leave with university-verified proof companies can inspect, not just a degree and a CV. Over time, the same record shows where curriculum and industry demand diverge.",
  },
]

export default function ForUniversities() {
  const totals = usePlatformTotals()

  return (
    <div>
      <section className="border-b border-ink-100 bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Universities</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Verify what your students can actually demonstrate.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            See what your students can actually demonstrate, verify their work, and understand how learning aligns with industry needs. WSL organizes the evidence; the verification stays with you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 80}
              className="rounded-2xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5"
            >
              <h3 className="font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{p.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <p className="mb-3 text-sm font-semibold text-ink-500 uppercase tracking-wide">
            Live across {totals.universities} partner universities
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Active Challenges" value={totals.activeChallenges} />
            <StatTile label="Student Projects" value={totals.projects} />
            <StatTile label="Evidence Items" value={totals.evidence} />
            <StatTile label="Skills Identified" value={totals.skillSignals} />
          </div>
          <p className="mt-2 text-xs text-ink-400">Counted live from the WSL platform.</p>
        </Reveal>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-night px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0"
          >
            Continue as a University
          </Link>
        </div>
      </section>
    </div>
  )
}
