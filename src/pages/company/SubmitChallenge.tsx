import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { universities } from "../../data/seed"
import type { Challenge, ChallengeVisibility, DataSensitivity, Difficulty } from "../../types"

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
  const { createChallenge } = useStore()
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
  const [contactPerson, setContactPerson] = useState("")
  const [contactRole, setContactRole] = useState("")

  if (!company) return null

  const buildChallenge = (asDraft: boolean): Challenge => {
    const skills = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
    const outcomes = learningOutcomes.split("\n").map((s) => s.trim()).filter(Boolean)
    const now = new Date().toISOString()

    const history: Challenge["history"] = asDraft
      ? [{ status: "Draft", at: now }]
      : [
          { status: "Draft", at: now },
          {
            status: "Sent to University",
            at: now,
            note: "WSL automatically screened this challenge for private or confidential data — none found.",
          },
        ]

    return {
      id: `chal-${Date.now()}`,
      title: title || "Untitled Challenge",
      organizationId: company.id,
      problemDescription,
      objectives: outcomes.length ? outcomes : ["Explore the problem", "Prototype a solution", "Present findings"],
      expectedOutput: "A working prototype or analysis plus a short report, as detailed in submission requirements.",
      industry: industry || company.industry,
      difficulty,
      requiredSkills: skills.length ? skills : ["Problem Solving"],
      learningOutcomes: outcomes.length ? outcomes : ["Apply classroom concepts to a real operational problem"],
      datasetAvailability: datasetAvailability || "To be confirmed during WSL's automatic screening.",
      dataSensitivity,
      deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      preferredUniversityId: preferredUniversityId || null,
      contactPerson: contactPerson || "Company Contact",
      contactRole: contactRole || "Representative",
      visibility,
      submissionRequirements: ["Project report", "GitHub repository", "Presentation"],
      status: asDraft ? "Draft" : "Sent to University",
      assignedProgram: null,
      submittedAt: asDraft ? null : now,
      history,
    }
  }

  const submit = (asDraft: boolean) => {
    const challenge = buildChallenge(asDraft)
    createChallenge(challenge)
    navigate(`/company/challenges/${challenge.id}`)
  }

  const canSubmit = title.trim().length > 0 && problemDescription.trim().length > 0

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

      <form className="space-y-5 rounded-2xl border border-ink-200 bg-white p-6" onSubmit={(e) => e.preventDefault()}>
        <Field label="Challenge title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Predict Cafeteria Demand"
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

            <Field label="Deadline">
              <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>

            <Field label="Preferred university" hint="Leave unset to let WSL route it.">
              <select className={inputClass} value={preferredUniversityId} onChange={(e) => setPreferredUniversityId(e.target.value)}>
                <option value="">No preference</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact person">
                <input className={inputClass} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
              </Field>
              <Field label="Contact role">
                <input className={inputClass} value={contactRole} onChange={(e) => setContactRole(e.target.value)} />
              </Field>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 pt-5">
          <button
            onClick={() => submit(false)}
            disabled={!canSubmit}
            className="rounded-lg bg-ink-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit Challenge
          </button>
          <button onClick={() => submit(true)} disabled={!canSubmit} className="text-sm font-medium text-ink-400 hover:text-ink-700 disabled:opacity-40">
            Save as draft instead
          </button>
        </div>
      </form>
    </div>
  )
}
