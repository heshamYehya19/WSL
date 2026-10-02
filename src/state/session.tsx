import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { DemoUserState, Role } from "../types"

// Which account the visitor is acting as. Only the account's id lives here — every
// detail about it (name, programs, data) is read from the database via the store.
const STORAGE_KEY = "wsl-demo-user-v2"

const GUEST: DemoUserState = { role: "guest" }

function load(): DemoUserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoUserState) : GUEST
  } catch {
    return GUEST
  }
}

interface SessionContextValue {
  session: DemoUserState
  signInAs: (role: Exclude<Role, "guest">, id: string) => void
  signOut: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoUserState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Storage unavailable — the session just won't survive a reload.
    }
  }, [session])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      signInAs: (role, id) => {
        if (role === "student") setSession({ role, studentId: id })
        else if (role === "university") setSession({ role, universityId: id })
        else setSession({ role, companyId: id })
      },
      signOut: () => setSession(GUEST),
    }),
    [session],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within SessionProvider")
  return ctx
}
