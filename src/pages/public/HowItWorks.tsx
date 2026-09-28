import { Link } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { Reveal } from "../../components/ui/Reveal"
import type { ChallengeStatus } from "../../types"

const STATUS_PIPELINE: ChallengeStatus[] = [
  "Draft",
  "Sent to University",
  "University Assigned",
  "In Progress",
  "Submissions Under Review",
  "Confirmed to Company",
  "Company Reviewed",
]

const STAGES = [
  {
    who: "Company",
    title: "Submits a safe challenge",
    body: "A real operational problem, described without exposing confidential data — with a clear visibility level, dataset availability, and sensitivity rating.",
  },
  {
    who: "WSL",
    title: "Screens it automatically",
    body: "WSL checks the challenge for private or confidential data. It's automatic and invisible — nobody using the site watches this step happen.",
  },
  {
    who: "University",
    title: "Assigns it to a college",
    body: "A university assigns the challenge to students of the relevant college — not a specific course, open to anyone in that program.",
  },
  {
    who: "Student",
    title: "Solves it on their own",
    body: "Eligible students discover the challenge and start a project. Every project is individual work — never a team submission.",
  },
  {
    who: "WSL",
    title: "Rates the submission automatically",
    body: "The moment evidence is submitted, WSL rates each required skill as a percentage. It's informational only and never blocks anything — it shows up on the student's dashboard right away.",
  },
  {
    who: "University",
    title: "Reviews and confirms",
    body: "A university reviewer looks at the submission to gauge the student's level, then confirms it to the company.",
  },
  {
    who: "Company",
    title: "Reviews and rates it too",
    body: "The company opens the confirmed submission and gives its own rating, the same way WSL did.",
  },
]

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="How It Works"
        title="One loop, seven steps, three roles"
        subtitle="Every step below is a real, clickable part of the WSL demo — switch personas to walk the whole loop yourself."
      />

      <div className="space-y-4">
        {STAGES.map((stage, i) => (
          <Reveal
            key={stage.title}
            delay={Math.min(i, 5) * 60}
            className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md hover:shadow-ink-950/5"
          >
            <div className="flex shrink-0 flex-col items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-sm font-bold text-teal-300">
                {i + 1}
              </span>
              {i < STAGES.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-ink-100" />}
            </div>
            <div className="pb-2">
              <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">{stage.who}</div>
              <h3 className="mt-0.5 font-semibold text-ink-950">{stage.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{stage.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-14 rounded-2xl border border-ink-200 bg-white p-6">
        <h2 className="font-semibold text-ink-900">The challenge status pipeline</h2>
        <p className="mt-1 mb-4 text-sm text-ink-500">
          Every company challenge moves through a visible, auditable pipeline — nothing reaches students silently.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_PIPELINE.map((s) => (
            <StatusBadge key={s} status={s} className="transition-transform duration-150 hover:-translate-y-0.5" />
          ))}
        </div>
      </Reveal>

      <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-teal-500/30 bg-teal-50 px-6 py-8 text-center">
        <div className="w-full">
          <h3 className="text-lg font-bold text-ink-950">See it end to end</h3>
          <p className="mt-1 text-sm text-ink-600">Switch between Student, University, and Company to follow one real project through the whole loop.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-full bg-ink-950 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0"
          >
            Start the Demo
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
