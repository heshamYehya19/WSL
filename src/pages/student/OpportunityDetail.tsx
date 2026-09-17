import { Link, useParams } from "react-router-dom"
import { useDemoUser } from "../../state/demoUser"
import { useStore } from "../../state/store"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkillChip } from "../../components/ui/SkillChip"
import { getOrg, verifiedSignals } from "../../lib/selectors"
import { opportunities } from "../../data/seed"

export default function OpportunityDetail() {
  const { id } = useParams()
  const { student } = useDemoUser()
  const { skillSignals } = useStore()
  const opportunity = opportunities.find((o) => o.id === id)

  if (!opportunity || !student) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-semibold text-ink-800">Opportunity not found</h2>
        <Link to="/student/opportunities" className="mt-3 inline-block text-sm text-teal-600 hover:underline">← Back to Opportunities</Link>
      </div>
    )
  }

  const org = getOrg(opportunity.organizationId)
  const verified = verifiedSignals(skillSignals, student.id)
  const verifiedNames = new Set(verified.map((s) => s.skill))
  const matched = opportunity.requiredSkills.filter((s) => verifiedNames.has(s))

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/student/opportunities" className="text-sm text-ink-400 hover:text-teal-600">← Back to Opportunities</Link>
      <PageHeader eyebrow={`${org?.name} · ${opportunity.type}`} title={opportunity.title} subtitle={opportunity.location} />

      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <p className="text-sm leading-relaxed text-ink-700">{opportunity.description}</p>

        <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-teal-600 uppercase">Requested Skills</h3>
        <div className="flex flex-wrap gap-1.5">
          {opportunity.requiredSkills.map((s) => (
            <span key={s} className={`rounded-md px-2.5 py-1 text-xs font-medium ${verifiedNames.has(s) ? "bg-teal-600 text-white" : "bg-ink-50 text-ink-500"}`}>
              {verifiedNames.has(s) ? "✓ " : ""}{s}
            </span>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-3 text-sm text-ink-800">
          {matched.length > 0
            ? `Your verified skills overlap with ${matched.length} of ${opportunity.requiredSkills.length} skills requested for this opportunity.`
            : "None of your currently verified skills overlap with this opportunity yet."}
        </div>

        {matched.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Supporting Evidence</h3>
            <div className="flex flex-wrap gap-2">
              {matched.map((skillName) => {
                const sig = verified.find((s) => s.skill === skillName)
                return (
                  <Link key={skillName} to={`/student/projects/${sig?.projectId}`} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm hover:border-teal-400">
                    <SkillChip skill={skillName} verified size="sm" />
                    <span className="text-xs text-teal-600">View Evidence →</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
