// "Take the tour": one student's story through all three roles, from a company's
// challenge to that company finding the student by verified skills. Each step
// signs in as the right account and opens the right page (see state/tour.tsx).

export interface TourStep {
  role: "student" | "university" | "company"
  accountId: string
  path: string
  view: string
  title: string
  body: string
  /** Step 3 offers a one-click attempt to game the AI by pasting the brief back as evidence. */
  tryGaming?: boolean
}

export const TOUR_PROJECT = "prj-iris-anomaly-yazan"
export const TOUR_CHALLENGE = "chal-iris-anomaly"

export const TOUR_STEPS: TourStep[] = [
  {
    role: "company",
    accountId: "org-iris",
    path: `/company/challenges/${TOUR_CHALLENGE}`,
    view: "Company",
    title: "A real-world challenge",
    body: "IRIS Technology Jordan submits a safe, structured challenge: catch unusual network traffic. WSL screened it for personal data before any university saw it.",
  },
  {
    role: "university",
    accountId: "uni-aau",
    path: `/university/challenges/${TOUR_CHALLENGE}`,
    view: "University",
    title: "Built into a course",
    body: "Amman Arab University assigns the challenge to its B.Sc. Cyber Security students, so the work happens inside real coursework.",
  },
  {
    role: "student",
    accountId: "stu-aau-yazan",
    path: `/student/projects/${TOUR_PROJECT}?tab=evidence`,
    view: "Student",
    title: "Yazan submits evidence",
    body: "His real detector code, evaluation notebook and report are here. Try to game it: paste the challenge brief back as evidence and WSL rejects it. Then press Re-analyze to grade the real work and see the lines it quotes.",
    tryGaming: true,
  },
  {
    role: "university",
    accountId: "uni-aau",
    path: `/university/projects/${TOUR_PROJECT}`,
    view: "University mentor",
    title: "AI evidence, human verification",
    body: "Every skill signal quotes the exact lines of Yazan's work that prove it. The AI never certifies: as his mentor, verify each skill, then confirm the work to IRIS.",
  },
  {
    role: "company",
    accountId: "org-iris",
    path: "/company/talent/stu-aau-yazan",
    view: "Company",
    title: "Talent discovery by proof",
    body: "IRIS finds Yazan by university-verified skills, each traced back to the work behind it. Not a CV, not a claim: evidence.",
  },
]
