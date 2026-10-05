import type { EvidenceType } from "../types.ts"

/**
 * The evidence a student can add today. Stored names are kept stable (older records use them);
 * what students read is `EVIDENCE_TYPE_LABEL`.
 */
export const SUBMITTABLE_EVIDENCE_TYPES: EvidenceType[] = [
  "GitHub Repository",
  "Documentation",
  "Notebook",
  "Project Report",
  "Presentation",
  "Video Walkthrough",
  "Screenshot",
  "Contribution Statement",
]

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  "GitHub Repository": "GitHub",
  Documentation: "Documentation",
  Notebook: "Notebook",
  "Project Report": "Report",
  Presentation: "Presentation",
  "Video Walkthrough": "Demo / Video",
  Screenshot: "Screenshot",
  "Contribution Statement": "Contribution Statement",
}

export const evidenceTypeLabel = (type: string) => EVIDENCE_TYPE_LABEL[type] ?? type

/** What kind of file a type accepts, mirroring the upload formats in server/screening.ts. */
export type EvidenceFileKind = "document" | "notebook" | "presentation" | "image"

export interface EvidenceInputRule {
  /** Whether a link is needed, allowed, or not accepted. */
  link: "required" | "either" | "optional" | "none"
  /** The kind of file the type takes, if any. "either" link-or-file types need one of the two. */
  file: EvidenceFileKind | null
  /** What the text box means for this type. */
  text: "excerpt" | "caption" | "statement"
  placeholder: string
  hint: string
}

/** How each type is filled in. `either` = a link or a file, one is enough. */
export const EVIDENCE_INPUT: Record<string, EvidenceInputRule> = {
  "GitHub Repository": {
    link: "required",
    file: null,
    text: "excerpt",
    placeholder: "github.com/you/project",
    hint: "Public repositories are read automatically (README and main source files). A link to a single file works too.",
  },
  Documentation: {
    link: "either",
    file: "document",
    text: "excerpt",
    placeholder: "docs.google.com/document/…",
    hint: "For a Google Doc, set sharing to “Anyone with the link can view” so WSL can read it.",
  },
  Notebook: {
    link: "either",
    file: "notebook",
    text: "excerpt",
    placeholder: "github.com/you/project/blob/main/analysis.ipynb",
    hint: "A notebook on GitHub is read automatically. Or attach the .ipynb file itself.",
  },
  "Project Report": {
    link: "either",
    file: "document",
    text: "excerpt",
    placeholder: "docs.google.com/document/… or a link to your report",
    hint: "Attach the report (PDF or Word) or link to it.",
  },
  Presentation: {
    link: "either",
    file: "presentation",
    text: "excerpt",
    placeholder: "docs.google.com/presentation/…",
    hint: "Attach a PDF or PowerPoint, or link to the slides. WSL reads attached files; a link is kept for your reviewer.",
  },
  "Video Walkthrough": {
    link: "required",
    file: null,
    text: "caption",
    placeholder: "A link to your demo or walkthrough video",
    hint: "Videos can't be analyzed. They're kept for your university reviewer to watch.",
  },
  Screenshot: {
    link: "none",
    file: "image",
    text: "caption",
    placeholder: "",
    hint: "A screenshot of your work (PNG, JPG or WebP). It's kept for your university reviewer; WSL doesn't analyze images.",
  },
  "Contribution Statement": {
    link: "none",
    file: null,
    text: "statement",
    placeholder: "What did you do on this project? Be specific — what you built, decided or analyzed.",
    hint: "This is your own account of your contribution. It isn't proof by itself: your reviewer compares it with your actual work.",
  },
}

/**
 * Evidence kept for the reviewer but never fed to the skill analysis: a contribution statement is a
 * claim rather than work, and videos and screenshots have nothing WSL can read. Adding one of these
 * doesn't change what was analyzed.
 */
export const NOT_ANALYZED_TYPES = ["Contribution Statement", "Video Walkthrough", "Screenshot"]

export const FILE_EXTENSIONS: Record<EvidenceFileKind, string[]> = {
  document: [".pdf", ".docx", ".doc", ".txt", ".md"],
  notebook: [".ipynb"],
  presentation: [".pdf", ".pptx"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
}
