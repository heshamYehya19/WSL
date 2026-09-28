import { PageHeader } from "../../components/ui/PageHeader"

const NOT_LIST = [
  "a generic LMS",
  "an online course platform",
  "a job board",
  "a generic portfolio website",
  "simply a project marketplace",
  "an AI tutor",
]

const PRINCIPLES = [
  "Real-world problems become learning opportunities.",
  "Students produce actual evidence of capability, working individually.",
  "WSL screens every challenge automatically for private data — nobody watches it happen.",
  "AI rates evidence automatically and informationally — it never blocks or gates anything.",
  "A university reviews each submission before it reaches the company.",
  "The company rates the confirmed submission independently, the same way WSL did.",
  "Companies do not need to expose confidential information.",
  "Universities remain central to assigning work and reviewing it.",
  "WSL does not replace universities.",
  "WSL does not replace hiring platforms.",
  "WSL connects education and employment through evidence.",
]

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="About WSL"
        title="An evidence infrastructure between education and employment"
        subtitle="WSL doesn't teach, and it doesn't hire. It builds the trusted layer in between."
      />

      <div className="prose-ink space-y-5 text-ink-700">
        <p className="leading-relaxed">
          Universities primarily show what students learned through courses, assignments, grades, and
          degrees. Students then present CVs and claimed skills. Employers, however, need evidence that a
          person can actually perform real work.
        </p>
        <p className="text-lg font-semibold text-ink-950">WSL closes this gap.</p>
        <p className="leading-relaxed">
          WSL connects real-world problems to university-assigned projects, turns individual student work into
          evidence, has WSL's AI rate that evidence automatically the moment it's submitted, and has a university
          review each submission before confirming it to the company — who reviews and rates it too.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-teal-500/30 bg-teal-50 px-6 py-6">
        <p className="text-xl font-bold text-ink-950">“University teaches you what to know. WSL proves what you can do.”</p>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-white px-6 py-6">
        <p className="text-lg font-semibold text-ink-900">“The project isn't the product. The evidence infrastructure is.”</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          The differentiating layer isn't "companies give students projects" — that alone isn't enough.
          It's the pipeline after the project: evidence → automatic AI rating → university confirmation →
          company rating → a living record.
        </p>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold text-ink-900">WSL is not</h2>
          <ul className="space-y-2">
            {NOT_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-0.5 text-danger-600">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold text-ink-900">System principles</h2>
          <ul className="space-y-2">
            {PRINCIPLES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-0.5 text-teal-600">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
