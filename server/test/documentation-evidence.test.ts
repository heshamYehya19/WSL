import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { deflateRawSync } from "node:zlib"
import { resetDatabase, startServer } from "./helpers.ts"
import { docsDeps, readGoogleDoc } from "../gdocs.ts"
import { llmDeps } from "../ml/llm-grader.ts"

const PROJECT = "prj-iris-anomaly-yazan"
const YAZAN = "student:stu-aau-yazan"
const stubbedDocsFetch = docsDeps.fetch // the offline stub from helpers.ts, never the network

// On-topic write-up for the IRIS anomaly-detection challenge, so only the behavior under test can fail.
const REPORT = `Evaluation of the network traffic anomaly detector. We trained an Isolation Forest on NetFlow features per source host,
scaled the flow features, and set the contamination to 2%. The detector caught 37 of the 41 labeled incidents (90% recall) at 61% precision,
which is about 55 alerts a day for a two-analyst shift. The four missed incidents were slow port scans, so a rolling count of unique
destination ports per source would catch them.`

const server = await startServer()
afterAll(() => server.close())

const addEvidence = (body: Record<string, unknown>, actor = YAZAN) => server.call("POST", `/projects/${PROJECT}/evidence`, actor, body)
const upload = (name: string, data: Buffer) => ({ name, data: data.toString("base64") })

interface Snap {
  evidence: { id: string; projectId: string; type: string; title: string; link: string; analyzedFiles?: string[]; file?: { name: string; size: number } }[]
}
async function myEvidence() {
  const snap = (await server.call("GET", "/snapshot", YAZAN)).json.snapshot as Snap
  return snap.evidence.filter((e) => e.projectId === PROJECT)
}

/** A minimal .docx: a zip holding word/document.xml, built with only node:zlib. */
function docx(paragraphs: string[]): Buffer {
  const xml = `<?xml version="1.0"?><w:document><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`
  const name = Buffer.from("word/document.xml")
  const body = deflateRawSync(Buffer.from(xml))
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(body.length, 18)
  local.writeUInt32LE(xml.length, 22)
  local.writeUInt16LE(name.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(body.length, 20)
  central.writeUInt32LE(xml.length, 24)
  central.writeUInt16LE(name.length, 28)
  const offset = 0
  central.writeUInt32LE(offset, 42)
  const localPart = Buffer.concat([local, name, body])
  const centralPart = Buffer.concat([central, name])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)
  return Buffer.concat([localPart, centralPart, eocd])
}

