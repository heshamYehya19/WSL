import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { deflateRawSync } from "node:zlib"
import { resetDatabase, startServer } from "./helpers.ts"
import { docsDeps } from "../gdocs.ts"

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

  it("offers only GitHub Repository and Documentation", async () => {
    for (const type of ["Code", "Dataset / Model", "Project Report"]) {
      const res = await addEvidence({ type, title: "Detector", link: "https://docs.example.com/report" })
      expect(res.status).toBe(400)
      expect(res.json.field).toBe("type")
      expect(String(res.json.error)).toMatch(/GitHub Repository or Documentation/)
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
    expect(String((bare.json.result as { notice: string }).notice)).toMatch(/Anyone with the link can view/)
    expect((await myEvidence()).some((e) => e.title === "Evaluation report, shared later")).toBe(true)
  })

  it("asks for a link or a file when neither is given", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Evaluation report" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("link")
    expect(String(res.json.error)).toMatch(/link to your document .* or attach the file/)
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

async function fetchFile(evidenceId: string, actor: string) {
  return server.fetch(`/evidence/${evidenceId}/file`, actor)
}
