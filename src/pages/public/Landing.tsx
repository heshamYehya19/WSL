import { Link } from "react-router-dom"
import { FlowLoop } from "../../components/ui/FlowLoop"
import { SkillChip } from "../../components/ui/SkillChip"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { HeroNetwork } from "../../components/ui/HeroNetwork"
import { GitHubVsWsl } from "../../components/ui/GitHubVsWsl"
import { Reveal } from "../../components/ui/Reveal"
import { useShowcase } from "../../lib/showcase"

export default function Landing() {
  const showcase = useShowcase()

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-night">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
            <div className="text-center lg:text-left">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-teal-300 lg:mx-0">
                Jordan 2076 Hackathon · Amman — Innovation in Education &amp; Learning Systems
              </div>
              <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
                <span className="text-3xl font-extrabold tracking-tight text-white">WSL</span>
                <span className="font-arabic text-3xl font-bold text-teal-300">وصل</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
                <span className="block">Don't Just Graduate With a Degree.</span>
                <span className="block text-teal-300">Graduate With Proof.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-300 lg:mx-0">
                WSL connects universities, students, and companies through real-world challenges, verified student
                work, and demonstrated skills.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  to="/login"
                  className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
                >
                  Start with WSL
                </Link>
                <Link
                  to="/how-it-works"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-300 active:translate-y-0"
                >
                  See How It Works
                </Link>
              </div>
            </div>
            <HeroNetwork />
          </div>
        </div>
      </section>

      {/* CORE FLOW */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">The WSL Loop</div>
          <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">From Learning → Doing → Proving → Opportunity</h2>
          <p className="mx-auto mt-2 max-w-2xl text-ink-500">
            Companies bring real needs. Students do the work. WSL organizes the evidence. Universities verify what
            students actually demonstrated. Companies discover talent through proof, not CV claims.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <FlowLoop />
        </Reveal>
      </section>

      {/* THREE AUDIENCES */}
      <section className="border-y border-ink-100 bg-surface py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3">
          <Reveal delay={0} className="rounded-2xl border border-ink-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Students</div>
            <h3 className="text-lg font-bold text-ink-950">Turn your work into evidence of what you can do.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Every real project you complete becomes evidence a university can verify — proof of what you did, not just another line on a CV.
            </p>
            <Link to="/for-students" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </Reveal>
          <Reveal delay={100} className="rounded-2xl border border-ink-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Universities</div>
            <h3 className="text-lg font-bold text-ink-950">Verify what your students can actually demonstrate.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              You are the verification authority: review student work, confirm it before it reaches a company, and connect learning to real industry needs.
            </p>
            <Link to="/for-universities" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </Reveal>
          <Reveal delay={200} className="rounded-2xl border border-ink-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-ink-950/5">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Companies</div>
            <h3 className="text-lg font-bold text-ink-950">Shape learning. Discover talent. Get better signals.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Contribute real-world challenges and find people through university-verified work, not CV claims.
            </p>
            <Link to="/for-companies" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </Reveal>
        </div>
      </section>

      <GitHubVsWsl />

      {/* GAP EXPLAINER */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">The missing layer</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
              Learning produces grades.
              <br />
              Employment requires evidence.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              Nothing today reliably connects what a university teaches to what an employer can verify.
              WSL closes that gap: real problems become learning projects, projects produce evidence, and
              evidence becomes verified, living proof of capability.
            </p>
            <div className="mt-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-4">
              <p className="font-semibold text-ink-900">
                “The project isn't the product. The evidence infrastructure is.”
              </p>
            </div>
          </Reveal>
          {showcase && (
          <Reveal delay={150} className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-800">{showcase.project.title}</span>
              <StatusBadge status={showcase.project.status} />
            </div>
            <p className="mb-4 text-xs text-ink-400">
              {showcase.org?.name} · {showcase.student?.name}, {showcase.university?.shortName} {showcase.student?.field}
            </p>
            <div className="space-y-3">
              {showcase.signals.slice(0, 3).map((s) => (
                <div key={s.id}>
                  <div className="text-sm font-medium text-ink-800">{s.skill}</div>
                  <span className={`text-xs font-semibold ${s.status === "Verified" ? "text-verified-600" : "text-ink-400"}`}>
                    {s.status === "Verified" ? "✓ Verified by the university" : "Awaiting university verification"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-400">
              A skill counts as verified only once a university has reviewed the evidence. AI helps organize and surface relevant evidence for that review.
            </p>
          </Reveal>
          )}
        </div>
      </section>

      {/* SKILLS PREVIEW / EMPLOYER TRUST */}
      <section className="border-t border-ink-100 bg-night py-20">
        <Reveal className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Your Degree Says You Know.</h2>
          <h2 className="text-2xl font-bold text-teal-300 sm:text-3xl">Your Work Should Prove It.</h2>
          <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {showcase?.signals.map((s) => <SkillChip key={s.id} skill={s.skill} state={s.status === "Verified" ? "verified" : "pending"} />)}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0"
            >
              Start with WSL
            </Link>
            <Link
              to="/about"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 active:translate-y-0"
            >
              About WSL
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
