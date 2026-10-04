import type { DatabaseSync } from "node:sqlite"
import { simulateAIReview } from "./ai.ts"

// Initial content for the WSL database. Universities and companies are real
// Jordanian institutions; every person, challenge, submission, and rating is
// fictional. Timestamps are relative to the moment the database is seeded, so
// deadlines and "x days ago" labels always read naturally.

const SCREEN_NOTE = "WSL automatically screened this challenge for private or confidential data — none found."

/** Where each seeded piece of evidence lives. Also used to upgrade databases seeded with older links. */
export const EVIDENCE_LINKS: Record<string, string> = {
  "ev-omar-1": "github.com/omar-alfayez/call-intent-classifier",
  "ev-omar-2": "drive.google.com/file/d/1mQ7xK2pLr9TzV4bWc8NfH3jYeA6sD0uG/view",
  "ev-omar-3": "docs.google.com/presentation/d/1Hc4tRwq8ZpLx2VnB7eK9sYjM3fA5gU0dQ/view",
  "ev-khaled-1": "drive.google.com/file/d/1Bv9pQe3LmX7rT2wZs6NcK4hYdJ8fA1uE/view",
  "ev-khaled-2": "docs.google.com/spreadsheets/d/1Rx5mT8qWz2KpL7vN3bC9sHjE4fY6gA0dU/view",
  "ev-khaled-3": "drive.google.com/file/d/1Kd2wF7xQp9LmZ4tR8vB3nCjH6sY5eA0gT/view",
  "ev-leen-1": "github.com/leen-alzoubi/echo-helpdesk-portal",
  "ev-leen-2": "github.com/leen-alzoubi/echo-helpdesk-portal/blob/main/docs/openapi.yaml",
  "ev-leen-3": "drive.google.com/file/d/1Wc3hT8mQx5LpZ2vR7nB4kJsE9fY6gA0dN/view",
  "ev-dana-1": "github.com/dana-alomari/helpdesk-portal-wip",
  "ev-yazan-1": "github.com/yazan-almasri/netflow-anomaly-detector",
  "ev-yazan-2": "github.com/yazan-almasri/netflow-anomaly-detector/blob/main/notebooks/evaluation.ipynb",
  "ev-yazan-3": "drive.google.com/file/d/1Tz6nV2qKx8LpW4mR9bE3cJhS7fY5dA0gU/view",
  "ev-yazan-ssh-1": "github.com/yazan-almasri/ssh-bruteforce-triage",
  "ev-yazan-ssh-2": "drive.google.com/file/d/1Qm8rT3vYp5WkL2nX7cJ9aF4hD6sB0eGu/view",
  "ev-ahmad-1": "github.com/ahmad-obeidat/erp-inventory-service",
  "ev-ahmad-2": "drive.google.com/file/d/1Pw3kR8vLx5QmT2zN7bC4sJhE9fY6gA0dK/view",
  "ev-ahmad-3": "github.com/ahmad-obeidat/erp-inventory-service/tree/main/src/test",
  "ev-mais-1": "colab.research.google.com/drive/1Lq8vT3mXz6KpR2wN9bC5sJhE4fY7gA0dP",
  "ev-tala-1": "github.com/tala-haddad/sme-sales-model",
  "ev-tala-2": "drive.google.com/file/d/1Nf5wQ9kLx2TmR7zV3bC8sJhE6fY4gA0dM/view",
  "ev-tala-3": "docs.google.com/presentation/d/1Gy7tR2wQp4LmX9zN5bC3sJhE8fK6vA0dT/view",
  "ev-maint-1": "github.com/sara-alnajjar/asset-risk-model",
  "ev-maint-2": "github.com/sara-alnajjar/asset-risk-model/blob/main/api/README.md",
}

