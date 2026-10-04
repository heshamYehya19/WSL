import { describe, expect, it } from "vitest"
import { parseLiveUrl } from "../../src/lib/liveUrl.ts"

// The footer only shows a QR code once a real live URL is configured.
describe("live URL for the footer QR code", () => {
  it("is absent until a URL is set", () => {
    expect(parseLiveUrl(undefined)).toBeNull()
    expect(parseLiveUrl("   ")).toBeNull()
  })

  it("accepts an http(s) URL", () => {
    expect(parseLiveUrl("https://wsl-demo.replit.app")).toBe("https://wsl-demo.replit.app/")
    expect(parseLiveUrl("  http://localhost:3000/  ")).toBe("http://localhost:3000/")
  })

  it("ignores values that aren't web addresses", () => {
    expect(parseLiveUrl("wsl-demo.replit.app")).toBeNull()
    expect(parseLiveUrl("javascript:alert(1)")).toBeNull()
  })
})
