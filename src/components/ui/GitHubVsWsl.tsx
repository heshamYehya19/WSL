import { Reveal } from "./Reveal"

// Illustrative: based on the seeded team project (Sara, Omar and Ahmad on SkyTech's
// predictive-maintenance challenge). Roles are the contribution notes stored on that project.
const CONTRIBUTORS = [
  {
    name: "Omar Al-Fayez",
    role: "Python preprocessing and ML model training for the risk score",
    evidence: "risk_model.py · Code",
    skills: ["Python", "Machine Learning"],
  },
  {
    name: "Ahmad Obeidat",
    role: "REST API integration and database design for the asset store",
    evidence: "Asset Risk API Reference · Documentation",
    skills: ["REST API Design", "SQL"],
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
              Predictive maintenance for SkyTech's field equipment
              <span className="font-normal text-ink-500"> — a real challenge from Enterprise Software (ERP)</span>
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
              Illustrative example from the demo team project — fictional students. Each contribution is reviewed and verified by a university,
              not read off a commit count.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
