import { useNavigate } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { useDemoUser } from "../../state/demoUser"
import { organizations, students, universities } from "../../data/seed"
import type { Role } from "../../types"

export default function DemoLogin() {
  const { signInAs } = useDemoUser()
  const navigate = useNavigate()

  const go = (role: Role, id: string, path: string) => {
    signInAs(role, id)
    navigate(path)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="Demo Access"
        title="Continue as..."
        subtitle="No real accounts needed for this MVP. Choose a persona to explore the full WSL experience — you can switch anytime from the top bar."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Student</div>
          <h3 className="mb-3 font-semibold text-ink-900">Browse challenges, submit evidence, build your skill record.</h3>
          <div className="space-y-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => go("student", s.id, "/student")}
                className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{s.name}</span>
                  <span className="block text-xs text-ink-400">{s.field} · {s.year}</span>
                </span>
                <span className="text-teal-600">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">University</div>
          <h3 className="mb-3 font-semibold text-ink-900">Review challenges, monitor projects, verify skills.</h3>
          <div className="space-y-2">
            {universities.map((u) => (
              <button
                key={u.id}
                onClick={() => go("university", u.id, "/university")}
                className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{u.name}</span>
                  <span className="block text-xs text-ink-400">{u.city}</span>
                </span>
                <span className="text-teal-600">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Company</div>
          <h3 className="mb-3 font-semibold text-ink-900">Submit challenges and discover verified talent.</h3>
          <div className="space-y-2">
            {organizations.map((o) => (
              <button
                key={o.id}
                onClick={() => go("company", o.id, "/company")}
                className="flex w-full items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{o.name}</span>
                  <span className="block text-xs text-ink-400">{o.industry}</span>
                </span>
                <span className="text-teal-600">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
