import { Reveal } from "./Reveal"

// Illustrative: the seeded EnergyWise team (Jordan Energy Solutions' "Smart Campus Energy Optimization"),
// three students at one university. Roles are the contribution each student recorded; evidence and
// skills are what their own submissions contain. Nothing here is verified until a reviewer decides.
const CONTRIBUTORS = [
  {
    name: "Ahmad Al-Khatib",
    role: "Database design, SQL analysis, and the data-processing pipeline",
    evidence: "Schema and SQL reports · Documentation; Data pipeline · GitHub",
    skills: ["SQL", "Python", "Data Analysis"],
  },
  {
    name: "Sara Al-Najjar",
    role: "Feature engineering, the machine-learning model, and model evaluation",
    evidence: "Anomaly detection · Notebook; Model evaluation · Report",
    skills: ["Machine Learning"],
  },
  {
    name: "Omar Al-Fayez",
    role: "Dashboard, visualizations, and the presentation",
    evidence: "Dashboard · GitHub; Walkthrough · Presentation",
    skills: ["Data Visualization"],
  },
]

export function GitHubVsWsl() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">Already on GitHub?</div>
          <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">GitHub shows the work. WSL shows what that work proves.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-ink-500">
            Keep your code on GitHub. WSL treats a repository as one source of evidence and adds who did what, what it demonstrates, and
            whether a university has verified it.
          </p>
        </Reveal>

        <Reveal delay={100} className="grid gap-4 md:grid-cols-[2fr_3fr]">
          <div className="rounded-2xl border border-ink-200 bg-ink-50 p-6">
            <div className="text-xs font-semibold tracking-wide text-ink-400 uppercase">On GitHub</div>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-600">
              {["A repository", "The code", "Commits and history", "3 contributors"].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-ink-300" aria-hidden="true">–</span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-400">It doesn't say who built which part, what it shows they can do, or whether anyone checked.</p>
          </div>

          <div className="rounded-2xl border border-teal-400/50 bg-teal-50 p-6">
            <div className="text-xs font-semibold tracking-wide text-teal-700 uppercase">On WSL</div>
            <p className="mt-3 text-sm font-semibold text-ink-900">
              Smart Campus Energy Optimization
              <span className="font-normal text-ink-500"> — a real challenge from Jordan Energy Solutions</span>
            </p>
            <div className="mt-4 space-y-3">
              {CONTRIBUTORS.map((c) => (
                <div key={c.name} className="rounded-xl border border-ink-200 bg-surface p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-900">{c.name}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending university verification</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-600">
                    <span className="font-semibold text-ink-700">Contribution:</span> {c.role}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">Evidence:</span> {c.evidence}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">Demonstrates:</span> {c.skills.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-400">
              Illustrative example from the demo team project — fictional students. Each student's skills come only from their own evidence and are verified
              (or not) one at a time by their university, never read off a commit count.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
