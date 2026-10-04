import { createContext, startTransition, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { TOUR_STEPS } from "../lib/tour"
import { useSession } from "./session"

const STORAGE_KEY = "wsl-tour-v1"

interface TourContextValue {
  /** Index of the current step, or null when no tour is running. */
  step: number | null
  start: () => void
  goTo: (index: number) => void
  end: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

function load(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = raw === null ? NaN : Number(raw)
    return Number.isInteger(n) && n >= 0 && n < TOUR_STEPS.length ? n : null
  } catch {
    return null
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(load)
  const { signInAs } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      if (step === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, String(step))
    } catch {
      // Storage unavailable — the tour just won't survive a reload.
    }
  }, [step])

  const value = useMemo<TourContextValue>(() => {
    const goTo = (index: number) => {
      const s = TOUR_STEPS[index]
      if (!s) return
      setStep(index)
      // One transition for both, so the app never renders the new account on the old
      // page (which would redirect it to that account's dashboard instead).
      startTransition(() => {
        signInAs(s.role, s.accountId)
        navigate(s.path)
      })
    }
    return { step, start: () => goTo(0), goTo, end: () => setStep(null) }
  }, [step, signInAs, navigate])

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be used within TourProvider")
  return ctx
}
