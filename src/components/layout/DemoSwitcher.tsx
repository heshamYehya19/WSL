import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"

function Avatar({ text, round = true, active = false }: { text: string; round?: boolean; active?: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold transition-transform duration-200 group-hover:scale-110 ${
        round ? "rounded-full" : "rounded-lg"
      } ${active ? "bg-gradient-to-br from-teal-400 to-teal-600 text-ink-950" : "bg-ink-100 text-ink-600"}`}
    >
      {text}
    </span>
  )
}

function Row({ active, onClick, avatar, title, sub }: { active: boolean; onClick: () => void; avatar: ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${active ? "bg-teal-100/60" : "hover:bg-ink-50"}`}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink-900">{title}</span>
        <span className="block truncate text-[11px] text-ink-400">{sub}</span>
      </span>
      {active ? (
        <span className="text-teal-600">✓</span>
      ) : (
        <span className="text-ink-300 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">→</span>
      )}
    </button>
  )
}

export function DemoSwitcher() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { session, student, university, company, signInAs, signOut } = useDemoUser()
  const { students, universities, organizations, resetDemo } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const currentLabel =
    session.role === "student"
      ? student?.name
      : session.role === "university"
        ? university?.shortName
        : session.role === "company"
          ? company?.name
          : "Guest"
  const currentInitials =
    session.role === "student" ? student?.initials : session.role === "university" ? university?.shortName.slice(0, 3) : session.role === "company" ? company?.logoInitials : "?"

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  const choose = (role: "student" | "university" | "company", id: string, path: string) => {
    signInAs(role, id)
    close()
    navigate(path)
  }

  const q = query.trim().toLowerCase()
  const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q))
  const matchedStudents = students.filter((s) => match(s.name, s.field))
  const matchedUnis = universities.filter((u) => match(u.name, u.shortName, u.city))
  const matchedOrgs = organizations.filter((o) => match(o.name, o.industry))
  const nothing = matchedStudents.length + matchedUnis.length + matchedOrgs.length === 0

  const heading = (label: string) => <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-wider text-ink-400 uppercase">{label}</div>

  return (
    <div className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="group flex max-w-[60vw] items-center gap-2 rounded-full border border-ink-200 bg-surface py-1 pr-3 pl-1 text-sm font-medium text-ink-700 transition-all duration-200 hover:border-teal-400 hover:shadow-md hover:shadow-teal-500/10"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[10px] font-bold text-ink-950">
          {currentInitials}
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-verified-500" />
        </span>
        <span className="truncate">{currentLabel}</span>
        <span className={`text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="animate-pop-in absolute right-0 z-50 mt-2 flex max-h-[75vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-2xl shadow-ink-950/15">
            <div className="border-b border-ink-100 p-3">
              <p className="mb-2 px-1 text-xs text-ink-400">Switch accounts to see WSL from each side.</p>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, universities, companies…"
                className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {nothing && <p className="py-6 text-center text-sm text-ink-400">No accounts match “{query}”.</p>}

              {matchedStudents.length > 0 && (
                <div>
                  {heading("Students")}
                  {universities.map((u) => {
                    const list = matchedStudents.filter((s) => s.universityId === u.id)
                    if (list.length === 0) return null
                    return (
                      <div key={u.id} className="mb-1">
                        <div className="px-2 pt-1 text-[11px] font-semibold text-teal-600">{u.shortName}</div>
                        {list.map((s) => (
                          <Row
                            key={s.id}
                            active={s.id === student?.id}
                            onClick={() => choose("student", s.id, "/student")}
                            avatar={<Avatar text={s.initials} active={s.id === student?.id} />}
                            title={s.name}
                            sub={`${s.field} · ${s.year}`}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              {matchedUnis.length > 0 && (
                <div>
                  {heading("Universities")}
                  {matchedUnis.map((u) => (
                    <Row
                      key={u.id}
                      active={u.id === university?.id}
                      onClick={() => choose("university", u.id, "/university")}
                      avatar={<Avatar text={u.shortName.slice(0, 3)} round={false} active={u.id === university?.id} />}
                      title={u.name}
                      sub={u.city}
                    />
                  ))}
                </div>
              )}

              {matchedOrgs.length > 0 && (
                <div>
                  {heading("Companies")}
                  {matchedOrgs.map((o) => (
                    <Row
                      key={o.id}
                      active={o.id === company?.id}
                      onClick={() => choose("company", o.id, "/company")}
                      avatar={<Avatar text={o.logoInitials} round={false} active={o.id === company?.id} />}
                      title={o.name}
                      sub={o.industry}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1 border-t border-ink-100 p-2">
              <button
                onClick={async () => {
                  if (confirm("Reset all data back to its starting state? Everything submitted, rated, or changed by any account will be lost.")) {
                    await resetDemo()
                    close()
                  }
                }}
                className="group rounded-xl px-2 py-2 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
              >
                <span className="inline-block transition-transform duration-300 group-hover:-rotate-180">↺</span> Reset all data
              </button>
              <button
                onClick={() => {
                  signOut()
                  close()
                  navigate("/")
                }}
                className="rounded-xl px-2 py-2 text-xs font-medium text-ink-500 transition-colors hover:bg-danger-100 hover:text-danger-600"
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
