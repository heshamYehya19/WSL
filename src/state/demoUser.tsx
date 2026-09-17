import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { DemoUserState, Role } from "../types"
import { organizations, students, universities } from "../data/seed"

const STORAGE_KEY = "wsl-demo-user-v1"

const DEFAULT_STATE: DemoUserState = { role: "guest" }

function load(): DemoUserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return JSON.parse(raw) as DemoUserState
  } catch {
    return DEFAULT_STATE
  }
}

interface DemoUserContextValue {
  session: DemoUserState
  student: (typeof students)[number] | undefined
  university: (typeof universities)[number] | undefined
  company: (typeof organizations)[number] | undefined
  signInAs: (role: Role, id?: string) => void
  signOut: () => void
}

const DemoUserContext = createContext<DemoUserContextValue | null>(null)

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoUserState>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const value = useMemo<DemoUserContextValue>(() => {
    const signInAs = (role: Role, id?: string) => {
      if (role === "student") setSession({ role, studentId: id ?? "stu-ahmed" })
      else if (role === "university") setSession({ role, universityId: id ?? "uni-anu" })
      else if (role === "company") setSession({ role, companyId: id ?? "org-jts" })
      else setSession({ role: "guest" })
    }
    const signOut = () => setSession({ role: "guest" })

    return {
      session,
      student: students.find((s) => s.id === session.studentId),
      university: universities.find((u) => u.id === session.universityId),
      company: organizations.find((o) => o.id === session.companyId),
      signInAs,
      signOut,
    }
  }, [session])

  return <DemoUserContext.Provider value={value}>{children}</DemoUserContext.Provider>
}

export function useDemoUser(): DemoUserContextValue {
  const ctx = useContext(DemoUserContext)
  if (!ctx) throw new Error("useDemoUser must be used within DemoUserProvider")
  return ctx
}
