import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"

export function DemoSwitcher() {
  const [open, setOpen] = useState(false)
  const { session, student, university, company, signInAs, signOut } = useDemoUser()
  const { students, universities, organizations, resetDemo } = useStore()
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
        className="flex max-w-[60vw] items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:border-teal-400"
      >
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-teal-400" />
        <span className="truncate">{currentLabel}</span>
        <span className="text-ink-400">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-[75vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
            <p className="px-1 pb-2 text-xs text-ink-400">
              Switch accounts to see WSL from each side. Each account sees and changes only its own data.
            </p>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Students</div>
              {universities.map((u) => (
                <div key={u.id} className="mb-1">
                  <div className="px-2 pt-1 text-[11px] font-semibold text-teal-600">{u.shortName}</div>
                  {students
                    .filter((s) => s.universityId === u.id)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => choose("student", s.id, "/student")}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50 ${s.id === student?.id ? "bg-teal-50" : ""}`}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="shrink-0 text-xs text-ink-400">{s.field}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Universities</div>
              {universities.map((u) => (
                <button
                  key={u.id}
                  onClick={() => choose("university", u.id, "/university")}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50 ${u.id === university?.id ? "bg-teal-50" : ""}`}
                >
                  <span className="truncate">{u.name}</span>
                  <span className="shrink-0 text-xs text-ink-400">{u.city}</span>
                </button>
              ))}
            </div>

            <div className="mb-2">
              <div className="px-1 pb-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">Companies</div>
              {organizations.map((o) => (
                <button
                  key={o.id}
                  onClick={() => choose("company", o.id, "/company")}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50 ${o.id === company?.id ? "bg-teal-50" : ""}`}
                >
                  <span className="truncate">{o.name}</span>
                  <span className="shrink-0 truncate text-xs text-ink-400">{o.industry}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-ink-100 pt-2">
              <button
                onClick={async () => {
                  if (confirm("Reset all data back to its starting state? Everything submitted, rated, or changed by any account will be lost.")) {
                    await resetDemo()
                    setOpen(false)
                  }
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-500 hover:bg-ink-50"
              >
                ↺ Reset all data
              </button>
              <button
                onClick={() => {
                  signOut()
                  setOpen(false)
                  navigate("/")
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-500 hover:bg-ink-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
