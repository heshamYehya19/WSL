import { Outlet } from "react-router-dom"
import { PublicNav } from "./PublicNav"
import { Footer } from "./Footer"

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
