import { Link } from "react-router-dom"
import { FlowLoop } from "../../components/ui/FlowLoop"
import { SkillChip } from "../../components/ui/SkillChip"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { StatusBadge } from "../../components/ui/StatusBadge"

export default function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-950">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-teal-300">
              Jordan 2076 Hackathon · Amman — Innovation in Education &amp; Learning Systems
            </div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-white">WSL</span>
              <span className="font-arabic text-3xl font-bold text-teal-300">وصل</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Your Degree Says You Know.
              <br />
              Your Work Should Prove It.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
              WSL connects universities, students, and organizations through real-world projects and
              evidence-backed skills.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-teal-400"
              >
                Explore WSL
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-300 hover:text-teal-300"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FLOW */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">The WSL Loop</div>
          <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">From Learning → Doing → Proving</h2>
          <p className="mx-auto mt-2 max-w-2xl text-ink-500">
            Real problem → learning project → student work → evidence → verified skills → opportunities.
          </p>
        </div>
        <FlowLoop />
      </section>

      {/* THREE AUDIENCES */}
      <section className="border-y border-ink-100 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-ink-200 p-6">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Students</div>
            <h3 className="text-lg font-bold text-ink-950">Turn your work into evidence of what you can do.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Every real project you complete becomes verified, evidence-backed proof — not just another line on a CV.
            </p>
            <Link to="/for-students" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink-200 p-6">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Universities</div>
            <h3 className="text-lg font-bold text-ink-950">Connect learning with authentic real-world challenges.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Map real company problems onto existing courses, and keep verification where it belongs — with faculty.
            </p>
            <Link to="/for-universities" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink-200 p-6">
            <div className="mb-3 text-xs font-semibold tracking-wide text-teal-600 uppercase">For Companies</div>
            <h3 className="text-lg font-bold text-ink-950">Discover talent through demonstrated capability.</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Post safe, structured challenges — no confidential data required — and find people by evidence, not claims.
            </p>
            <Link to="/for-companies" className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline">
              Learn more →
            </Link>
          </div>
        </div>
      </section>

      {/* GAP EXPLAINER */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">The missing layer</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
              Learning produces grades.
              <br />
              Employment requires evidence.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              Universities show what a student was taught. Students then present CVs and claimed skills.
              Employers need proof someone can actually perform real work — and today, nothing connects
              the two reliably.
            </p>
            <p className="mt-4 leading-relaxed text-ink-600">
              WSL creates the missing evidence layer: real problems become learning projects, learning
              projects produce evidence, and evidence becomes verified, living proof of capability.
            </p>
            <div className="mt-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-4">
              <p className="font-semibold text-ink-900">
                “The project isn't the product. The evidence infrastructure is.”
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-800">Cafeteria Demand Prediction</span>
              <StatusBadge status="Evidence Under Review" />
            </div>
            <p className="mb-4 text-xs text-ink-400">Jordan Tech Solutions · Data Science / Machine Learning</p>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-800">Python</span>
                  <span className="text-xs font-semibold text-teal-700">Advanced</span>
                </div>
                <ConfidenceMeter value={94} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-800">Data Analysis</span>
                  <span className="text-xs font-semibold text-teal-700">Advanced</span>
                </div>
                <ConfidenceMeter value={91} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-800">Machine Learning</span>
                  <span className="text-xs font-semibold text-teal-700">Intermediate</span>
                </div>
                <ConfidenceMeter value={88} />
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-400">
              Evidence confidence reflects how strongly submitted work supports a skill signal — not proficiency.
            </p>
          </div>
        </div>
      </section>

      {/* SKILLS PREVIEW / EMPLOYER TRUST */}
      <section className="border-t border-ink-100 bg-ink-950 py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Don't just tell employers what you know.</h2>
          <h2 className="text-2xl font-bold text-teal-300 sm:text-3xl">Show them what you've done.</h2>
          <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            <SkillChip skill="Python" level="Advanced" verified />
            <SkillChip skill="Data Analysis" level="Advanced" verified />
            <SkillChip skill="Machine Learning" level="Intermediate" verified />
            <SkillChip skill="Data Visualization" level="Intermediate" verified />
            <SkillChip skill="Problem Solving" level="Demonstrated" verified />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-teal-400">
              Explore the Demo
            </Link>
            <Link to="/about" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:border-teal-300">
              About WSL
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
