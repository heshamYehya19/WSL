// WSL's offline evidence scorer, and the shared rules every scorer follows.
//
// The primary grader is Gemini (server/ml/gemini.ts), which reads the evidence
// against the challenge and quotes the exact lines that prove each skill. This
// file is the strict, deterministic fallback used when Gemini isn't configured,
// fails, or the evidence contains personal data that must not leave WSL. The
// seeded demo data is scored with it too, so the demo works offline.
//
// Two rules hold for every scorer:
//
//   1. Repeating the challenge brief is not evidence. Lines that echo the brief
//      are dropped before scoring, and a submission that mostly repeats it is
//      rejected at intake (checkRelevance).
//   2. Only the student's actual content counts (pasted code or text, or files
//      WSL read from a linked repository). An evidence title or description is
//      the student's own claim about the work, so it never raises a score.
//
// The offline scorer looks for concrete, skill-specific indicators (an
// `IsolationForest(...)` call, a `GROUP BY`, a `@Test` method), counts each
// indicator once, and quotes the line where it found it. It is capped below
// "Demonstrated": only a full read of the evidence can claim that.

// "Insufficient" is a 5th outcome, not a low tier: it means WSL didn't find enough
// to check multiple rubric criteria at all, so forcing a tier (even "Foundational")
// would overstate what was actually found. See gateByCriteria below.
export type SuggestedLevel = "Insufficient" | "Foundational" | "Intermediate" | "Advanced" | "Demonstrated"

// A deterministic, tunable read of the same 0-100 confidence number — not a
// second model. Presented to a mentor as a starting point, never as a verdict:
// only a human verification decision can actually set a student's skill level.
export function suggestedLevelFor(rating: number): Exclude<SuggestedLevel, "Insufficient"> {
  return rating >= 80 ? "Demonstrated" : rating >= 60 ? "Advanced" : rating >= 35 ? "Intermediate" : "Foundational"
}

// A single rubric criterion (one indicator's `what`, or one criterion label offered
// to the LLM grader) and whether this submission showed it. Met criteria appear
// first in SimulatedRating.criteria, so the UI can render "what was demonstrated"
// before "what's still missing" without re-sorting.
export interface SkillCriterion {
  label: string
  met: boolean
}

// Below this many *met* criteria, WSL won't claim a real tier — see gateByCriteria.
const MIN_CRITERIA_FOR_LEVEL = 2

/**
 * The credibility gate: a raw rating alone can't justify a confident tier. Zero
 * matched criteria means WSL found nothing concrete to check, so the honest
 * answer is "Insufficient Evidence," not "Foundational." Exactly one matched
 * criterion is a single signal, not the "multiple relevant criteria" a real
 * Intermediate-or-above claim needs, so it's capped at Foundational. Two or more
 * lets the rating stand as computed.
 */
export function gateByCriteria(level: Exclude<SuggestedLevel, "Insufficient">, metCount: number): SuggestedLevel {
  if (metCount === 0) return "Insufficient"
  if (metCount < MIN_CRITERIA_FOR_LEVEL && level !== "Foundational") return "Foundational"
  return level
}

/** One line of the student's own content that supports a skill, and what it shows. */
export interface EvidenceQuote {
  evidenceId: string
  text: string
  why: string
}

export interface SimulatedRating {
  skill: string
  rating: number
  suggestedLevel: SuggestedLevel
  note: string
  quotes: EvidenceQuote[]
  evidenceIds: string[]
  /** Named rubric criteria this submission was checked against, met ones first. */
  criteria: SkillCriterion[]
  /** Whether this came from a live model call or the deterministic offline scorer. */
  source: "model" | "offline"
  /** The exact model id used ("openai/gpt-oss-120b", "gemini-flash-latest"), or "offline". */
  model: string
}

export interface ChallengeContext {
  problemDescription: string
  objectives: string[]
  expectedOutput: string
}

export interface EvidenceLike {
  id: string
  type: string
  title: string
  description: string
  content?: string
}

export function buildChallengeText(challenge: ChallengeContext): string {
  return [challenge.problemDescription, ...challenge.objectives, challenge.expectedOutput].filter(Boolean).join(". ")
}

// ------------------------------------------------------------ brief echo check

// One spelling per Arabic word, so a brief and a submission that write the same word
// slightly differently (with or without short vowels, أ vs ا, ة vs ه) still match.
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, "") // diacritics (tashkeel)
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

const ARABIC_LETTER = /[ء-ي]/
const ARABIC_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال"]

// Light stemming: the definite article (and "and the", "with the"...) is written attached
// to the word — "والبيانات" is "and the data" — so it's stripped to match "بيانات".
function stripArabicPrefix(w: string): string {
  for (const p of ARABIC_PREFIXES) if (w.startsWith(p) && w.length - p.length >= 2) return w.slice(p.length)
  return w
}

