import { useRef, useState } from "react"
import { useStore } from "../../state/store"
import { EVIDENCE_INPUT, FILE_EXTENSIONS, SUBMITTABLE_EVIDENCE_TYPES, evidenceTypeLabel } from "../../lib/evidenceTypes"
import { MAX_UPLOAD_BYTES, readAsBase64 } from "../../lib/files"
import { formatBytes } from "../../lib/format"
import type { EvidenceType } from "../../types"

interface PickedFile {
  name: string
  size: number
  /** Base64 contents. */
  data: string
}

const EMPTY = { type: "GitHub Repository" as EvidenceType, title: "", link: "", text: "" }

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
      {message}
    </p>
  )
}

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-teal-400"

/**
 * Adds one piece of evidence. What the form asks for depends on the type (see EVIDENCE_INPUT, shared
 * with the server): a repository is a link, documents and notebooks are a link or a file, a screenshot
 * is an image, a video is a link, and a contribution statement is the student's own words.
 */
export function EvidenceForm({ projectId }: { projectId: string }) {
  const { addEvidence } = useStore()
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // A rejected submission's message, shown next to the field it's about (keyed as the server keys it).
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInput = useRef<HTMLInputElement>(null)

  const rule = EVIDENCE_INPUT[form.type]
  const label = evidenceTypeLabel(form.type)
  const extensions = rule.file ? FILE_EXTENSIONS[rule.file] : []

  const clear = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e))
  const edit = (key: "title" | "link" | "text", value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    clear(key === "text" ? "content" : key)
  }

  const pickFile = async (picked: File | undefined) => {
    if (!picked) return
    const ext = picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase()
    if (!extensions.includes(ext)) return setErrors({ file: `“${picked.name}” isn't a ${extensions.join(", ")} file.` })
    if (picked.size === 0) return setErrors({ file: `“${picked.name}” is empty.` })
    if (picked.size > MAX_UPLOAD_BYTES) return setErrors({ file: `“${picked.name}” is larger than 10 MB.` })
    try {
      setFile({ name: picked.name, size: picked.size, data: await readAsBase64(picked) })
      setErrors({})
    } catch {
      setErrors({ file: `“${picked.name}” couldn't be read. Choose it again.` })
    }
  }

  const hasLink = form.link.trim().length > 0
  const ready =
    form.title.trim().length > 0 &&
    (rule.text === "statement"
      ? form.text.trim().length > 0
      : rule.link === "required"
        ? hasLink
        : rule.link === "either"
          ? hasLink || file !== null
          : rule.file === "image"
            ? file !== null
            : true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setSubmitting(true)
    setErrors({})
    const ok = await addEvidence(
      projectId,
      {
        type: form.type,
        title: form.title.trim(),
        link: rule.link === "none" ? "" : form.link.trim(),
        content: form.text.trim(),
        ...(rule.file && file ? { file: { name: file.name, data: file.data } } : {}),
      },
      (key, message) => setErrors({ [key]: message }),
    )
    setSubmitting(false)
    if (ok) {
      setForm(EMPTY)
      setFile(null)
    }
  }

  const showExcerpt = rule.text === "excerpt" && (form.type === "GitHub Repository" || (hasLink && file === null))

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="evidence-title" className="mb-1 block text-xs font-medium text-ink-500">Title</label>
        <input
          id="evidence-title"
          value={form.title}
          onChange={(e) => edit("title", e.target.value)}
          aria-invalid={Boolean(errors.title)}
          placeholder={rule.text === "statement" ? "e.g. What I contributed" : "e.g. Database schema and SQL reports"}
          className={inputClass}
        />
        <FieldError message={errors.title} />
      </div>

      <div>
        <label htmlFor="evidence-type" className="mb-1 block text-xs font-medium text-ink-500">Evidence type</label>
        <select
          id="evidence-type"
          value={form.type}
          onChange={(e) => {
            setForm((f) => ({ ...f, type: e.target.value as EvidenceType, link: "", text: "" }))
            setFile(null)
            setErrors({})
          }}
          className={inputClass}
        >
          {SUBMITTABLE_EVIDENCE_TYPES.map((t) => (
            <option key={t} value={t}>{evidenceTypeLabel(t)}</option>
          ))}
        </select>
        <FieldError message={errors.type} />
        <p className="mt-1 text-[11px] text-ink-400">{rule.hint}</p>
      </div>

      {rule.text === "statement" && (
        <div>
          <label htmlFor="evidence-text" className="mb-1 block text-xs font-medium text-ink-500">Your contribution</label>
          <textarea
            id="evidence-text"
            value={form.text}
            onChange={(e) => edit("text", e.target.value)}
            aria-invalid={Boolean(errors.content)}
            rows={5}
            placeholder={rule.placeholder}
            className={inputClass}
          />
          <FieldError message={errors.content} />
        </div>
      )}

      {rule.link !== "none" && (
        <div className="space-y-2">
          {rule.link === "either" && <p className="text-[11px] font-medium text-ink-500">Add a link or attach a file — either one is enough.</p>}
          <div>
            <label htmlFor="evidence-link" className="mb-1 block text-xs font-medium text-ink-500">
              {form.type === "GitHub Repository" ? "Repository link — required" : rule.link === "required" ? `${label} link — required` : `${label} link`}
            </label>
            <input
              id="evidence-link"
              value={form.link}
              onChange={(e) => edit("link", e.target.value)}
              aria-invalid={Boolean(errors.link)}
              placeholder={rule.placeholder}
              className={inputClass}
            />
            <FieldError message={errors.link} />
          </div>
        </div>
      )}

      {rule.file && (
        <div>
          {rule.link === "either" && (
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
              <span className="h-px flex-1 bg-ink-100" />
              or attach a file
              <span className="h-px flex-1 bg-ink-100" />
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept={extensions.join(",")}
            aria-label={`Attach a ${label.toLowerCase()} file`}
            onChange={(e) => {
              void pickFile(e.target.files?.[0])
              e.target.value = "" // so picking the same file again still fires onChange
            }}
          />
          {file ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-teal-400/60 bg-teal-50 px-3 py-2">
              <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-[10px] font-bold text-teal-700">
                {file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase().slice(0, 5)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
                <p className="text-xs text-ink-400">{formatBytes(file.size)}</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-semibold text-ink-500 hover:text-danger-600">
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full rounded-lg border border-dashed border-ink-300 px-3 py-3 text-sm text-ink-500 hover:border-teal-400 hover:text-teal-700"
            >
              Choose a file from your computer
              <span className="mt-0.5 block text-xs text-ink-400">{extensions.join(", ")} · up to 10 MB</span>
            </button>
          )}
          <FieldError message={errors.file} />
        </div>
      )}

      {rule.text === "caption" && (
        <div>
          <label htmlFor="evidence-caption" className="mb-1 block text-xs font-medium text-ink-500">Caption (optional)</label>
          <input
            id="evidence-caption"
            value={form.text}
            onChange={(e) => edit("text", e.target.value)}
            aria-invalid={Boolean(errors.content)}
            placeholder="What does it show?"
            maxLength={300}
            className={inputClass}
          />
          <FieldError message={errors.content} />
        </div>
      )}

      {showExcerpt && (
        <div>
          <label htmlFor="evidence-excerpt" className="mb-1 block text-xs font-medium text-ink-500">Representative excerpt (optional)</label>
          <textarea
            id="evidence-excerpt"
            value={form.text}
            onChange={(e) => edit("text", e.target.value)}
            aria-invalid={Boolean(errors.content)}
            rows={4}
            placeholder="Paste a key section, snippet or summary if WSL can't open the link, so it can still be analyzed."
            className="w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-xs outline-none focus:border-teal-400"
          />
          <FieldError message={errors.content} />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !ready}
        className="w-full rounded-lg bg-night px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Add Evidence"}
      </button>
    </form>
  )
}
