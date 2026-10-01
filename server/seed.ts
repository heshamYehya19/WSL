import type { DatabaseSync } from "node:sqlite"

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
  "ev-ahmad-1": "github.com/ahmad-obeidat/erp-inventory-service",
  "ev-ahmad-2": "drive.google.com/file/d/1Pw3kR8vLx5QmT2zN7bC4sJhE9fY6gA0dK/view",
  "ev-ahmad-3": "github.com/ahmad-obeidat/erp-inventory-service/tree/main/src/test",
  "ev-mais-1": "colab.research.google.com/drive/1Lq8vT3mXz6KpR2wN9bC5sJhE4fY7gA0dP",
  "ev-tala-1": "github.com/tala-haddad/sme-sales-model",
  "ev-tala-2": "drive.google.com/file/d/1Nf5wQ9kLx2TmR7zV3bC8sJhE6fY4gA0dM/view",
  "ev-tala-3": "docs.google.com/presentation/d/1Gy7tR2wQp4LmX9zN5bC3sJhE8fK6vA0dT/view",
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
        ["Submissions Under Review", -40, "WSL rated Omar Al-Fayez's submitted evidence automatically."],
        ["Confirmed to Company", -36, "Reviewed by Dr. Hazem Al-Qudah and confirmed to Estarta HQ."],
        ["Company Reviewed", -30, "Estarta HQ reviewed the submission and gave its own rating."],
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
        ["Submissions Under Review", -3, "WSL rated Khaled Rawashdeh's submitted evidence automatically."],
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
        ["Submissions Under Review", -9, "WSL rated Leen Al-Zoubi's submitted evidence automatically."],
        ["Confirmed to Company", -6, "Reviewed by Dr. Mahmoud Al-Khasawneh and confirmed to Echo Technology."],
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
        ["Submissions Under Review", -2, "WSL rated Yazan Al-Masri's submitted evidence automatically."],
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
        ["Submissions Under Review", -60, "WSL rated Ahmad Obeidat's submitted evidence automatically."],
        ["Confirmed to Company", -56, "Reviewed by Dr. Waleed Al-Batayneh and confirmed to SkyTech Enterprise Systems."],
        ["Company Reviewed", -50, "SkyTech Enterprise Systems reviewed the submission and gave its own rating."],
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
        ["Submissions Under Review", -8, "WSL rated Tala Haddad's submitted evidence automatically."],
        ["Confirmed to Company", -4, "Reviewed by Dr. Manal Al-Ajlouni and confirmed to Advanced Business Solutions."],
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

  // ------------------------------------------------------------------- projects
  interface SeedEvidence { id: string; type: string; title: string; description: string; day: number }
  interface SeedSignal { skill: string; ai: number; company?: number; evidence: string[] }
  interface SeedProject {
    id: string
    challenge: string
    student: string
    status: string
    started: number
    tasksDone: number
    evidence: SeedEvidence[]
    signals: SeedSignal[]
    analyzed?: number
    companyRated?: number
    feedback: [kind: "staff" | "contact", authorId: string, day: number, note: string][]
  }

  const projects: SeedProject[] = [
    {
      id: "prj-estarta-intent-omar",
      challenge: "chal-estarta-intent",
      student: "stu-ju-omar",
      status: "Company Reviewed",
      started: -105,
      tasksDone: 4,
      evidence: [
        { id: "ev-omar-1", type: "GitHub Repository", title: "call-intent-classifier", description: "Preprocessing pipeline for mixed Arabic/English text, a TF-IDF baseline, a fine-tuned Arabic BERT model, and evaluation scripts.", day: -44 },
        { id: "ev-omar-2", type: "Project Report", title: "Call Intent Classification — Final Report", description: "22-page report covering data cleaning, model comparison, per-language accuracy, and documented failure cases.", day: -42 },
        { id: "ev-omar-3", type: "Presentation", title: "Supervisor Briefing — Automating Call Reason Tagging", description: "Slide deck for contact-center supervisors explaining what the model can and can't do, with a proposed reporting workflow.", day: -41 },
      ],
      signals: [
        { skill: "Python", ai: 91, company: 90, evidence: ["ev-omar-1"] },
        { skill: "Natural Language Processing", ai: 88, company: 92, evidence: ["ev-omar-1", "ev-omar-2"] },
        { skill: "Machine Learning", ai: 86, company: 85, evidence: ["ev-omar-1", "ev-omar-2"] },
        { skill: "Data Analysis", ai: 84, company: 88, evidence: ["ev-omar-2", "ev-omar-3"] },
      ],
      analyzed: -40,
      companyRated: -30,
      feedback: [
        ["staff", "stf-ju-1", -36, "Careful handling of dialectal Arabic and an honest error analysis. Confirmed to Estarta HQ."],
        ["contact", "ctc-estarta-1", -30, "The per-intent breakdown is exactly what our supervisors needed. We'd like to talk to Omar about our CX analytics internship."],
      ],
    },
    {
      id: "prj-estarta-access-khaled",
      challenge: "chal-estarta-access",
      student: "stu-just-khaled",
      status: "Submissions Under Review",
      started: -38,
      tasksDone: 4,
      evidence: [
        { id: "ev-khaled-1", type: "Documentation", title: "Remote Access Architecture Map", description: "Diagrams and notes mapping VPN gateways, VDI pools, and agent endpoints in the lab replica.", day: -6 },
        { id: "ev-khaled-2", type: "Analysis", title: "CIS Benchmark Gap Assessment", description: "Control-by-control assessment of the VPN, VDI, and Linux jump-host configurations against CIS Benchmarks.", day: -5 },
        { id: "ev-khaled-3", type: "Project Report", title: "Remote Agent Access — Risk Assessment & Hardening Plan", description: "Risk register with likelihood/impact ratings and a 3-phase hardening plan.", day: -4 },
      ],
      signals: [
        { skill: "Network Security", ai: 87, evidence: ["ev-khaled-1", "ev-khaled-2"] },
        { skill: "Risk Assessment", ai: 83, evidence: ["ev-khaled-3"] },
        { skill: "Linux", ai: 79, evidence: ["ev-khaled-2"] },
        { skill: "Technical Writing", ai: 81, evidence: ["ev-khaled-3"] },
      ],
      analyzed: -3,
      feedback: [],
    },
    {
      id: "prj-echo-helpdesk-leen",
      challenge: "chal-echo-helpdesk",
      student: "stu-hu-leen",
      status: "Confirmed to Company",
      started: -60,
      tasksDone: 4,
      evidence: [
        { id: "ev-leen-1", type: "GitHub Repository", title: "echo-helpdesk-portal", description: "React front end, Node.js/Express API, PostgreSQL schema and migrations, and a Jest/Supertest test suite.", day: -12 },
        { id: "ev-leen-2", type: "Documentation", title: "Helpdesk API Reference (OpenAPI)", description: "OpenAPI 3 specification for every endpoint, with role permissions documented per route.", day: -11 },
        { id: "ev-leen-3", type: "Video Walkthrough", title: "Portal Walkthrough Video", description: "6-minute walkthrough: raising a ticket, triage, resolution, and the SLA dashboard.", day: -10 },
      ],
      signals: [
        { skill: "React", ai: 90, evidence: ["ev-leen-1", "ev-leen-3"] },
        { skill: "Node.js", ai: 87, evidence: ["ev-leen-1"] },
        { skill: "SQL", ai: 82, evidence: ["ev-leen-1"] },
        { skill: "REST API Design", ai: 89, evidence: ["ev-leen-1", "ev-leen-2"] },
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
      status: "Submissions Under Review",
      started: -48,
      tasksDone: 4,
      evidence: [
        { id: "ev-yazan-1", type: "GitHub Repository", title: "netflow-anomaly-detector", description: "Feature pipeline over NetFlow/firewall logs, Isolation Forest and autoencoder models, and an alert formatter.", day: -5 },
        { id: "ev-yazan-2", type: "Analysis", title: "Feature Engineering & Model Evaluation Notebook", description: "Notebook comparing models against the 41 labeled incidents with precision/recall at several alert thresholds.", day: -4 },
        { id: "ev-yazan-3", type: "Project Report", title: "Anomaly Detection — False-Positive Trade-off Report", description: "Report recommending an alert threshold based on analyst workload, with example alerts and explanations.", day: -3 },
      ],
      signals: [
        { skill: "Python", ai: 85, evidence: ["ev-yazan-1"] },
        { skill: "Machine Learning", ai: 82, evidence: ["ev-yazan-1", "ev-yazan-2"] },
        { skill: "Network Security", ai: 90, evidence: ["ev-yazan-1", "ev-yazan-3"] },
        { skill: "Data Analysis", ai: 84, evidence: ["ev-yazan-2"] },
      ],
      analyzed: -2,
      feedback: [],
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
      status: "Company Reviewed",
      started: -128,
      tasksDone: 4,
      evidence: [
        { id: "ev-ahmad-1", type: "GitHub Repository", title: "erp-inventory-service", description: "Spring Boot service with stock, transfer, and reorder-alert endpoints, Flyway migrations, and optimistic locking for transfers.", day: -64 },
        { id: "ev-ahmad-2", type: "Documentation", title: "Inventory Service API & Deployment Guide", description: "API reference, sequence diagrams for transfers, and Docker Compose deployment steps.", day: -63 },
        { id: "ev-ahmad-3", type: "Code", title: "Test Suite & Coverage Report", description: "JUnit and Testcontainers integration tests covering concurrent transfers; 87% line coverage.", day: -62 },
      ],
      signals: [
        { skill: "Java", ai: 89, company: 91, evidence: ["ev-ahmad-1", "ev-ahmad-3"] },
        { skill: "REST API Design", ai: 92, company: 94, evidence: ["ev-ahmad-1", "ev-ahmad-2"] },
        { skill: "SQL", ai: 84, company: 82, evidence: ["ev-ahmad-1"] },
        { skill: "Software Testing", ai: 86, company: 88, evidence: ["ev-ahmad-3"] },
      ],
      analyzed: -60,
      companyRated: -50,
      feedback: [
        ["staff", "stf-just-1", -56, "Well-structured service with meaningful integration tests. Confirmed to SkyTech Enterprise Systems."],
        ["contact", "ctc-skytech-1", -50, "Strong API design — the transfer endpoints handled our concurrency edge cases. Ahmad would be a fit for our graduate engineer track."],
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
      status: "Confirmed to Company",
      started: -50,
      tasksDone: 4,
      evidence: [
        { id: "ev-tala-1", type: "Dataset / Model", title: "Sales Star Schema & SQL Transformations", description: "Star schema (sales fact, product/branch/date dimensions), SQL transformation scripts, and data-quality checks.", day: -11 },
        { id: "ev-tala-2", type: "Prototype", title: "SME Sales Dashboard (Power BI)", description: "Interactive dashboard with branch and product drill-downs, margin tracking, and target vs. actual views.", day: -10 },
        { id: "ev-tala-3", type: "Presentation", title: "Dashboard Rollout Recommendation", description: "Short deck on insights from the sample clients and how ABS could roll the template out.", day: -9 },
      ],
      signals: [
        { skill: "SQL", ai: 86, evidence: ["ev-tala-1"] },
        { skill: "Power BI", ai: 91, evidence: ["ev-tala-2"] },
        { skill: "Data Visualization", ai: 89, evidence: ["ev-tala-2", "ev-tala-3"] },
        { skill: "Business Analysis", ai: 83, evidence: ["ev-tala-3"] },
      ],
      analyzed: -8,
      feedback: [
        ["staff", "stf-ju-2", -4, "Thoughtful data model and a dashboard a store manager could actually use. Confirmed to Advanced Business Solutions."],
      ],
    },
  ]

  for (const p of projects) {
    run("INSERT INTO projects (id, challenge_id, student_id, status, started_at) VALUES (?, ?, ?, ?, ?)", p.id, p.challenge, p.student, p.status, d(p.started))
    objectivesOf(p.challenge).forEach((title, i) => {
      run("INSERT INTO project_tasks (id, project_id, position, title, done) VALUES (?, ?, ?, ?, ?)", `${p.id}-t${i + 1}`, p.id, i, title, i < p.tasksDone ? 1 : 0)
    })
    for (const e of p.evidence) {
      run(
        "INSERT INTO evidence (id, project_id, student_id, type, title, description, link, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        e.id, p.id, p.student, e.type, e.title, e.description, EVIDENCE_LINKS[e.id], d(e.day),
      )
    }
    p.signals.forEach((s, i) => {
      const sigId = `sig-${p.id}-${i + 1}`
      run(
        "INSERT INTO skill_signals (id, project_id, student_id, skill, ai_rating, company_rating, company_rated_at, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        sigId, p.id, p.student, s.skill, s.ai, s.company ?? null, s.company !== undefined && p.companyRated !== undefined ? d(p.companyRated) : null, d(p.analyzed!),
      )
      for (const ev of s.evidence) run("INSERT INTO skill_signal_evidence (signal_id, evidence_id) VALUES (?, ?)", sigId, ev)
    })
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

  // -------------------------------------------------------------- notifications
  // Mirrors what the live system would have sent for the events seeded above.
  const notifications: [role: string, recipient: string, title: string, body: string, link: string | null, day: number, read: number][] = [
    ["company", "org-estarta", "Student started your challenge", "Khaled Rawashdeh (JUST) started “Audit Remote Agent Access Security”.", "/company/challenges/chal-estarta-access", -38, 1],
    ["company", "org-echo", "Submission ready for your review", "The Hashemite University confirmed Leen Al-Zoubi's submission for “Build an Internal IT Helpdesk Ticketing Portal”.", "/company/submissions/prj-echo-helpdesk-leen", -6, 0],
    ["company", "org-iris", "Challenge assigned", "Amman Arab University assigned “Detect Anomalies in Network Traffic Logs” to B.Sc. Cyber Security students.", "/company/challenges/chal-iris-anomaly", -52, 1],
    ["company", "org-skytech", "Challenge assigned", "Applied Science Private University assigned “Implement Role-Based Access Control for an ERP” to B.Sc. Software Engineering students.", "/company/challenges/chal-skytech-rbac", -7, 0],
    ["company", "org-skytech", "Student started your challenge", "Mais Khalil (ASU) started “Forecast Spare-Parts Demand for ERP Clients”.", "/company/challenges/chal-skytech-forecast", -21, 1],
    ["company", "org-abs", "Submission ready for your review", "University of Jordan confirmed Tala Haddad's submission for “Build a Sales Performance BI Dashboard for SMEs”.", "/company/submissions/prj-abs-bi-tala", -4, 0],
    ["university", "uni-aau", "Submission awaiting confirmation", "WSL rated Yazan Al-Masri's evidence for “Detect Anomalies in Network Traffic Logs”.", "/university/projects/prj-iris-anomaly-yazan", -2, 0],
    ["university", "uni-just", "Submission awaiting confirmation", "WSL rated Khaled Rawashdeh's evidence for “Audit Remote Agent Access Security”.", "/university/projects/prj-estarta-access-khaled", -3, 0],
    ["university", "uni-hu", "New challenge received", "IRIS Technology Jordan sent “Phishing Awareness Simulation & Reporting Dashboard”.", "/university/challenges/chal-iris-phishing", -3, 0],
    ["university", "uni-ju", "Company rated your student's work", "Estarta HQ rated Omar Al-Fayez's submission for “Classify Customer Call Intents from Transcripts”.", "/university/projects/prj-estarta-intent-omar", -30, 1],
    ["student", "stu-ju-omar", "Estarta HQ rated your work", "Your submission for “Classify Customer Call Intents from Transcripts” received company ratings and feedback.", "/student/projects/prj-estarta-intent-omar", -30, 1],
    ["student", "stu-hu-leen", "Submission confirmed to Echo Technology", "Dr. Mahmoud Al-Khasawneh confirmed your helpdesk portal submission to the company.", "/student/projects/prj-echo-helpdesk-leen", -6, 0],
    ["student", "stu-ju-tala", "Submission confirmed to Advanced Business Solutions", "Dr. Manal Al-Ajlouni confirmed your BI dashboard submission to the company.", "/student/projects/prj-abs-bi-tala", -4, 0],
    ["student", "stu-just-ahmad", "SkyTech Enterprise Systems rated your work", "Your inventory microservice submission received company ratings and feedback.", "/student/projects/prj-skytech-inventory-ahmad", -50, 1],
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
