import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { githubDeps } from "../github.ts"
import { docx, notebook, png, pptx, upload } from "./fixtures.ts"

const PROJECT = "prj-jes-energywise"
const AHMAD = "student:stu-ju-ahmad"
const SARA = "student:stu-ju-sara"
const realGithubFetch = githubDeps.fetch

interface Evidence {
  id: string
  projectId: string
  studentId: string
  type: string
  title: string
  description: string
  link: string
  content?: string
  analyzedFiles?: string[]
  file?: { name: string; size: number }
}

const server = await startServer()
afterAll(() => server.close())
beforeEach(() => resetDatabase())
afterEach(() => {
  githubDeps.fetch = realGithubFetch
})

const add = (body: Record<string, unknown>, actor = AHMAD) => server.call("POST", `/projects/${PROJECT}/evidence`, actor, body)
const mine = async (title: string, actor = AHMAD) =>
  ((await server.call("GET", "/snapshot", actor)).json.snapshot as unknown as { evidence: Evidence[] }).evidence.find((e) => e.title === title)!

// Energy-meter work, so only the rules under test can reject it.
const ML_CODE = `from sklearn.ensemble import IsolationForest
detector = IsolationForest(n_estimators=300, contamination=0.02, random_state=7)
flagged = detector.fit_predict(energy_features) == -1
print("Flagged", flagged.sum(), "abnormal hourly meter readings across the campus buildings")`

describe("every piece of evidence belongs to one student", () => {
  it("records the author, and keeps each teammate's evidence separate", async () => {
    await add({ type: "Contribution Statement", title: "Ahmad's statement", content: "I designed the database and wrote the SQL reports for the energy data." })
    await add({ type: "Contribution Statement", title: "Sara's statement", content: "I trained and evaluated the anomaly detection model on the meter readings." }, SARA)
    expect((await mine("Ahmad's statement")).studentId).toBe("stu-ju-ahmad")
    expect((await mine("Sara's statement")).studentId).toBe("stu-ju-sara")
  })
})

describe("GitHub", () => {
  it("still needs a readable repository, or an excerpt", async () => {
    githubDeps.fetch = async () => new Response("Not Found", { status: 404 })
    const bare = await add({ type: "GitHub Repository", title: "Repo", link: "https://github.com/ahmad/energywise-private" })
    expect(bare.status).toBe(400)
    expect(bare.json.field).toBe("content")
    const withExcerpt = await add({ type: "GitHub Repository", title: "Repo", link: "https://github.com/ahmad/energywise-private", content: ML_CODE })
    expect(withExcerpt.status).toBe(200)
  })
})

