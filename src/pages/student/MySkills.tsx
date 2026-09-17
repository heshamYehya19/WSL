import { Link } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { LevelBadge } from "../../components/ui/LevelBadge"
import { ConfidenceMeter } from "../../components/ui/ConfidenceMeter"
import { StatusBadge } from "../../components/ui/StatusBadge"
import { EmptyState } from "../../components/ui/EmptyState"
import { studentSignals } from "../../lib/selectors"
import { formatDate } from "../../lib/format"

export default function MySkills() {
  const { student } = useDemoUser()
  const { skillSignals, projects } = useStore()
  if (!student) return null

  const mine = studentSignals(skillSignals, student.id).sort((a) => (a.status === "Verified" ? -1 : 1))

  return (
    <div>
      <PageHeader
        eyebrow="My Skills"
        title="Every skill signal, verified or pending"
        subtitle="Skill level and evidence confidence are tracked separately — confidence reflects how strongly your evidence supports the signal, not how good you are."
      />

      {mine.length === 0 ? (
        <EmptyState title="No skill signals yet" description="Submit evidence on an active project and run AI analysis to see your first signals here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mine.map((s) => {
            const project = projects.find((p) => p.id === s.projectId)
            return (
              <div key={s.id} className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900">{s.skill}</span>
                    <LevelBadge level={s.level} />
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  from <Link to={`/student/projects/${s.projectId}`} className="text-teal-600 hover:underline">{project?.title}</Link>
                </p>
                <div className="mt-3"><ConfidenceMeter value={s.confidence} /></div>
                {s.status === "Verified" ? (
                  <p className="mt-3 text-xs text-verified-600">✓ Verified by {s.verifiedBy} on {formatDate(s.verifiedAt)}</p>
                ) : (
                  <p className="mt-3 text-xs text-ink-400">Awaiting university mentor review.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
