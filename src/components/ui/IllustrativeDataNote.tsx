/** Every company in the demo is a real organization; nothing about its challenges is. */
export function IllustrativeDataNote({ company }: { company?: string }) {
  const name = company ?? "This company"
  return (
    <p className="mb-6 rounded-lg border border-amber-400/50 bg-amber-100 px-3 py-2 text-xs text-amber-600">
      <span className="font-semibold">Illustrative data.</span> {name} is a real company, but this challenge and everything
      submitted to it are fictional demo content — not created or endorsed by {company ?? "them"}.
    </p>
  )
}
