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
  const [industry, setIndustry] = useState(company?.industry ?? "")
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate")
  const [requiredSkills, setRequiredSkills] = useState("")
  const [learningOutcomes, setLearningOutcomes] = useState("")
  const [datasetAvailability, setDatasetAvailability] = useState("")
  const [dataSensitivity, setDataSensitivity] = useState<DataSensitivity>("Low")
  const [numTeams, setNumTeams] = useState(2)
  const [deadline, setDeadline] = useState("")
  const [preferredUniversityId, setPreferredUniversityId] = useState<string>("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactRole, setContactRole] = useState("")
  const [visibility, setVisibility] = useState<ChallengeVisibility>("Public")

  if (!company) return null

  const buildChallenge = (status: Challenge["status"]): Challenge => {
    const skills = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
    const outcomes = learningOutcomes.split("\n").map((s) => s.trim()).filter(Boolean)
    const now = new Date().toISOString()
    return {
      id: `chal-${Date.now()}`,
      title: title || "Untitled Challenge",
      organizationId: company.id,
      problemDescription,
      objectives: outcomes.length ? outcomes : ["Explore the problem", "Prototype a solution", "Present findings"],
      expectedOutput: "A working prototype or analysis plus a short report, as detailed in submission requirements.",
      industry,
      difficulty,
      requiredSkills: skills.length ? skills : ["Problem Solving"],
      learningOutcomes: outcomes.length ? outcomes : ["Apply classroom concepts to a real operational problem"],
      datasetAvailability: datasetAvailability || "To be confirmed with WSL during structuring review.",
      dataSensitivity,
      numTeams,
      deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      preferredUniversityId: preferredUniversityId || null,
      contactPerson: contactPerson || "Company Contact",
      contactRole: contactRole || "Representative",
      visibility,
      submissionRequirements: ["Project report", "GitHub repository", "Presentation"],
      status,
      courseMapping: null,
      submittedAt: status === "Draft" ? null : now,
      history: status === "Draft" ? [{ status: "Draft", at: now }] : [{ status: "Draft", at: now }, { status: "Submitted", at: now }],
    }
  }

  const submit = (asDraft: boolean) => {
    const challenge = buildChallenge(asDraft ? "Draft" : "Submitted")
    createChallenge(challenge)
    navigate(`/company/challenges/${challenge.id}`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Submit Challenge"
        title="Describe a real problem — not confidential data"
        subtitle="WSL structures and reviews every challenge before any student sees it."
      />

      <div className="mb-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-3 text-sm text-ink-800">
        “WSL converts business challenges into safe, structured learning challenges before students access them.”
      </div>

      <form className="space-y-6 rounded-2xl border border-ink-200 bg-white p-6" onSubmit={(e) => e.preventDefault()}>
        <Field label="Challenge title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Predict Cafeteria Demand" />
        </Field>

        <Field label="Organization">
          <input className={`${inputClass} bg-ink-50 text-ink-500`} value={company.name} disabled />
        </Field>

        <Field label="Problem description" hint="Describe the operational problem in general terms — leave out confidential specifics.">
          <textarea className={inputClass} rows={4} value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
        </Field>

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

        <Field label="Required skills" hint="Comma-separated, e.g. Python, Machine Learning, Data Analysis">
          <input className={inputClass} value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} />
        </Field>

        <Field label="Desired learning outcomes" hint="One per line">
          <textarea className={inputClass} rows={3} value={learningOutcomes} onChange={(e) => setLearningOutcomes(e.target.value)} />
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Number of student teams">
            <input type="number" min={1} max={10} className={inputClass} value={numTeams} onChange={(e) => setNumTeams(Number(e.target.value))} />
          </Field>
          <Field label="Deadline">
            <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        <Field label="Preferred university / program" hint="Optional — leave unset to let WSL route it.">
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

        <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-5">
          <button onClick={() => submit(false)} className="rounded-lg bg-ink-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
            Submit for WSL Review
          </button>
          <button onClick={() => submit(true)} className="rounded-lg border border-ink-200 px-6 py-2.5 text-sm font-semibold text-ink-700 hover:border-teal-400">
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  )
}
