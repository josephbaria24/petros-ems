export type GlobalSearchCategory =
  | "Pages"
  | "Courses"
  | "Schedules"
  | "Trainees"

export type GlobalSearchItem = {
  id: string
  title: string
  description?: string
  href: string
  category: GlobalSearchCategory
  keywords: string[]
}

/** Static navigable destinations + aliases (e.g. "test" → Exam). */
export const GLOBAL_SEARCH_PAGES: GlobalSearchItem[] = [
  {
    id: "page-dashboard",
    title: "Dashboard",
    description: "Overview and metrics",
    href: "/dashboard",
    category: "Pages",
    keywords: ["home", "overview", "metrics"],
  },
  {
    id: "page-schedules",
    title: "Training Schedules",
    description: "Plan and manage trainings",
    href: "/training-schedules",
    category: "Pages",
    keywords: ["schedule", "training", "sessions", "batches"],
  },
  {
    id: "page-exam",
    title: "Exam (Pre & Post Test)",
    description: "Open schedules, then use Exam on a row",
    href: "/training-schedules",
    category: "Pages",
    keywords: [
      "exam",
      "test",
      "pretest",
      "posttest",
      "pre-test",
      "post-test",
      "examination",
      "quiz",
      "assessment",
    ],
  },
  {
    id: "page-attendance",
    title: "Attendance",
    description: "Open schedules, then use Attendance on a row",
    href: "/training-schedules",
    category: "Pages",
    keywords: ["attendance", "check-in", "present", "absent", "qr"],
  },
  {
    id: "page-evaluation",
    title: "Evaluation",
    description: "Open schedules, then use Manage Evaluations on a row",
    href: "/training-schedules",
    category: "Pages",
    keywords: [
      "evaluation",
      "evaluate",
      "feedback",
      "survey",
      "questionnaire",
      "eval",
    ],
  },
  {
    id: "page-submissions",
    title: "Submissions",
    description: "Trainee photo and document submissions",
    href: "/submissions",
    category: "Pages",
    keywords: ["submission", "photos", "upload", "receipt", "booking"],
  },
  {
    id: "page-calendar",
    title: "Training Calendar",
    description: "Calendar view of trainings",
    href: "/training-calendar",
    category: "Pages",
    keywords: ["calendar", "dates", "agenda"],
  },
  {
    id: "page-reports",
    title: "Training Reports",
    description: "Reports and exports",
    href: "/training-reports",
    category: "Pages",
    keywords: ["reports", "analytics", "export"],
  },
  {
    id: "page-directory",
    title: "Directory of Trainees",
    description: "Search trainees across trainings",
    href: "/directory-of-trainees",
    category: "Pages",
    keywords: ["directory", "trainees", "participants", "people", "search trainee"],
  },
  {
    id: "page-trainer-repo",
    title: "Trainer Repository",
    description: "Trainer profiles and materials",
    href: "/trainer-repository",
    category: "Pages",
    keywords: ["trainer", "facilitator", "instructor", "evaluation", "feedback"],
  },
  {
    id: "page-facilitator",
    title: "Facilitator Materials",
    description: "Manuals, forms, and presentation files",
    href: "/training-facilitator",
    category: "Pages",
    keywords: ["facilitator", "materials", "manual", "powerpoint", "ppt"],
  },
  {
    id: "page-courses",
    title: "Courses",
    description: "Course catalog and exam links",
    href: "/courses",
    category: "Pages",
    keywords: ["courses", "catalog", "fees", "exam links"],
  },
  {
    id: "page-cert-mgmt",
    title: "Certs & ID Management",
    description: "Certificate and ID templates",
    href: "/certificate-id-management",
    category: "Pages",
    keywords: ["certificate", "id", "template", "pvc", "print"],
  },
  {
    id: "page-cert-tracker",
    title: "Certificate Tracker",
    description: "Track issued certificates",
    href: "/cert-tracker",
    category: "Pages",
    keywords: ["tracker", "certificate", "serial", "issued"],
  },
  {
    id: "page-cert-verifier",
    title: "Certificate Verifier",
    description: "Verify certificate authenticity",
    href: "/certificate-verifier",
    category: "Pages",
    keywords: ["verify", "verifier", "validation"],
  },
  {
    id: "page-voucher",
    title: "Voucher Manager",
    description: "Discount vouchers",
    href: "/voucher-manager",
    category: "Pages",
    keywords: ["voucher", "discount", "promo", "code"],
  },
  {
    id: "page-email-status",
    title: "Email Status",
    description: "Delivery tracking for sent emails",
    href: "/admin/email-status",
    category: "Pages",
    keywords: ["email", "smtp", "bounce", "delivered", "admin"],
  },
]

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,/|_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function scoreItem(item: GlobalSearchItem, tokens: string[]): number {
  if (!tokens.length) return 0
  const hay = [item.title, item.description || "", ...item.keywords]
    .join(" ")
    .toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (item.title.toLowerCase() === token) score += 120
    else if (item.title.toLowerCase().startsWith(token)) score += 80
    else if (item.keywords.some((k) => k === token)) score += 70
    else if (item.keywords.some((k) => k.startsWith(token))) score += 55
    else if (hay.includes(token)) score += 30
    else return 0
  }
  // Prefer shorter exact-ish page titles when equal
  score += Math.max(0, 20 - item.title.length)
  return score
}

export function searchStaticPages(query: string, limit = 8): GlobalSearchItem[] {
  const tokens = tokenize(query)
  if (!tokens.length) return []
  return GLOBAL_SEARCH_PAGES.map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item)
}

export function groupSearchResults(items: GlobalSearchItem[]) {
  const order: GlobalSearchCategory[] = ["Pages", "Courses", "Schedules", "Trainees"]
  const map = new Map<GlobalSearchCategory, GlobalSearchItem[]>()
  for (const item of items) {
    const list = map.get(item.category) || []
    list.push(item)
    map.set(item.category, list)
  }
  return order
    .filter((cat) => (map.get(cat) || []).length > 0)
    .map((cat) => ({ category: cat, items: map.get(cat)! }))
}
