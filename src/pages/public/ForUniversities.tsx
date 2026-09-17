import { Link } from "react-router-dom"
import { StatTile } from "../../components/ui/Card"

const POINTS = [
  {
    title: "Real challenges, mapped to real courses",
    body: "Accept structured, pre-screened company challenges and map each one to a course, program, semester, and student group.",
  },
  {
    title: "Verification stays with faculty",
    body: "AI surfaces evidence-backed skill signals — your mentors decide what gets verified. WSL never certifies a student on its own.",
  },
  {
    title: "Full visibility into student work",
    body: "Monitor active projects, review submitted evidence, and track learning outcomes across every participating course.",
  },
  {
    title: "WSL doesn't replace you",
    body: "It connects real-world problems to the learning and verification your institution already provides.",
  },
]

export default function ForUniversities() {
  return (
    <div>
      <section className="border-b border-ink-100 bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Universities</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Connect learning with authentic real-world challenges.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            WSL routes safe, structured industry problems into your existing courses — and keeps verification exactly where it belongs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-ink-200 bg-white p-5">
              <h3 className="font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <p className="mb-3 text-sm font-semibold text-ink-500 uppercase tracking-wide">A snapshot from Amman National University</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Active Challenges" value="12" />
            <StatTile label="Student Projects" value="84" />
            <StatTile label="Evidence Items" value="236" />
            <StatTile label="Skills Verified" value="417" />
          </div>
          <p className="mt-2 text-xs text-ink-400">Demo values shown for illustration.</p>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Continue as a University
          </Link>
        </div>
      </section>
    </div>
  )
}