export function seedDatabase(db: DatabaseSync): void {
  const now = Date.now()
  const d = (days: number) => new Date(now + days * 86_400_000).toISOString()

  const run = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).run(...params)
  const json = (v: unknown) => JSON.stringify(v)

  // ---------------------------------------------------------------- universities
  const universities = [
    {
      id: "uni-aau",
      name: "Amman Arab University",
      short: "AAU",
      city: "Amman",
      type: "Private",
      established: 1999,
      website: "aau.edu.jo",
      faculty: "College of Computer Sciences and Informatics",
      about: "A private university in Amman offering undergraduate and graduate programs, with a computing college focused on applied, industry-linked learning.",
    },
    {
      id: "uni-hu",
      name: "The Hashemite University",
      short: "HU",
      city: "Zarqa",
      type: "Public",
      established: 1995,
      website: "hu.edu.jo",
      faculty: "Prince Al-Hussein Bin Abdullah II Faculty for Information Technology",
      about: "A public university in Zarqa serving students from across central and northern Jordan, with a large information technology faculty.",
    },
    {
      id: "uni-ju",
      name: "University of Jordan",
      short: "UJ",
      city: "Amman",
      type: "Public",
      established: 1962,
      website: "ju.edu.jo",
      faculty: "King Abdullah II School of Information Technology",
      about: "Jordan's oldest public university, based in Amman. Its King Abdullah II School of Information Technology runs some of the country's longest-established computing programs.",
    },
    {
      id: "uni-just",
      name: "Jordan University of Science and Technology",
      short: "JUST",
      city: "Irbid",
      type: "Public",
      established: 1986,
      website: "just.edu.jo",
      faculty: "Faculty of Computer and Information Technology",
      about: "A public science and technology university near Irbid in northern Jordan, known for its engineering, medical, and computing faculties.",
    },
    {
      id: "uni-asu",
      name: "Applied Science Private University",
      short: "ASU",
      city: "Amman",
      type: "Private",
      established: 1991,
      website: "asu.edu.jo",
      faculty: "Faculty of Information Technology",
      about: "A private university in Shafa Badran, Amman, offering programs across information technology, engineering, business, and health sciences.",
    },
  ]
  for (const u of universities) {
    run(
      "INSERT INTO universities (id, name, short_name, city, type, established, website, faculty, about) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      u.id, u.name, u.short, u.city, u.type, u.established, u.website, u.faculty, u.about,
    )
  }

  // ---------------------------------------------------------------------- staff
  const staff = [
    ["stf-aau-1", "uni-aau", "Dr. Nidal Al-Rawabdeh", "Associate Professor, Cyber Security"],
    ["stf-aau-2", "uni-aau", "Dr. Ruba Al-Sarayreh", "Assistant Professor, Artificial Intelligence"],
    ["stf-hu-1", "uni-hu", "Dr. Mahmoud Al-Khasawneh", "Associate Professor, Software Engineering"],
    ["stf-hu-2", "uni-hu", "Dr. Areej Al-Hiary", "Assistant Professor, Cyber Security"],
    ["stf-ju-1", "uni-ju", "Dr. Hazem Al-Qudah", "Professor, Artificial Intelligence"],
    ["stf-ju-2", "uni-ju", "Dr. Manal Al-Ajlouni", "Associate Professor, Business Information Technology"],
    ["stf-just-1", "uni-just", "Dr. Waleed Al-Batayneh", "Associate Professor, Software Engineering"],
    ["stf-just-2", "uni-just", "Dr. Rania Al-Shorman", "Assistant Professor, Network & Information Security"],
    ["stf-asu-1", "uni-asu", "Dr. Osama Al-Hamdan", "Associate Professor, Software Engineering"],
    ["stf-asu-2", "uni-asu", "Dr. Hanan Al-Saleh", "Assistant Professor, Computer Science"],
  ]
  for (const s of staff) run("INSERT INTO staff (id, university_id, name, title) VALUES (?, ?, ?, ?)", ...s)

  // ------------------------------------------------------------------- programs
  const programs = [
    ["prg-aau-cs", "uni-aau", "B.Sc. Computer Science", "Computer Science", "stf-aau-2"],
    ["prg-aau-cyber", "uni-aau", "B.Sc. Cyber Security", "Cyber Security", "stf-aau-1"],
    ["prg-aau-ai", "uni-aau", "B.Sc. Artificial Intelligence", "Artificial Intelligence", "stf-aau-2"],
    ["prg-hu-se", "uni-hu", "B.Sc. Software Engineering", "Software Engineering", "stf-hu-1"],
    ["prg-hu-cs", "uni-hu", "B.Sc. Computer Science", "Computer Science", "stf-hu-1"],
    ["prg-hu-cyber", "uni-hu", "B.Sc. Cyber Security", "Cyber Security", "stf-hu-2"],
    ["prg-ju-ai", "uni-ju", "B.Sc. Artificial Intelligence", "Artificial Intelligence", "stf-ju-1"],
    ["prg-ju-cs", "uni-ju", "B.Sc. Computer Science", "Computer Science", "stf-ju-1"],
    ["prg-ju-bit", "uni-ju", "B.Sc. Business Information Technology", "Business Information Technology", "stf-ju-2"],
    ["prg-just-se", "uni-just", "B.Sc. Software Engineering", "Software Engineering", "stf-just-1"],
    ["prg-just-ai", "uni-just", "B.Sc. Artificial Intelligence", "Artificial Intelligence", "stf-just-1"],
    ["prg-just-cyber", "uni-just", "B.Sc. Cyber Security", "Cyber Security", "stf-just-2"],
    ["prg-asu-se", "uni-asu", "B.Sc. Software Engineering", "Software Engineering", "stf-asu-1"],
    ["prg-asu-cs", "uni-asu", "B.Sc. Computer Science", "Computer Science", "stf-asu-2"],
    ["prg-asu-ai", "uni-asu", "B.Sc. Artificial Intelligence", "Artificial Intelligence", "stf-asu-2"],
  ]
  for (const p of programs) run("INSERT INTO programs (id, university_id, name, major, coordinator_id) VALUES (?, ?, ?, ?, ?)", ...p)

  // ------------------------------------------------------------------ companies
  const companies = [
    {
      id: "org-estarta",
      name: "Estarta HQ",
      industry: "Customer Experience & BPO",
      initials: "EST",
      about: "Amman-headquartered customer experience and business process outsourcing provider running multilingual contact-center operations for regional and international clients.",
    },
    {
      id: "org-echo",
      name: "Echo Technology",
      industry: "IT Services & Software",
      initials: "ECHO",
      about: "Jordanian technology company delivering software development and IT solutions for businesses in Jordan and the region.",
    },
    {
      id: "org-iris",
      name: "IRIS Technology Jordan",
      industry: "IT Solutions & Security",
      initials: "IRIS",
      about: "Technology solutions provider in Jordan working across IT infrastructure, information security, and enterprise software.",
    },
    {
      id: "org-skytech",
      name: "SkyTech Enterprise Systems",
      industry: "Enterprise Software (ERP)",
      initials: "SKY",
      about: "Builds and implements enterprise resource planning and business management systems for organizations in Jordan.",
    },
    {
      id: "org-abs",
      name: "Advanced Business Solutions",
      industry: "Business Software & Analytics",
      initials: "ABS",
      about: "Delivers business software, reporting, and analytics solutions that help organizations digitize their operations.",
    },
  ]
  for (const c of companies) {
    run(
      "INSERT INTO companies (id, name, industry, city, logo_initials, about) VALUES (?, ?, ?, 'Amman', ?, ?)",
      c.id, c.name, c.industry, c.initials, c.about,
    )
  }

  const contacts: [string, string, string, string, number][] = [
    ["ctc-estarta-1", "org-estarta", "Rami Haddadin", "Head of Data & Analytics", 1],
    ["ctc-estarta-2", "org-estarta", "Hiba Saleh", "Information Security Manager", 0],
    ["ctc-echo-1", "org-echo", "Fadi Nassar", "Engineering Manager", 1],
    ["ctc-echo-2", "org-echo", "Yara Abu Shanab", "Product Owner", 0],
    ["ctc-iris-1", "org-iris", "Lama Kurdi", "Security Operations Lead", 1],
    ["ctc-skytech-1", "org-skytech", "Ziad Hijazi", "Solutions Architect", 1],
    ["ctc-skytech-2", "org-skytech", "Nadine Saadeh", "Product Manager, ERP Analytics", 0],
    ["ctc-abs-1", "org-abs", "Ruba Shawabkeh", "BI Practice Lead", 1],
  ]
  for (const c of contacts) run("INSERT INTO company_contacts (id, company_id, name, role, is_primary) VALUES (?, ?, ?, ?, ?)", ...c)

  // ------------------------------------------------------------------- students
  // [id, university, program, student number, name, year, gpa, city, availability, bio]
  const students: [string, string, string, string, string, string, number, string, string, string][] = [
    ["stu-aau-yazan", "uni-aau", "prg-aau-cyber", "202110457", "Yazan Al-Masri", "Year 4", 3.42, "Amman", "Open to Opportunities",
      "Cyber security student who spends most evenings on CTF platforms. Interested in network defense and turning raw logs into alerts analysts can trust."],
    ["stu-aau-rahaf", "uni-aau", "prg-aau-ai", "202211238", "Rahaf Abu Zaid", "Year 3", 3.71, "Amman", "Open to Internships",
      "AI student focused on applied machine learning. Enjoys messy, real-world datasets more than benchmark ones."],
    ["stu-aau-mohammad", "uni-aau", "prg-aau-cs", "202310892", "Mohammad Al-Shboul", "Year 2", 3.05, "Salt", "Not Available",
      "Second-year computer science student building fundamentals in algorithms and backend development."],
    ["stu-hu-leen", "uni-hu", "prg-hu-se", "2037452", "Leen Al-Zoubi", "Year 4", 3.58, "Zarqa", "Open to Opportunities",
      "Software engineering student who likes shipping complete products — from requirements and API design through tests and deployment."],
    ["stu-hu-hamza", "uni-hu", "prg-hu-cyber", "2131806", "Hamza Bani Hani", "Year 3", 3.21, "Mafraq", "Open to Internships",
      "Cyber security student interested in security awareness and social engineering defense."],
    ["stu-hu-dana", "uni-hu", "prg-hu-cs", "2135519", "Dana Al-Omari", "Year 3", 3.66, "Zarqa", "Open to Internships",
      "Computer science student with a growing interest in full-stack web development and databases."],
    ["stu-ju-tala", "uni-ju", "prg-ju-bit", "0196284", "Tala Haddad", "Year 4", 3.49, "Amman", "Open to Opportunities",
      "Business information technology student who bridges business questions and data — SQL, data modeling, and dashboards people actually use."],
    ["stu-ju-omar", "uni-ju", "prg-ju-ai", "0197731", "Omar Al-Fayez", "Year 4", 3.83, "Amman", "Open to Opportunities",
      "AI student specializing in natural language processing, especially Arabic and code-switched Arabic/English text."],
    ["stu-ju-sara", "uni-ju", "prg-ju-cs", "0219945", "Sara Al-Najjar", "Year 2", 3.37, "Madaba", "Open to Internships",
      "Computer science student exploring data analysis and web development through coursework and side projects."],
    ["stu-just-ahmad", "uni-just", "prg-just-se", "125893", "Ahmad Obeidat", "Year 4", 3.62, "Irbid", "Open to Opportunities",
      "Software engineering student focused on backend systems — Java, Spring Boot, and well-tested APIs."],
    ["stu-just-noor", "uni-just", "prg-just-ai", "131472", "Noor Al-Momani", "Year 3", 3.74, "Irbid", "Open to Internships",
      "AI student interested in computer vision and time-series modeling."],
    ["stu-just-khaled", "uni-just", "prg-just-cyber", "130658", "Khaled Rawashdeh", "Year 3", 3.18, "Ramtha", "Open to Internships",
      "Cyber security student interested in infrastructure hardening, Linux administration, and risk assessment."],
    ["stu-asu-bashar", "uni-asu", "prg-asu-se", "202120374", "Bashar Qatamin", "Year 3", 3.29, "Amman", "Open to Internships",
      "Software engineering student who enjoys backend development and clean, testable code."],
    ["stu-asu-lujain", "uni-asu", "prg-asu-cs", "202010561", "Lujain Al-Tarawneh", "Year 4", 3.55, "Amman", "Open to Opportunities",
      "Computer science student interested in data engineering and database design."],
    ["stu-asu-mais", "uni-asu", "prg-asu-ai", "202320118", "Mais Khalil", "Year 2", 3.4, "Jerash", "Open to Internships",
      "AI student learning forecasting and machine learning through applied, real-data projects."],
  ]
  for (const s of students) {
    run(
      "INSERT INTO students (id, university_id, program_id, student_number, name, year, gpa, city, availability, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ...s,
    )
  }

  // ----------------------------------------------------------------- challenges
  type Hist = [status: string, day: number, note?: string]
  interface SeedChallenge {
    id: string
    company: string
    contact: string
    title: string
    problem: string
    objectives: string[]
    expected: string
    industry: string
    difficulty: string
    skills: string[]
    outcomes: string[]
    dataset: string
    sensitivity: string
    deadline: number
    preferred: string | null
    visibility: string
    requirements: string[]
    assignedUni: string | null
    assignedProgram: string | null
    history: Hist[]
  }

  const challenges: SeedChallenge[] = [
    {
      id: "chal-estarta-intent",
      company: "org-estarta",
      contact: "ctc-estarta-1",
      title: "Classify Customer Call Intents from Transcripts",
      problem:
        "Estarta's contact-center teams handle thousands of Arabic and English customer interactions a day across several client accounts. Supervisors tag call reasons by hand, which is slow and inconsistent. Estarta wants a model that reads anonymized call transcripts and predicts the customer's intent so calls can be routed and reported on automatically.",
      objectives: [
        "Explore and clean an anonymized set of bilingual (Arabic/English) call transcripts",
        "Build an intent classification model and compare it against a keyword baseline",
        "Evaluate accuracy per intent and per language",
        "Recommend how supervisors could use the predictions in daily reporting",
      ],
      expected: "A trained classifier with an evaluation notebook, a short technical report, and a stakeholder presentation.",
      industry: "Customer Experience & BPO",
      difficulty: "Advanced",
      skills: ["Python", "Natural Language Processing", "Machine Learning", "Data Analysis"],
      outcomes: [
        "Apply text preprocessing to mixed Arabic/English data",
        "Train and evaluate a multi-class classifier on real-world labels",
        "Communicate model limitations to non-technical supervisors",
      ],
      dataset: "≈18,000 anonymized, PII-scrubbed transcript snippets with supervisor-assigned intent labels (CSV)",
      sensitivity: "Moderate",
      deadline: -15,
      preferred: "uni-ju",
      visibility: "Public",
      requirements: ["Project report", "GitHub repository", "Presentation"],
      assignedUni: "uni-ju",
      assignedProgram: "prg-ju-ai",
      history: [
        ["Draft", -120],
        ["Sent to University", -120, SCREEN_NOTE],
        ["University Assigned", -114, "Assigned to B.Sc. Artificial Intelligence students at University of Jordan."],
        ["In Progress", -105, "Omar Al-Fayez started the project."],
        ["Evidence Under Review", -40, "WSL analyzed Omar Al-Fayez's submitted evidence automatically."],
        ["Verified", -36, "Every required skill verified by Dr. Hazem Al-Qudah and confirmed to Estarta HQ."],
        ["Company Feedback Received", -30, "Estarta HQ reviewed the evidence and left feedback."],
      ],
    },
    {
      id: "chal-estarta-access",
      company: "org-estarta",
      contact: "ctc-estarta-2",
      title: "Audit Remote Agent Access Security",
      problem:
        "Many of Estarta's agents work remotely or in hybrid shifts, connecting to client systems over VPN and virtual desktops. Estarta wants an independent review of how remote agent access is configured — using a sanitized lab replica of the setup — and a prioritized list of hardening steps.",
      objectives: [
        "Map the remote access architecture of the provided lab environment",
        "Assess VPN, VDI, and endpoint configurations against CIS Benchmarks",
        "Identify and rate risks using a standard likelihood/impact matrix",
        "Write a prioritized hardening plan",
      ],
      expected: "A risk assessment report with a prioritized remediation plan and supporting configuration evidence.",
      industry: "Customer Experience & BPO",
      difficulty: "Intermediate",
      skills: ["Network Security", "Risk Assessment", "Linux", "Technical Writing"],
      outcomes: [
        "Apply industry benchmarks to a realistic enterprise environment",
        "Practice structured risk rating and prioritization",
        "Write security findings for both technical and management readers",
      ],
      dataset: "Sanitized lab replica (VM images) and redacted configuration exports — no client data",
      sensitivity: "Moderate",
      deadline: 12,
      preferred: "uni-just",
      visibility: "University Only",
      requirements: ["Project report", "Documentation", "Analysis"],
      assignedUni: "uni-just",
      assignedProgram: "prg-just-cyber",
      history: [
        ["Draft", -50],
        ["Sent to University", -50, SCREEN_NOTE],
        ["University Assigned", -46, "Assigned to B.Sc. Cyber Security students at Jordan University of Science and Technology."],
        ["In Progress", -38, "Khaled Rawashdeh started the project."],
        ["Evidence Under Review", -3, "WSL analyzed Khaled Rawashdeh's submitted evidence automatically."],
        ["Skills Pending Verification", -2, "Dr. Rania Al-Shorman began reviewing Khaled Rawashdeh's skill signals."],
      ],
    },
    {
      id: "chal-echo-helpdesk",
      company: "org-echo",
      contact: "ctc-echo-1",
      title: "Build an Internal IT Helpdesk Ticketing Portal",
      problem:
        "Echo Technology's internal IT requests arrive through email and chat, so tickets get lost and nobody can see response times. Echo wants a lightweight web portal where employees raise tickets, IT staff triage and resolve them, and managers see basic SLA metrics.",
      objectives: [
        "Turn the provided user stories into requirements and a data model",
        "Design and document the REST API",
        "Build the web portal with role-based views for employees and IT staff",
        "Add an SLA dashboard and automated tests",
      ],
      expected: "A working web application with source code, API documentation, and a short walkthrough video.",
      industry: "IT Services & Software",
      difficulty: "Intermediate",
      skills: ["React", "Node.js", "SQL", "REST API Design"],
      outcomes: [
        "Deliver a full-stack application from requirements to deployment",
        "Design a clean, documented API with role-based access",
        "Practice automated testing on a real feature set",
      ],
      dataset: "Sample user stories and 6 months of anonymized ticket metadata (no message content)",
      sensitivity: "Low",
      deadline: 8,
      preferred: "uni-hu",
      visibility: "Public",
      requirements: ["GitHub repository", "Documentation", "Video Walkthrough"],
      assignedUni: "uni-hu",
      assignedProgram: "prg-hu-se",
      history: [
        ["Draft", -70],
        ["Sent to University", -70, SCREEN_NOTE],
        ["University Assigned", -65, "Assigned to B.Sc. Software Engineering students at The Hashemite University."],
        ["In Progress", -60, "Leen Al-Zoubi started the project."],
        ["Evidence Under Review", -9, "WSL analyzed Leen Al-Zoubi's submitted evidence automatically."],
        ["Verified", -6, "Every required skill verified by Dr. Mahmoud Al-Khasawneh and confirmed to Echo Technology."],
      ],
    },
    {
      id: "chal-iris-anomaly",
      company: "org-iris",
      contact: "ctc-iris-1",
      title: "Detect Anomalies in Network Traffic Logs",
      problem:
        "IRIS Technology Jordan monitors network infrastructure for several clients and wants to catch unusual traffic earlier. It is providing a labeled, anonymized set of firewall and NetFlow logs and wants a prototype that flags anomalous behavior with an explanation an analyst can act on.",
      objectives: [
        "Explore the anonymized firewall and NetFlow logs",
        "Engineer features that describe normal traffic behavior",
        "Build and evaluate an anomaly detection model against the labeled incidents",
        "Produce analyst-friendly alerts with a short explanation",
      ],
      expected: "A detection prototype, an evaluation notebook, and a report on false-positive trade-offs.",
      industry: "IT Solutions & Security",
      difficulty: "Advanced",
      skills: ["Python", "Machine Learning", "Network Security", "Data Analysis"],
      outcomes: [
        "Work with high-volume security telemetry",
        "Balance detection rate against analyst alert fatigue",
        "Explain model output to security operations staff",
      ],
      dataset: "30 days of anonymized firewall + NetFlow logs (~2.5M rows) with 41 labeled incidents",
      sensitivity: "Moderate",
      deadline: 18,
      preferred: "uni-aau",
      visibility: "University Only",
      requirements: ["Project report", "GitHub repository", "Analysis"],
      assignedUni: "uni-aau",
      assignedProgram: "prg-aau-cyber",
      history: [
        ["Draft", -55],
        ["Sent to University", -55, SCREEN_NOTE],
        ["University Assigned", -52, "Assigned to B.Sc. Cyber Security students at Amman Arab University."],
        ["In Progress", -48, "Yazan Al-Masri started the project."],
        ["Evidence Under Review", -2, "WSL analyzed Yazan Al-Masri's submitted evidence automatically."],
      ],
    },
    {
      id: "chal-iris-ssh",
      company: "org-iris",
      contact: "ctc-iris-1",
      title: "Triage SSH Brute-Force Attempts on Client Jump Hosts",
      problem:
        "IRIS's SOC sees thousands of failed SSH logins a day across client Linux jump hosts, and analysts waste time on noise. It is providing anonymized auth logs and wants a tool that groups attempts into attack campaigns, separates real threats from misconfigured scripts, and recommends host hardening.",
      objectives: [
        "Parse anonymized Linux auth logs into structured login attempts",
        "Group attempts into campaigns and score how dangerous each one is",
        "Recommend SSH hardening for the affected hosts",
      ],
      expected: "A log triage script, a short findings report, and a hardening checklist.",
      industry: "IT Solutions & Security",
      difficulty: "Intermediate",
      skills: ["Python", "Linux", "Network Security"],
      outcomes: [
        "Read real authentication telemetry",
        "Tell attack traffic apart from operational noise",
        "Turn findings into concrete hardening steps",
      ],
      dataset: "14 days of anonymized /var/log/auth.log extracts from 6 jump hosts (~380k lines)",
      sensitivity: "Moderate",
      deadline: -60,
      preferred: "uni-aau",
      visibility: "University Only",
      requirements: ["GitHub repository", "Project report"],
      assignedUni: "uni-aau",
      assignedProgram: "prg-aau-cyber",
      history: [
        ["Draft", -130],
        ["Sent to University", -130, SCREEN_NOTE],
        ["University Assigned", -126, "Assigned to B.Sc. Cyber Security students at Amman Arab University."],
        ["In Progress", -120, "Yazan Al-Masri started the project."],
        ["Evidence Under Review", -78, "WSL analyzed Yazan Al-Masri's submitted evidence automatically."],
        ["Verified", -74, "Every required skill verified by Dr. Nidal Al-Rawabdeh and confirmed to IRIS Technology Jordan."],
        ["Company Feedback Received", -70, "IRIS Technology Jordan reviewed the evidence and left feedback."],
      ],
    },
    {
      id: "chal-iris-phishing",
      company: "org-iris",
      contact: "ctc-iris-1",
      title: "Phishing Awareness Simulation & Reporting Dashboard",
      problem:
        "IRIS runs security awareness programs for client staff. It wants a tool to plan simulated phishing campaigns, track who clicked or reported, and show department-level awareness trends — without ever collecting real credentials.",
      objectives: [
        "Design a safe campaign workflow that never captures credentials",
        "Build a dashboard of click and report rates by department",
        "Propose a training follow-up flow for repeat clickers",
      ],
      expected: "A working prototype with documentation and a short ethics and safety note.",
      industry: "IT Solutions & Security",
      difficulty: "Intermediate",
      skills: ["Security Awareness", "Web Development", "Data Visualization"],
      outcomes: [
        "Design security tooling with privacy and ethics built in",
        "Turn behavioral data into actionable awareness metrics",
      ],
      dataset: "Synthetic employee directory and campaign event data generated for the challenge",
      sensitivity: "None (Public Dataset)",
      deadline: 40,
      preferred: "uni-hu",
      visibility: "Public",
      requirements: ["Prototype", "Documentation", "Presentation"],
      assignedUni: null,
      assignedProgram: null,
      history: [
        ["Draft", -3],
        ["Sent to University", -3, SCREEN_NOTE],
      ],
    },
    {
      id: "chal-skytech-inventory",
      company: "org-skytech",
      contact: "ctc-skytech-1",
      title: "Design an Inventory Microservice for an ERP Module",
      problem:
        "SkyTech Enterprise Systems is splitting the inventory module of its ERP product out of a monolith. It wants a standalone inventory microservice — stock levels, transfers between warehouses, and reorder alerts — with a clean API the rest of the ERP can call.",
      objectives: [
        "Model warehouses, items, stock movements, and reorder rules",
        "Implement the service with a documented REST API",
        "Write unit and integration tests for stock transfers",
        "Containerize the service and document deployment",
      ],
      expected: "Source code, API documentation, a test report, and a Docker setup.",
      industry: "Enterprise Software (ERP)",
      difficulty: "Advanced",
      skills: ["Java", "REST API Design", "SQL", "Software Testing"],
      outcomes: [
        "Decompose a monolith feature into a well-bounded service",
        "Handle concurrency and consistency in stock transactions",
        "Practice test-driven backend development",
      ],
      dataset: "Sample item master and 12 months of synthetic stock movements",
      sensitivity: "Low",
      deadline: -10,
      preferred: "uni-just",
      visibility: "Public",
      requirements: ["GitHub repository", "Documentation", "Code"],
      assignedUni: "uni-just",
      assignedProgram: "prg-just-se",
      history: [
        ["Draft", -140],
        ["Sent to University", -140, SCREEN_NOTE],
        ["University Assigned", -133, "Assigned to B.Sc. Software Engineering students at Jordan University of Science and Technology."],
        ["In Progress", -128, "Ahmad Obeidat started the project."],
        ["Evidence Under Review", -60, "WSL analyzed Ahmad Obeidat's submitted evidence automatically."],
        ["Verified", -56, "Every required skill verified by Dr. Waleed Al-Batayneh and confirmed to SkyTech Enterprise Systems."],
        ["Company Feedback Received", -50, "SkyTech Enterprise Systems reviewed the evidence and left feedback."],
      ],
    },
    {
      id: "chal-skytech-forecast",
      company: "org-skytech",
      contact: "ctc-skytech-2",
      title: "Forecast Spare-Parts Demand for ERP Clients",
      problem:
        "SkyTech's ERP clients in maintenance-heavy industries overstock slow-moving spare parts and run out of critical ones. SkyTech wants a demand forecasting approach it could add to its ERP's purchasing module.",
      objectives: [
        "Analyze intermittent demand patterns in the provided spare-parts history",
        "Compare classical (Croston) and machine learning forecasting methods",
        "Recommend reorder points per part category",
      ],
      expected: "A forecasting notebook, a method comparison report, and a recommendation summary.",
      industry: "Enterprise Software (ERP)",
      difficulty: "Intermediate",
      skills: ["Python", "Machine Learning", "Time-Series Forecasting", "Data Analysis"],
      outcomes: [
        "Work with intermittent, low-volume demand data",
        "Choose forecasting methods based on evidence, not habit",
      ],
      dataset: "3 years of anonymized monthly spare-parts consumption for 1,200 parts",
      sensitivity: "Low",
      deadline: 25,
      preferred: "uni-asu",
      visibility: "Public",
      requirements: ["Project report", "Analysis", "Presentation"],
      assignedUni: "uni-asu",
      assignedProgram: "prg-asu-ai",
      history: [
        ["Draft", -35],
        ["Sent to University", -35, SCREEN_NOTE],
        ["University Assigned", -30, "Assigned to B.Sc. Artificial Intelligence students at Applied Science Private University."],
        ["In Progress", -21, "Mais Khalil started the project."],
      ],
    },
    {
      id: "chal-skytech-rbac",
      company: "org-skytech",
      contact: "ctc-skytech-1",
      title: "Implement Role-Based Access Control for an ERP",
      problem:
        "SkyTech's ERP grants permissions user by user, which makes access hard to audit. SkyTech wants a role-based access control (RBAC) layer with role templates, separation-of-duties checks, and a full audit log.",
      objectives: [
        "Design the role and permission model with separation-of-duties rules",
        "Implement the RBAC service and an admin screen",
        "Log and report every permission change",
      ],
      expected: "Source code, a design document, and an audit report sample.",
      industry: "Enterprise Software (ERP)",
      difficulty: "Intermediate",
      skills: ["Java", "SQL", "Software Testing", "Access Control"],
      outcomes: [
        "Apply access-control principles in a real business system",
        "Design for auditability from the start",
      ],
      dataset: "Sample role catalog and synthetic user-permission assignments",
      sensitivity: "Low",
      deadline: 35,
      preferred: "uni-asu",
      visibility: "Public",
      requirements: ["GitHub repository", "Documentation", "Project report"],
      assignedUni: "uni-asu",
      assignedProgram: "prg-asu-se",
      history: [
        ["Draft", -12],
        ["Sent to University", -12, SCREEN_NOTE],
        ["University Assigned", -7, "Assigned to B.Sc. Software Engineering students at Applied Science Private University."],
      ],
    },
    {
      id: "chal-abs-bi",
      company: "org-abs",
      contact: "ctc-abs-1",
      title: "Build a Sales Performance BI Dashboard for SMEs",
      problem:
        "Advanced Business Solutions implements business software for small and medium retailers who struggle to read their own sales data. ABS wants a reusable BI dashboard template — sales by branch, product, and period, with margin and target tracking — that it can roll out to SME clients.",
      objectives: [
        "Model the provided sales extract into a star schema",
        "Write the SQL transformations and data-quality checks",
        "Build an interactive dashboard with drill-downs by branch and product",
        "Present insights and a rollout recommendation",
      ],
      expected: "A data model, SQL scripts, a Power BI dashboard file, and a short presentation.",
      industry: "Business Software & Analytics",
      difficulty: "Intermediate",
      skills: ["SQL", "Power BI", "Data Visualization", "Business Analysis"],
      outcomes: [
        "Design a dimensional model from raw transactional data",
        "Build dashboards around the decisions users actually make",
      ],
      dataset: "Anonymized 24-month sales extract from three sample retail clients (~150k rows)",
      sensitivity: "Low",
      deadline: 5,
      preferred: "uni-ju",
      visibility: "Public",
      requirements: ["Dataset / Model", "Prototype", "Presentation"],
      assignedUni: "uni-ju",
      assignedProgram: "prg-ju-bit",
      history: [
        ["Draft", -60],
        ["Sent to University", -60, SCREEN_NOTE],
        ["University Assigned", -56, "Assigned to B.Sc. Business Information Technology students at University of Jordan."],
        ["In Progress", -50, "Tala Haddad started the project."],
        ["Evidence Under Review", -8, "WSL analyzed Tala Haddad's submitted evidence automatically."],
        ["Completed", -4, "Reviewed by Dr. Manal Al-Ajlouni and confirmed to Advanced Business Solutions — one skill signal wasn't verified from the evidence provided."],
      ],
    },
    {
      id: "chal-abs-workflow",
      company: "org-abs",
      contact: "ctc-abs-1",
      title: "Digitize an Invoice Approval Workflow",
      problem:
        "Several ABS clients still approve supplier invoices on paper, causing late payments and lost documents. ABS wants a redesigned, digital approval workflow — from invoice capture to multi-level approval — that it can implement in its business software.",
      objectives: [
        "Model the current paper-based process (as-is) in BPMN",
        "Design an improved to-be workflow with approval rules",
        "Prototype the approval screens",
        "Estimate time savings for a typical client",
      ],
      expected: "BPMN models, a clickable prototype, and a one-page business case.",
      industry: "Business Software & Analytics",
      difficulty: "Foundational",
      skills: ["Business Analysis", "Process Modeling", "UI/UX Design", "SQL"],
      outcomes: [
        "Practice process analysis on a common business workflow",
        "Connect process design to measurable business value",
      ],
      dataset: "Sample invoice forms and approval matrices (fictionalized)",
      sensitivity: "None (Public Dataset)",
      deadline: 45,
      preferred: null,
      visibility: "Public",
      requirements: ["Documentation", "Prototype", "Presentation"],
      assignedUni: null,
      assignedProgram: null,
      history: [
        ["Draft", -1],
        ["Sent to University", -1, SCREEN_NOTE],
      ],
    },
    {
      id: "chal-echo-mobile",
      company: "org-echo",
      contact: "ctc-echo-2",
      title: "Field Technician Mobile App Prototype",
      problem:
        "Echo Technology's field technicians log site visits on paper and re-type them later. Echo wants a mobile app prototype for visit checklists, photos, and offline sync.",
      objectives: ["Map the technician visit workflow", "Prototype offline-first mobile screens", "Define the sync API"],
      expected: "A clickable mobile prototype and an API outline.",
      industry: "IT Services & Software",
      difficulty: "Intermediate",
      skills: ["Mobile Development", "UI/UX Design", "REST API Design"],
      outcomes: ["Design for unreliable connectivity", "Prototype with real field users in mind"],
      dataset: "To be confirmed during WSL's automatic screening.",
      sensitivity: "Low",
      deadline: 50,
      preferred: null,
      visibility: "Public",
      requirements: ["Prototype", "Documentation"],
      assignedUni: null,
      assignedProgram: null,
      history: [["Draft", -2]],
    },
    {
      id: "chal-skytech-maintenance",
      company: "org-skytech",
      contact: "ctc-skytech-2",
      title: "Build a Predictive Maintenance Dashboard for Field Equipment",
      problem:
        "SkyTech's field-service clients still schedule equipment maintenance on a fixed calendar, so some assets fail between visits while others get serviced early for no reason. SkyTech wants a small internal tool that predicts which assets are at risk soon, with the prediction exposed through an API the ERP's purchasing module can call.",
      objectives: [
        "Explore historical sensor and maintenance-log data for failure patterns",
        "Train a model that estimates failure risk per asset",
        "Visualize risk per asset for field managers",
        "Expose the predictions through a small REST API backed by the asset database",
      ],
      expected: "A working risk-prediction model, a visualization dashboard, and a documented REST API other SkyTech services can call.",
      industry: "Enterprise Software (ERP)",
      difficulty: "Advanced",
      skills: ["Python", "Machine Learning", "Data Visualization", "REST API Design", "SQL"],
      outcomes: [
        "Work across a small team: modeling, visualization, and integration",
        "Practice attributing individual contributions within one shared deliverable",
      ],
      dataset: "2 years of anonymized sensor readings and maintenance logs for 400 field assets",
      sensitivity: "Low",
      deadline: 20,
      preferred: "uni-ju",
      visibility: "Public",
      requirements: ["Project report", "GitHub repository", "Presentation"],
      assignedUni: "uni-ju",
      assignedProgram: "prg-ju-cs",
      history: [
        ["Draft", -35],
        ["Sent to University", -35, SCREEN_NOTE],
        ["University Assigned", -30, "Assigned to B.Sc. Computer Science students at University of Jordan."],
        ["In Progress", -20, "Sara Al-Najjar started the project."],
        ["Evidence Under Review", -3, "WSL analyzed the team's submitted evidence automatically."],
      ],
    },
  ]

  for (const c of challenges) {
    const status = c.history[c.history.length - 1][0]
    const sent = c.history.find((h) => h[0] === "Sent to University")
    run(
      `INSERT INTO challenges (id, company_id, contact_id, title, problem_description, objectives, expected_output, industry, difficulty,
        required_skills, learning_outcomes, dataset_availability, data_sensitivity, deadline, preferred_university_id, visibility,
        submission_requirements, status, created_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id, c.company, c.contact, c.title, c.problem, json(c.objectives), c.expected, c.industry, c.difficulty,
      json(c.skills), json(c.outcomes), c.dataset, c.sensitivity, d(c.deadline), c.preferred, c.visibility,
      json(c.requirements), status, d(c.history[0][1]), sent ? d(sent[1]) : null,
    )
    for (const [hStatus, day, note] of c.history) {
      run("INSERT INTO challenge_history (challenge_id, status, at, note) VALUES (?, ?, ?, ?)", c.id, hStatus, d(day), note ?? null)
    }
    if (c.assignedUni && c.assignedProgram) {
      const assigned = c.history.find((h) => h[0] === "University Assigned")!
      run(
        "INSERT INTO challenge_assignments (challenge_id, university_id, program_id, assigned_at) VALUES (?, ?, ?, ?)",
        c.id, c.assignedUni, c.assignedProgram, d(assigned[1]),
      )
    }
  }
  const objectivesOf = (id: string) => challenges.find((c) => c.id === id)!.objectives
  const challengeContextOf = (id: string) => {
    const c = challenges.find((ch) => ch.id === id)!
    return { problemDescription: c.problem, objectives: c.objectives, expectedOutput: c.expected }
  }

  // ------------------------------------------------------------------- projects
  // evidenceConfidence/aiNote/suggestedLevel aren't authored here — they come from
  // actually running WSL's real ML model (simulateAIReview) over this project's
  // evidence below, same as a live student submission would. The verification
  // decision (status/verifiedBy/reviewerNotes) IS authored, since that's an
  // independent human judgment call, not something the model produces.
  interface SeedEvidence { id: string; student?: string; type: string; title: string; description: string; day: number; content?: string }
  interface SeedSignal {
    skill: string
    status?: "Verified" | "More Evidence Requested" | "Rejected"
    verifiedBy?: string
    verifiedDay?: number
    reviewerNotes?: string
  }
  interface SeedProject {
    id: string
    challenge: string
    student: string
    members?: { student: string; roleNote: string }[]
    status: string
    started: number
    tasksDone: number
    evidence: SeedEvidence[]
    signals: SeedSignal[]
    analyzed?: number
    companyFeedback?: {
      day: number
      strongTechnicalExecution: boolean
      relevantForInternship: boolean
      interestedInSpeaking: boolean
      note: string
    }
    feedback: [kind: "staff" | "contact", authorId: string, day: number, note: string][]
  }

  const projects: SeedProject[] = [
    {
      id: "prj-estarta-intent-omar",
      challenge: "chal-estarta-intent",
      student: "stu-ju-omar",
      status: "Company Feedback Received",
      started: -105,
      tasksDone: 4,
      evidence: [
        { id: "ev-omar-1", type: "GitHub Repository", title: "call-intent-classifier", description: "Preprocessing pipeline for mixed Arabic/English text, a TF-IDF baseline, a fine-tuned Arabic BERT model, and evaluation scripts.", day: -44, content: `import re
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from transformers import AutoTokenizer, AutoModelForSequenceClassification

ARABIC_DIACRITICS = re.compile(r"[\\u0617-\\u061A\\u064B-\\u0652]")

def normalize_text(text: str) -> str:
    text = ARABIC_DIACRITICS.sub("", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text.lower()

df = pd.read_csv("call_transcripts.csv")
df["clean_text"] = df["transcript"].map(normalize_text)

vectorizer = TfidfVectorizer(max_features=20000, ngram_range=(1, 2))
X = vectorizer.fit_transform(df["clean_text"])
baseline = LogisticRegression(max_iter=1000, class_weight="balanced")
baseline.fit(X, df["intent_label"])

tokenizer = AutoTokenizer.from_pretrained("aubmindlab/bert-base-arabertv2")
model = AutoModelForSequenceClassification.from_pretrained(
    "aubmindlab/bert-base-arabertv2", num_labels=df["intent_label"].nunique()
)` },
        { id: "ev-omar-2", type: "Project Report", title: "Call Intent Classification — Final Report", description: "22-page report covering data cleaning, model comparison, per-language accuracy, and documented failure cases.", day: -42, content: `Data: 18,214 transcript snippets across 9 intents; "billing" and "technical issue" make up 58% of calls, so accuracy is reported per intent, not only overall.
Cleaning removed Arabic diacritics, normalized alef and taa marbuta variants, and dropped 412 snippets shorter than five words.
Results on the held-out 20%: the TF-IDF and logistic regression baseline reached macro F1 0.71; the fine-tuned Arabic BERT reached macro F1 0.84 (Arabic 0.82, English 0.88).
The weakest intent is "contract change" (F1 0.63), which is often confused with "billing" when customers mention a price.
Recommendation for supervisors: auto-tag calls when model confidence is above 0.8 (74% of calls) and review the rest by hand.` },
        { id: "ev-omar-3", type: "Presentation", title: "Supervisor Briefing — Automating Call Reason Tagging", description: "Slide deck for contact-center supervisors explaining what the model can and can't do, with a proposed reporting workflow.", day: -41 },
      ],
      signals: [
        { skill: "Python", status: "Verified", verifiedBy: "stf-ju-1", verifiedDay: -37, reviewerNotes: "Clean preprocessing and a real fine-tuned model, not just a baseline." },
        { skill: "Natural Language Processing", status: "Verified", verifiedBy: "stf-ju-1", verifiedDay: -37 },
        { skill: "Machine Learning", status: "Verified", verifiedBy: "stf-ju-1", verifiedDay: -37 },
        { skill: "Data Analysis", status: "Verified", verifiedBy: "stf-ju-1", verifiedDay: -37 },
      ],
      analyzed: -40,
      companyFeedback: {
        day: -30,
        strongTechnicalExecution: true,
        relevantForInternship: true,
        interestedInSpeaking: true,
        note: "The per-intent breakdown is exactly what our supervisors needed. We'd like to talk to Omar about our CX analytics internship.",
      },
      feedback: [
        ["staff", "stf-ju-1", -36, "Careful handling of dialectal Arabic and an honest error analysis. Confirmed to Estarta HQ."],
      ],
    },
    {
      id: "prj-estarta-access-khaled",
      challenge: "chal-estarta-access",
      student: "stu-just-khaled",
      status: "Skills Pending Verification",
      started: -38,
      tasksDone: 4,
      evidence: [
        { id: "ev-khaled-1", type: "Documentation", title: "Remote Access Architecture Map", description: "Diagrams and notes mapping VPN gateways, VDI pools, and agent endpoints in the lab replica.", day: -6 },
        { id: "ev-khaled-2", type: "Analysis", title: "CIS Benchmark Gap Assessment", description: "Control-by-control assessment of the VPN, VDI, and Linux jump-host configurations against CIS Benchmarks.", day: -5, content: `CIS 5.2.10 (SSH root login): FAIL. /etc/ssh/sshd_config on jump-01 has PermitRootLogin yes. Fix: set PermitRootLogin no and reload with sudo systemctl reload sshd.
CIS 5.2.4 (SSH access limited): FAIL. Any VPN user can reach port 22 on every host. Fix: restrict with ufw to the 10.30.5.0/24 admin VLAN.
CIS 4.1.3 (audit logins): PASS. auditd is running and /var/log/audit/audit.log is shipped to the SIEM.
VPN gateway: TLS 1.0 is still enabled for legacy agents, and split tunnelling lets agent laptops reach client systems and the internet at once.
VDI pools: clipboard and USB redirection are enabled, so client data can be copied to personal devices; MFA is enforced only for supervisors.` },
        { id: "ev-khaled-3", type: "Project Report", title: "Remote Agent Access — Risk Assessment & Hardening Plan", description: "Risk register with likelihood/impact ratings and a 3-phase hardening plan.", day: -4, content: `Overview: remote agents reach client systems through a VPN, a VDI pool and a Linux jump host. Twelve findings were rated by likelihood and impact.
Top risks: (1) root SSH login on the jump host, high likelihood and critical impact; (2) clipboard and USB redirection in VDI, medium likelihood and high impact; (3) MFA missing for agents, high likelihood and high impact.
Phase 1 (week 1): disable root SSH login, enforce MFA for every agent account, turn off TLS 1.0 on the VPN gateway.
Phase 2 (month 1): disable VDI clipboard and USB redirection for client pools and segment the admin VLAN.
Phase 3 (quarter): replace split tunnelling with full tunnelling and review access quarterly with each client.
Recommendation: Phase 1 removes the two critical findings for almost no cost and should start before the next client onboarding.` },
      ],
      signals: [
        { skill: "Network Security", status: "Verified", verifiedBy: "stf-just-2", verifiedDay: -2 },
        {
          skill: "Risk Assessment",
          status: "More Evidence Requested",
          verifiedBy: "stf-just-2",
          verifiedDay: -2,
          reviewerNotes: "The report mentions likelihood/impact ratings but not the methodology behind them — can you show the matrix you used?",
        },
        { skill: "Linux" },
        { skill: "Technical Writing" },
      ],
      analyzed: -3,
      feedback: [],
    },
    {
      id: "prj-echo-helpdesk-leen",
      challenge: "chal-echo-helpdesk",
      student: "stu-hu-leen",
      status: "Verified",
      started: -60,
      tasksDone: 4,
      evidence: [
        { id: "ev-leen-1", type: "GitHub Repository", title: "echo-helpdesk-portal", description: "React front end, Node.js/Express API, PostgreSQL schema and migrations, and a Jest/Supertest test suite.", day: -12, content: `// server/routes/tickets.js
const express = require("express")
const router = express.Router()
const db = require("../db")

router.post("/tickets", async (req, res) => {
  const { subject, description, priority, requesterId } = req.body
  const result = await db.query(
    "INSERT INTO tickets (subject, description, priority, requester_id, status) VALUES ($1, $2, $3, $4, 'open') RETURNING id",
    [subject, description, priority, requesterId],
  )
  res.status(201).json({ id: result.rows[0].id })
})

module.exports = router

// src/components/TicketList.jsx
function TicketList({ tickets, onSelect }) {
  return (
    <ul className="ticket-list">
      {tickets.map((t) => (
        <li key={t.id} onClick={() => onSelect(t.id)}>
          <span className={\`badge badge-\${t.priority}\`}>{t.priority}</span>
          {t.subject}
        </li>
      ))}
    </ul>
  )
}` },
        { id: "ev-leen-2", type: "Documentation", title: "Helpdesk API Reference (OpenAPI)", description: "OpenAPI 3 specification for every endpoint, with role permissions documented per route.", day: -11, content: `-- db/migrations/001_tickets.sql
CREATE TABLE tickets (
  id           SERIAL PRIMARY KEY,
  subject      TEXT NOT NULL,
  priority     TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'urgent')),
  requester_id INT NOT NULL REFERENCES employees(id),
  assignee_id  INT REFERENCES employees(id),
  status       TEXT NOT NULL DEFAULT 'open'
);

-- SLA dashboard: open tickets per agent past their response target
SELECT e.name, COUNT(*) AS breached
FROM tickets t
JOIN employees e ON e.id = t.assignee_id
WHERE t.status = 'open' AND t.created_at < now() - interval '8 hours'
GROUP BY e.name;

# openapi.yaml (excerpt)
/api/tickets/{id}:
  patch:
    summary: Update a ticket's status or assignee (agents and admins only)
    responses:
      "200": { description: Updated ticket }
      "403": { description: Employees can't reassign tickets }
      "404": { description: Ticket not found }` },
        { id: "ev-leen-3", type: "Video Walkthrough", title: "Portal Walkthrough Video", description: "6-minute walkthrough: raising a ticket, triage, resolution, and the SLA dashboard.", day: -10 },
      ],
      signals: [
        { skill: "React", status: "Verified", verifiedBy: "stf-hu-1", verifiedDay: -7 },
        { skill: "Node.js", status: "Verified", verifiedBy: "stf-hu-1", verifiedDay: -7 },
        { skill: "SQL", status: "Verified", verifiedBy: "stf-hu-1", verifiedDay: -7 },
        { skill: "REST API Design", status: "Verified", verifiedBy: "stf-hu-1", verifiedDay: -7, reviewerNotes: "Documented OpenAPI spec with role permissions per route." },
      ],
      analyzed: -9,
      feedback: [
        ["staff", "stf-hu-1", -6, "Clean architecture, solid test coverage, and the SLA dashboard works end to end. Confirmed to Echo Technology."],
      ],
    },
    {
      id: "prj-echo-helpdesk-dana",
      challenge: "chal-echo-helpdesk",
      student: "stu-hu-dana",
      status: "In Progress",
      started: -25,
      tasksDone: 2,
      evidence: [
        { id: "ev-dana-1", type: "GitHub Repository", title: "helpdesk-portal-wip", description: "Work in progress: data model, ticket CRUD endpoints, and the employee ticket form.", day: -4 },
      ],
      signals: [],
      feedback: [],
    },
    {
      id: "prj-iris-anomaly-yazan",
      challenge: "chal-iris-anomaly",
      student: "stu-aau-yazan",
      status: "Evidence Under Review",
      started: -48,
      tasksDone: 4,
      evidence: [
        { id: "ev-yazan-1", type: "GitHub Repository", title: "netflow-anomaly-detector", description: "Feature pipeline over NetFlow/firewall logs, Isolation Forest and autoencoder models, and an alert formatter.", day: -5, content: `import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

def extract_features(flows: pd.DataFrame) -> pd.DataFrame:
    flows["bytes_per_sec"] = flows["bytes"] / flows["duration"].clip(lower=1)
    flows["is_offhours"] = flows["hour"].between(0, 5).astype(int)
    return flows[["bytes_per_sec", "packets", "is_offhours", "unique_dst_ports"]]

flows = pd.read_parquet("netflow_logs.parquet")
X = extract_features(flows)
X_scaled = StandardScaler().fit_transform(X)

model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)
flows["anomaly_score"] = model.fit_predict(X_scaled)
alerts = flows[flows["anomaly_score"] == -1]
print(f"Flagged {len(alerts)} anomalous flows out of {len(flows)}")` },
        { id: "ev-yazan-2", type: "Analysis", title: "Feature Engineering & Model Evaluation Notebook", description: "Notebook comparing models against the 41 labeled incidents with precision/recall at several alert thresholds.", day: -4, content: `from sklearn.metrics import precision_score, recall_score

labels = pd.read_csv("labeled_incidents.csv")
scored = flows.merge(labels, on="flow_id", how="left").fillna({"is_incident": 0})
hourly = scored.groupby(["dst_port", "is_offhours"])["bytes_per_sec"].median()

for threshold in [0.01, 0.02, 0.05]:
    model = IsolationForest(n_estimators=300, contamination=threshold, random_state=42)
    pred = (model.fit_predict(X_scaled) == -1).astype(int)
    p = precision_score(scored["is_incident"], pred)
    r = recall_score(scored["is_incident"], pred)
    print(f"contamination={threshold}: precision={p:.2f} recall={r:.2f} alerts/day={pred.sum() / 30:.0f}")

# contamination=0.02 catches 37 of the 41 incidents at about 55 alerts a day, which the SOC can review.` },
        { id: "ev-yazan-3", type: "Project Report", title: "Anomaly Detection — False-Positive Trade-off Report", description: "Report recommending an alert threshold based on analyst workload, with example alerts and explanations.", day: -3, content: `Recommendation: run the detector at a 2% contamination threshold. It caught 37 of the 41 labeled incidents (90% recall) at 61% precision, about 55 alerts a day for a two-analyst shift.
The four missed incidents were slow port scans spread over several hours; a rolling 6-hour count of unique destination ports per source IP would catch them and is the next step.
False positives cluster around nightly backup jobs, so whitelisting the three backup servers removes roughly a third of them without losing any incident.
Each alert lists the top contributing features, for example: "10.4.2.17 sent 48x its usual bytes per second to an external IP at 03:10, outside working hours."` },
      ],
      signals: [
        { skill: "Python" },
        { skill: "Machine Learning" },
        { skill: "Network Security" },
        { skill: "Data Analysis" },
      ],
      analyzed: -2,
      feedback: [],
    },
    {
      id: "prj-iris-ssh-yazan",
      challenge: "chal-iris-ssh",
      student: "stu-aau-yazan",
      status: "Company Feedback Received",
      started: -120,
      tasksDone: 3,
      evidence: [
        { id: "ev-yazan-ssh-1", type: "GitHub Repository", title: "ssh-bruteforce-triage", description: "Auth-log parser, campaign grouping, and a danger score per campaign.", day: -80, content: `import re
from collections import defaultdict
from datetime import datetime, timedelta

FAILED = re.compile(r"Failed password for (invalid user )?(?P<user>\\S+) from (?P<ip>[\\d.]+) port (?P<port>\\d+)")

def parse_auth_log(path: str) -> list[dict]:
    attempts = []
    with open(path) as fh:
        for line in fh:
            m = FAILED.search(line)
            if m:
                ts = datetime.strptime(line[:15], "%b %d %H:%M:%S")
                attempts.append({"ts": ts, "ip": m["ip"], "user": m["user"], "invalid": bool(m.group(1))})
    return attempts

def group_campaigns(attempts: list[dict], gap=timedelta(minutes=30)) -> list[dict]:
    by_ip = defaultdict(list)
    for a in sorted(attempts, key=lambda a: a["ts"]):
        by_ip[a["ip"]].append(a)
    campaigns = []
    for ip, rows in by_ip.items():
        start = rows[0]
        for prev, cur in zip(rows, rows[1:] + [None]):
            if cur is None or cur["ts"] - prev["ts"] > gap:
                window = [r for r in rows if start["ts"] <= r["ts"] <= prev["ts"]]
                users = {r["user"] for r in window}
                score = len(window) * (2 if len(users) > 5 else 1) * (3 if "root" in users else 1)
                campaigns.append({"ip": ip, "attempts": len(window), "users": len(users), "score": score})
                start = cur
    return sorted(campaigns, key=lambda c: c["score"], reverse=True)` },
        { id: "ev-yazan-ssh-2", type: "Project Report", title: "Jump Host Hardening Findings", description: "Findings from 14 days of auth logs and a hardening checklist for the six hosts.", day: -79, content: `Findings: 92% of failed logins came from 41 source IPs in 6 campaigns; the largest tried 1,800 usernames against root and admin in 40 minutes.
Two "campaigns" were an internal backup script with an expired key, not an attack, so they are excluded from alerting.
Hardening checklist for every jump host:
1. In /etc/ssh/sshd_config set PermitRootLogin no and PasswordAuthentication no (key-only login).
2. sudo apt install fail2ban, with maxretry = 5 and bantime = 1h on the sshd jail.
3. sudo ufw allow from 10.20.0.0/16 to any port 22, then ufw deny 22 for everything else.
4. Forward /var/log/auth.log to the SIEM so new campaigns raise an alert within minutes.` },
      ],
      signals: [
        { skill: "Python", status: "Verified", verifiedBy: "stf-aau-1", verifiedDay: -75, reviewerNotes: "Clean parser and a sensible campaign grouping, not just a grep." },
        { skill: "Linux", status: "Verified", verifiedBy: "stf-aau-1", verifiedDay: -75 },
        { skill: "Network Security", status: "Verified", verifiedBy: "stf-aau-1", verifiedDay: -75, reviewerNotes: "Correctly separated the backup-script noise from real attacks." },
      ],
      analyzed: -78,
      companyFeedback: {
        day: -70,
        strongTechnicalExecution: true,
        relevantForInternship: true,
        interestedInSpeaking: false,
        note: "We rolled out the fail2ban and key-only settings on two client hosts. Spotting the backup script saved our analysts real time.",
      },
      feedback: [
        ["staff", "stf-aau-1", -74, "Strong, practical work that IRIS could use straight away. Confirmed to IRIS Technology Jordan."],
      ],
    },
    {
      id: "prj-iris-anomaly-rahaf",
      challenge: "chal-iris-anomaly",
      student: "stu-aau-rahaf",
      status: "In Progress",
      started: -30,
      tasksDone: 1,
      evidence: [],
      signals: [],
      feedback: [],
    },
    {
      id: "prj-skytech-inventory-ahmad",
      challenge: "chal-skytech-inventory",
      student: "stu-just-ahmad",
      status: "Company Feedback Received",
      started: -128,
      tasksDone: 4,
      evidence: [
        { id: "ev-ahmad-1", type: "GitHub Repository", title: "erp-inventory-service", description: "Spring Boot service with stock, transfer, and reorder-alert endpoints, Flyway migrations, and optimistic locking for transfers.", day: -64, content: `@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping("/transfers")
    public ResponseEntity<TransferResult> transferStock(@RequestBody @Valid TransferRequest request) {
        TransferResult result = inventoryService.transfer(
            request.getSourceWarehouseId(),
            request.getDestinationWarehouseId(),
            request.getSku(),
            request.getQuantity()
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{sku}/reorder-alert")
    public ResponseEntity<Boolean> needsReorder(@PathVariable String sku) {
        return ResponseEntity.ok(inventoryService.isBelowReorderThreshold(sku));
    }
}` },
        { id: "ev-ahmad-2", type: "Documentation", title: "Inventory Service API & Deployment Guide", description: "API reference, sequence diagrams for transfers, and Docker Compose deployment steps.", day: -63, content: `-- db/migration/V1__inventory.sql (Flyway)
CREATE TABLE warehouse (
    id   BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE
);
CREATE TABLE stock_level (
    warehouse_id BIGINT NOT NULL REFERENCES warehouse(id),
    sku          VARCHAR(40) NOT NULL,
    quantity     INT NOT NULL CHECK (quantity >= 0),
    version      BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (warehouse_id, sku)
);
CREATE INDEX idx_stock_sku ON stock_level (sku);

-- Reorder report used by GET /api/inventory/reorder-report
SELECT s.sku, SUM(s.quantity) AS on_hand, r.reorder_point
FROM stock_level s
JOIN reorder_rule r ON r.sku = s.sku
GROUP BY s.sku, r.reorder_point
HAVING SUM(s.quantity) < r.reorder_point;` },
        { id: "ev-ahmad-3", type: "Code", title: "Test Suite & Coverage Report", description: "JUnit and Testcontainers integration tests covering concurrent transfers; 87% line coverage.", day: -62, content: `@Testcontainers
class InventoryTransferConcurrencyTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

    @Test
    void concurrentTransfersDoNotOversell() throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch latch = new CountDownLatch(8);
        for (int i = 0; i < 8; i++) {
            pool.submit(() -> {
                inventoryService.transfer("WH-1", "WH-2", "SKU-100", 5);
                latch.countDown();
            });
        }
        latch.await();
        assertThat(inventoryService.getStock("WH-1", "SKU-100")).isGreaterThanOrEqualTo(0);
    }
}` },
      ],
      signals: [
        { skill: "Java", status: "Verified", verifiedBy: "stf-just-1", verifiedDay: -57 },
        { skill: "REST API Design", status: "Verified", verifiedBy: "stf-just-1", verifiedDay: -57 },
        { skill: "SQL", status: "Verified", verifiedBy: "stf-just-1", verifiedDay: -57 },
        { skill: "Software Testing", status: "Verified", verifiedBy: "stf-just-1", verifiedDay: -57, reviewerNotes: "Real concurrency tests with Testcontainers, not just unit tests — 87% coverage." },
      ],
      analyzed: -60,
      companyFeedback: {
        day: -50,
        strongTechnicalExecution: true,
        relevantForInternship: false,
        interestedInSpeaking: true,
        note: "Strong API design — the transfer endpoints handled our concurrency edge cases. Ahmad would be a fit for our graduate engineer track.",
      },
      feedback: [
        ["staff", "stf-just-1", -56, "Well-structured service with meaningful integration tests. Confirmed to SkyTech Enterprise Systems."],
      ],
    },
    {
      id: "prj-skytech-forecast-mais",
      challenge: "chal-skytech-forecast",
      student: "stu-asu-mais",
      status: "In Progress",
      started: -21,
      tasksDone: 1,
      evidence: [
        { id: "ev-mais-1", type: "Analysis", title: "Exploratory Analysis of Intermittent Demand", description: "Notebook classifying parts by demand pattern (smooth, erratic, intermittent, lumpy) with summary charts.", day: -6 },
      ],
      signals: [],
      feedback: [],
    },
    {
      id: "prj-abs-bi-tala",
      challenge: "chal-abs-bi",
      student: "stu-ju-tala",
      status: "Completed",
      started: -50,
      tasksDone: 4,
      evidence: [
        { id: "ev-tala-1", type: "Dataset / Model", title: "Sales Star Schema & SQL Transformations", description: "Star schema (sales fact, product/branch/date dimensions), SQL transformation scripts, and data-quality checks.", day: -11, content: `CREATE TABLE dim_product (
    product_id   INT PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    category     VARCHAR(100) NOT NULL
);

CREATE TABLE fact_sales (
    sale_id     BIGINT PRIMARY KEY,
    product_id  INT REFERENCES dim_product(product_id),
    branch_id   INT REFERENCES dim_branch(branch_id),
    date_id     INT REFERENCES dim_date(date_id),
    quantity    INT NOT NULL,
    revenue     DECIMAL(12, 2) NOT NULL,
    margin      DECIMAL(12, 2) NOT NULL
);

INSERT INTO fact_sales (sale_id, product_id, branch_id, date_id, quantity, revenue, margin)
SELECT
    s.id,
    p.product_id,
    b.branch_id,
    d.date_id,
    s.qty,
    s.qty * p.unit_price,
    s.qty * (p.unit_price - p.unit_cost)
FROM raw_sales s
JOIN dim_product p ON p.sku = s.sku
JOIN dim_branch b ON b.branch_code = s.branch_code
JOIN dim_date d ON d.calendar_date = s.sale_date
WHERE s.qty > 0;` },
        { id: "ev-tala-2", type: "Prototype", title: "SME Sales Dashboard (Power BI)", description: "Interactive dashboard with branch and product drill-downs, margin tracking, and target vs. actual views.", day: -10, content: `Dashboard design notes
Page 1, Overview: KPI cards for revenue, margin % and target attainment; a line chart of monthly revenue against target; a bar chart of margin by branch.
Page 2, Products: a heatmap of margin by category and month, with a drill-down from category to product.
Slicers for branch, region and month apply to every visual, and tooltips show last year's value for the same month.
Insight from the sample clients: two branches sell the most but have the lowest margin because of discounting on electronics, so the recommendation is to cap discounts there before expanding stock.` },
        { id: "ev-tala-3", type: "Presentation", title: "Dashboard Rollout Recommendation", description: "Short deck on insights from the sample clients and how ABS could roll the template out.", day: -9 },
      ],
      signals: [
        { skill: "SQL", status: "Verified", verifiedBy: "stf-ju-2", verifiedDay: -5 },
        {
          skill: "Power BI",
          status: "Rejected",
          verifiedBy: "stf-ju-2",
          verifiedDay: -5,
          reviewerNotes: "The dashboard link works, but there's no description of the data model or refresh process to verify from the evidence alone — please add a short write-up.",
        },
        { skill: "Data Visualization", status: "Verified", verifiedBy: "stf-ju-2", verifiedDay: -5 },
        { skill: "Business Analysis", status: "Verified", verifiedBy: "stf-ju-2", verifiedDay: -5 },
      ],
      analyzed: -8,
      feedback: [
        ["staff", "stf-ju-2", -4, "Thoughtful data model and a dashboard a store manager could actually use. Confirmed to Advanced Business Solutions — the Power BI signal needs more evidence to verify."],
      ],
    },
    {
      id: "prj-skytech-maintenance-sara",
      challenge: "chal-skytech-maintenance",
      student: "stu-ju-sara",
      // A team project: Sara owns it, Omar and Ahmad contribute specific, individually
      // attributed parts — evidence below is submitted by whichever member actually did
      // the work, not pooled under the owner.
      members: [
        { student: "stu-ju-omar", roleNote: "Python preprocessing and ML model training for the risk score" },
        { student: "stu-just-ahmad", roleNote: "REST API integration and database design for the asset store" },
      ],
      status: "Evidence Under Review",
      started: -20,
      tasksDone: 2,
      evidence: [
        {
          id: "ev-maint-1",
          student: "stu-ju-omar",
          type: "Code",
          title: "risk_model.py",
          description: "Feature engineering over sensor/maintenance logs and a gradient-boosted risk score per asset.",
          day: -6,
          content: `import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split

def build_features(logs: pd.DataFrame) -> pd.DataFrame:
    logs["days_since_service"] = (logs["as_of"] - logs["last_service"]).dt.days
    logs["vibration_trend"] = logs.groupby("asset_id")["vibration_rms"].diff().fillna(0)
    return logs[["days_since_service", "vibration_trend", "runtime_hours", "temperature_max"]]

logs = pd.read_csv("maintenance_logs.csv", parse_dates=["as_of", "last_service"])
X = build_features(logs)
y = logs["failed_within_30d"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=7)
model = GradientBoostingClassifier(n_estimators=200, max_depth=3)
model.fit(X_train, y_train)

logs["risk_score"] = model.predict_proba(X)[:, 1]
logs[["asset_id", "risk_score"]].to_csv("asset_risk_scores.csv", index=False)
`,
        },
        {
          id: "ev-maint-2",
          student: "stu-just-ahmad",
          type: "Documentation",
          title: "Asset Risk API Reference",
          description: "REST endpoints exposing per-asset risk scores and the underlying asset/maintenance database schema for the ERP purchasing module to call.",
          day: -4,
          content: `# Asset Risk API

GET /api/assets/{assetId}/risk
  -> { "assetId": string, "riskScore": number, "asOf": string }

GET /api/assets/at-risk?threshold=0.7
  -> list of assets above the given risk threshold, sorted by riskScore desc

Backed by the asset and maintenance_log tables (see schema.sql) — the purchasing
module polls /at-risk daily to flag parts to stock ahead of a likely failure.
`,
        },
      ],
      signals: [
        { skill: "Python" },
        { skill: "Machine Learning" },
        { skill: "Data Visualization" },
        { skill: "REST API Design" },
        { skill: "SQL" },
      ],
      analyzed: -3,
      feedback: [],
    },
  ]

  for (const p of projects) {
    run("INSERT INTO projects (id, challenge_id, student_id, status, started_at) VALUES (?, ?, ?, ?, ?)", p.id, p.challenge, p.student, p.status, d(p.started))
    objectivesOf(p.challenge).forEach((title, i) => {
      run("INSERT INTO project_tasks (id, project_id, position, title, done) VALUES (?, ?, ?, ?, ?)", `${p.id}-t${i + 1}`, p.id, i, title, i < p.tasksDone ? 1 : 0)
    })
    for (const m of p.members ?? []) {
      run("INSERT INTO project_members (project_id, student_id, role_note, added_at) VALUES (?, ?, ?, ?)", p.id, m.student, m.roleNote, d(p.started))
    }
    for (const e of p.evidence) {
      run(
        "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, content, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        e.id, p.id, e.student ?? p.student, e.type, e.title, e.description, EVIDENCE_LINKS[e.id], e.content ?? null, d(e.day),
      )
    }
    if (p.signals.length > 0) {
      const results = simulateAIReview(
        p.signals.map((s) => s.skill),
        p.evidence.map((e) => ({ id: e.id, type: e.type, title: e.title, description: e.description, content: e.content })),
        challengeContextOf(p.challenge),
      )
      p.signals.forEach((s, i) => {
        const r = results[i]
        const sigId = `sig-${p.id}-${i + 1}`
        const status = s.status ?? "Pending Verification"
        run(
          `INSERT INTO skill_signals (id, project_id, student_id, skill, evidence_confidence, ai_note, ai_quotes, ai_criteria, suggested_level, status, verified_by, verified_at, reviewer_notes, analyzed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sigId, p.id, p.student, s.skill, r.rating, r.note, JSON.stringify(r.quotes), JSON.stringify(r.criteria), r.suggestedLevel, status,
          s.verifiedBy ?? null, s.verifiedBy && s.verifiedDay !== undefined ? d(s.verifiedDay) : null, s.reviewerNotes ?? null, d(p.analyzed!),
        )
        for (const ev of r.evidenceIds) run("INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, ?)", sigId, ev)
      })
    }
    if (p.companyFeedback) {
      const cf = p.companyFeedback
      const contactId = challenges.find((c) => c.id === p.challenge)!.contact
      run(
        `INSERT INTO company_feedback (id, project_id, contact_id, strong_technical_execution, relevant_for_internship, interested_in_speaking, note, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `cf-${p.id}`, p.id, contactId, cf.strongTechnicalExecution ? 1 : 0, cf.relevantForInternship ? 1 : 0, cf.interestedInSpeaking ? 1 : 0, cf.note, d(cf.day), d(cf.day),
      )
    }
    p.feedback.forEach(([kind, author, day, note], i) => {
      run("INSERT INTO feedback (id, project_id, author_kind, author_id, note, at) VALUES (?, ?, ?, ?, ?, ?)", `fb-${p.id}-${i + 1}`, p.id, kind, author, note, d(day))
    })
  }

  // -------------------------------------------------------------- opportunities
  const opportunities: [string, string, string, string, string, string[], string, number][] = [
    ["opp-estarta-cx", "org-estarta", "CX Data Analyst Intern", "Internship", "Amman, Jordan (Hybrid)", ["Python", "Data Analysis", "Natural Language Processing"],
      "Join the analytics team turning contact-center interactions into insight for client accounts — call-reason trends, sentiment, and quality metrics.", -10],
    ["opp-estarta-sec", "org-estarta", "Junior Information Security Analyst", "Full-time", "Amman, Jordan", ["Network Security", "Risk Assessment", "Linux"],
      "Support the information security team with access reviews, vulnerability tracking, and hardening of agent workstations and remote access.", -18],
    ["opp-echo-fullstack", "org-echo", "Junior Full-Stack Developer", "Full-time", "Amman, Jordan", ["React", "Node.js", "SQL", "REST API Design"],
      "Build and maintain web applications for Echo Technology's clients, from API design through front-end delivery.", -7],
    ["opp-iris-soc", "org-iris", "SOC Analyst Trainee", "Internship", "Amman, Jordan", ["Network Security", "Python", "Data Analysis"],
      "Work alongside the security operations team triaging alerts, tuning detections, and writing small automation scripts.", -14],
    ["opp-skytech-grad", "org-skytech", "Graduate Software Engineer — ERP Platform", "Full-time", "Amman, Jordan", ["Java", "REST API Design", "SQL", "Software Testing"],
      "Join the platform team building the services behind SkyTech's ERP modules — inventory, purchasing, and finance.", -21],
    ["opp-abs-bi", "org-abs", "BI Developer Intern", "Internship", "Amman, Jordan (Hybrid)", ["SQL", "Power BI", "Data Visualization"],
      "Help build reporting and dashboard solutions for ABS's SME clients, from data modeling to final visuals.", -5],
  ]
  for (const o of opportunities) {
    run(
      "INSERT INTO opportunities (id, company_id, title, type, location, required_skills, description, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      o[0], o[1], o[2], o[3], o[4], json(o[5]), o[6], d(o[7]),
    )
  }

  // ---------------------------------------------------------- company actions
  // Lightweight engagement a company can take on a candidate — no email, no
  // accept/reject flow, just a recorded action (see POST /students/:id/company-actions).
  const companyActions: [id: string, company: string, student: string, kind: string, opportunity: string | null, note: string | null, day: number][] = [
    ["cact-echo-leen", "org-echo", "stu-hu-leen", "saved", null, null, -5],
    ["cact-skytech-ahmad", "org-skytech", "stu-just-ahmad", "interested", null, null, -49],
    ["cact-estarta-omar", "org-estarta", "stu-ju-omar", "invited", "opp-estarta-cx", "Following up on our note — we'd love to talk through the CX Data Analyst Intern role with you.", -28],
  ]
  for (const [id, company, student, kind, opportunity, note, day] of companyActions) {
    run(
      "INSERT INTO company_actions (id, company_id, student_id, kind, opportunity_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, company, student, kind, opportunity, note, d(day),
    )
  }

  // -------------------------------------------------------------- notifications
  // Mirrors what the live system would have sent for the events seeded above.
  const notifications: [role: string, recipient: string, title: string, body: string, link: string | null, day: number, read: number][] = [
    ["company", "org-estarta", "Student started your challenge", "Khaled Rawashdeh (JUST) started “Audit Remote Agent Access Security”.", "/company/challenges/chal-estarta-access", -38, 1],
    ["company", "org-echo", "Submission ready for your review", "The Hashemite University confirmed Leen Al-Zoubi's submission for “Build an Internal IT Helpdesk Ticketing Portal”.", "/company/submissions/prj-echo-helpdesk-leen", -6, 0],
    ["company", "org-iris", "Challenge assigned", "Amman Arab University assigned “Detect Anomalies in Network Traffic Logs” to B.Sc. Cyber Security students.", "/company/challenges/chal-iris-anomaly", -52, 1],
    ["company", "org-skytech", "Challenge assigned", "Applied Science Private University assigned “Implement Role-Based Access Control for an ERP” to B.Sc. Software Engineering students.", "/company/challenges/chal-skytech-rbac", -7, 0],
    ["company", "org-skytech", "Student started your challenge", "Mais Khalil (ASU) started “Forecast Spare-Parts Demand for ERP Clients”.", "/company/challenges/chal-skytech-forecast", -21, 1],
    ["company", "org-abs", "Submission ready for your review", "University of Jordan confirmed Tala Haddad's submission for “Build a Sales Performance BI Dashboard for SMEs”.", "/company/submissions/prj-abs-bi-tala", -4, 0],
    ["university", "uni-aau", "Evidence signals ready for review", "WSL found evidence signals in Yazan Al-Masri's submission for “Detect Anomalies in Network Traffic Logs”.", "/university/projects/prj-iris-anomaly-yazan", -2, 0],
    ["university", "uni-just", "Evidence signals ready for review", "WSL found evidence signals in Khaled Rawashdeh's submission for “Audit Remote Agent Access Security”.", "/university/projects/prj-estarta-access-khaled", -3, 0],
    ["university", "uni-hu", "New challenge received", "IRIS Technology Jordan sent “Phishing Awareness Simulation & Reporting Dashboard”.", "/university/challenges/chal-iris-phishing", -3, 0],
    ["university", "uni-ju", "Company sent feedback on your student's work", "Estarta HQ sent feedback on Omar Al-Fayez's submission for “Classify Customer Call Intents from Transcripts”.", "/university/projects/prj-estarta-intent-omar", -30, 1],
    ["student", "stu-ju-omar", "Estarta HQ sent feedback", "Your submission for “Classify Customer Call Intents from Transcripts” received company feedback.", "/student/projects/prj-estarta-intent-omar", -30, 1],
    ["student", "stu-hu-leen", "Submission confirmed to Echo Technology", "Dr. Mahmoud Al-Khasawneh confirmed your helpdesk portal submission to the company.", "/student/projects/prj-echo-helpdesk-leen", -6, 0],
    ["student", "stu-ju-tala", "Submission confirmed to Advanced Business Solutions", "Dr. Manal Al-Ajlouni confirmed your BI dashboard submission to the company.", "/student/projects/prj-abs-bi-tala", -4, 0],
    ["student", "stu-just-ahmad", "SkyTech Enterprise Systems sent feedback", "Your inventory microservice submission received company feedback.", "/student/projects/prj-skytech-inventory-ahmad", -50, 1],
    ["student", "stu-asu-bashar", "New challenge available", "“Implement Role-Based Access Control for an ERP” from SkyTech Enterprise Systems was assigned to your program.", "/student/challenges/chal-skytech-rbac", -7, 0],
  ]
  // A challenge with no university preference reaches every university.
  for (const u of universities) {
    notifications.push(["university", u.id, "New challenge received", "Advanced Business Solutions sent “Digitize an Invoice Approval Workflow”.", "/university/challenges/chal-abs-workflow", -1, 0])
  }
  notifications.forEach(([role, recipient, title, body, link, day, read], i) => {
    run(
      "INSERT INTO notifications (id, recipient_role, recipient_id, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      `ntf-seed-${i + 1}`, role, recipient, title, body, link, read, d(day),
    )
  })
}
