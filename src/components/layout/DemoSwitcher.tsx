import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { organizations, students, universities } from "../../data/seed"

export function DemoSwitcher() {
  const [open, setOpen] = useState(false)
  const { session, student, university, company, signInAs, signOut } = useDemoUser()
  const navigate = useNavigate()

  const currentLabel =
    session.role === "student"
      ? student?.name
      : session.role === "university"
        ? university?.shortName
        : session.role === "company"
          ? company?.name
          : "Guest"

  const choose = (role: "student" | "university" | "company", id: string, path: string) => {
    signInAs(role, id)
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:border-teal-400"
      >
        <span className="flex h-2 w-2 rounded-full bg-teal-400" />
        Demo: {currentLabel}
        <span className="text-ink-400">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
            <p className="px-1 pb-2 text-xs text-ink-400">
              No real login required — switch personas to explore the full WSL loop.
            </p>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Student</div>
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose("student", s.id, "/student")}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-ink-400">{s.field}</span>
                </button>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">University</div>
              {universities.map((u) => (
                <button
                  key={u.id}
                  onClick={() => choose("university", u.id, "/university")}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                >
                  <span>{u.name}</span>
                  <span className="text-xs text-ink-400">{u.city}</span>
                </button>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Company</div>
              {organizations.map((o) => (
                <button
                  key={o.id}
                  onClick={() => choose("company", o.id, "/company")}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                >
                  <span>{o.name}</span>
                  <span className="text-xs text-ink-400">{o.industry}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-ink-100 pt-2">
              <button
                onClick={() => {
                  signOut()
                  setOpen(false)
                  navigate("/")
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-500 hover:bg-ink-50"
              >
                Exit to public site
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
