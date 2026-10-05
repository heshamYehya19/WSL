import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { resetDatabase, startServer } from "./helpers.ts"

const server = await startServer()

describe("evidence relevance gate", () => {
  afterAll(() => server.close())
  beforeEach(() => resetDatabase())

  it("rejects off-topic evidence with an overlap-percentage message", async () => {
    // prj-skytech-forecast-mais is about forecasting spare-parts demand for an ERP —
    // submitting a recipe has no meaningful vocabulary overlap with that problem.
    const res = await server.call("POST", "/projects/prj-skytech-forecast-mais/evidence", "student:stu-asu-mais", {
      type: "Documentation",
      title: "Grandmother's knafeh recipe",
      link: "https://docs.example.com/knafeh",
      content:
        "Melt the butter slowly over low heat, then layer the kataifi dough evenly across the tray before adding the sweetened cheese filling and baking until golden, finishing with the rosewater sugar syrup poured on top while still hot.",
    })
    expect(res.status).toBe(400)
    expect(String(res.json.error)).toMatch(/%/)
  })
})