function words(text: string): string[] {
  const raw = normalizeArabic(text).match(/[\p{L}\p{N}_]+/gu) ?? []
  return raw
    .flatMap((tok) => tok.split(/_+/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])/)))
    .map((w) => (ARABIC_LETTER.test(w) ? stripArabicPrefix(w) : w.toLowerCase()))
    .filter((w) => w.length >= 2)
}

type Script = "latin" | "arabic" | "other" | "none"

/** The writing system most of a text's letters are in. */
function dominantScript(text: string): Script {
  const letters = text.match(/\p{L}/gu) ?? []
  if (letters.length === 0) return "none"
  const latin = letters.filter((c) => /[A-Za-z]/.test(c)).length
  const arabic = letters.filter((c) => /[؀-ۿ]/.test(c)).length
  if (latin / letters.length > 0.5) return "latin"
  if (arabic / letters.length > 0.5) return "arabic"
  return "other"
}

function shingles(ws: string[], n = 3): string[] {
  const out: string[] = []
  for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(" "))
  return out
}

export class BriefEcho {
  private readonly brief: Set<string>

  constructor(challenge: ChallengeContext) {
    this.brief = new Set(shingles(words(buildChallengeText(challenge))))
  }

  /** Share (0-1) of the text's three-word phrases that also appear in the brief. */
  ratio(text: string): number {
    const s = shingles(words(text))
    if (s.length === 0) return 0
    return s.filter((x) => this.brief.has(x)).length / s.length
  }

  /** A line that mostly restates the brief, such as an objective pasted in as a comment. */
  isEchoLine(line: string): boolean {
    const s = shingles(words(line))
    return s.length >= 2 && s.filter((x) => this.brief.has(x)).length / s.length >= 0.5
  }

  /** The text with every brief-echoing line removed. */
  novel(text: string): string {
    return text
      .split("\n")
      .filter((line) => !this.isEchoLine(line))
      .join("\n")
  }
}

// ------------------------------------------------------------- relevance gate

