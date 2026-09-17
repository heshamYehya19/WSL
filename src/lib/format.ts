export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days > 1 && days < 30) return `${days} days ago`
  if (days < 0 && days > -30) return `in ${Math.abs(days)} days`
  return formatDate(iso)
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
