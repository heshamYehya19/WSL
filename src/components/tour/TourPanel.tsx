import { useState } from "react"
import { TOUR_CHALLENGE, TOUR_PROJECT, TOUR_STEPS } from "../../lib/tour"
import { useTour } from "../../state/tour"
import { useStore } from "../../state/store"

/** The floating guide shown on app pages while "Take the tour" is running. */
export function TourPanel() {
  const { step, goTo, end } = useTour()
  const { challenges, addEvidence } = useStore()
  const [trying, setTrying] = useState(false)
  if (step === null) return null
  const s = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1

  // Submits the challenge's own brief as "evidence"; WSL's rejection appears as the usual error message.
  const tryGaming = async () => {
    const c = challenges.find((ch) => ch.id === TOUR_CHALLENGE)
    if (!c) return
    setTrying(true)
    const brief = [c.problemDescription, ...c.objectives, c.expectedOutput].map((l) => `# ${l}`).join("\n")
    await addEvidence(TOUR_PROJECT, { type: "Code", title: "Anomaly detector (copied brief)", link: "", content: `${brief}\nprint("hello world")` })
    setTrying(false)
  }

  return (
    <aside
      aria-label="Guided tour"
      className="animate-fade-in-up fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-teal-400/60 bg-surface p-4 shadow-2xl shadow-ink-950/15 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-teal-600 uppercase">
          Tour · step {step + 1} of {TOUR_STEPS.length} · {s.view} view
        </span>
        <button type="button" onClick={end} className="text-xs text-ink-400 hover:text-ink-700" aria-label="End the tour">
          End tour
        </button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {TOUR_STEPS.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-teal-500" : "bg-ink-100"}`} />
        ))}
      </div>
      <h2 className="mt-3 font-semibold text-ink-900">{s.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{s.body}</p>
      {s.tryGaming && (
        <button
          type="button"
          onClick={tryGaming}
          disabled={trying}
          className="mt-3 w-full rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100/70 disabled:opacity-60"
        >
          {trying ? "Submitting the brief…" : "Try to game it: submit the brief as evidence"}
        </button>
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:border-teal-400 disabled:opacity-40"
        >
          ← Back
        </button>
        {last ? (
          <button type="button" onClick={end} className="rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600">
            Finish tour
          </button>
        ) : (
          <button type="button" onClick={() => goTo(step + 1)} className="rounded-lg bg-night px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600">
            Next: {TOUR_STEPS[step + 1].view} →
          </button>
        )}
      </div>
    </aside>
  )
}
