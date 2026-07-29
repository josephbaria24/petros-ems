import { NextResponse } from "next/server"
import { getEmailTrackingStore, normalizeMessageId } from "@/lib/email-tracking"
import { authorizeEmailStatusRequest } from "@/lib/email-tracking/auth"
import { fetchSendLayerEvents, mapApiEventToRecord } from "@/lib/sendlayer/events-api"

export const runtime = "nodejs"

/**
 * Manual reconciliation: fetch SendLayer Events API for a MessageID and store missing events.
 * POST { "messageId": "..." }
 */
export async function POST(request: Request) {
  const auth = await authorizeEmailStatusRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const messageId =
    typeof body === "object" &&
    body !== null &&
    "messageId" in body &&
    typeof (body as { messageId: unknown }).messageId === "string"
      ? normalizeMessageId((body as { messageId: string }).messageId)
      : ""

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 })
  }

  if (!process.env.SENDLAYER_API_KEY) {
    return NextResponse.json(
      { error: "SENDLAYER_API_KEY is not configured" },
      { status: 503 },
    )
  }

  try {
    const apiEvents = await fetchSendLayerEvents({ messageId })
    const store = await getEmailTrackingStore()
    let added = 0
    let skipped = 0

    for (const raw of apiEvents) {
      const mapped = mapApiEventToRecord(raw)
      if (!mapped.messageId) continue
      const result = await store.recordEvent({
        messageId: mapped.messageId,
        event: mapped.event,
        recipient: mapped.recipient,
        occurredAt: mapped.occurredAt,
        reason: mapped.reason,
        code: mapped.code,
        ipAddress: mapped.ipAddress,
        rawPayload: { source: "sendlayer-events-api", event: mapped.event },
      })
      if (result.created) added += 1
      else skipped += 1
    }

    const tracked = await store.findByMessageId(messageId)

    return NextResponse.json({
      ok: true,
      messageId,
      fetched: apiEvents.length,
      added,
      skipped,
      currentStatus: tracked?.currentStatus ?? null,
    })
  } catch (error) {
    console.error(
      "[email-status/reconcile] error:",
      error instanceof Error ? error.message : "unknown",
    )
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 },
    )
  }
}
