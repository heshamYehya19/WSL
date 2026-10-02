import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import type { ChallengeVisibility, DataSensitivity, Difficulty } from "../../types"

const DIFFICULTIES: Difficulty[] = ["Foundational", "Intermediate", "Advanced"]
const SENSITIVITIES: DataSensitivity[] = ["None (Public Dataset)", "Low", "Moderate", "High (NDA Required)"]
const VISIBILITIES: { value: ChallengeVisibility; label: string; body: string }[] = [
  { value: "Public", label: "Public", body: "Safe challenge that can be publicly displayed to any student." },
  { value: "University Only", label: "University Only", body: "Only participating universities and eligible students can access it." },
  { value: "Restricted", label: "Restricted", body: "Only selected teams can access it — may require additional approval / NDA." },
]

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"

export default function SubmitChallenge() {
  const { company } = useDemoUser()
  const { createChallenge, universities, contacts } = useStore()
  const myContacts = contacts.filter((c) => c.organizationId === company?.id)
  const navigate = useNavigate()

  const [title, setTitle] = useState("")
  const [problemDescription, setProblemDescription] = useState("")
  const [requiredSkills, setRequiredSkills] = useState("")
  const [visibility, setVisibility] = useState<ChallengeVisibility>("Public")

  const [industry, setIndustry] = useState(company?.industry ?? "")
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate")
  const [learningOutcomes, setLearningOutcomes] = useState("")
  const [datasetAvailability, setDatasetAvailability] = useState("")
  const [dataSensitivity, setDataSensitivity] = useState<DataSensitivity>("Low")
  const [deadline, setDeadline] = useState("")
  const [preferredUniversityId, setPreferredUniversityId] = useState<string>("")
  const [contactId, setContactId] = useState(myContacts.find((c) => c.isPrimary)?.id ?? myContacts[0]?.id ?? "")
  const [saving, setSaving] = useState(false)
  const [minDeadline] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))

  if (!company) return null

  const submit = async (asDraft: boolean) => {
    setSaving(true)
    const id = await createChallenge({
      title,
      problemDescription,
      requiredSkills: requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
      visibility,
      industry,
      difficulty,
      learningOutcomes: learningOutcomes.split("\n").map((s) => s.trim()).filter(Boolean),
      datasetAvailability,
      dataSensitivity,
      deadline,
      preferredUniversityId: preferredUniversityId || null,
      contactId,
      asDraft,
    })
    setSaving(false)
    if (id) navigate(`/company/challenges/${id}`)
  }

  const canSubmit = !saving && title.trim().length > 0 && problemDescription.trim().length > 0

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Submit Challenge"
        title="Describe a real problem — not confidential data"
        subtitle="WSL automatically screens it for private data and routes it to a university. No confidential data required."
      />

      <div className="mb-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-3 text-sm text-ink-800">
        “WSL automatically checks every challenge for private or confidential data before it reaches a university — nobody watches this happen.”
      </div>

      <form className="space-y-5 rounded-2xl border border-ink-200 bg-surface p-6" onSubmit={(e) => e.preventDefault()}>
        <Field label="Challenge title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Forecast Weekly Support Ticket Volume"
            autoFocus
          />
        </Field>

        <Field label="Problem description" hint="A few sentences in general terms — leave out confidential specifics.">
          <textarea className={inputClass} rows={3} value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
        </Field>

        <Field label="Required skills" hint="Comma-separated, e.g. Python, Machine Learning, Data Analysis">
          <input className={inputClass} value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} />
        </Field>

        <div>
          <label className="mb-2 block text-xs font-medium text-ink-500">Visibility level</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {VISIBILITIES.map((v) => (
              <button
                type="button"
                key={v.value}
                onClick={() => setVisibility(v.value)}
                className={`rounded-xl border p-3 text-left transition-colors ${visibility === v.value ? "border-teal-500 bg-teal-50" : "border-ink-200 hover:border-teal-300"}`}
              >
                <p className="text-sm font-semibold text-ink-900">{v.label}</p>
                <p className="mt-1 text-xs text-ink-500">{v.body}</p>
              </button>
            ))}
          </div>
        </div>

        <details className="group rounded-xl border border-ink-100">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-600 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-ink-400 transition-transform group-open:rotate-90">›</span>
              Additional details <span className="text-ink-400 font-normal">(optional — sensible defaults are used if skipped)</span>
            </span>
          </summary>
          <div className="space-y-4 border-t border-ink-100 px-4 pt-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry">
                <input className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </Field>
              <Field label="Difficulty">
                <select className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Desired learning outcomes" hint="One per line">
              <textarea className={inputClass} rows={2} value={learningOutcomes} onChange={(e) => setLearningOutcomes(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Dataset availability">
                <input className={inputClass} value={datasetAvailability} onChange={(e) => setDatasetAvailability(e.target.value)} placeholder="e.g. Sample CSV, 12 months" />
              </Field>
              <Field label="Data sensitivity level">
                <select className={inputClass} value={dataSensitivity} onChange={(e) => setDataSensitivity(e.target.value as DataSensitivity)}>
                  {SENSITIVITIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Deadline" hint="Defaults to 30 days from today.">
              <input type="date" min={minDeadline} className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>

            <Field label="Preferred university" hint="Leave unset to let WSL route it.">
              <select className={inputClass} value={preferredUniversityId} onChange={(e) => setPreferredUniversityId(e.target.value)}>
                <option value="">No preference</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

            <Field label="Contact person" hint="Reviews submissions and signs your company's feedback.">
              <select className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {myContacts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.role}</option>)}
              </select>
            </Field>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 pt-5">
          <button
            onClick={() => submit(false)}
            disabled={!canSubmit}
            className="rounded-lg bg-night px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Submitting…" : "Submit Challenge"}
          </button>
          <button onClick={() => submit(true)} disabled={!canSubmit} className="text-sm font-medium text-ink-400 hover:text-ink-700 disabled:opacity-40">
            Save as draft instead
          </button>
        </div>
      </form>
    </div>
  )
}
