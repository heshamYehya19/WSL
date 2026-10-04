import { Suspense, useState } from "react"
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { Wordmark } from "../ui/Wordmark"
import { DemoSwitcher } from "./DemoSwitcher"
import { ThemeToggle } from "../ui/ThemeToggle"
import { RouteFallback } from "../ui/RouteFallback"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { formatRelative } from "../../lib/format"
import { AmbientConstellation } from "../ui/AmbientConstellation"
import type { Role } from "../../types"
import { TourPanel } from "../tour/TourPanel"
import { useTour } from "../../state/tour"

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
    { to: "/student/opportunities", label: "Opportunities", icon: <Icon d="M5 12h14M13 6l6 6-6 6" /> },
    { to: "/student/profile", label: "Profile", icon: <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6" /> },
  ],
  university: [
    { to: "/university", label: "Dashboard", icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> },
    { to: "/university/challenges", label: "Challenges", icon: <Icon d="M9 3h6l1 4H8l1-4zM4 21l3-11h10l3 11H4z" /> },
    { to: "/university/projects", label: "Projects", icon: <Icon d="M4 6h16M4 12h16M4 18h10" /> },
    { to: "/university/submissions", label: "Submissions", icon: <Icon d="M9 12l2 2 4-4M12 21c4-1.5 8-4.5 8-10V5l-8-3-8 3v6c0 5.5 4 8.5 8 10z" /> },
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
  const { notifications, markNotificationsRead } = useStore()
  const { step: tourStep } = useTour()
  const [notifOpen, setNotifOpen] = useState(false)
  const { pathname } = useLocation()

  const identity =
    role === "student" ? student?.name : role === "university" ? university?.name : company?.name
  const identitySub =
    role === "student" ? student?.field : role === "university" ? university?.city : company?.industry
  const identityInitials =
    role === "student" ? student?.initials : role === "university" ? university?.shortName.slice(0, 3) : company?.logoInitials

  // Signed in as a different kind of account (e.g. just switched via the account menu,
  // whose navigate() lands a beat after the session change): go to that account's home,
  // not the login screen.
  if (session.role !== role && session.role !== "guest") {
    return <Navigate to={`/${session.role}`} replace />
  }
  // No session for this area, or the account no longer exists in the database.
  if (session.role !== role || !identity) {
    return <Navigate to="/login" replace />
  }

  const unread = notifications.filter((n) => !n.read).length
  // Opening the panel shows what's new; closing it marks everything as read.
  const closeNotifications = () => {
    if (unread > 0) markNotificationsRead()
    setNotifOpen(false)
  }
  const toggleNotifications = () => (notifOpen ? closeNotifications() : setNotifOpen(true))

  return (
    <div className="relative isolate flex min-h-screen bg-ink-50">
      <AmbientConstellation />
      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-surface px-4 py-5 md:flex">
        <Wordmark />
        <div className="group relative mt-6 overflow-hidden rounded-2xl bg-night px-3 py-3">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-teal-500/25 blur-2xl transition-transform duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-ink-950 shadow-lg shadow-teal-500/20 ${
                role === "student" ? "rounded-full" : "rounded-xl"
              }`}
            >
              {identityInitials}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wider text-teal-300 uppercase">{ROLE_LABEL[role]} view</div>
              <div className="truncate text-sm font-semibold text-white">{identity}</div>
              <div className="truncate text-[11px] text-white/55">{identitySub}</div>
            </div>
          </div>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${role}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? "bg-night text-white shadow-md shadow-ink-950/10" : "text-ink-600 hover:translate-x-0.5 hover:bg-ink-50 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-1/2 -left-4 h-6 w-1 -translate-y-1/2 rounded-r-full bg-teal-400 transition-all duration-300 ${
                      isActive ? "opacity-100" : "h-0 opacity-0"
                    }`}
                  />
                  <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-teal-300" : ""}`}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="mt-4 rounded-lg px-3 py-2 text-xs font-medium text-ink-400 hover:text-ink-700">
          ← Back to public site
        </NavLink>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-100 bg-surface/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Wordmark />
          </div>
          <div className="hidden text-sm text-ink-400 md:block">Jordan 2076 · Amman — Innovation in Education &amp; Learning Systems</div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="relative rounded-full border border-ink-200 p-2 text-ink-500 transition-colors hover:border-teal-400 hover:text-teal-600"
                aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
              >
                <span className={`block ${unread > 0 ? "animate-bell" : ""}`}>
                  <Icon d="M15 17h5l-1.4-2.1a2 2 0 01-.3-1V11a6 6 0 10-12 0v2.9c0 .36-.1.7-.3 1L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </span>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeNotifications} />
                  <div className="animate-pop-in absolute right-0 z-50 mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-ink-200 bg-surface p-2 shadow-2xl shadow-ink-950/10">
                    <div className="flex items-center justify-between px-3 pt-1 pb-2">
                      <span className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Notifications</span>
                      {unread > 0 && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">{unread} new</span>}
                    </div>
                    {notifications.length === 0 && <p className="px-3 py-4 text-center text-sm text-ink-400">No notifications yet.</p>}
                    {notifications.map((n) => {
                      const body = (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-ink-800">{n.title}</span>
                            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />}
                          </div>
                          <div className="text-xs text-ink-500">{n.body}</div>
                          <div className="mt-0.5 text-[11px] text-ink-400">{formatRelative(n.createdAt)}</div>
                        </>
                      )
                      return n.link ? (
                        <Link key={n.id} to={n.link} onClick={closeNotifications} className={`block rounded-xl px-3 py-2 text-sm transition-colors hover:bg-ink-50 ${!n.read ? "bg-teal-100/40" : ""}`}>
                          {body}
                        </Link>
                      ) : (
                        <div key={n.id} className="rounded-lg px-3 py-2 text-sm">{body}</div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <ThemeToggle />
            <DemoSwitcher />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div key={pathname} className="animate-page-enter">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
          {/* Room to scroll the page's last content above the tour panel. */}
          {tourStep !== null && <div className="h-64 sm:h-48" aria-hidden />}
        </main>
        <TourPanel />
      </div>
    </div>
  )
}
