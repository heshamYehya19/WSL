import { describe, expect, it } from "vitest"
import { evidenceTypeLabel, formatDateIn, isolate, langProps, levelLabel, statusLabel } from "../../src/lib/i18n.ts"

// The English / Arabic helpers behind the landing page and the student skill record.
describe("English / Arabic helpers", () => {
  it("formats Arabic dates with Arabic month names and Western digits", () => {
    const ar = formatDateIn("ar", "2026-10-04T12:00:00Z")
    expect(ar).toContain("أكتوبر")
    expect(ar).toContain("2026")
    expect(ar).not.toMatch(/[٠-٩]/)
    expect(formatDateIn("en", "2026-10-04T12:00:00Z")).toBe("4 Oct 2026")
  })

  it("isolates embedded names so they can't reorder the text around them", () => {
    expect(isolate("Dr. Nidal Al-Rawabdeh")).toBe("⁨Dr. Nidal Al-Rawabdeh⁩")
  })

  it("translates levels, statuses and evidence types, and leaves unknown values as they are", () => {
    expect(levelLabel("Intermediate", "ar")).toBe("متوسط")
    expect(levelLabel("Intermediate", "en")).toBe("Intermediate")
    expect(statusLabel("Verified", "ar")).toBe("موثّق")
    expect(statusLabel("Some New Status", "ar")).toBe("Some New Status")
    expect(evidenceTypeLabel("Project Report", "ar")).toBe("تقرير المشروع")
  })

  it("lays a page out right-to-left only in Arabic", () => {
    expect(langProps("ar")).toMatchObject({ dir: "rtl", lang: "ar" })
    expect(langProps("en")).toMatchObject({ dir: "ltr", lang: "en" })
  })
})
