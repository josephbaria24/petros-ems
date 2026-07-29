import { promises as fs } from "fs"
import path from "path"
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

type FileDb = {
  emails: TrackedEmail[]
  events: EmailEvent[]
}

const DATA_DIR = path.join(process.cwd(), ".data")
const DATA_FILE = path.join(DATA_DIR, "email-events.json")

async function readDb(): Promise<FileDb> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as FileDb
    return {
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    }
  } catch {
    return { emails: [], events: [] }
  }
}

async function writeDb(db: FileDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, DATA_FILE)
}

/**
 * Dev/local fallback. Not durable on Vercel/serverless ephemeral filesystems.
 */
export function createFileEmailTrackingStore(): EmailTrackingStore {
  return {
    async createEmail(input: CreateTrackedEmailInput): Promise<TrackedEmail> {
      const messageId = normalizeMessageId(input.messageId)
      if (!messageId) throw new Error("messageId is required")
      const db = await readDb()
      const existing = db.emails.find((e) => e.messageId === messageId)
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
      db.emails.unshift(email)

      const sentFingerprint = buildEventFingerprint({
        messageId,
        event: "sent",
        recipient: input.recipient,
        occurredAt: email.sentAt,
      })
      if (!db.events.some((e) => e.eventFingerprint === sentFingerprint)) {
        db.events.unshift({
          id: newId("evt"),
          trackedEmailId: email.id,
          messageId,
          event: "sent",
          recipient: input.recipient,
          occurredAt: email.sentAt,
          reason: null,
          code: null,
          ipAddress: null,
          eventFingerprint: sentFingerprint,
          rawPayload: null,
          unmatched: false,
          createdAt: now,
        })
      }

      await writeDb(db)
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

      const db = await readDb()
      const existingEvent = db.events.find((e) => e.eventFingerprint === fingerprint)
      if (existingEvent) {
        return { created: false, event: existingEvent }
      }

      let tracked = db.emails.find((e) => e.messageId === messageId) || null
      const unmatched = !tracked

      if (tracked) {
        tracked = applyEventTimestamps(tracked, input.event, occurredAt, {
          reason: input.reason,
          code: input.code,
        })
        db.emails = db.emails.map((e) => (e.id === tracked!.id ? tracked! : e))
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
      db.events.unshift(event)
      await writeDb(db)
      return { created: true, event }
    },

    async findByMessageId(messageId: string) {
      const id = normalizeMessageId(messageId)
      const db = await readDb()
      return db.emails.find((e) => e.messageId === id) || null
    },

    async listEmails(filter: ListEmailsFilter = {}) {
      const db = await readDb()
      let rows = [...db.emails]
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
      const db = await readDb()
      return db.events
        .filter((e) => e.messageId === id)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    },
  }
}
