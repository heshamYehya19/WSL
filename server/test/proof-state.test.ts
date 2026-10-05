import { describe, expect, it } from "vitest"
import { proofCounts, PROOF_STATE_LABEL, PROOF_STATE_MEANING, reviewItemFor, reviewItemReason, skillProofState } from "../../src/lib/proof.ts"
import type { ReviewItem, SkillSignalStatus, SuggestedLevel } from "../../src/types.ts"
import { EVIDENCE_INPUT, SUBMITTABLE_EVIDENCE_TYPES, evidenceTypeLabel } from "../../src/lib/evidenceTypes.ts"

const signal = (status: SkillSignalStatus, suggestedLevel: SuggestedLevel = "Foundational") => ({ status, suggestedLevel })

// What every screen says about a skill is derived from one function, so no screen can say "Verified"
// before a university has verified, or call missing evidence a failing.
describe("the state of a skill, derived from the data", () => {
  it("A. no evidence — no signal at all — is Insufficient evidence", () => {
    expect(skillProofState(undefined)).toBe("insufficient")
    expect(PROOF_STATE_LABEL[skillProofState(undefined)]).toBe("Insufficient evidence")
  })

  it("B. evidence found but not yet reviewed is Pending University Verification", () => {
    expect(skillProofState(signal("Pending Verification"))).toBe("pending")
    expect(PROOF_STATE_LABEL.pending).toBe("Pending University Verification")
  })

  it("C. a reviewer asking for more is More Evidence Requested", () => {
    expect(skillProofState(signal("More Evidence Requested"))).toBe("more-evidence")
    expect(PROOF_STATE_LABEL["more-evidence"]).toBe("More Evidence Requested")
  })

  it("D. a reviewer declining is Not Verified — about the evidence, not about the student", () => {
    expect(skillProofState(signal("Rejected"))).toBe("not-verified")
    expect(PROOF_STATE_LABEL["not-verified"]).toBe("Not Verified")
    expect(PROOF_STATE_MEANING["not-verified"]).toBe("The university has not verified this evidence as sufficient.")
  })

  it("E. only the university's decision makes a skill Verified", () => {
    expect(skillProofState(signal("Verified"))).toBe("verified")
    for (const status of ["Pending Verification", "More Evidence Requested", "Rejected"] as const) expect(skillProofState(signal(status))).not.toBe("verified")
  })

  it("G. a signal that found nothing is Insufficient until a reviewer acts on it", () => {
    expect(skillProofState(signal("Pending Verification", "Insufficient"))).toBe("insufficient")
    expect(PROOF_STATE_MEANING.insufficient).toBe("The submitted evidence does not currently demonstrate this skill.")
  })

  it("keeps required skills apart from demonstrated ones when counting", () => {
    const required = ["Python", "SQL", "Machine Learning", "Data Analysis"]
    const counts = proofCounts(required, [
      { skill: "Python", ...signal("Verified") },
      { skill: "SQL", ...signal("Pending Verification") },
      { skill: "Machine Learning", ...signal("Pending Verification", "Insufficient") },
    ])
    // Data Analysis has no signal at all, and the required list is never treated as evidence.
    expect(counts).toEqual({ verified: 1, pending: 1, insufficient: 2, acknowledged: 0, "more-evidence": 0, "not-verified": 0 })
  })
})

describe("insufficient evidence the university acknowledged", () => {
  it("H. is a state of its own: reviewed and agreed, not merely 'WSL found nothing'", () => {
    expect(skillProofState(signal("Insufficient Evidence", "Insufficient"))).toBe("acknowledged")
    expect(skillProofState(signal("Pending Verification", "Insufficient"))).toBe("insufficient")
    expect(PROOF_STATE_LABEL.acknowledged).toBe("Insufficient evidence · reviewed")
    expect(PROOF_STATE_MEANING.acknowledged).toMatch(/reviewed this and agreed/)
  })

  it("counts an acknowledged skill apart from an unreviewed one, and never as verified", () => {
    const counts = proofCounts(["SQL", "Python"], [
      { skill: "SQL", ...signal("Insufficient Evidence", "Insufficient") },
      { skill: "Python", ...signal("Pending Verification", "Insufficient") },
    ])
    expect(counts).toEqual({ verified: 0, pending: 0, insufficient: 1, acknowledged: 1, "more-evidence": 0, "not-verified": 0 })
  })
})

describe("what the reviewer has to decide", () => {
  const item = (over: Partial<ReviewItem>): ReviewItem => ({ studentId: "stu-1", skill: "SQL", state: "pending", stale: false, resolved: false, ...over })

  it("finds the confirmation check's verdict on exactly one student's one skill", () => {
    const review = { items: [item({ skill: "SQL", state: "verified", resolved: true }), item({ skill: "Python" }), item({ studentId: "stu-2", skill: "SQL", state: "unreviewed" })] }
    expect(reviewItemFor(review, "stu-1", "SQL")?.state).toBe("verified")
    expect(reviewItemFor(review, "stu-2", "SQL")?.state).toBe("unreviewed")
    expect(reviewItemFor(review, "stu-3", "SQL")).toBeUndefined()
    expect(reviewItemFor(null, "stu-1", "SQL")).toBeUndefined()
  })

  it("says why a skill still blocks confirmation: never reviewed, awaiting, more evidence, or stale", () => {
    expect(reviewItemReason(item({ state: "unreviewed" }))).toBe("not reviewed yet")
    expect(reviewItemReason(item({ state: "pending" }))).toBe("awaiting a decision")
    expect(reviewItemReason(item({ state: "more-evidence" }))).toBe("more evidence requested")
    // A decision that predates new evidence no longer counts, whatever it was.
    expect(reviewItemReason(item({ state: "verified", stale: true }))).toBe("new evidence since the last review or analysis")
  })
})

describe("the evidence types", () => {
  it("are the eight WSL offers, each with a human label and an input rule", () => {
    expect(SUBMITTABLE_EVIDENCE_TYPES.map(evidenceTypeLabel)).toEqual([
      "GitHub",
      "Documentation",
      "Notebook",
      "Report",
      "Presentation",
      "Demo / Video",
      "Screenshot",
      "Contribution Statement",
    ])
    for (const type of SUBMITTABLE_EVIDENCE_TYPES) expect(EVIDENCE_INPUT[type]).toBeDefined()
  })
})
