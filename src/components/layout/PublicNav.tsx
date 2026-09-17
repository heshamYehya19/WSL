import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Wordmark } from "../ui/Wordmark"
import { DemoSwitcher } from "./DemoSwitcher"
import { useDemoUser } from "../../state/demoUser"

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/for-students", label: "For Students" },
  { to: "/for-universities", label: "For Universities" },
  { to: "/for-companies", label: "For Companies" },
]

export function PublicNav() {
  const [open, setOpen] = useState(false)
  const { session } = useDemoUser()

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? "text-teal-600" : "text-ink-600 hover:text-ink-950"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {session.role !== "guest" ? (
            <DemoSwitcher />
          ) : (
            <NavLink
              to="/login"
              className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
            >
              Demo Access
            </NavLink>
          )}
          <button
            className="rounded-lg border border-ink-200 p-2 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className="block h-0.5 w-4 bg-ink-800" />
            <span className="mt-1 block h-0.5 w-4 bg-ink-800" />
            <span className="mt-1 block h-0.5 w-4 bg-ink-800" />
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-ink-100 px-4 py-3 lg:hidden">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
