import { Link } from "react-router-dom"
import { SkillChip } from "../../components/ui/SkillChip"
import { Reveal } from "../../components/ui/Reveal"
import { useShowcase } from "../../lib/showcase"

const POINTS = [
  {
    title: "Work on real problems, not hypotheticals",
    body: "Challenges come from real Jordanian companies, automatically screened and assigned by a university before you ever see them.",
  },
  {
    title: "Every submission becomes evidence",
    body: "Reports, repositories, presentations, and datasets are organized as evidence of what you did — with AI helping surface the relevant parts for university review.",
  },
  {
    title: "Your contribution is recorded as yours",
    body: "On a team project, WSL records what each student specifically contributed, so your profile shows what you built — not just the team's repository.",
  },
  {
    title: "GitHub shows the work. WSL shows what it proves.",
    body: "Link your repository as evidence. WSL adds your contribution, the project context, the skills the work demonstrates, and your university's verification. GitHub stays where your code lives.",
  },
  {
    title: "A verified proof profile that grows with you",
    body: "Every verified project adds to a permanent record of what you demonstrated, verified by your university, that employers can actually inspect.",
  },
]

export default function ForStudents() {
  const showcase = useShowcase()

  return (
    <div>
      <section className="border-b border-ink-100 bg-surface py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">For Students</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Graduate with proof, not just a degree.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500">
            Stop describing your skills. Start proving them — real projects, real evidence, and your university's verification.
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

        {showcase && (
        <Reveal className="mt-10 rounded-2xl border border-ink-200 bg-night p-8">
          <p className="text-xs font-semibold tracking-wide text-teal-300 uppercase">Example: verified proof profile</p>
          <h3 className="mt-1 text-lg font-bold text-white">
            {showcase.student?.name} — {showcase.program?.name ?? showcase.student?.field}, {showcase.university?.name}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {showcase.signals.map((s) => <SkillChip key={s.id} skill={s.skill} state={s.status === "Verified" ? "verified" : "pending"} />)}
          </div>
          <p className="mt-4 text-sm text-ink-300">
            This is not what a student claims they know. This is what their work has demonstrated, and what their university has verified.
          </p>
        </Reveal>
        )}

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
