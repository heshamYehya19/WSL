import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { StoreProvider } from "./state/store"
import { DemoUserProvider } from "./state/demoUser"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <DemoUserProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </DemoUserProvider>
    </BrowserRouter>
  </StrictMode>,
)