const MIN_CONTENT_CHARS = 30
// At or above this share of repeated phrases, a submission is a restatement of the brief.
const ECHO_REJECT = 0.5
// Below this word overlap with the brief, a submission is about something else entirely.
const OFF_TOPIC_REJECT = 0.03

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both
   but by can cannot could did do does doing don down during each few for from further had has have having he her
   here hers herself him himself his how i if in into is it its itself just let me more most my myself no nor not
   now of off on once only or other our ours ourselves out over own same she should so some such than that the
   their theirs them themselves then there these they this those through to too under until up very was we were
   what when where which while who whom why will with you your yours yourself yourselves using use used uses via
   also able new build built using provide provides across`
    .split(/\s+/)
    .filter(Boolean),
)
// Arabic function words, normalized the same way words() normalizes text, in both their
// written form and their article-stripped form (التي is also tokenized as تي).
for (const w of `في من علي الي عن مع هذا هذه ذلك تلك التي الذي الذين او ان انه انها كان كانت يكون لا ما لم لن قد ثم كل بعض
   بين عند حتي اذا هو هي هم هن نحن انا انت كما ايضا غير لكن وهو وهي عبر خلال حول ضمن مثل`.split(/\s+/)) {
  if (!w) continue
  const n = normalizeArabic(w)
  STOPWORDS.add(n)
  STOPWORDS.add(stripArabicPrefix(n))
}

function termFreq(text: string): Map<string, number> {
  const tf = new Map<string, number>()
  for (const w of words(text)) if (!STOPWORDS.has(w) && !/^\d+$/.test(w)) tf.set(w, (tf.get(w) ?? 0) + 1)
  return tf
}

function cosineOverlap(a: Map<string, number>, b: Map<string, number>): number {
  let dotP = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  for (const [t, v] of a) {
    const w = b.get(t)
    if (w) dotP += v * w
  }
  if (na === 0 || nb === 0) return 0
  return dotP / (Math.sqrt(na) * Math.sqrt(nb))
}

export type RelevanceCheck =
  /** `unjudged` when word overlap can't say anything (a different language than the brief). */
  | { relevant: true; unjudged?: true }
  | { relevant: false; reason: "echoes-brief"; echoPct: number }
  | { relevant: false; reason: "off-topic"; overlapPct: number }

/**
 * Run when evidence is submitted, separately from rating. Rejects two things:
 * a submission that mostly repeats the challenge brief back, and one that has
 * nothing to do with the challenge at all. Short submissions (a bare link or a
 * one-line title) are too thin to judge either way and are accepted. Works for
 * Arabic as well as English; a submission written mainly in a different script
 * than the brief can't be compared word-for-word, so it's accepted and left for
 * the AI grader (which reads both) to judge, rather than rejected as a 0% match.
 */
export function checkRelevance(challenge: ChallengeContext, text: string): RelevanceCheck {
  if (text.trim().length < MIN_CONTENT_CHARS) return { relevant: true }
  const briefText = buildChallengeText(challenge)
  if (dominantScript(text) !== dominantScript(briefText)) return { relevant: true, unjudged: true }
  const echo = new BriefEcho(challenge)
  const ratio = echo.ratio(text)
  const ownWords = words(echo.novel(text)).length
  // Mostly the brief, or the brief plus a token line of "work" (e.g. print("hello world")).
  if (ratio >= ECHO_REJECT || (ratio >= 0.25 && ownWords < 25)) {
    return { relevant: false, reason: "echoes-brief", echoPct: Math.round(ratio * 100) }
  }
  const overlap = cosineOverlap(termFreq(briefText), termFreq(text))
  if (overlap < OFF_TOPIC_REJECT) return { relevant: false, reason: "off-topic", overlapPct: Math.round(overlap * 100) }
  return { relevant: true }
}

// ------------------------------------------------------------ offline rubric

interface Indicator {
  pattern: RegExp
  /** What a match shows, phrased to follow "This line ..." */
  what: string
  weight: number
}

const i = (pattern: RegExp, what: string, weight: number): Indicator => ({ pattern, what, weight })

const JS_CORE: Indicator[] = [
  i(/\b(const|let)\s+\w+\s*=/, "declares variables in JavaScript", 8),
  i(/=>\s*[{(]?|\bfunction\s+\w+\s*\(/, "defines functions", 12),
  i(/^\s*(import\s.+\sfrom\s+['"]|export\s+(default\s+)?(function|const|class|async))/, "uses ES modules", 10),
  i(/\b(async|await|Promise)\b|\.then\(/, "handles asynchronous code", 10),
  i(/\.(map|filter|reduce|forEach|find)\(/, "transforms data with array methods", 8),
  i(/\bfetch\(|\bJSON\.(parse|stringify)\(|\baddEventListener\(/, "uses browser or runtime APIs", 8),
]

const RUBRICS: Record<string, Indicator[]> = {
  python: [
    i(/^\s*(import\s+[a-z_][\w.]*|from\s+[a-z_][\w.]*\s+import\s)/, "imports Python modules", 12),
    i(/^\s*(async\s+)?def\s+\w+\s*\(/, "defines its own functions", 14),
    i(/^\s*class\s+\w+\s*[(:]/, "defines classes", 8),
    i(/\)\s*->\s*[\w.[\], ]+:|\(\s*\w+\s*:\s*[\w.]+[[\],)=]/, "uses type hints", 8),
    i(/\bf["'][^"']*\{/, "formats output with f-strings", 6),
    i(/\[[^\]]*\bfor\s+\w+\s+in\b[^\]]*\]/, "uses a list comprehension", 6),
    i(/^\s*(try:|except\b|with\s+open\()/, "handles files or errors", 6),
    i(/\b(pd|np)\.\w+|\.(read_csv|read_parquet|groupby|merge)\(/, "works with pandas or NumPy", 10),
  ],
  java: [
    i(/\b(public|private|protected)\s+(static\s+)?(final\s+)?[\w<>[\],?\s]+\s+\w+\s*\([^)]*\)\s*(throws\s[\w, ]+)?\{?/, "declares typed methods", 14),
    i(/\b(class|interface|record|enum)\s+[A-Z]\w*/, "defines classes or interfaces", 10),
    i(/^\s*import\s+[\w.]+(\.\*)?;/, "imports Java packages", 10),
    i(/^\s*@[A-Z]\w+/, "uses annotations (Spring, JUnit, validation)", 10),
    i(/\b(List|Map|Set|Optional)<|\.stream\(\)/, "uses generics or streams", 10),
    i(/\bthrows\s+\w+|\bcatch\s*\(/, "handles exceptions", 6),
    i(/\bprivate\s+final\s+\w+/, "uses immutable, injected dependencies", 8),
  ],
  sql: [
    i(/\bSELECT\b.+\bFROM\b|^\s*FROM\s+\w+/i, "writes SELECT queries", 14),
    i(/\b(LEFT|RIGHT|INNER|FULL)?\s*JOIN\s+\w+/i, "joins tables", 12),
    i(/\bGROUP\s+BY\b|\bHAVING\b|\b(COUNT|SUM|AVG)\s*\(/i, "aggregates data in SQL", 12),
    i(/\b(CREATE\s+TABLE|ALTER\s+TABLE|PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES\s+\w+|CREATE\s+(UNIQUE\s+)?INDEX)\b/i, "designs a database schema", 14),
    i(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i, "modifies data", 8),
    i(/\bWITH\s+\w+\s+AS\s*\(|\bOVER\s*\(|\bPARTITION\s+BY\b|\bROW_NUMBER\s*\(/i, "uses CTEs or window functions", 12),
    i(/@Query\b|\bprepareStatement\(|\bflyway\b|\bmigration\b|\b(knex|prisma|sequelize)\b/i, "runs SQL from application code or migrations", 8),
  ],
  javascript: JS_CORE,
  typescript: [
    ...JS_CORE,
    i(/\binterface\s+[A-Z]\w*|\btype\s+[A-Z]\w*\s*=|:\s*(string|number|boolean|unknown|[A-Z]\w*(\[\])?)\s*[,)=;]/, "uses static types", 16),
  ],
  react: [
    i(/\buse(State|Effect|Memo|Callback|Context|Reducer|Ref)\s*\(/, "uses React hooks", 18),
    i(/return\s*\(?\s*<|<[A-Z]\w*[\s/>]|className=/, "renders JSX", 16),
    i(/\bexport\s+(default\s+)?function\s+[A-Z]\w*/, "defines a component", 12),
    i(/\bon(Click|Change|Submit)=/, "handles UI events", 8),
    i(/\(\{\s*\w+(,\s*\w+)*\s*\}\)|\bprops\./, "passes props between components", 8),
  ],
  "node.js": [
    i(/\b(express\(\)|createServer\(|fastify\(|new\s+Koa\()|\b(app|router)\.(get|post|put|patch|delete|use)\(/, "defines HTTP routes in Node", 18),
    i(/\brequire\(['"]|from\s+['"](node:)?[\w@/.-]+['"]/, "uses Node modules", 8),
    i(/\breq\.(body|params|query)\b|\bres\.(json|status|send)\(/, "handles requests and responses", 14),
    i(/\bprocess\.env\.\w+|\bawait\s+\w+/, "handles configuration or async I/O", 8),
    i(/\b(jwt|bcrypt|helmet|cors|middleware)\b/i, "adds middleware or authentication", 10),
  ],
  "web development": [
    i(/<(div|section|form|input|button|nav|header|main|table)\b/i, "writes page structure", 10),
    i(/@media\b|\b(flex|grid)\b|\b(sm|md|lg):\w+/, "builds a responsive layout", 10),
    i(/\bfetch\(|\baxios\.|\bXMLHttpRequest\b/, "calls an API from the client", 10),
    i(/\buse(State|Effect)\s*\(/, "manages UI state", 12),
    i(/\b(app|router)\.(get|post|put|delete)\(|@(Get|Post)Mapping/, "serves backend routes", 10),
    i(/\baria-\w+=|\balt=|<label\b/, "makes the page accessible", 8),
  ],
  "mobile development": [
    i(/\b(StatelessWidget|StatefulWidget|Widget\s+build\(|Scaffold\(|setState\()/, "builds Flutter UI", 18),
    i(/\b(SwiftUI|UIViewController|NavigationView|@State\b|some\s+View)\b/, "builds iOS UI", 18),
    i(/@Composable\b|\b(Activity|Fragment|RecyclerView)\b/, "builds Android UI", 18),
    i(/\bStyleSheet\.create\(|<(View|Text|FlatList)\b/, "builds React Native UI", 18),
    i(/\b(offline|push notification|AsyncStorage|SharedPreferences|sqflite|permission)\b/i, "handles device concerns", 10),
  ],
  "machine learning": [
    i(/\b(sklearn|torch|tensorflow|keras|xgboost|lightgbm|transformers)\b/, "imports a machine learning library", 12),
    i(/\b(IsolationForest|RandomForest\w*|LogisticRegression|LinearRegression|KMeans|DBSCAN|SVC|GradientBoosting\w*|XGB\w+|LGBM\w+|MLPClassifier|AutoModel\w*|Sequential|nn\.Module|OneClassSVM|LocalOutlierFactor)\s*\(/, "instantiates a specific model", 18),
    i(/\.(fit|fit_transform|fit_predict|train)\s*\(/, "trains a model on data", 14),
    i(/\.(predict|predict_proba|decision_function|score_samples)\s*\(|fit_predict\(/, "uses the model's predictions", 8),
    i(/\b(StandardScaler|MinMaxScaler|TfidfVectorizer|OneHotEncoder|LabelEncoder|train_test_split|Pipeline|AutoTokenizer)\b/, "prepares features or splits data", 10),
    i(/\b(n_estimators|contamination|max_depth|learning_rate|epochs|class_weight)\s*=/, "tunes hyperparameters", 8),
    i(/\b(precision_score|recall_score|f1_score|roc_auc_score|accuracy_score|confusion_matrix|classification_report|cross_val_score)\b|\b(precision|recall|F1)\b.*\d/, "evaluates the model", 12),
  ],
  "natural language processing": [
    i(/\b(TfidfVectorizer|CountVectorizer|AutoTokenizer|word2vec|spacy|nltk|BertModel|AutoModelFor\w+)\b|\bembedding/i, "represents text for a model", 18),
    i(/\bre\.sub\(|\b(stopwords?|lemmati\w+|stemm\w+|diacritic\w*|normali[sz]e_\w+)\b/i, "cleans and normalizes text", 14),
    i(/\b(intent|sentiment|named entit\w*|topic model\w*)\b/i, "builds a language task", 10),
    i(/\b(f1|precision|recall|confusion_matrix|classification_report)\b/i, "evaluates text predictions", 10),
  ],
  "data analysis": [
    i(/\b(pd\.)?read_(csv|parquet|excel|sql|json)\(|\bSELECT\b.+\bFROM\b/i, "loads a real dataset", 12),
    i(/\.(groupby|pivot_table|agg|aggregate|value_counts|describe|resample|rolling|merge)\(|\bGROUP\s+BY\b/i, "aggregates or reshapes data", 14),
    i(/\w+\[\w+\[["']\w+["']\]\s*(==|!=|>=|<=|>|<)|\.(query|between|clip|fillna|dropna)\(|\.loc\[/, "filters or cleans data", 12),
    i(/\w+\[["']\w+["']\]\s*=[^=]|\.assign\(/, "derives new columns", 12),
    i(/\.(mean|median|std|quantile|corr)\(|\b(correlation|percentile|outliers?|distribution)\b/i, "computes statistics", 10),
    i(/\blen\(\w+\)|\.shape\b|\bCOUNT\(/i, "reports counts", 5),
  ],
  "data visualization": [
    i(/\b(matplotlib|plt\.|seaborn|sns\.|plotly|px\.|recharts|chart\.js|d3\.|ggplot)/, "uses a plotting library", 15),
    i(/\.(plot|bar|barh|scatter|hist|heatmap|lineplot|barplot|imshow)\s*\(|\b(bar|line|scatter|pie|stacked|donut)\s+(chart|plot)s?\b|\bheat ?map\b|\bhistogram\b/i, "builds a specific chart type", 15),
    i(/\.(xlabel|ylabel|set_title|title|legend)\(|\b(tooltip|axis label|colou?r scale|annotation)s?\b/i, "labels and annotates charts", 10),
    i(/\b(dashboard|slicer|drill.?(down|through)|KPI card|report page)\b/i, "designs a dashboard", 12),
  ],
  "power bi": [
    i(/\b(CALCULATE|SUMX|AVERAGEX|DIVIDE|FILTER|RELATED|DATEADD|TOTALYTD|SAMEPERIODLASTYEAR)\s*\(/, "writes DAX measures", 22),
    i(/\bpower query\b|\bTable\.\w+\(|^\s*let\s*$/i, "shapes data in Power Query", 14),
    i(/\b(star schema|fact table|dimension table|relationship)s?\b/i, "models data for Power BI", 14),
    i(/\b(slicer|drill.?through|bookmark|row.level security|RLS)\b/i, "uses Power BI report features", 12),
  ],
  "time-series forecasting": [
    i(/\b(ARIMA|SARIMAX?|Prophet|ExponentialSmoothing|Holt\w*|LSTM|statsmodels)\b/, "uses a forecasting model", 20),
    i(/\.(resample|rolling|shift)\(|\b(lag_?\d+|seasonal\w*|to_datetime|date_range)\b/, "engineers time-based features", 14),
    i(/\b(MAPE|MAE|RMSE|backtest\w*|walk.forward|TimeSeriesSplit|horizon)\b/i, "evaluates forecasts", 14),
  ],
  "network security": [
    i(/\b(netflow|firewall|pcap|packets?|tcp|udp|icmp|dns|src_ip|dst_ip|dst_port|src_port|auth\.log|source ips?)\b/i, "works with network traffic or auth logs", 15),
    i(/\b(split tunnel\w*|open ports?|port \d+|exposed to)\b/i, "finds network exposure", 12),
    i(/\b(unique_\w*ports?|bytes_per_sec|is_offhours|beacon\w*|conn_count|packet_rate)\b/i, "engineers traffic features", 12),
    i(/\b(alerts?|intrusion|malicious|suspicious|brute.?force|exfiltrat\w*|lateral movement|port scan\w*|attacks?|failed (password|logins?))\b/i, "flags suspicious behavior", 12),
    i(/\b(vpn|ssh|tls|certificate|CVE-\d+|CIS|hardening|segmentation|vlan|acl|mfa|zero.?trust|nmap|wireshark|snort|suricata|zeek|siem|iptables|ufw)\b/i, "applies security controls or tooling", 14),
    i(/\b(false.?positives?|true.?positives?|detection rate)\b/i, "weighs detection quality", 8),
  ],
  linux: [
    i(/(^\s*(\d+[.)]\s*)?[$#]?\s*|\bsudo\s+)(apt|yum|dnf|systemctl|chmod|chown|useradd|usermod|journalctl|iptables|ufw|crontab|mount)\b/, "runs Linux administration commands", 18),
    i(/\/(etc|var\/log|usr|opt)\/[\w./-]+/, "works with system config or logs", 12),
    i(/\b(sshd_config|PermitRootLogin|PasswordAuthentication|sudoers|auditd|selinux|apparmor|fail2ban|pam_\w+)\b/i, "hardens Linux services", 16),
    i(/^#!\/bin\/(ba)?sh|\$\(|\|\s*(grep|awk|sort|uniq|sed)\b/, "writes shell scripts or pipelines", 10),
  ],
  "risk assessment": [
    i(/\b(likelihood|impact|severity)\b/i, "rates likelihood or impact", 14),
    i(/\b(risk (matrix|register|score|rating)|5x5|inherent risk|residual risk)\b/i, "uses a risk matrix or register", 16),
    i(/\b(mitigat\w+|remediat\w+|prioriti[sz]\w+|compensating control)\b/i, "proposes mitigations and priorities", 12),
    i(/\b(CIS|NIST|ISO ?27001|OWASP|CVSS|STRIDE|threat model\w*)\b/, "applies a recognized framework", 12),
    i(/\b(critical|high|medium|low)\b.{0,40}\b(risk|finding|severity)\b/i, "classifies findings", 8),
  ],
  "technical writing": [
    i(/^(#{1,4}\s+\w|\d+\.\s+[A-Z]|[A-Z][\w ]{2,40}:\s*$)/, "structures content with headings or steps", 12),
    i(/\b(step \d|for example|e\.g\.|note:)/i, "explains procedures with examples", 10),
    i(/\b(audience|overview|recommendation|conclusion|prerequisites?)\b/i, "frames the document for its reader", 10),
    i(/`[^`]+`/, "documents commands or code precisely", 8),
    i(/[a-z][^.!?\n]{60,}[.!?](\s|$)/, "explains in complete sentences", 10),
  ],
  "rest api design": [
    i(/@(Get|Post|Put|Patch|Delete|Request)Mapping|\b(app|router)\.(get|post|put|patch|delete)\(|\b(GET|POST|PUT|PATCH|DELETE)\s+\/\w/, "defines HTTP endpoints", 18),
    i(/\/api\/|\{\w*[iI]d\}|\/:\w+|@PathVariable/, "uses resource-oriented paths", 10),
    i(/\bResponseEntity\b|\.status\(\d{3}\)|\b(201|204|400|401|403|404|409|422)\b/, "returns meaningful status codes", 12),
    i(/@RequestBody|@Valid\b|\breq\.body\b|\b(openapi|swagger)\b/i, "validates or documents requests", 12),
    i(/\b(pagination|page=|limit=|offset|\/v\d\/|idempoten\w+|rate.?limit)\b/i, "handles paging, versioning or limits", 8),
  ],
  "software testing": [
    i(/@Test\b|\b(describe|it|test)\s*\(\s*['"`]|\bdef\s+test_\w+|\bunittest\b|\bpytest\b/, "writes test cases", 18),
    i(/\bassert\w*\b|\bexpect\(|\.toBe\(|\bassertEquals\(|\bassertThat\(/, "makes assertions about behavior", 14),
    i(/\b(mock|stub|spy|fixture|Testcontainers)\b|@(BeforeEach|Container)\b|\bbeforeEach\(|\bsetUp\(/i, "sets up fixtures or mocks", 12),
    i(/\b(coverage|integration|concurren\w+|edge case|regression)\b/i, "covers integration or edge cases", 10),
  ],
  "security awareness": [
    i(/\b(phish\w*|social engineering|pretext\w*|smish\w*|vish\w*)\b/i, "addresses social-engineering threats", 16),
    i(/\b(click rate|report rate|repeat clickers?|reported|clicked)\b/i, "measures awareness behavior", 14),
    i(/\b(never (store|collect|capture)s?|no credentials|consent|ethic\w*|anonymi[sz]\w*)\b/i, "builds in safety and ethics", 14),
    i(/\b(campaign|simulation|landing page|training module)\b/i, "designs the simulation", 10),
  ],
  "access control": [
    i(/\b(RBAC|ABAC|least privilege|permissions?|roles?)\b/i, "models roles and permissions", 16),
    i(/@PreAuthorize|\bhasRole\(|\brequireRole\(|\bisAuthorized\(|\bpolicy\b/, "enforces authorization in code", 16),
    i(/\b(MFA|2FA|SSO|OAuth|JWT)\b/, "handles authentication", 10),
    i(/\b(audit (log|trail)|segregation of duties|deny by default|revoke\w*)\b/i, "audits or limits access", 12),
  ],
  "business analysis": [
    i(/\b(stakeholders?|requirements?|user stor(y|ies)|use cases?|acceptance criteria)\b/i, "captures requirements and stakeholders", 16),
    i(/\b(KPIs?|metrics?|revenue|margin|ROI|conversion|churn|cost per)\b/i, "ties the work to business metrics", 14),
    i(/\b(as.is|to.be|gap analysis|bottlenecks?|root cause)\b/i, "analyzes gaps in the current process", 12),
    i(/\b(recommend\w*|insights?)\b/i, "turns findings into recommendations", 10),
  ],
  "process modeling": [
    i(/\b(BPMN|swim ?lanes?|flowchart|gateway|start event|end event)\b/i, "uses process notation", 18),
    i(/\b(as.is|to.be|handoffs?|approval steps?|cycle time|SLA)\b/i, "analyzes the process flow", 14),
    i(/\b(state machine|transitions?|workflow)\b/i, "models workflow states", 10),
  ],
  "ui/ux design": [
    i(/\b(wireframes?|prototype|figma|mockups?|user flows?|journey map)\b/i, "designs flows or prototypes", 16),
    i(/\b(usability test\w*|user research|interviews?|personas?|heuristic)\b/i, "tests the design with users", 16),
    i(/\b(accessib\w+|contrast|aria-\w+|WCAG|keyboard)\b/i, "considers accessibility", 12),
    i(/\b(visual hierarchy|spacing|typograph\w+|design system|component library)\b/i, "applies visual design principles", 10),
  ],
}

// Skills whose rubric is a superset of another's, so near-synonyms share one.
const RUBRIC_ALIASES: Record<string, string> = {
  "frontend development": "web development",
  "golang": "go",
  "nlp": "natural language processing",
}

// Display casing for WSL's known skill vocabulary (the RUBRICS keys above, plus
// the alias names themselves — an alias is only about which rubric scores a skill,
// never about what it's called). Keyed by lowercase so lookup is case-insensitive.
// Anything a company types outside this list falls back to a generic capitalization
// in canonicalSkillName below, rather than silently staying however it was typed.
const SKILL_DISPLAY_NAMES: Record<string, string> = {
  "python": "Python",
  "java": "Java",
  "sql": "SQL",
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "react": "React",
  "node.js": "Node.js",
  "web development": "Web Development",
  "frontend development": "Frontend Development",
  "mobile development": "Mobile Development",
  "machine learning": "Machine Learning",
  "natural language processing": "Natural Language Processing",
  "nlp": "NLP",
  "data analysis": "Data Analysis",
  "data visualization": "Data Visualization",
  "power bi": "Power BI",
  "time-series forecasting": "Time-Series Forecasting",
  "network security": "Network Security",
  "linux": "Linux",
  "risk assessment": "Risk Assessment",
  "technical writing": "Technical Writing",
  "rest api design": "REST API Design",
  "software testing": "Software Testing",
  "security awareness": "Security Awareness",
  "access control": "Access Control",
  "business analysis": "Business Analysis",
  "process modeling": "Process Modeling",
  "ui/ux design": "UI/UX Design",
  "go": "Go",
  "golang": "Go",
  "c++": "C++",
  "c#": "C#",
  ".net": ".NET",
}

/**
 * The one casing a skill name is stored and shown with everywhere — applied once,
 * at challenge creation, so "python" and "Python" are never two different skills
 * across a student's record, a university's dashboard, or Talent Discovery search.
 * Known skills (WSL's own rubric vocabulary) get their canonical display form.
 * Anything else gets a plain per-word capitalization of any all-lowercase word,
 * leaving words that already have a capital (JavaScript, iOS, GraphQL, Node.js)
 * untouched rather than guessing at them.
 */
export function canonicalSkillName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return trimmed
  const known = SKILL_DISPLAY_NAMES[trimmed.toLowerCase()]
  if (known) return known
  return trimmed
    .split(" ")
    .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

// The offline scorer can't read evidence the way a model can, so it never
// suggests "Demonstrated" (80+) — that needs a full read and a mentor.
const LOCAL_CAP = 75
const LOCAL_BASE = 5
const GENERIC_CAP = 35
const INSUFFICIENT_RATING = 10
const MAX_QUOTES = 3
const MAX_QUOTE_CHARS = 160
// Unmet criteria beyond this are just noise in an "evidence gaps" list — the
// heaviest (most meaningful) missing ones are the ones worth showing.
const MAX_UNMET_CRITERIA = 4

function rubricFor(skill: string): Indicator[] {
  const key = skill.trim().toLowerCase()
  const rubric = RUBRICS[RUBRIC_ALIASES[key] ?? key]
  if (rubric) return rubric
  // An unknown skill: a line naming it counts a little, never much.
  const names = key.split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3)
  if (names.length === 0) return []
  const escaped = names.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return [i(new RegExp(`\\b(${escaped.join("|")})`, "i"), `mentions ${skill} in the student's own work`, 10)]
}

/** The rubric criteria a skill is checked against — same labels shown in the UI
 * checklist and offered to the LLM grader, so both scorers reason against one
 * named list instead of two independently-drifting ones. */
export function criteriaLabelsFor(skill: string): string[] {
  return rubricFor(skill).map((ind) => ind.what)
}

export function trimQuote(line: string): string {
  const t = line.trim().replace(/\s+/g, " ")
  return t.length > MAX_QUOTE_CHARS ? `${t.slice(0, MAX_QUOTE_CHARS - 1)}…` : t
}

function scoreSkillLocally(skill: string, items: { id: string; lines: string[] }[]): SimulatedRating {
  const rubric = rubricFor(skill)
  const isGeneric = !RUBRICS[RUBRIC_ALIASES[skill.trim().toLowerCase()] ?? skill.trim().toLowerCase()]
  const hits: { indicator: Indicator; quote: EvidenceQuote }[] = []
  const quoted = new Set<string>()
  // Heaviest indicators pick their line first, and each prefers a line no other
  // indicator has quoted yet, so the quotes show different parts of the work.
  for (const indicator of [...rubric].sort((a, b) => b.weight - a.weight)) {
    const matches = items.flatMap((item) => item.lines.filter((l) => indicator.pattern.test(l)).map((line) => ({ item, line })))
    const pick = matches.find((m) => !quoted.has(m.line)) ?? matches[0]
    if (!pick) continue
    quoted.add(pick.line)
    hits.push({ indicator, quote: { evidenceId: pick.item.id, text: trimQuote(pick.line), why: indicator.what } })
  }

  const raw = LOCAL_BASE + hits.reduce((sum, h) => sum + h.indicator.weight, 0)
  const rating = Math.min(isGeneric ? GENERIC_CAP : LOCAL_CAP, Math.round(raw))
  const quotes = hits.slice(0, MAX_QUOTES).map((h) => h.quote)

  const note =
    hits.length === 0
      ? `No concrete ${skill} work was found in the student's own content. Lines that repeat the challenge brief were not counted.`
      : `Found ${hits.length} concrete sign${hits.length === 1 ? "" : "s"} of ${skill} in the student's own content. Lines that repeat the challenge brief were not counted.`

  const hitIndicators = new Set(hits.map((h) => h.indicator))
  const criteria: SkillCriterion[] = [
    ...hits.map((h) => ({ label: h.indicator.what, met: true })),
    ...rubric
      .filter((ind) => !hitIndicators.has(ind))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_UNMET_CRITERIA)
      .map((ind) => ({ label: ind.what, met: false })),
  ]

  const evidenceIds = [...new Set(quotes.map((q) => q.evidenceId))]
  return {
    skill,
    rating,
    suggestedLevel: gateByCriteria(suggestedLevelFor(rating), hits.length),
    note,
    quotes,
    evidenceIds: evidenceIds.length > 0 ? evidenceIds : [items[0].id],
    criteria,
    source: "offline",
    model: "offline",
  }
}

/** The part of an evidence item WSL actually analyzes: its content, never its self-description. */
export function analyzableContent(e: EvidenceLike): string {
  return (e.content ?? "").trim()
}

/**
 * The strict offline scorer. Scores each required skill from concrete indicators
 * in the students' own content, after removing every line that echoes the brief,
 * and quotes the lines it relied on. Evidence with no content (a bare link) can
 * only be checked by a mentor, so it never raises a score.
 */
export function simulateAIReview(requiredSkills: string[], submittedEvidence: EvidenceLike[], challenge: ChallengeContext): SimulatedRating[] {
  if (submittedEvidence.length === 0) return []
  const echo = new BriefEcho(challenge)
  const items = submittedEvidence
    .map((e) => ({ id: e.id, text: echo.novel(analyzableContent(e)) }))
    .filter((e) => e.text.trim().length >= MIN_CONTENT_CHARS)
    .map((e) => ({ id: e.id, lines: e.text.split("\n").filter((l) => l.trim().length > 0) }))

  return requiredSkills.map((skill) => {
    if (items.length === 0) {
      return {
        skill,
        rating: INSUFFICIENT_RATING,
        suggestedLevel: "Insufficient",
        note: `None of the evidence includes content WSL can read, so ${skill} can only be checked by a mentor from the links.`,
        quotes: [],
        evidenceIds: [submittedEvidence[0].id],
        criteria: [],
        source: "offline",
        model: "offline",
      }
    }
    return scoreSkillLocally(skill, items)
  })
}
