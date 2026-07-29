import { NextResponse } from "next/server"
import { getEmailTrackingStore, normalizeMessageId, normalizeSendLayerEvent } from "@/lib/email-tracking"
import { assertWebhookPayloadShape, redactWebhookForLog } from "@/lib/sendlayer/webhook"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let payload
  try {
    payload = assertWebhookPayloadShape(body)
  } catch (error) {
    console.warn(
      "[sendlayer-webhook] malformed payload:",
      error instanceof Error ? error.message : "unknown",
    )
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 })
  }

  const eventData = payload.EventData!
  const eventName = String(eventData.Event || eventData.EventType || "")
  const status = normalizeSendLayerEvent(eventName)
  const messageId = normalizeMessageId(eventData.MessageID)
  const recipient =
    eventData.To ||
    eventData.BouncedEmailAddress?.EmailAddress ||
    null
  const reason =
    eventData.Reason ||
    eventData.BouncedEmailAddress?.Status ||
    null
  const code =
    eventData.Code ||
    eventData.BouncedEmailAddress?.DiagnosticCode ||
    null

  const occurredAt = payload.Signature?.Timestamp
    ? new Date(payload.Signature.Timestamp * 1000).toISOString()
    : new Date().toISOString()

  try {
    const store = await getEmailTrackingStore()

    // SMTP Message-ID correlation should be tested with a real SendLayer send —
    // provider-generated identifiers may vary in formatting from Nodemailer info.messageId.
    const result = await store.recordEvent({
      messageId,
      event: status,
      recipient,
      occurredAt,
      reason,
      code,
      ipAddress: eventData.IPAddress ?? null,
      rawPayload: redactWebhookForLog(payload),
    })

    if (result.event.unmatched) {
      console.warn(
        "[sendlayer-webhook] unmatched MessageID",
        JSON.stringify({
          messageId: messageId || "(empty)",
          event: status,
          recipient,
        }),
      )
    }

    return NextResponse.json({
      ok: true,
      created: result.created,
      event: status,
      unmatched: result.event.unmatched,
    })
  } catch (error) {
    console.error(
      "[sendlayer-webhook] processing error:",
      error instanceof Error ? error.message : "unknown",
    )
    // Return 200 for valid payloads so SendLayer does not hammer retries on storage blips
    // when the event shape was already accepted. Log for ops follow-up.
    return NextResponse.json({ ok: true, stored: false })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