/** A minimal one-page PDF whose single text line is `text`. */
function pdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
      `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
      `trailer<</Root 1 0 R/Size 6>>\n%%EOF`,
  )
}

describe("evidence types", () => {
  beforeEach(() => resetDatabase())

  it("offers the eight evidence types and nothing else", async () => {
    for (const type of ["Code", "Dataset / Model", "Analysis", "Prototype", "Something else"]) {
      const res = await addEvidence({ type, title: "Detector", link: "https://docs.example.com/report" })
      expect(res.status).toBe(400)
      expect(res.json.field).toBe("type")
      expect(String(res.json.error)).toMatch(/GitHub, Documentation, Notebook, Report, Presentation, Demo \/ Video, Screenshot, Contribution Statement/)
    }
  })
})

describe("Documentation evidence from a link", () => {
  beforeEach(() => resetDatabase())
  afterEach(() => {
    docsDeps.fetch = stubbedDocsFetch
  })

  it("reads a shared Google Doc so its text is analyzed, not just linked", async () => {
    const requested: string[] = []
    docsDeps.fetch = async (url) => {
      requested.push(url)
      return new Response(REPORT, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } })
    }
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", link: "https://docs.google.com/document/d/1AbC_def-123/edit" })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()
    expect(requested).toEqual(["https://docs.google.com/document/d/1AbC_def-123/export?format=txt"])
    const added = (await myEvidence()).find((e) => e.title === "Evaluation report")!
    expect(added.type).toBe("Documentation")
    expect(added.analyzedFiles).toEqual(["Google Doc"])
  })

  it("saves a private Google Doc anyway and tells the student how to make it readable", async () => {
    // Google answers an unshared document with its sign-in page.
    docsDeps.fetch = async () => new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } })
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", link: "https://docs.google.com/document/d/private123/edit", content: REPORT })
    expect(res.status).toBe(200)
    // The excerpt is still analyzed, so there's nothing to warn about.
    expect(res.json.result).toBeNull()

    const bare = await addEvidence({ type: "Documentation", title: "Evaluation report, shared later", link: "https://docs.google.com/document/d/private123/edit" })
    expect(bare.status).toBe(200)
    expect(String((bare.json.result as { notice: string }).notice)).toMatch(/Anyone with the link/)
    expect((await myEvidence()).some((e) => e.title === "Evaluation report, shared later")).toBe(true)
  })

  it("asks for a link or a file when neither is given", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("link")
    expect(String(res.json.error)).toMatch(/link to your documentation or attach the file/)
  })
})

describe("Documentation evidence from an attached file", () => {
  beforeEach(() => resetDatabase())

  it("stores a text file, analyzes its text, and lets the student download it unchanged", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", file: upload("report.txt", Buffer.from(REPORT)) })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()

    const added = (await myEvidence()).find((e) => e.title === "Evaluation report")!
    expect(added.link).toBe("")
    expect(added.file).toEqual({ name: "report.txt", size: Buffer.byteLength(REPORT) })
    expect(added.analyzedFiles).toEqual(["report.txt"])

    const download = await fetchFile(added.id, YAZAN)
    expect(download.status).toBe(200)
    expect(download.headers.get("content-disposition")).toMatch(/attachment; filename="report.txt"/)
    expect(await download.text()).toBe(REPORT)
  })

  it("reads the text out of a Word document", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", file: upload("report.docx", docx(REPORT.split("\n"))) })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()
    const added = (await myEvidence()).find((e) => e.title === "Evaluation report")!
    expect(added.file?.name).toBe("report.docx")
    expect(added.analyzedFiles).toEqual(["report.docx"])
  })

  it("reads the text out of a PDF", async () => {
    const line = "Isolation Forest anomaly detector evaluation on NetFlow traffic: 90% recall at 61% precision, contamination 2%, missed slow port scans."
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", file: upload("report.pdf", pdf(line)) })
    expect(res.status).toBe(200)
    expect(res.json.result).toBeNull()
    expect((await myEvidence()).find((e) => e.title === "Evaluation report")!.analyzedFiles).toEqual(["report.pdf"])
  })

  it("accepts a file together with a link", async () => {
    const res = await addEvidence({
      type: "Documentation",
      title: "Evaluation report",
      link: "https://docs.example.com/report",
      file: upload("report.md", Buffer.from(`# Evaluation\n\n${REPORT}`)),
    })
    expect(res.status).toBe(200)
    const added = (await myEvidence()).find((e) => e.title === "Evaluation report")!
    expect(added.link).toBe("https://docs.example.com/report")
    expect(added.file?.name).toBe("report.md")
  })

  it("saves a file with no readable text and says it couldn't be analyzed", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", file: upload("scan.txt", Buffer.from("abc")) })
    expect(res.status).toBe(200)
    expect(String((res.json.result as { notice: string }).notice)).toMatch(/attached for your reviewer/)
    expect((await myEvidence()).find((e) => e.title === "Evaluation report")!.file?.name).toBe("scan.txt")
  })

  it("rejects the wrong file type, an empty file, and a renamed one, naming the file field", async () => {
    const wrongType = await addEvidence({ type: "Documentation", title: "Report", file: upload("report.exe", Buffer.from(REPORT)) })
    expect(wrongType.status).toBe(400)
    expect(wrongType.json.field).toBe("file")
    expect(String(wrongType.json.error)).toMatch(/\.pdf, \.docx, \.doc, \.txt, \.md/)

    const empty = await addEvidence({ type: "Documentation", title: "Report", file: upload("report.txt", Buffer.alloc(0)) })
    expect(empty.status).toBe(400)
    expect(empty.json.field).toBe("file")

    const renamed = await addEvidence({ type: "Documentation", title: "Report", file: upload("report.pdf", Buffer.from(REPORT)) })
    expect(renamed.status).toBe(400)
    expect(String(renamed.json.error)).toMatch(/isn't a valid PDF file/)

    const malformed = await addEvidence({ type: "Documentation", title: "Report", file: { name: "report.txt" } })
    expect(malformed.status).toBe(400)
    expect(malformed.json.field).toBe("file")
  })

  it("rejects a file that just repeats the challenge brief", async () => {
    const brief = (await server.call("GET", "/snapshot", YAZAN)).json.snapshot as { challenges: { id: string; problemDescription: string }[] }
    const challenge = brief.challenges.find((c) => c.id === "chal-iris-anomaly")!
    const res = await addEvidence({ type: "Documentation", title: "Report", file: upload("report.txt", Buffer.from(challenge.problemDescription.repeat(2))) })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("file")
  })

  it("only lets people who can read the evidence download its file", async () => {
    await addEvidence({ type: "Documentation", title: "Evaluation report", file: upload("report.txt", Buffer.from(REPORT)) })
    const id = (await myEvidence()).find((e) => e.title === "Evaluation report")!.id

    expect((await fetchFile(id, "university:uni-aau")).status).toBe(200)
    expect((await fetchFile(id, "student:stu-hu-leen")).status).toBe(403)
    expect((await fetchFile(id, "university:uni-ju")).status).toBe(403)
    // The project isn't confirmed to the company yet, so IRIS can't read it either.
    expect((await fetchFile(id, "company:org-iris")).status).toBe(403)
    expect((await fetchFile("ev-nope", YAZAN)).status).toBe(404)
  })
})


