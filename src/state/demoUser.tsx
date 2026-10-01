import { useSession } from "./session"
import { useStore } from "./store"

/** The signed-in account, resolved against the database. */
export function useDemoUser() {
  const { session, signInAs, signOut } = useSession()
  const { students, universities, organizations } = useStore()

  return {
    session,
    student: session.role === "student" ? students.find((s) => s.id === session.studentId) : undefined,
    university: session.role === "university" ? universities.find((u) => u.id === session.universityId) : undefined,
    company: session.role === "company" ? organizations.find((o) => o.id === session.companyId) : undefined,
    signInAs,
    signOut,
  }
}
