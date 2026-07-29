import {
  applyEventTimestamps,
  buildEventFingerprint,
  normalizeMessageId,
  newId,
  type CreateTrackedEmailInput,
  type EmailEvent,
  type EmailTrackingStore,
  type ListEmailsFilter,
  type RecordEmailEventInput,
  type TrackedEmail,
} from "./types"

/**
 * In-memory store for unit tests only. Not durable across processes.
 */
export function createMemoryEmailTrackingStore(): EmailTrackingStore {
  const emails: TrackedEmail[] = []
  const events: EmailEvent[] = []

  return {
    async createEmail(input: CreateTrackedEmailInput): Promise<TrackedEmail> {
      const messageId = normalizeMessageId(input.messageId)
      if (!messageId) throw new Error("messageId is required")
      const existing = emails.find((e) => e.messageId === messageId)
      if (existing) return existing

      const now = input.sentAt || new Date().toISOString()
      const email: TrackedEmail = {
        id: newId("tem"),
        messageId,
        recipient: input.recipient,
        subject: input.subject,
        currentStatus: "sent",
        sentAt: now,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        unsubscribedAt: null,
        complainedAt: null,
        bounceReason: null,
        diagnosticCode: null,
        createdAt: now,
        updatedAt: now,
      }
      emails.unshift(email)

      const fingerprint = buildEventFingerprint({
        messageId,
        event: "sent",
        recipient: input.recipient,
        occurredAt: now,
      })
      events.unshift({
        id: newId("evt"),
        trackedEmailId: email.id,
        messageId,
        event: "sent",
        recipient: input.recipient,
        occurredAt: now,
        reason: null,
        code: null,
        ipAddress: null,
        eventFingerprint: fingerprint,
        rawPayload: null,
        unmatched: false,
        createdAt: now,
      })

      return email
    },

    async recordEvent(input: RecordEmailEventInput) {
      const messageId = normalizeMessageId(input.messageId)
      const occurredAt = input.occurredAt || new Date().toISOString()
      const fingerprint = buildEventFingerprint({
        messageId,
        event: input.event,
        recipient: input.recipient,
        occurredAt,
        reason: input.reason,
        code: input.code,
      })

      const existingEvent = events.find((e) => e.eventFingerprint === fingerprint)
      if (existingEvent) {
        return { created: false, event: existingEvent }
      }

      let tracked = emails.find((e) => e.messageId === messageId) || null
      const unmatched = !tracked

      if (tracked) {
        tracked = applyEventTimestamps(tracked, input.event, occurredAt, {
          reason: input.reason,
          code: input.code,
        })
        const idx = emails.findIndex((e) => e.id === tracked!.id)
        if (idx >= 0) emails[idx] = tracked
      }

      const event: EmailEvent = {
        id: newId("evt"),
        trackedEmailId: tracked?.id ?? null,
        messageId,
        event: input.event,
        recipient: input.recipient ?? tracked?.recipient ?? null,
        occurredAt,
        reason: input.reason ?? null,
        code: input.code ?? null,
        ipAddress: input.ipAddress ?? null,
        eventFingerprint: fingerprint,
        rawPayload: input.rawPayload ?? null,
        unmatched,
        createdAt: new Date().toISOString(),
      }
      events.unshift(event)
      return { created: true, event }
    },

    async findByMessageId(messageId: string) {
      const id = normalizeMessageId(messageId)
      return emails.find((e) => e.messageId === id) || null
    },

    async listEmails(filter: ListEmailsFilter = {}) {
      let rows = [...emails]
      if (filter.messageId) {
        const id = normalizeMessageId(filter.messageId)
        rows = rows.filter((e) => e.messageId === id)
      }
      if (filter.recipient) {
        const q = filter.recipient.toLowerCase()
        rows = rows.filter((e) => e.recipient.toLowerCase().includes(q))
      }
      if (filter.status) {
        rows = rows.filter((e) => e.currentStatus === filter.status)
      }
      rows.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      return rows.slice(0, Math.min(Math.max(filter.limit ?? 100, 1), 500))
    },

    async listEventsForMessage(messageId: string) {
      const id = normalizeMessageId(messageId)
      return events
        .filter((e) => e.messageId === id)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    },
  }
}