// What WSL says about a Google Doc depends on why it couldn't be read, so the student knows what to do.
describe("reading a Google Doc", () => {
  afterEach(() => {
    docsDeps.fetch = stubbedDocsFetch
  })
  const link = "https://docs.google.com/document/d/1AbC_def-123/edit?usp=sharing"
  const plain = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } })

  it("returns the text of a shared document", async () => {
    docsDeps.fetch = async () => plain(`\uFEFF  ${REPORT}  `)
    const read = await readGoogleDoc(link)
    expect(read).toEqual({ ok: true, text: REPORT })
  })

  it("accepts the other shapes of Google Docs link", async () => {
    const requested: string[] = []
    docsDeps.fetch = async (url) => {
      requested.push(url)
      return plain(REPORT)
    }
    for (const l of ["docs.google.com/document/d/AAA-bbb_1/edit", "https://docs.google.com/document/u/0/d/AAA-bbb_1/edit?tab=t.0", "  https://docs.google.com/document/d/AAA-bbb_1  "]) {
      expect((await readGoogleDoc(l)).ok).toBe(true)
    }
    expect(new Set(requested)).toEqual(new Set(["https://docs.google.com/document/d/AAA-bbb_1/export?format=txt"]))
  })

  it("says a document that isn't shared is not shared (sign-in page, 403 or 404)", async () => {
    for (const reply of [
      () => new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } }),
      () => new Response("<html>Forbidden</html>", { status: 403, headers: { "content-type": "text/html" } }),
      () => new Response("<html>Not found</html>", { status: 404, headers: { "content-type": "text/html" } }),
    ]) {
      docsDeps.fetch = async () => reply()
      expect(await readGoogleDoc(link)).toEqual({ ok: false, problem: "not-shared" })
    }
  })

  it("says when Google can't be reached, and when the document is empty", async () => {
    docsDeps.fetch = async () => {
      throw new Error("network down")
    }
    expect(await readGoogleDoc(link)).toEqual({ ok: false, problem: "unreachable" })
    docsDeps.fetch = async () => new Response("Service unavailable", { status: 503, headers: { "content-type": "text/html" } })
    expect(await readGoogleDoc(link)).toEqual({ ok: false, problem: "unreachable" })
    docsDeps.fetch = async () => plain("hi")
    expect(await readGoogleDoc(link)).toEqual({ ok: false, problem: "empty" })
  })
})

