import { createHash } from "crypto"

export type EmailStatus =
  | "sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked"
  | "unsubscribed"
  | "complained"
  | "unknown"

export type TrackedEmail = {
  id: string
  messageId: string
  recipient: string
  subject: string
  currentStatus: EmailStatus
  sentAt: string
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  unsubscribedAt: string | null
  complainedAt: string | null
  bounceReason: string | null
  diagnosticCode: string | null
  createdAt: string
  updatedAt: string
}

export type EmailEvent = {
  id: string
  trackedEmailId: string | null
  messageId: string
  event: EmailStatus
  recipient: string | null
  occurredAt: string
  reason: string | null
  code: string | null
  ipAddress: string | null
  eventFingerprint: string
  rawPayload: unknown
  unmatched: boolean
  createdAt: string
}

export type CreateTrackedEmailInput = {
  messageId: string
  recipient: string
  subject: string
  sentAt?: string
}

export type RecordEmailEventInput = {
  messageId: string
  event: EmailStatus
  recipient?: string | null
  occurredAt?: string
  reason?: string | null
  code?: string | null
  ipAddress?: string | null
  rawPayload?: unknown
}

export type ListEmailsFilter = {
  messageId?: string
  recipient?: string
  status?: EmailStatus
  limit?: number
}

export interface EmailTrackingStore {
  createEmail(input: CreateTrackedEmailInput): Promise<TrackedEmail>
  recordEvent(input: RecordEmailEventInput): Promise<{ created: boolean; event: EmailEvent }>
  findByMessageId(messageId: string): Promise<TrackedEmail | null>
  listEmails(filter?: ListEmailsFilter): Promise<TrackedEmail[]>
  listEventsForMessage(messageId: string): Promise<EmailEvent[]>
}

export function normalizeMessageId(value: string | null | undefined): string {
  return value?.trim().replace(/^<|>$/g, "") ?? ""
}

export function normalizeSendLayerEvent(event: string): EmailStatus {
  switch (event.toLowerCase().trim()) {
    case "delivery":
    case "delivered":
      return "delivered"
    case "bounce":
    case "bounced":
    case "failed":
    case "rejected":
      return "bounced"
    case "open":
    case "opened":
      return "opened"
    case "click":
    case "clicked":
      return "clicked"
    case "unsubscribe":
    case "unsubscribed":
      return "unsubscribed"
    case "complaint":
    case "complained":
      return "complained"
    case "sent":
      return "sent"
    default:
      return "unknown"
  }
}

const STATUS_RANK: Record<EmailStatus, number> = {
  unknown: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 100,
  unsubscribed: 100,
  complained: 100,
}

const TERMINAL: ReadonlySet<EmailStatus> = new Set([
  "bounced",
  "unsubscribed",
  "complained",
])

/** Prefer progression and keep terminal bounce/unsubscribe/complaint visible. */
export function shouldUpdateCurrentStatus(
  current: EmailStatus,
  incoming: EmailStatus,
): boolean {
  if (incoming === "unknown") return false
  if (TERMINAL.has(current) && !TERMINAL.has(incoming)) return false
  if (TERMINAL.has(incoming)) return true
  return STATUS_RANK[incoming] >= STATUS_RANK[current]
}

export function buildEventFingerprint(input: {
  messageId: string
  event: string
  recipient?: string | null
  occurredAt?: string | null
  reason?: string | null
  code?: string | null
}): string {
  const raw = [
    normalizeMessageId(input.messageId),
    input.event.toLowerCase(),
    (input.recipient || "").toLowerCase().trim(),
    input.occurredAt || "",
    input.reason || "",
    input.code || "",
  ].join("|")
  return createHash("sha256").update(raw).digest("hex")
}

export function applyEventTimestamps(
  email: TrackedEmail,
  event: EmailStatus,
  occurredAt: string,
  extras?: { reason?: string | null; code?: string | null },
): TrackedEmail {
  const next = { ...email, updatedAt: new Date().toISOString() }
  if (shouldUpdateCurrentStatus(email.currentStatus, event)) {
    next.currentStatus = event
  }
  switch (event) {
    case "delivered":
      next.deliveredAt = next.deliveredAt || occurredAt
      break
    case "opened":
      next.openedAt = next.openedAt || occurredAt
      break
    case "clicked":
      next.clickedAt = next.clickedAt || occurredAt
      break
    case "bounced":
      next.bouncedAt = next.bouncedAt || occurredAt
      if (extras?.reason) next.bounceReason = extras.reason
      if (extras?.code) next.diagnosticCode = extras.code
      break
    case "unsubscribed":
      next.unsubscribedAt = next.unsubscribedAt || occurredAt
      break
    case "complained":
      next.complainedAt = next.complainedAt || occurredAt
      break
    default:
      break
  }
  return next
}

export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
