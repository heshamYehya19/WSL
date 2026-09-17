import { Link } from "react-router-dom"

export function Wordmark({ to = "/", dark = false }: { to?: string; dark?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2 shrink-0">
      <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="#0B1D26" />
        <circle cx="9" cy="10" r="3.2" fill="#2DD4BF" />
        <circle cx="23" cy="22" r="3.2" fill="#2DD4BF" />
        <path d="M9 10 L23 22" stroke="#5EEAD4" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="23" cy="10" r="2" fill="#F2C879" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-ink-950"}`}>WSL</span>
      <span className={`font-arabic text-lg font-bold ${dark ? "text-teal-300" : "text-teal-600"}`}>وصل</span>
    </Link>
  )
}
