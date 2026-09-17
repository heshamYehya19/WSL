import { Link } from "react-router-dom"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <p className="text-xs font-semibold tracking-wide text-teal-600 uppercase">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink-950">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">This part of WSL doesn't exist yet.</p>
      <Link to="/" className="mt-6 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">
        Back to Home
      </Link>
    </div>
  )
}
