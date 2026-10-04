// Renders the Mermaid diagram in docs/architecture.md to public/architecture.svg and
// public/architecture.png, so it can be dropped onto a slide and always matches the doc.
// Run with `npm run docs:architecture`. Uses the playwright devDependency and loads
// Mermaid from its CDN, so it needs a network connection and a Chromium-based browser.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const markdown = readFileSync(join(root, "docs", "architecture.md"), "utf8").replace(/\r\n/g, "\n")
const source = /```mermaid\n([\s\S]*?)```/.exec(markdown)?.[1]
if (!source) throw new Error("No ```mermaid block found in docs/architecture.md")

async function launch() {
  for (const channel of [undefined, "msedge", "chrome"]) {
    try {
      return await chromium.launch(channel ? { channel } : {})
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No browser available — run `npx playwright install chromium` and try again.")
}

interface Mermaid {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

const browser = await launch()
const page = await browser.newPage({ deviceScaleFactor: 2 })
await page.setContent("<!doctype html><html><body></body></html>")
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" })

const rendered = await page.evaluate(async (text) => {
  const mermaid = (globalThis as unknown as { mermaid: Mermaid }).mermaid
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    // Plain SVG text instead of embedded HTML, so slide tools render every label.
    flowchart: { htmlLabels: false, curve: "basis", padding: 14 },
    themeVariables: {
      fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif",
      fontSize: "15px",
      primaryColor: "#ffffff",
      primaryBorderColor: "#14b8a6",
      primaryTextColor: "#0b1f2a",
      lineColor: "#5b7183",
      clusterBkg: "#f0fdfa",
      clusterBorder: "#5eead4",
      edgeLabelBackground: "#ffffff",
    },
  })
  return (await mermaid.render("wsl-architecture", text)).svg
}, source)

// A fixed size and a white background, so the file stands alone outside a web page
// (slides, image viewers, GitHub's dark theme) instead of collapsing or going transparent.
const [, , width, height] = (/viewBox="([\d.\s-]+)"/.exec(rendered)?.[1] ?? "0 0 1200 600").split(/\s+/).map(Number)
const svg = rendered
  .replace(/width="100%"/, `width="${Math.ceil(width)}" height="${Math.ceil(height)}"`)
  .replace(/style="max-width:[^"]*"/, "")
  .replace(/(<svg[^>]*>)/, `$1<rect x="-10000" y="-10000" width="20000" height="20000" fill="#ffffff"/>`)
writeFileSync(join(root, "public", "architecture.svg"), `${svg}\n`)

await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><div id="frame" style="display:inline-block;padding:24px">${svg}</div></body></html>`)
await page.locator("#frame").screenshot({ path: join(root, "public", "architecture.png") })
await browser.close()
console.log(`Wrote public/architecture.svg (${Math.ceil(width)}×${Math.ceil(height)}) and public/architecture.png`)
