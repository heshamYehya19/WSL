import { describe, expect, it } from "vitest"
import { allClaimedResolved, isClaimed, proofCounts, PROOF_STATE_LABEL, PROOF_STATE_MEANING, skillProofState } from "../../src/lib/proof.ts"
import type { SkillSignalStatus, SuggestedLevel } from "../../src/types.ts"
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
    expect(counts).toEqual({ verified: 1, pending: 1, insufficient: 2, "more-evidence": 0, "not-verified": 0 })
  })
})

describe("what the reviewer has to decide", () => {
  it("leaves skills nobody showed evidence for out of the decision", () => {
    expect(isClaimed(signal("Pending Verification", "Insufficient"))).toBe(false)
    expect(isClaimed(signal("Pending Verification"))).toBe(true)
    expect(allClaimedResolved([signal("Verified"), signal("Pending Verification", "Insufficient")])).toBe(true)
    expect(allClaimedResolved([signal("Verified"), signal("Pending Verification")])).toBe(false)
    expect(allClaimedResolved([signal("Pending Verification", "Insufficient")])).toBe(false)
    expect(allClaimedResolved([signal("Verified"), signal("Rejected")])).toBe(true)
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
