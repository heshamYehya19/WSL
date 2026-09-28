import { Outlet } from "react-router-dom"
import { PublicNav } from "./PublicNav"
import { Footer } from "./Footer"
import { AmbientConstellation } from "../ui/AmbientConstellation"

export function PublicLayout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-ink-50">
      <AmbientConstellation />
      <PublicNav />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
