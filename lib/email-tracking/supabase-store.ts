import { tmsServerDb } from "@/lib/supabase-server"
import {
  applyEventTimestamps,
  buildEventFingerprint,
  normalizeMessageId,
  newId,
  type CreateTrackedEmailInput,
  type EmailEvent,
  type EmailStatus,
  type EmailTrackingStore,
  type ListEmailsFilter,
  type RecordEmailEventInput,
  type TrackedEmail,
} from "./types"

type EmailRow = {
  id: string
  message_id: string
  recipient: string
  subject: string
  current_status: EmailStatus
  sent_at: string
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  unsubscribed_at: string | null
  complained_at: string | null
  bounce_reason: string | null
  diagnostic_code: string | null
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  tracked_email_id: string | null
  message_id: string
  event: EmailStatus
  recipient: string | null
  occurred_at: string
  reason: string | null
  code: string | null
  ip_address: string | null
  event_fingerprint: string
  raw_payload: unknown
  unmatched: boolean
  created_at: string
}

function mapEmail(row: EmailRow): TrackedEmail {
  return {
    id: row.id,
    messageId: row.message_id,
    recipient: row.recipient,
    subject: row.subject,
    currentStatus: row.current_status,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    openedAt: row.opened_at,
    clickedAt: row.clicked_at,
    bouncedAt: row.bounced_at,
    unsubscribedAt: row.unsubscribed_at,
    complainedAt: row.complained_at,
    bounceReason: row.bounce_reason,
    diagnosticCode: row.diagnostic_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: EventRow): EmailEvent {
  return {
    id: row.id,
    trackedEmailId: row.tracked_email_id,
    messageId: row.message_id,
    event: row.event,
    recipient: row.recipient,
    occurredAt: row.occurred_at,
    reason: row.reason,
    code: row.code,
    ipAddress: row.ip_address,
    eventFingerprint: row.event_fingerprint,
    rawPayload: row.raw_payload,
    unmatched: row.unmatched,
    createdAt: row.created_at,
  }
}

function toEmailRow(email: TrackedEmail): EmailRow {
  return {
    id: email.id,
    message_id: email.messageId,
    recipient: email.recipient,
    subject: email.subject,
    current_status: email.currentStatus,
    sent_at: email.sentAt,
    delivered_at: email.deliveredAt,
    opened_at: email.openedAt,
    clicked_at: email.clickedAt,
    bounced_at: email.bouncedAt,
    unsubscribed_at: email.unsubscribedAt,
    complained_at: email.complainedAt,
    bounce_reason: email.bounceReason,
    diagnostic_code: email.diagnosticCode,
    created_at: email.createdAt,
    updated_at: email.updatedAt,
  }
}

export function createSupabaseEmailTrackingStore(): EmailTrackingStore {
  return {
    async createEmail(input: CreateTrackedEmailInput): Promise<TrackedEmail> {
      const messageId = normalizeMessageId(input.messageId)
      if (!messageId) throw new Error("messageId is required")

      const existing = await this.findByMessageId(messageId)
      if (existing) return existing

      const now = new Date().toISOString()
      const email: TrackedEmail = {
        id: newId("tem"),
        messageId,
        recipient: input.recipient,
        subject: input.subject,
        currentStatus: "sent",
        sentAt: input.sentAt || now,
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

      const { error } = await tmsServerDb.from("tracked_emails").insert(toEmailRow(email))
      if (error) throw error

      const sentFingerprint = buildEventFingerprint({
        messageId,
        event: "sent",
        recipient: input.recipient,
        occurredAt: email.sentAt,
      })
      await tmsServerDb.from("email_events").insert({
        id: newId("evt"),
        tracked_email_id: email.id,
        message_id: messageId,
        event: "sent",
        recipient: input.recipient,
        occurred_at: email.sentAt,
        reason: null,
        code: null,
        ip_address: null,
        event_fingerprint: sentFingerprint,
        raw_payload: null,
        unmatched: false,
        created_at: now,
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

      const { data: existingRows } = await tmsServerDb
        .from("email_events")
        .select("*")
        .eq("event_fingerprint", fingerprint)
        .limit(1)

      if (existingRows?.[0]) {
        return { created: false, event: mapEvent(existingRows[0] as EventRow) }
      }

      let tracked = await this.findByMessageId(messageId)
      const unmatched = !tracked

      if (tracked) {
        tracked = applyEventTimestamps(tracked, input.event, occurredAt, {
          reason: input.reason,
          code: input.code,
        })
        const { error: updateError } = await tmsServerDb
          .from("tracked_emails")
          .update(toEmailRow(tracked))
          .eq("id", tracked.id)
        if (updateError) throw updateError
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

      const { error } = await tmsServerDb.from("email_events").insert({
        id: event.id,
        tracked_email_id: event.trackedEmailId,
        message_id: event.messageId,
        event: event.event,
        recipient: event.recipient,
        occurred_at: event.occurredAt,
        reason: event.reason,
        code: event.code,
        ip_address: event.ipAddress,
        event_fingerprint: event.eventFingerprint,
        raw_payload: event.rawPayload,
        unmatched: event.unmatched,
        created_at: event.createdAt,
      })
      if (error) throw error
      return { created: true, event }
    },

    async findByMessageId(messageId: string) {
      const id = normalizeMessageId(messageId)
      const { data, error } = await tmsServerDb
        .from("tracked_emails")
        .select("*")
        .eq("message_id", id)
        .maybeSingle()
      if (error) throw error
      return data ? mapEmail(data as EmailRow) : null
    },

    async listEmails(filter: ListEmailsFilter = {}) {
      let query = tmsServerDb.from("tracked_emails").select("*").order("sent_at", { ascending: false })
      if (filter.messageId) query = query.eq("message_id", normalizeMessageId(filter.messageId))
      if (filter.status) query = query.eq("current_status", filter.status)
      if (filter.recipient) query = query.ilike("recipient", `%${filter.recipient}%`)
      const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500)
      query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return (data || []).map((row) => mapEmail(row as EmailRow))
    },

    async listEventsForMessage(messageId: string) {
      const id = normalizeMessageId(messageId)
      const { data, error } = await tmsServerDb
        .from("email_events")
        .select("*")
        .eq("message_id", id)
        .order("occurred_at", { ascending: false })
      if (error) throw error
      return (data || []).map((row) => mapEvent(row as EventRow))
    },
  }
}

export async function isSupabaseEmailTrackingAvailable(): Promise<boolean> {
  try {
    const { error } = await tmsServerDb.from("tracked_emails").select("id").limit(1)
    return !error
  } catch {
    return false
  }
}
