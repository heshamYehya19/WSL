import { Link } from "react-router-dom"
import { SkillChip } from "../../components/ui/SkillChip"
import { Reveal } from "../../components/ui/Reveal"

const POINTS = [
  {
    title: "Work on real problems, not hypotheticals",
    body: "Challenges come from real Jordanian companies, automatically screened and assigned by a university before you ever see them.",
  },
  {
    title: "Every submission becomes evidence",
    body: "Reports, repositories, presentations, and datasets aren't just graded — they're analyzed for skill signals.",
  },
  {
    title: "Every project is entirely your own",
    body: "You work solo — no team grade, no shared credit. What lands on your profile is what you actually built.",
  },
  {
    title: "AI feedback never blocks you",
    body: "WSL rates your evidence automatically and shows it on your dashboard right away — it's informational, not a gate.",
  },
  {
    title: "A living record that grows with you",
    body: "Every rated project adds to a permanent, evidence-backed skill profile employers can actually inspect.",
  },
]

export default function ForStudents() {
  return (
    <div>
      <section className="border-b border-ink-100 bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Students</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Your work, not your word.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            Stop describing your skills. Start proving them — with real projects, real evidence, and real feedback.
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

        <Reveal className="mt-10 rounded-2xl border border-ink-200 bg-night p-8">
          <p className="text-xs font-semibold tracking-wide text-teal-300 uppercase">Example: living skill record</p>
          <h3 className="mt-1 text-lg font-bold text-white">Lina Qasem — Human-Computer Interaction, Jordan Institute of Technology</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <SkillChip skill="UI/UX Design" rating={95} />
            <SkillChip skill="Frontend Development" rating={92} />
            <SkillChip skill="Research" rating={85} />
          </div>
          <p className="mt-4 text-sm text-ink-300">
            This is not what a student claims they know. This is what their work has demonstrated.
          </p>
        </Reveal>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-night px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0"
          >
            Continue as a Student
          </Link>
        </div>
      </section>
    </div>
  )
}
