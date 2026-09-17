import { Link } from "react-router-dom"
import { Wordmark } from "../ui/Wordmark"

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              WSL is the evidence infrastructure connecting universities, students, and organizations —
              turning real-world learning into verified, demonstrated skill.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Platform</div>
              <ul className="space-y-1.5 text-sm text-ink-600">
                <li><Link to="/how-it-works" className="hover:text-teal-600">How It Works</Link></li>
                <li><Link to="/about" className="hover:text-teal-600">About WSL</Link></li>
                <li><Link to="/login" className="hover:text-teal-600">Demo Access</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Audiences</div>
              <ul className="space-y-1.5 text-sm text-ink-600">
                <li><Link to="/for-students" className="hover:text-teal-600">For Students</Link></li>
                <li><Link to="/for-universities" className="hover:text-teal-600">For Universities</Link></li>
                <li><Link to="/for-companies" className="hover:text-teal-600">For Companies</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Jordan 2076 Hackathon — Amman track: Innovation in Education &amp; Learning Systems.</span>
          <span>All names, organizations, and data on this site are illustrative demo content.</span>
        </div>
      </div>
    </footer>
  )
}
