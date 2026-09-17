import { useState } from "react"
import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { EmptyState } from "../../components/ui/EmptyState"
import { getStudent, isUniversityStudent } from "../../lib/selectors"
import { formatRelative } from "../../lib/format"
import type { SkillSignal } from "../../types"

const TABS: { label: string; statuses: SkillSignal["status"][] }[] = [
  { label: "Pending", statuses: ["Pending Verification"] },
  { label: "Verified", statuses: ["Verified"] },
  { label: "Needs More Evidence", statuses: ["More Evidence Requested"] },
  { label: "Rejected", statuses: ["Rejected"] },
]

export default function VerificationQueue() {
  const { university } = useDemoUser()
  const { skillSignals, projects } = useStore()
  const [tab, setTab] = useState(0)
  if (!university) return null

  const uniSignals = skillSignals.filter((s) => isUniversityStudent(s.studentId, university.id))
  const list = uniSignals.filter((s) => TABS[tab].statuses.includes(s.status))

  return (
    <div>
      <PageHeader
        eyebrow="Verification"
        title="Skill verification queue"
        subtitle="AI finds the evidence signal. A human mentor verifies it before it becomes part of a student's record."
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium ${tab === i ? "border-b-2 border-teal-500 text-ink-950" : "text-ink-400 hover:text-ink-700"}`}
          >
            {t.label} <span className="text-ink-300">({uniSignals.filter((s) => t.statuses.includes(s.status)).length})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing here" description="No skill signals in this state right now." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((s) => {
            const student = getStudent(s.studentId)
            const project = projects.find((p) => p.id === s.projectId)
            return (
              <Link key={s.id} to={`/university/verification/${s.id}`} className="rounded-2xl border border-ink-200 bg-white p-5 hover:border-teal-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900">{s.skill}</span>
                    <LevelBadge level={s.level} />
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-xs text-ink-400">{student?.name} · {project?.title}</p>
                <div className="mt-3"><ConfidenceMeter value={s.confidence} /></div>
                <p className="mt-2 text-xs text-ink-400">Analyzed {formatRelative(s.analyzedAt)}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