describe("Notebook", () => {
  it("reads the code and notes out of an attached .ipynb file", async () => {
    const file = notebook([
      { type: "markdown", source: "Anomaly detection on the campus meter readings" },
      { type: "code", source: ML_CODE },
    ])
    const res = await add({ type: "Notebook", title: "Anomaly notebook", file: upload("anomaly.ipynb", file) })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()
    const saved = await mine("Anomaly notebook")
    expect(saved.file?.name).toBe("anomaly.ipynb")
    expect(saved.analyzedFiles).toEqual(["anomaly.ipynb"])
  })

  it("rejects a file that isn't a notebook", async () => {
    const res = await add({ type: "Notebook", title: "Not a notebook", file: upload("notes.txt", Buffer.from(ML_CODE)) })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("file")
    expect(String(res.json.error)).toMatch(/\.ipynb/)
  })

  it("accepts a link instead, even if WSL can't open it, and says so", async () => {
    githubDeps.fetch = async () => new Response("Not Found", { status: 404 })
    const res = await add({ type: "Notebook", title: "Linked notebook", link: "https://github.com/ahmad/energywise/blob/main/model.ipynb" })
    expect(res.status).toBe(200)
    expect(String((res.json.result as { notice: string }).notice)).toMatch(/saved for your reviewer/)
  })

  it("asks for a link or a file when given neither", async () => {
    const res = await add({ type: "Notebook", title: "Empty" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("link")
  })
})

describe("Report and Presentation", () => {
  it("reads an attached Word report", async () => {
    const res = await add({
      type: "Project Report",
      title: "Final report",
      file: upload("report.docx", docx(["The campus energy meter readings were cleaned, loaded into a database and queried by building."])),
    })
    expect(res.status).toBe(200)
    expect((await mine("Final report")).analyzedFiles).toEqual(["report.docx"])
  })

  it("reads the text on the slides of an attached PowerPoint", async () => {
    const res = await add({
      type: "Presentation",
      title: "Team presentation",
      file: upload(
        "energywise.pptx",
        pptx([
          ["Slide 2: a bar chart ranks the 24 buildings by total kWh, so the engineering faculty stands out immediately"],
          ["Slide 3: the heat map of hourly consumption uses a dropdown to filter by faculty and a tooltip with the exact reading"],
          ["Slide 4: flagged anomalies are drawn as red markers on the timeline; facilities staff asked for fewer than five a week"],
        ]),
      ),
    })
    expect(res.status).toBe(200)
    const saved = await mine("Team presentation")
    expect(saved.file?.name).toBe("energywise.pptx")
    expect(saved.analyzedFiles).toEqual(["energywise.pptx"])
  })

  it("only takes the file types that make sense for each", async () => {
    const wrong = await add({ type: "Presentation", title: "Slides", file: upload("slides.docx", docx(["Energy meter readings by building."])) })
    expect(wrong.status).toBe(400)
    expect(String(wrong.json.error)).toMatch(/\.pdf, \.pptx/)
  })

  it("keeps a link for the reviewer when WSL can't read it, and asks for an excerpt or file to analyze it", async () => {
    const res = await add({ type: "Presentation", title: "Linked slides", link: "https://docs.google.com/presentation/d/abc123/edit" })
    expect(res.status).toBe(200)
    expect(String((res.json.result as { notice: string }).notice)).toMatch(/presentation link is saved for your reviewer/)
  })
})

describe("Screenshot", () => {
  it("keeps the image for the reviewer, with an optional caption, and never analyzes it", async () => {
    const res = await add({ type: "Screenshot", title: "Dashboard screenshot", content: "The anomaly heat map for the engineering faculty.", file: upload("dashboard.png", png()) })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()
    const saved = await mine("Dashboard screenshot")
    expect(saved.file?.name).toBe("dashboard.png")
    expect(saved.description).toBe("The anomaly heat map for the engineering faculty.")
    expect(saved.content).toBeUndefined()
    expect(saved.analyzedFiles).toBeUndefined()
  })

  it("needs the image itself, in a supported format", async () => {
    const none = await add({ type: "Screenshot", title: "Missing" })
    expect(none.status).toBe(400)
    expect(none.json.field).toBe("file")
    const gif = await add({ type: "Screenshot", title: "Gif", file: upload("anim.gif", png()) })
    expect(gif.status).toBe(400)
    expect(String(gif.json.error)).toMatch(/\.png, \.jpg, \.jpeg, \.webp/)
    const fake = await add({ type: "Screenshot", title: "Fake", file: upload("fake.png", Buffer.from("this is not an image at all")) })
    expect(fake.status).toBe(400)
    expect(String(fake.json.error)).toMatch(/isn't a valid PNG/)
  })
})

describe("Demo / Video", () => {
  it("is a link for the reviewer, with an optional caption", async () => {
    const res = await add({ type: "Video Walkthrough", title: "Demo video", link: "https://youtube.com/watch?v=energywise", content: "A three-minute walkthrough of the dashboard." })
    expect(res.status).toBe(200)
    const saved = await mine("Demo video")
    expect(saved.link).toBe("https://youtube.com/watch?v=energywise")
    expect(saved.description).toBe("A three-minute walkthrough of the dashboard.")
    expect(saved.analyzedFiles).toBeUndefined()
  })

  it("needs a link and isn't a file", async () => {
    const none = await add({ type: "Video Walkthrough", title: "No link" })
    expect(none.status).toBe(400)
    expect(none.json.field).toBe("link")
    const file = await add({ type: "Video Walkthrough", title: "File", link: "https://youtube.com/watch?v=x", file: upload("demo.png", png()) })
    expect(file.status).toBe(400)
    expect(file.json.field).toBe("file")
  })
})

describe("Contribution Statement", () => {
  it("is text only, long enough to say something", async () => {
    const short = await add({ type: "Contribution Statement", title: "Short", content: "I helped." })
    expect(short.status).toBe(400)
    expect(short.json.field).toBe("content")
    const withFile = await add({ type: "Contribution Statement", title: "File", content: "I wrote the whole database layer for the project.", file: upload("a.png", png()) })
    expect(withFile.status).toBe(400)
    expect(withFile.json.field).toBe("file")
  })

  it("is kept for the reviewer and never sent to the analysis", async () => {
    // Ahmad's seeded evidence is already analyzed, so adding things the analysis ignores changes nothing…
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, AHMAD)).json.result).toMatchObject({ unchanged: true })
    await add({ type: "Contribution Statement", title: "Another statement", content: "I also reviewed the team's SQL and checked every report against the raw readings." })
    await add({ type: "Video Walkthrough", title: "Another video", link: "https://youtube.com/watch?v=other" })
    await add({ type: "Screenshot", title: "Another screenshot", file: upload("shot.png", png()) })
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, AHMAD)).json.result).toMatchObject({ unchanged: true })
    // …while a piece of work does.
    await add({ type: "Project Report", title: "New report", link: "https://docs.example.com/new", content: "Hourly campus energy readings were grouped by building and compared across weeks using SQL." })
    expect((await server.call("POST", `/projects/${PROJECT}/ai-review`, AHMAD)).json.result).toMatchObject({ unchanged: false })
  })
})
