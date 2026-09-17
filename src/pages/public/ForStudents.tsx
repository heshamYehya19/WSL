import { Link } from "react-router-dom"
import { SkillChip } from "../../components/ui/SkillChip"

const POINTS = [
  {
    title: "Work on real problems, not hypotheticals",
    body: "Challenges come from real Jordanian companies, structured and reviewed before you ever see them.",
  },
  {
    title: "Every submission becomes evidence",
    body: "Reports, repositories, presentations, and datasets aren't just graded — they're analyzed for skill signals.",
  },
  {
    title: "Your contribution is attributed to you",
    body: "On team projects, WSL tracks what you individually produced — not a shared, generic team grade.",
  },
  {
    title: "A human always verifies",
    body: "AI finds the signal. Your university mentor verifies it. Nothing on your profile is AI-certified alone.",
  },
  {
    title: "A living record that grows with you",
    body: "Every verified project adds to a permanent, evidence-backed skill profile employers can actually inspect.",
  },
]

export default function ForStudents() {
  return (
    <div>
      <section className="border-b border-ink-100 bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Students</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Turn your work into evidence of what you can do.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            Stop describing your skills. Start proving them — with real projects, real evidence, and real verification.
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

        <div className="mt-10 rounded-2xl border border-ink-200 bg-ink-950 p-8">
          <p className="text-xs font-semibold tracking-wide text-teal-300 uppercase">Example: living skill record</p>
          <h3 className="mt-1 text-lg font-bold text-white">Lina Qasem — Human-Computer Interaction, Jordan Institute of Technology</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <SkillChip skill="UI/UX Design" level="Advanced" verified />
            <SkillChip skill="Frontend Development" level="Advanced" verified />
            <SkillChip skill="Research" level="Demonstrated" verified />
          </div>
          <p className="mt-4 text-sm text-ink-300">
            This is not what a student claims they know. This is what their work has demonstrated.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-block rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Continue as a Student
          </Link>
        </div>
      </section>
    </div>
  )
}
