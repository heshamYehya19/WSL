import { useNavigate } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"

export default function DemoLogin() {
  const { signInAs } = useDemoUser()
  const { students, universities, organizations } = useStore()
  const navigate = useNavigate()

  const go = (role: "student" | "university" | "company", id: string, path: string) => {
    signInAs(role, id)
    navigate(path)
  }

  const rowClass =
    "flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50"

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="Sign In"
        title="Continue as..."
        subtitle="Choose your account. Each student, university, and company has its own data on WSL, and everything you do is saved to that account. You can switch accounts anytime from the top bar."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Student</div>
          <h3 className="mb-3 font-semibold text-ink-900">Browse challenges, submit evidence, build your skill record.</h3>
          <div className="space-y-4">
            {universities.map((u) => (
              <div key={u.id}>
                <div className="mb-1.5 text-xs font-semibold text-ink-400">{u.name}</div>
                <div className="space-y-2">
                  {students
                    .filter((s) => s.universityId === u.id)
                    .map((s) => (
                      <button key={s.id} onClick={() => go("student", s.id, "/student")} className={rowClass}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink-900">{s.name}</span>
                          <span className="block truncate text-xs text-ink-400">{s.field} · {s.year}</span>
                        </span>
                        <span className="text-teal-600">→</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">University</div>
          <h3 className="mb-3 font-semibold text-ink-900">Assign challenges, monitor submissions, confirm work to companies.</h3>
          <div className="space-y-2">
            {universities.map((u) => (
              <button key={u.id} onClick={() => go("university", u.id, "/university")} className={rowClass}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">{u.name}</span>
                  <span className="block truncate text-xs text-ink-400">{u.city} · {u.type} · Est. {u.established}</span>
                </span>
                <span className="text-teal-600">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="mb-1 text-xs font-semibold tracking-wide text-teal-600 uppercase">Company</div>
          <h3 className="mb-3 font-semibold text-ink-900">Submit challenges and discover rated talent.</h3>
          <div className="space-y-2">
            {organizations.map((o) => (
              <button key={o.id} onClick={() => go("company", o.id, "/company")} className={rowClass}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">{o.name}</span>
                  <span className="block truncate text-xs text-ink-400">{o.industry}</span>
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
