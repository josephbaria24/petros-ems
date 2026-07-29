import { NextResponse } from "next/server"
import {
  getEmailTrackingStore,
  isUsingFileEmailTrackingFallback,
  type EmailStatus,
  type TrackedEmail,
} from "@/lib/email-tracking"
import { authorizeEmailStatusRequest } from "@/lib/email-tracking/auth"

export const runtime = "nodejs"

const VALID_STATUSES = new Set<EmailStatus>([
  "sent",
  "delivered",
  "bounced",
  "opened",
  "clicked",
  "unsubscribed",
  "complained",
  "unknown",
])

function sanitizeEmail(email: TrackedEmail, lastEvent: string | null) {
  return {
    messageId: email.messageId,
    recipient: email.recipient,
    subject: email.subject,
    currentStatus: email.currentStatus,
    sentAt: email.sentAt,
    deliveredAt: email.deliveredAt,
    openedAt: email.openedAt,
    clickedAt: email.clickedAt,
    bouncedAt: email.bouncedAt,
    unsubscribedAt: email.unsubscribedAt,
    complainedAt: email.complainedAt,
    bounceReason: email.bounceReason,
    diagnosticCode: email.diagnosticCode,
    updatedAt: email.updatedAt,
    lastEvent,
  }
}

export async function GET(request: Request) {
  const auth = await authorizeEmailStatusRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const messageId = url.searchParams.get("messageId") || undefined
  const recipient = url.searchParams.get("recipient") || undefined
  const statusParam = url.searchParams.get("status") || undefined
  const limitParam = url.searchParams.get("limit")
  const includeHistory = url.searchParams.get("includeHistory") === "1"

  let status: EmailStatus | undefined
  if (statusParam) {
    if (!VALID_STATUSES.has(statusParam as EmailStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
    }
    status = statusParam as EmailStatus
  }

  const limit = limitParam ? Number(limitParam) : 100
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 })
  }

  try {
    const store = await getEmailTrackingStore()
    const emails = await store.listEmails({ messageId, recipient, status, limit })

    const sanitized = await Promise.all(
      emails.map(async (email) => {
        const events = await store.listEventsForMessage(email.messageId)
        const lastEvent = events[0]?.event ?? email.currentStatus
        const base = sanitizeEmail(email, lastEvent)
        if (!includeHistory) return base
        return {
          ...base,
          events: events.map((e) => ({
            event: e.event,
            recipient: e.recipient,
            occurredAt: e.occurredAt,
            reason: e.reason,
            code: e.code,
            unmatched: e.unmatched,
          })),
        }
      }),
    )

    return NextResponse.json({
      emails: sanitized,
      meta: {
        count: sanitized.length,
        storage: isUsingFileEmailTrackingFallback() ? "file" : "supabase",
      },
    })
  } catch (error) {
    console.error(
      "[email-status] error:",
      error instanceof Error ? error.message : "unknown",
    )
    return NextResponse.json({ error: "Failed to load email status" }, { status: 500 })
  }
}