// The point of reading a document is that its content drives the analysis. Dana's helpdesk project
// has no code evidence of its own, so anything WSL finds there comes from what the tests add.
describe("what the analysis does with a Google Doc's content", () => {
  const DANA = "student:stu-hu-dana"
  const DANA_PROJECT = "prj-echo-helpdesk-dana"
  const API_DOC = `Helpdesk portal API reference

const express = require("express")
const app = express()
app.use(express.json())

app.post("/api/tickets", (req, res) => {
  const ticket = { id: nextId++, requester: req.body.requester, priority: req.body.priority, status: "open" }
  tickets.push(ticket)
  res.status(201).json(ticket)
})
app.get("/api/tickets", (req, res) => res.json(tickets))
app.patch("/api/tickets/:id", (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id))
  if (!ticket) return res.status(404).json({ error: "ticket not found" })
  Object.assign(ticket, { status: req.body.status, assignee: req.body.assignee })
  res.json(ticket)
})

Employees raise tickets through the portal, IT staff triage and resolve them, and managers see response times.`
  const DOC_LINK = "https://docs.google.com/document/d/1HelpdeskApi_abc/edit?usp=sharing"
  const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "WSL_AI_PROVIDER"]
  const realLlmFetch = llmDeps.fetch
  const shared = () => new Response(API_DOC, { status: 200, headers: { "content-type": "text/plain" } })

  const addDoc = () => server.call("POST", `/projects/${DANA_PROJECT}/evidence`, DANA, { type: "Documentation", title: "Helpdesk API reference", link: DOC_LINK })
  const analyze = () => server.call("POST", `/projects/${DANA_PROJECT}/ai-review`, DANA)
  async function snapshot() {
    return (await server.call("GET", "/snapshot", DANA)).json.snapshot as {
      evidence: { id: string; projectId: string; title: string; analyzedFiles?: string[] }[]
      skillSignals: { projectId: string; skill: string; suggestedLevel: string; evidenceIds: string[]; criteria: { met: boolean }[] }[]
    }
  }

  beforeEach(() => {
    resetDatabase()
    for (const k of KEYS) delete process.env[k]
  })
  afterEach(() => {
    docsDeps.fetch = stubbedDocsFetch
    llmDeps.fetch = realLlmFetch
    for (const k of KEYS) delete process.env[k]
  })

  it("finds the work in a shared Google Doc and ties each skill back to that evidence", async () => {
    docsDeps.fetch = async () => shared()
    expect((await addDoc()).status).toBe(200)
    const snap = await snapshot()
    const doc = snap.evidence.find((e) => e.projectId === DANA_PROJECT && e.title === "Helpdesk API reference")!
    expect(doc.analyzedFiles).toEqual(["Google Doc"])

    expect((await analyze()).status).toBe(200)
    const signals = (await snapshot()).skillSignals.filter((x) => x.projectId === DANA_PROJECT)
    for (const skill of ["REST API Design", "Node.js"]) {
      const sig = signals.find((x) => x.skill === skill)!
      expect(sig.suggestedLevel, skill).not.toBe("Insufficient")
      expect(sig.criteria.some((c) => c.met), skill).toBe(true)
      expect(sig.evidenceIds, skill).toContain(doc.id)
    }
    // Nothing in the document touches SQL, and WSL says so rather than guessing.
    expect(signals.find((x) => x.skill === "SQL")!.suggestedLevel).toBe("Insufficient")
  })

  it("has nothing to analyze from a Google Doc it couldn't read", async () => {
    // Default stub: Google's sign-in page, and no excerpt, so the document contributes nothing.
    expect((await addDoc()).status).toBe(200)
    const doc = (await snapshot()).evidence.find((e) => e.title === "Helpdesk API reference")!
    expect(doc.analyzedFiles).toBeUndefined()
    await analyze()
    for (const sig of (await snapshot()).skillSignals.filter((x) => x.projectId === DANA_PROJECT)) expect(sig.evidenceIds).not.toContain(doc.id)
  })

  it("sends the document's text to the grading model", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    docsDeps.fetch = async () => shared()
    await addDoc()
    const sent: string[] = []
    llmDeps.fetch = async (_url, init) => {
      sent.push(String(init.body))
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ restatesBrief: false, skills: [] }) }] } }] })
    }
    await analyze()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain("res.status(201)")
  })
})

