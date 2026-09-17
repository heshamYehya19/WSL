import { useState } from "react"
import { NavLink, Navigate, Outlet } from "react-router-dom"
import type { ReactNode } from "react"
import { Wordmark } from "../ui/Wordmark"
import { DemoSwitcher } from "./DemoSwitcher"
import { useDemoUser } from "../../state/demoUser"
import type { Role } from "../../types"

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const NAV: Record<Exclude<Role, "guest">, NavItem[]> = {
  student: [
    { to: "/student", label: "Dashboard", icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> },
    { to: "/student/challenges", label: "Challenges", icon: <Icon d="M9 3h6l1 4H8l1-4zM4 21l3-11h10l3 11H4z" /> },
    { to: "/student/projects", label: "Projects", icon: <Icon d="M4 6h16M4 12h16M4 18h10" /> },
    { to: "/student/skills", label: "Skills", icon: <Icon d="M12 2l2.6 6.6L21 9l-5 4.4L17.4 21 12 17.3 6.6 21 8 13.4 3 9l6.4-.4z" /> },
    { to: "/student/opportunities", label: "Opportunities", icon: <Icon d="M5 12h14M13 6l6 6-6 6" /> },
    { to: "/student/profile", label: "Profile", icon: <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6" /> },
  ],
  university: [
    { to: "/university", label: "Dashboard", icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> },
    { to: "/university/challenges", label: "Challenges", icon: <Icon d="M9 3h6l1 4H8l1-4zM4 21l3-11h10l3 11H4z" /> },
    { to: "/university/projects", label: "Projects", icon: <Icon d="M4 6h16M4 12h16M4 18h10" /> },
    { to: "/university/evidence", label: "Evidence", icon: <Icon d="M6 2h9l5 5v15H6zM14 2v6h6" /> },
    { to: "/university/verification", label: "Verification", icon: <Icon d="M9 12l2 2 4-4M12 21c4-1.5 8-4.5 8-10V5l-8-3-8 3v6c0 5.5 4 8.5 8 10z" /> },
    { to: "/university/students", label: "Students", icon: <Icon d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM2 21c1.5-5 6-7 10-7s8.5 2 10 7" /> },
  ],
  company: [
    { to: "/company", label: "Dashboard", icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> },
    { to: "/company/submit", label: "Submit Challenge", icon: <Icon d="M12 5v14M5 12h14" /> },
    { to: "/company/challenges", label: "My Challenges", icon: <Icon d="M9 3h6l1 4H8l1-4zM4 21l3-11h10l3 11H4z" /> },
    { to: "/company/talent", label: "Talent Discovery", icon: <Icon d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" /> },
  ],
}

const ROLE_LABEL: Record<Exclude<Role, "guest">, string> = {
  student: "Student",
  university: "University",
  company: "Company",
}

export function AppShell({ role }: { role: Exclude<Role, "guest"> }) {
  const { session, student, university, company } = useDemoUser()
  const [notifOpen, setNotifOpen] = useState(false)

  if (session.role !== role) {
    return <Navigate to="/login" replace />
  }

  const identity =
    role === "student" ? student?.name : role === "university" ? university?.name : company?.name
  const identitySub =
    role === "student" ? student?.field : role === "university" ? university?.city : company?.industry

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-5 md:flex">
        <Wordmark />
        <div className="mt-6 rounded-xl bg-ink-50 px-3 py-2.5">
          <div className="text-[11px] font-semibold tracking-wide text-teal-600 uppercase">{ROLE_LABEL[role]} view</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-ink-900">{identity}</div>
          <div className="truncate text-xs text-ink-500">{identitySub}</div>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${role}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink-950 text-white" : "text-ink-600 hover:bg-ink-50"
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="mt-4 rounded-lg px-3 py-2 text-xs font-medium text-ink-400 hover:text-ink-700">
          ← Back to public site
        </NavLink>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Wordmark />
          </div>
          <div className="hidden text-sm text-ink-400 md:block">Jordan 2076 · Amman — Innovation in Education &amp; Learning Systems</div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-full border border-ink-200 p-2 text-ink-500 hover:border-teal-400"
                aria-label="Notifications"
              >
                <Icon d="M15 17h5l-1.4-2.1a2 2 0 01-.3-1V11a6 6 0 10-12 0v2.9c0 .36-.1.7-.3 1L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">
                  2
                </span>
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-2 shadow-xl">
                    <div className="rounded-lg px-3 py-2 text-sm hover:bg-ink-50">
                      <div className="font-medium text-ink-800">AI analysis complete</div>
                      <div className="text-xs text-ink-500">New evidence-backed skill signals are ready for review.</div>
                    </div>
                    <div className="rounded-lg px-3 py-2 text-sm hover:bg-ink-50">
                      <div className="font-medium text-ink-800">Challenge accepted</div>
                      <div className="text-xs text-ink-500">A university accepted a submitted challenge.</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DemoSwitcher />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
