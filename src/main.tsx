import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { StoreProvider } from "./state/store"
import { SessionProvider } from "./state/session"
import { ThemeProvider } from "./state/theme"
import { TourProvider } from "./state/tour"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SessionProvider>
          <StoreProvider>
            <TourProvider>
              <App />
            </TourProvider>
          </StoreProvider>
        </SessionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