// A document that wasn't shared when it was added can be read again once the student fixes that.
describe("checking a Google Doc again", () => {
  const DOC_LINK = "https://docs.google.com/document/d/1PrivateThenShared_x/edit"
  beforeEach(() => resetDatabase())
  afterEach(() => {
    docsDeps.fetch = stubbedDocsFetch
  })
  const shared = (body: string) => async () => new Response(body, { status: 200, headers: { "content-type": "text/plain" } })
  const reread = (evidenceId: string, actor = YAZAN) => server.call("POST", `/projects/${PROJECT}/evidence/${evidenceId}/reread`, actor)
  async function addPrivateDoc(extra: Record<string, unknown> = {}) {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report", link: DOC_LINK, ...extra })
    expect(res.status).toBe(200)
    return { res, id: (await myEvidence()).find((e) => e.title === "Evaluation report")!.id }
  }

  it("tells the student how to share it when it wasn't readable, then reads it once it is", async () => {
    const { res, id } = await addPrivateDoc()
    expect(String((res.json.result as { notice: string }).notice)).toMatch(/Anyone with the link/)
    expect((await myEvidence()).find((e) => e.id === id)!.analyzedFiles).toBeUndefined()

    const still = await reread(id)
    expect(still.status).toBe(200)
    expect(still.json.result).toMatchObject({ read: false })
    expect(String((still.json.result as { notice: string }).notice)).toMatch(/Anyone with the link/)

    docsDeps.fetch = shared(REPORT)
    const now = await reread(id)
    expect(now.status).toBe(200)
    expect(now.json.result).toMatchObject({ read: true })
    expect((await myEvidence()).find((e) => e.id === id)!.analyzedFiles).toEqual(["Google Doc"])
  })

  it("explains an unreachable Google differently from an unshared document", async () => {
    const { id } = await addPrivateDoc()
    docsDeps.fetch = async () => {
      throw new Error("offline")
    }
    const res = await reread(id)
    expect(String((res.json.result as { notice: string }).notice)).toMatch(/couldn't reach Google/)
  })

  it("won't accept a document that just repeats the challenge brief, and leaves the evidence unchanged", async () => {
    const { id } = await addPrivateDoc()
    const snap = (await server.call("GET", "/snapshot", YAZAN)).json.snapshot as { challenges: { id: string; problemDescription: string }[] }
    const brief = snap.challenges.find((c) => c.id === "chal-iris-anomaly")!.problemDescription
    docsDeps.fetch = shared(brief.repeat(2))
    const res = await reread(id)
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("link")
    expect(String(res.json.error)).toMatch(/repeats/)
    expect((await myEvidence()).find((e) => e.id === id)!.analyzedFiles).toBeUndefined()
  })

  it("only applies to your own Google Docs links without an attached file", async () => {
    const { id } = await addPrivateDoc()
    expect((await reread(id, "student:stu-hu-leen")).status).toBe(403)
    expect((await reread("ev-nope")).status).toBe(404)

    const repo = await addEvidence({ type: "GitHub Repository", title: "Repo", link: "https://github.com/yazan/x", content: REPORT })
    expect(repo.status).toBe(200)
    const repoId = (await myEvidence()).find((e) => e.title === "Repo")!.id
    expect((await reread(repoId)).status).toBe(400)

    await addEvidence({ type: "Documentation", title: "With file", link: DOC_LINK, file: upload("report.txt", Buffer.from(REPORT)) })
    const withFile = (await myEvidence()).find((e) => e.title === "With file")!.id
    expect((await reread(withFile)).status).toBe(400)
  })
})

async function fetchFile(evidenceId: string, actor: string) {
  return server.fetch(`/evidence/${evidenceId}/file`, actor)
}
