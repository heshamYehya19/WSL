import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { StoreProvider } from "./state/store"
import { SessionProvider } from "./state/session"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
