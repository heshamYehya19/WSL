import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { PageHeader } from "../../components/ui/PageHeader"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { useTour } from "../../state/tour"

const FEATURED_STUDENT = "stu-aau-yazan"

/** The account a first-time visitor should open: a full skill record, plus the guided tour of his story. */
function StartHere({ onSignIn }: { onSignIn: () => void }) {
  const { start } = useTour()
  const { getStudent, getUniversity } = useStore()
  const student = getStudent(FEATURED_STUDENT)
  if (!student) return null
  const uni = getUniversity(student.universityId)
  return (
    <div className="animate-fade-in-up relative mb-8 overflow-hidden rounded-3xl bg-night p-6 text-white sm:p-8">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-teal-500/25 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-base font-bold text-ink-950">
            {student.initials}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-teal-300 uppercase">Start here</div>
            <h2 className="mt-1 text-xl font-semibold">{student.name}</h2>
            <p className="text-sm text-white/70">
              {student.field} · {student.year} · {uni?.name}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              Follow one student through the whole loop: IRIS posts a challenge, his university assigns it, he submits real code, WSL's AI quotes the
              lines that prove each skill, a mentor verifies them, and IRIS finds him by evidence instead of a CV. About three minutes.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-teal-400 px-5 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-300"
          >
            Take the tour →
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-300"
          >
            Open {student.name.split(" ")[0]}'s skill record
          </button>
        </div>
      </div>
    </div>
  )
}

function RoleIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function RoleCard({ label, title, icon, delay, children }: { label: string; title: string; icon: ReactNode; delay: number; children: ReactNode }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group/card relative overflow-hidden rounded-3xl border border-ink-200 bg-surface p-5 transition-all duration-300 hover:border-teal-400/60 hover:shadow-xl hover:shadow-teal-500/5"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-teal-500 to-teal-300 transition-transform duration-500 group-hover/card:scale-x-100" />
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-night text-teal-300 transition-transform duration-300 group-hover/card:-rotate-6 group-hover/card:scale-110">
          {icon}
        </span>
        <div className="text-xs font-semibold tracking-wide text-teal-600 uppercase">{label}</div>
      </div>
      <h3 className="mb-4 font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  )
}

function AccountRow({ initials, round, title, sub, onClick }: { initials: string; round?: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-100/40 hover:shadow-md"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center bg-ink-100 text-[11px] font-bold text-ink-600 transition-all duration-200 group-hover:bg-gradient-to-br group-hover:from-teal-400 group-hover:to-teal-600 group-hover:text-ink-950 ${
          round ? "rounded-full" : "rounded-xl"
        }`}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{title}</span>
        <span className="block truncate text-xs text-ink-400">{sub}</span>
      </span>
      <span className="text-teal-600 opacity-40 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">→</span>
    </button>
  )
}

export default function DemoLogin() {
  const { signInAs } = useDemoUser()
  const { students, universities, organizations } = useStore()
  const navigate = useNavigate()

  const go = (role: "student" | "university" | "company", id: string, path: string) => {
    signInAs(role, id)
    navigate(path)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="Sign In"
        title="Continue as..."
        subtitle="Choose your account. Each student, university, and company has its own data on WSL, and everything you do is saved to that account. You can switch accounts anytime from the top bar."
      />

      <StartHere onSignIn={() => go("student", FEATURED_STUDENT, "/student/profile")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <RoleCard
          delay={0}
          label="Student"
          title="Browse challenges, submit evidence, build your skill record."
          icon={<RoleIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1.5-4 5-6 8-6s6.5 2 8 6" />}
        >
          <div className="space-y-4">
            {universities.map((u) => (
              <div key={u.id}>
                <div className="mb-1.5 text-xs font-semibold text-ink-400">{u.name}</div>
                <div className="space-y-2">
                  {students
                    .filter((s) => s.universityId === u.id)
                    .map((s) => (
                      <AccountRow key={s.id} round initials={s.initials} title={s.name} sub={`${s.field} · ${s.year}`} onClick={() => go("student", s.id, "/student")} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </RoleCard>

        <RoleCard
          delay={80}
          label="University"
          title="Assign challenges, monitor submissions, confirm work to companies."
          icon={<RoleIcon d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5ZM6 11.6v4.2c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9v-4.2" />}
        >
          <div className="space-y-2">
            {universities.map((u) => (
              <AccountRow
                key={u.id}
                initials={u.shortName.slice(0, 3)}
                title={u.name}
                sub={`${u.city} · ${u.type} · Est. ${u.established}`}
                onClick={() => go("university", u.id, "/university")}
              />
            ))}
          </div>
        </RoleCard>

        <RoleCard
          delay={160}
          label="Company"
          title="Submit challenges and discover rated talent."
          icon={<RoleIcon d="M4 20.5V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9.5h5a1 1 0 0 1 1 1v10M7.5 7.5h1M11 7.5h1M7.5 11h1M11 11h1M7.5 14.5h1M11 14.5h1" />}
        >
          <div className="space-y-2">
            {organizations.map((o) => (
              <AccountRow key={o.id} initials={o.logoInitials} title={o.name} sub={o.industry} onClick={() => go("company", o.id, "/company")} />
            ))}
          </div>
        </RoleCard>
      </div>
    </div>
  )
}
