import { Link } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import type { ChallengeStatus } from "../../types"

const STATUS_PIPELINE: ChallengeStatus[] = [
  "Draft",
  "Submitted",
  "Under WSL Review",
  "Approved",
  "Sent to University",
  "University Accepted",
  "Open to Students",
  "In Progress",
  "Completed",
  "Evidence Under Review",
  "Verified",
]

const STAGES = [
  {
    who: "Company",
    title: "Submits a safe, structured challenge",
    body: "A real operational problem, described without exposing confidential data — with a clear visibility level, dataset availability, and sensitivity rating.",
  },
  {
    who: "WSL",
    title: "Structures and reviews the challenge",
    body: "WSL converts the business challenge into a safe, structured learning challenge before any student ever sees it.",
  },
  {
    who: "University",
    title: "Accepts and maps it to a course",
    body: "A university reviews the structured challenge and maps it to a real course, program, semester, and student group.",
  },
  {
    who: "Student",
    title: "Discovers the challenge and starts a project",
    body: "Eligible students browse challenges approved by their university and start a project workspace once they commit.",
  },
  {
    who: "Student",
    title: "Produces evidence, not just a submission",
    body: "Reports, repositories, presentations, datasets, and documentation — the artifacts of real work.",
  },
  {
    who: "AI",
    title: "Analyzes evidence for skill signals",
    body: "The AI identifies which skills the submitted evidence supports, and how strongly — it does not certify anyone.",
  },
  {
    who: "University Mentor",
    title: "Reviews and verifies",
    body: "A human reviewer checks the AI's findings against the evidence and verifies, requests more evidence, or rejects.",
  },
  {
    who: "Student",
    title: "Living skill record updates",
    body: "Verified skills join the student's profile — a growing record of demonstrated, not claimed, capability.",
  },
  {
    who: "Company",
    title: "Discovers talent through evidence",
    body: "Companies search verified skills and open the underlying evidence — the exact work behind the claim.",
  },
]

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="How It Works"
        title="One loop, nine steps, three roles"
        subtitle="Every step below is a real, clickable part of the WSL demo — switch personas to walk the whole loop yourself."
      />

      <div className="space-y-4">
        {STAGES.map((stage, i) => (
          <div key={stage.title} className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-5">
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
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-ink-200 bg-white p-6">
        <h2 className="font-semibold text-ink-900">The challenge status pipeline</h2>
        <p className="mt-1 mb-4 text-sm text-ink-500">
          Every company challenge moves through a visible, auditable pipeline — nothing reaches students silently.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_PIPELINE.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-teal-500/30 bg-teal-50 px-6 py-8 text-center">
        <div className="w-full">
          <h3 className="text-lg font-bold text-ink-950">See it end to end</h3>
          <p className="mt-1 text-sm text-ink-600">Switch between Student, University, and Company to follow one real project through the whole loop.</p>
          <Link to="/login" className="mt-4 inline-block rounded-full bg-ink-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
            Start the Demo
          </Link>
        </div>
      </div>
    </div>
  )
}
