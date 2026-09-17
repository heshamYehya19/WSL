import { Link } from "react-router-dom"

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

export default function ForCompanies() {
  return (
    <div>
      <section className="border-b border-ink-100 bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Companies</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Discover talent through demonstrated capability.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            Submit a real problem, not confidential data. WSL structures it into a safe learning challenge before any student sees it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-teal-500/30 bg-teal-50 px-6 py-5 text-center">
          <p className="font-semibold text-ink-900">
            “WSL converts business challenges into safe, structured learning challenges before students access them.”
          </p>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 font-semibold text-ink-900">You control exactly who can see your challenge</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VISIBILITY.map((v) => (
              <div key={v.label} className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="mb-2 inline-flex rounded-full bg-ink-950 px-3 py-1 text-xs font-semibold text-teal-300">
                  {v.label}
                </div>
                <p className="text-sm leading-relaxed text-ink-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="font-semibold text-ink-900">No confidential data required</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              You describe the problem — dataset availability and sensitivity are declared upfront, and WSL
              structures the challenge before it reaches any student.
            </p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="font-semibold text-ink-900">Evidence, not an opaque score</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Talent Discovery never ranks candidates with a mystery score. You see verified skills and the exact evidence behind them.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Continue as a Company
          </Link>
        </div>
      </section>
    </div>
  )
}
