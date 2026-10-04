import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"
import { checkRelevance } from "../ml/analyze.ts"
import { githubDeps } from "../github.ts"

const PROJECT = "prj-iris-anomaly-yazan"
const YAZAN = "student:stu-aau-yazan"
const realGithubFetch = githubDeps.fetch

// Real, on-topic work for the IRIS anomaly-detection challenge, so only the check under test can fail.
const IRIS_EXCERPT = `flows = pd.read_parquet("netflow_logs.parquet")
X_scaled = StandardScaler().fit_transform(extract_features(flows))
model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)
flows["anomaly_score"] = model.fit_predict(X_scaled)
alerts = flows[flows["anomaly_score"] == -1]`

const server = await startServer()
afterAll(() => server.close())

const addEvidence = (body: Record<string, unknown>) => server.call("POST", `/projects/${PROJECT}/evidence`, YAZAN, body)

describe("GitHub repository evidence", () => {
  beforeEach(() => resetDatabase())
  afterEach(() => {
    githubDeps.fetch = realGithubFetch
  })

  it("rejects a link that isn't a github.com/owner/repo URL, naming the field and the fix", async () => {
    for (const link of ["https://gitlab.com/yazan/flow-guard", "github.com/yazan", "my repo"]) {
      const res = await addEvidence({ type: "GitHub Repository", title: "Detector", link })
      expect(res.status).toBe(400)
      expect(res.json.field).toBe("link")
      expect(String(res.json.error)).toMatch(/github\.com\/owner\/repo/)
    }
  })

  it("requires an excerpt when the repository can't be read, and says why", async () => {
    githubDeps.fetch = async () => new Response("Not Found", { status: 404 })
    const res = await addEvidence({ type: "GitHub Repository", title: "Detector", link: "https://github.com/yazan/private-detector" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("content")
    expect(String(res.json.error)).toMatch(/could not read this repository/)
    expect(String(res.json.error)).toMatch(/[Pp]aste a representative excerpt/)
  })

  it("accepts an unreadable repository with an excerpt, and tells the student only the excerpt is analyzed", async () => {
    githubDeps.fetch = async () => new Response("Not Found", { status: 404 })
    const res = await addEvidence({ type: "GitHub Repository", title: "Detector", link: "https://github.com/yazan/private-detector", content: IRIS_EXCERPT })
    expect(res.status).toBe(200)
    expect(res.json.result).toEqual({ notice: "WSL could not read this repository, so only your pasted excerpt will be analyzed." })
  })

  it("rejects a non-GitHub link that isn't a web address at all", async () => {
    const res = await addEvidence({ type: "Documentation", title: "Report", link: "my report" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("link")
  })
})

describe("challenge submission", () => {
  beforeEach(() => resetDatabase())

  const challenge = (overrides: Record<string, unknown>) =>
    server.call("POST", "/challenges", "company:org-iris", {
      title: "Detect phishing domains",
      problemDescription: "IRIS wants to flag newly registered look-alike domains before they're used in phishing campaigns against its clients.",
      requiredSkills: ["Python"],
      learningOutcomes: ["Engineer features from domain names"],
      contactId: "",
      ...overrides,
    })

  it("rejects a challenge with no required skills, instead of inventing a placeholder skill", async () => {
    const res = await challenge({ requiredSkills: [] })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("requiredSkills")
    expect(String(res.json.error)).toMatch(/at least one required skill/)
  })

  it("rejects a challenge with only blank skills", async () => {
    const res = await challenge({ requiredSkills: ["  ", ""] })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("requiredSkills")
  })

  it("rejects a challenge with no learning outcomes", async () => {
    const res = await challenge({ learningOutcomes: [] })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("learningOutcomes")
    expect(String(res.json.error)).toMatch(/at least one learning outcome/)
  })

  it("names the field and what to do for a missing title", async () => {
    const res = await challenge({ title: "" })
    expect(res.status).toBe(400)
    expect(res.json.field).toBe("title")
    expect(String(res.json.error)).toMatch(/fill it in and try again/)
  })

  it("still accepts a complete challenge", async () => {
    const res = await challenge({})
    expect(res.status).toBe(200)
    expect(res.json.result).toHaveProperty("id")
  })
})

describe("relevance check in Arabic", () => {
  const ARABIC_BRIEF = {
    problemDescription: "تريد الشركة نظاماً للتنبؤ بالطلب على قطع الغيار لعملاء أنظمة تخطيط الموارد، باستخدام بيانات المبيعات التاريخية لتقليل نفاد المخزون.",
    objectives: ["تحليل بيانات المبيعات التاريخية", "بناء نموذج للتنبؤ بالطلب الشهري", "تقييم دقة النموذج"],
    expectedOutput: "نموذج تنبؤ وتقرير يشرح النتائج.",
  }
  const ARABIC_WORK =
    "قمت بتنظيف بيانات المبيعات وإزالة القيم المكررة، ثم بنيت نموذج انحدار للتنبؤ بالطلب الشهري على كل قطعة غيار. " +
    "قيّمت النموذج على آخر ثلاثة أشهر وكان متوسط الخطأ المطلق ١٢٪، وأوصي بإعادة الطلب عندما يتجاوز التنبؤ مستوى المخزون الحالي."

  it("accepts genuine Arabic work on an Arabic brief instead of calling it a 0% match", () => {
    expect(checkRelevance(ARABIC_BRIEF, ARABIC_WORK)).toEqual({ relevant: true })
  })

  it("still rejects an Arabic submission that copies the brief back, even with diacritics added", () => {
    const copied = "تُرِيدُ الشَّرِكَةُ نِظَاماً للتنبؤ بالطلب على قطع الغيار لعملاء أنظمة تخطيط الموارد، باستخدام بيانات المبيعات التاريخية لتقليل نفاد المخزون. تحليل بيانات المبيعات التاريخية. بناء نموذج للتنبؤ بالطلب الشهري."
    expect(checkRelevance(ARABIC_BRIEF, copied)).toMatchObject({ relevant: false, reason: "echoes-brief" })
  })

  it("rejects Arabic text about something else entirely", () => {
    const unrelated = "ذهبنا في رحلة إلى البحر الميت مع العائلة، وسبحنا طويلاً ثم تناولنا الغداء في مطعم صغير قرب الشاطئ وعدنا مساءً."
    expect(checkRelevance(ARABIC_BRIEF, unrelated)).toMatchObject({ relevant: false, reason: "off-topic" })
  })

  it("can't judge Arabic work against an English brief, so it accepts it and leaves it to the AI grader", () => {
    const english = { problemDescription: "Detect anomalies in network traffic logs.", objectives: ["Build a detector"], expectedOutput: "A prototype." }
    expect(checkRelevance(english, ARABIC_WORK)).toEqual({ relevant: true, unjudged: true })
  })

  it("accepts Arabic evidence submitted to an English challenge through the API", async () => {
    resetDatabase()
    const res = await addEvidence({ type: "Documentation", title: "تقرير الكشف عن الشذوذ", link: "https://docs.google.com/document/d/abc123", content: ARABIC_WORK })
    expect(res.status).toBe(200)
  })
})
