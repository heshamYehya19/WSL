import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import type { NewChallengeInput } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { formatBytes } from "../../lib/format"
import type { ChallengeFileKind, ChallengeVisibility, DataSensitivity, Difficulty, ScreeningFinding } from "../../types"

const DIFFICULTIES: Difficulty[] = ["Foundational", "Intermediate", "Advanced"]
const SENSITIVITIES: DataSensitivity[] = ["None (Public Dataset)", "Low", "Moderate", "High (NDA Required)"]
const VISIBILITIES: { value: ChallengeVisibility; label: string; body: string }[] = [
  { value: "Public", label: "Public", body: "Safe challenge that can be publicly displayed to any student." },
  { value: "University Only", label: "University Only", body: "Only participating universities and eligible students can access it." },
  { value: "Restricted", label: "Restricted", body: "Only selected teams can access it — may require additional approval / NDA." },
]

// Mirrors the server's rules in server/screening.ts, so mistakes show up before uploading.
const ACCEPT: Record<ChallengeFileKind, string[]> = {
  description: [".pdf", ".doc", ".docx"],
  dataset: [".csv", ".tsv", ".xlsx", ".json", ".txt"],
}
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_DATASET_FILES = 3

interface PickedFile {
  name: string
  size: number
  /** Base64 contents. */
  data: string
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Checks a picked file against the accepted types and size, returning an error message or null. */
function fileProblem(kind: ChallengeFileKind, file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
  if (!ACCEPT[kind].includes(ext)) return `“${file.name}” isn't a ${ACCEPT[kind].join(", ")} file.`
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” is larger than 10 MB.`
  if (file.size === 0) return `“${file.name}” is empty.`
  return null
}

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>
      )}
    </div>
  )
}

function FileChip({ file, onRemove }: { file: PickedFile; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2">
      <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-[10px] font-bold text-teal-700">
        {file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
        <p className="text-xs text-ink-400">{formatBytes(file.size)}</p>
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 text-xs font-medium text-ink-400 hover:text-danger-600">
        Remove
      </button>
    </li>
  )
}

function FilePicker({ kind, multiple, label, onPick }: { kind: ChallengeFileKind; multiple?: boolean; label: string; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={ACCEPT[kind].join(",")}
        multiple={multiple}
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []))
          e.target.value = "" // so picking the same file again still fires onChange
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="w-full rounded-lg border border-dashed border-ink-300 px-3 py-3 text-sm text-ink-500 hover:border-teal-400 hover:text-teal-700"
      >
        {label}
        <span className="mt-0.5 block text-xs text-ink-400">{ACCEPT[kind].join(", ")} · up to 10 MB</span>
      </button>
    </>
  )
}

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"

export default function SubmitChallenge() {
  const { company } = useDemoUser()
  const { createChallenge, universities, contacts } = useStore()
  const myContacts = contacts.filter((c) => c.organizationId === company?.id)
  const navigate = useNavigate()

  const [title, setTitle] = useState("")
  const [descriptionMode, setDescriptionMode] = useState<"write" | "upload">("write")
  const [problemDescription, setProblemDescription] = useState("")
  const [descriptionFile, setDescriptionFile] = useState<PickedFile | null>(null)
  const [requiredSkills, setRequiredSkills] = useState("")
  const [visibility, setVisibility] = useState<ChallengeVisibility>("Public")

  const [datasetFiles, setDatasetFiles] = useState<PickedFile[]>([])
  const [datasetAvailability, setDatasetAvailability] = useState("")
  const [dataSensitivity, setDataSensitivity] = useState<DataSensitivity>("Low")
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const [industry, setIndustry] = useState(company?.industry ?? "")
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate")
  const [learningOutcomes, setLearningOutcomes] = useState("")
  const [deadline, setDeadline] = useState("")
  const [preferredUniversityId, setPreferredUniversityId] = useState<string>("")
  const [contactId, setContactId] = useState(myContacts.find((c) => c.isPrimary)?.id ?? myContacts[0]?.id ?? "")
  const [saving, setSaving] = useState(false)
  const [minDeadline] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
  // Set when WSL's screening found personal data: the company reviews it, then edits or confirms.
  const [screening, setScreening] = useState<{ findings: ScreeningFinding[]; asDraft: boolean } | null>(null)
  // Shown next to the field they belong to — from the checks below, or from the server.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const clearError = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e))
  const formRef = useRef<HTMLFormElement>(null)
  // The submit button is at the bottom of a long form, so bring the first problem into view.
  const showErrors = (next: Record<string, string>) => {
    setErrors(next)
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" }))
    }
  }

  if (!company) return null

  const pick = async (kind: ChallengeFileKind, files: File[]) => {
    setFileError(null)
    const problem = files.map((f) => fileProblem(kind, f)).find(Boolean)
    if (problem) return setFileError(problem)
    if (kind === "dataset" && datasetFiles.length + files.length > MAX_DATASET_FILES) {
      return setFileError(`Attach up to ${MAX_DATASET_FILES} dataset files.`)
    }
    setReading(true)
    try {
      const picked = await Promise.all(files.map(async (f) => ({ name: f.name, size: f.size, data: await readAsBase64(f) })))
      if (kind === "description") setDescriptionFile(picked[0] ?? null)
      else setDatasetFiles((prev) => [...prev, ...picked])
    } catch {
      setFileError("Couldn't read that file — try choosing it again.")
    } finally {
      setReading(false)
    }
  }

  const submit = async (asDraft: boolean, confirmSensitiveData = false) => {
    const skillList = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
    const outcomeList = learningOutcomes.split("\n").map((s) => s.trim()).filter(Boolean)
    const hasDescription = descriptionMode === "write" ? problemDescription.trim().length > 0 : descriptionFile !== null
    // The same rules the server enforces, checked here first so each problem shows next to its field.
    const found: Record<string, string> = {}
    if (!title.trim()) found.title = "Give the challenge a title, e.g. “Forecast Weekly Support Ticket Volume”."
    if (!hasDescription) {
      found.problemDescription =
        descriptionMode === "write" ? "Describe the problem in a few sentences so students know what to solve." : "Attach the challenge description document, or switch to “Write it”."
    }
    if (skillList.length === 0) found.requiredSkills = "Add at least one required skill students will be assessed on, separated by commas (e.g. Python, SQL)."
    if (outcomeList.length === 0) found.learningOutcomes = "Add at least one learning outcome, one per line (e.g. Build and evaluate a forecasting model)."
    showErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const sentDescription = descriptionMode === "upload" ? descriptionFile : null
    const files: NewChallengeInput["files"] = [
      ...(sentDescription ? [{ kind: "description" as const, name: sentDescription.name, data: sentDescription.data }] : []),
      ...datasetFiles.map((f) => ({ kind: "dataset" as const, name: f.name, data: f.data })),
    ]
    const result = await createChallenge(
      {
        title,
        problemDescription,
        requiredSkills: skillList,
        visibility,
        industry,
        difficulty,
        learningOutcomes: outcomeList,
        datasetAvailability,
        dataSensitivity,
        deadline,
        preferredUniversityId: preferredUniversityId || null,
        contactId,
        asDraft,
        files,
        confirmSensitiveData,
      },
      (field, message) => showErrors({ [field]: message }),
    )
    setSaving(false)
    if (!result) return
    if ("findings" in result) setScreening({ findings: result.findings, asDraft })
    else navigate(`/company/challenges/${result.id}`)
  }

  const canSubmit = !saving && !reading
  // Errors on fields inside the collapsed section open it, so they're never hidden.
  const detailsHaveError = Boolean(errors.deadline || errors.preferredUniversityId || errors.contactId)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Submit Challenge"
        title="Describe a real problem — not confidential data"
        subtitle="WSL automatically screens it for private data and routes it to a university. No confidential data required."
      />

      <div className="mb-6 rounded-xl border border-teal-500/30 bg-teal-50 px-5 py-3 text-sm text-ink-800">
        “WSL automatically checks every challenge — and every file you attach — for personal data before it reaches a university, whatever sensitivity level you choose.”
      </div>

      <form ref={formRef} className="space-y-5 rounded-2xl border border-ink-200 bg-surface p-6" onSubmit={(e) => e.preventDefault()}>
        <Field label="Challenge title" error={errors.title}>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              clearError("title")
            }}
            aria-invalid={Boolean(errors.title)}
            placeholder="e.g. Forecast Weekly Support Ticket Volume"
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-ink-500">Problem description</label>
            <div className="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs" role="group" aria-label="How to provide the description">
              {(["write", "upload"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={descriptionMode === m}
                  onClick={() => setDescriptionMode(m)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${descriptionMode === m ? "bg-night text-white" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {m === "write" ? "Write it" : "Upload a file"}
                </button>
              ))}
            </div>
          </div>
          {descriptionMode === "write" ? (
            <>
              <textarea
                className={inputClass}
                rows={3}
                value={problemDescription}
                onChange={(e) => {
                  setProblemDescription(e.target.value)
                  clearError("problemDescription")
                }}
                aria-invalid={Boolean(errors.problemDescription)}
              />
              {!errors.problemDescription && <p className="mt-1 text-xs text-ink-400">A few sentences in general terms — leave out confidential specifics.</p>}
            </>
          ) : (
            <div className="space-y-3">
              {descriptionFile ? (
                <ul>
                  <FileChip file={descriptionFile} onRemove={() => setDescriptionFile(null)} />
                </ul>
              ) : (
                <FilePicker
                  kind="description"
                  label="Choose the challenge description document"
                  onPick={(f) => {
                    clearError("problemDescription")
                    void pick("description", f)
                  }}
                />
              )}
              <Field label="Short summary (optional)" hint="Shown on challenge lists. If you leave it blank, WSL uses the opening of your document.">
                <textarea className={inputClass} rows={2} value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
              </Field>
            </div>
          )}
          {errors.problemDescription && (
            <p role="alert" className="mt-1 text-xs font-medium text-danger-600">{errors.problemDescription}</p>
          )}
        </div>

        <Field label="Required skills" hint="Comma-separated, e.g. Python, Machine Learning, Data Analysis" error={errors.requiredSkills}>
          <input
            className={inputClass}
            value={requiredSkills}
            onChange={(e) => {
              setRequiredSkills(e.target.value)
              clearError("requiredSkills")
            }}
            aria-invalid={Boolean(errors.requiredSkills)}
          />
        </Field>

        <Field label="Learning outcomes" hint="What students will learn — one per line" error={errors.learningOutcomes}>
          <textarea
            className={inputClass}
            rows={2}
            value={learningOutcomes}
            onChange={(e) => {
              setLearningOutcomes(e.target.value)
              clearError("learningOutcomes")
            }}
            aria-invalid={Boolean(errors.learningOutcomes)}
          />
        </Field>

        <div className="space-y-4 rounded-xl border border-ink-100 p-4">
          <div>
            <p className="text-sm font-medium text-ink-800">Data for students <span className="font-normal text-ink-400">(optional)</span></p>
            <p className="mt-0.5 text-xs text-ink-400">
              WSL scans every file for personal data (phone numbers, addresses, ID numbers…) and asks you before sharing anything it finds.
            </p>
          </div>
          {datasetFiles.length > 0 && (
            <ul className="space-y-2">
              {datasetFiles.map((f, i) => (
                <FileChip key={`${f.name}-${i}`} file={f} onRemove={() => setDatasetFiles((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </ul>
          )}
          {datasetFiles.length < MAX_DATASET_FILES && (
            <FilePicker kind="dataset" multiple label={datasetFiles.length ? "Add another dataset file" : "Attach dataset files"} onPick={(f) => pick("dataset", f)} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dataset availability">
              <input className={inputClass} value={datasetAvailability} onChange={(e) => setDatasetAvailability(e.target.value)} placeholder="e.g. Sample CSV, 12 months" />
            </Field>
            <Field label="Data sensitivity level">
              <select className={inputClass} value={dataSensitivity} onChange={(e) => setDataSensitivity(e.target.value as DataSensitivity)}>
                {SENSITIVITIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {(fileError || reading) && (
          <p role={fileError ? "alert" : "status"} className={`text-sm ${fileError ? "text-danger-600" : "text-ink-400"}`}>
            {fileError ?? "Reading file…"}
          </p>
        )}

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

        <details className="group rounded-xl border border-ink-100" open={detailsHaveError || undefined}>
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

            <Field label="Deadline" hint="Defaults to 30 days from today." error={errors.deadline}>
              <input
                type="date"
                min={minDeadline}
                className={inputClass}
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value)
                  clearError("deadline")
                }}
              />
            </Field>

            <Field label="Preferred university" hint="Leave unset to let WSL route it." error={errors.preferredUniversityId}>
              <select
                className={inputClass}
                value={preferredUniversityId}
                onChange={(e) => {
                  setPreferredUniversityId(e.target.value)
                  clearError("preferredUniversityId")
                }}
              >
                <option value="">No preference</option>
                {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

            <Field label="Contact person" hint="Reviews submissions and signs your company's feedback." error={errors.contactId}>
              <select
                className={inputClass}
                value={contactId}
                onChange={(e) => {
                  setContactId(e.target.value)
                  clearError("contactId")
                }}
              >
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
            {saving ? "Screening & submitting…" : "Submit Challenge"}
          </button>
          <button onClick={() => submit(true)} disabled={!canSubmit} className="text-sm font-medium text-ink-400 hover:text-ink-700 disabled:opacity-40">
            Save as draft instead
          </button>
        </div>
      </form>

      {screening && (
        <SensitiveDataDialog
          findings={screening.findings}
          declared={dataSensitivity}
          saving={saving}
          onCancel={() => setScreening(null)}
          onConfirm={async () => {
            await submit(screening.asDraft, true)
            setScreening(null)
          }}
        />
      )}
    </div>
  )
}

function SensitiveDataDialog({
  findings,
  declared,
  saving,
  onCancel,
  onConfirm,
}: {
  findings: ScreeningFinding[]
  declared: DataSensitivity
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const backButton = useRef<HTMLButtonElement>(null)
  const cancel = useRef(onCancel)
  useEffect(() => {
    cancel.current = onCancel
  })
  useEffect(() => {
    backButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel.current()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const lowDeclared = declared === "None (Public Dataset)" || declared === "Low"
  const onlyUnreadable = findings.every((f) => f.kind === "unreadable")

  // Portalled to <body> so it sits above the app shell's header and sidebar, not inside the page's stacking context.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-night/60 p-4 sm:items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sensitive-title"
        aria-describedby="sensitive-body"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-200 bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-bold text-amber-600" aria-hidden>
            !
          </span>
          <div>
            <h2 id="sensitive-title" className="font-semibold text-ink-900">
              {onlyUnreadable ? "WSL couldn't fully check your files" : "This challenge may contain personal data"}
            </h2>
            <p id="sensitive-body" className="mt-1 text-sm text-ink-600">
              {lowDeclared && !onlyUnreadable && (
                <>
                  You marked the data sensitivity as <strong>{declared}</strong>, but WSL's automatic screen found the following.{" "}
                </>
              )}
              If you continue, university staff and assigned students will be able to see it.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {findings.map((f) => (
            <li key={f.kind} className="rounded-lg border border-amber-400/50 bg-amber-100/60 px-3 py-2">
              <p className="text-sm font-semibold text-ink-900">
                {f.label}
                {f.kind !== "unreadable" && <span className="font-normal text-ink-500"> · {f.count} found</span>}
              </p>
              <p className="mt-0.5 text-xs text-ink-600">{f.kind === "unreadable" ? f.sources.join(" · ") : `In: ${f.sources.join(", ")}`}</p>
              {f.examples.length > 0 && (
                <p className="mt-1 font-mono text-xs text-ink-500">e.g. {f.examples.join("   ")}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-ink-400">
          Tip: remove or anonymize the data (e.g. replace phone numbers with “07X XXX XXXX”) and attach the cleaned file instead.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={backButton}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
          >
            Go back and edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Submitting…" : "It's OK to share — continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
