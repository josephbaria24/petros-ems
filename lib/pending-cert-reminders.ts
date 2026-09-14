export const PENDING_CERT_OPEN_KEY = "tms-pending-cert-open"
export const PENDING_CERT_DONE_KEY = "tms-pending-cert-done"
export const PENDING_CERT_CENTER_SHOWS_KEY = "tms-pending-cert-center-shows"
export const PENDING_CERT_CENTER_SHOWS_PER_DAY = 2

export type CompletedReminder = {
  scheduleId: string
  courseName: string
  scheduleLabel: string
  totalAttendees: number
  pendingCount: number
  completedAt: string
  completedBy: string
}

function parseCompletedReminders(raw: string | null): CompletedReminder[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return {
            scheduleId: item,
            courseName: "Training",
            scheduleLabel: "",
            totalAttendees: 0,
            pendingCount: 0,
            completedAt: "",
            completedBy: "",
          }
        }
        if (!item || typeof item.scheduleId !== "string") return null
        return {
          scheduleId: item.scheduleId,
          courseName: item.courseName || "Training",
          scheduleLabel: item.scheduleLabel || "",
          totalAttendees: Number(item.totalAttendees) || 0,
          pendingCount: Number(item.pendingCount) || 0,
          completedAt: item.completedAt || "",
          completedBy: item.completedBy || "",
        }
      })
      .filter((item): item is CompletedReminder => Boolean(item))
  } catch {
    return []
  }
}

export function loadCompletedReminders(): CompletedReminder[] {
  if (typeof window === "undefined") return []
  return parseCompletedReminders(localStorage.getItem(PENDING_CERT_DONE_KEY))
}

export function loadCompletedReminderIds(): string[] {
  return loadCompletedReminders().map((item) => item.scheduleId)
}

export function markReminderCompleted(record: Omit<CompletedReminder, "completedAt"> & { completedAt?: string }) {
  if (typeof window === "undefined") return
  const existing = loadCompletedReminders().filter((item) => item.scheduleId !== record.scheduleId)
  const next: CompletedReminder[] = [
    {
      ...record,
      completedAt: record.completedAt || new Date().toISOString(),
    },
    ...existing,
  ]
  localStorage.setItem(PENDING_CERT_DONE_KEY, JSON.stringify(next))
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** How many times the centered dialog was auto-shown today. */
export function getPendingCertCenterShowsToday(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(PENDING_CERT_CENTER_SHOWS_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { date?: string; count?: number }
    if (parsed?.date !== todayKey()) return 0
    return Math.max(0, Number(parsed.count) || 0)
  } catch {
    return 0
  }
}

/**
 * Auto-open the centered dialog at most PENDING_CERT_CENTER_SHOWS_PER_DAY times per calendar day,
 * and only once per full page load / refresh (not on client-side route changes).
 * Returns true if this load should show the center dialog (and records that show).
 */
let pendingCertCenterCheckedThisPageLoad = false

export function consumePendingCertCenterShow(): boolean {
  if (typeof window === "undefined") return false
  // Same JS runtime = SPA remount / soft navigation — do not auto-open again.
  if (pendingCertCenterCheckedThisPageLoad) return false
  pendingCertCenterCheckedThisPageLoad = true

  const count = getPendingCertCenterShowsToday()
  if (count >= PENDING_CERT_CENTER_SHOWS_PER_DAY) return false
  localStorage.setItem(
    PENDING_CERT_CENTER_SHOWS_KEY,
    JSON.stringify({ date: todayKey(), count: count + 1 })
  )
  return true
}

export type PendingCertTrainee = {
  id: string
  name: string
}

export type PendingCertStatusCount = {
  label: string
  count: number
}

export type PendingCertSchedule = {
  scheduleId: string
  courseName: string
  scheduleLabel: string
  totalAttendees: number
  statusCounts: PendingCertStatusCount[]
  trainees: PendingCertTrainee[]
}

export type PendingCertOpenPayload = {
  scheduleId: string
  traineeIds: string[]
  viewCerts: boolean
}

export function isPaymentCompleted(paymentStatus: string | null | undefined) {
  return (paymentStatus || "").toLowerCase().includes("payment completed")
}

export function getSentCertificateTypes(customData: Record<string, unknown> | null | undefined) {
  const types = new Set<string>()
  const list = customData?.__certificate_email_sent_types
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === "string" && item) types.add(item)
    }
  }
  if (customData?.__certificate_email_status === "sent") {
    const single = customData.__certificate_email_template_type
    if (typeof single === "string" && single) types.add(single)
  }
  return types
}

/** Outstanding until both a certificate (participation/completion) and an ID have been emailed. */
export function isMissingCertAndId(customData: Record<string, unknown> | null | undefined) {
  const types = getSentCertificateTypes(customData)
  const hasCert = types.has("completion") || types.has("participation")
  const hasId = types.has("excellence")
  return !(hasCert && hasId)
}

export function savePendingCertOpen(payload: PendingCertOpenPayload) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_CERT_OPEN_KEY, JSON.stringify(payload))
}

export function consumePendingCertOpen(scheduleId: string): PendingCertOpenPayload | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(PENDING_CERT_OPEN_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingCertOpenPayload
    if (!parsed?.scheduleId || parsed.scheduleId !== scheduleId) return null
    sessionStorage.removeItem(PENDING_CERT_OPEN_KEY)
    return parsed
  } catch {
    sessionStorage.removeItem(PENDING_CERT_OPEN_KEY)
    return null
  }
}
