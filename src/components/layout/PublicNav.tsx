import { useEffect, useRef, useState } from "react"
import { NavLink } from "react-router-dom"
import { Wordmark } from "../ui/Wordmark"
import { DemoSwitcher } from "./DemoSwitcher"
import { ThemeToggle } from "../ui/ThemeToggle"
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
  const progressRef = useRef<HTMLDivElement>(null)

  // Thin reading-progress bar along the bottom of the header. Written straight to the
  // DOM so scrolling doesn't re-render the nav.
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-surface/90 backdrop-blur">
      <div
        ref={progressRef}
        className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-gradient-to-r from-teal-500 to-teal-300"
        style={{ transform: "scaleX(0)" }}
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `relative pb-0.5 text-sm font-medium transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:bg-teal-500 after:transition-transform after:duration-300 after:ease-out after:content-[''] ${
                  isActive
                    ? "text-teal-600 after:scale-x-100"
                    : "text-ink-600 after:scale-x-0 hover:text-ink-950 hover:after:scale-x-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        {/* Tighter on phones: with an account signed in, the default gaps overflowed a 390px screen. */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {session.role !== "guest" ? (
            <DemoSwitcher />
          ) : (
            <NavLink
              to="/login"
              className="rounded-full bg-night px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 hover:shadow-lg hover:shadow-teal-600/20 active:translate-y-0"
            >
              Sign In
            </NavLink>
          )}
          <button
            className="rounded-lg border border-ink-200 p-2 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className={`block h-0.5 w-4 bg-ink-800 transition-transform duration-300 ${open ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`mt-1 block h-0.5 w-4 bg-ink-800 transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
            <span className={`mt-1 block h-0.5 w-4 bg-ink-800 transition-transform duration-300 ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-ink-100 px-4 py-3 lg:hidden">
          {LINKS.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={({ isActive }) =>
                `animate-fade-in-up rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-ink-50 ${isActive ? "text-teal-600" : "text-ink-700"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
