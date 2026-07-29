import { normalizeMessageId, normalizeSendLayerEvent, type EmailStatus } from "@/lib/email-tracking"

export type SendLayerApiEvent = {
  Event?: string
  EventType?: string
  MessageID?: string
  To?: string
  Reason?: string
  Code?: string
  Timestamp?: number | string
  IPAddress?: string
  [key: string]: unknown
}

function requireApiKey(): string {
  const key = process.env.SENDLAYER_API_KEY
  if (!key) {
    throw new Error("SENDLAYER_API_KEY is not configured")
  }
  return key
}

/**
 * Server-only Events API client for reconciliation / debugging.
 * Do not call from the browser.
 */
export async function fetchSendLayerEvents(params: {
  messageId?: string
  event?: string
}): Promise<SendLayerApiEvent[]> {
  const apiKey = requireApiKey()
  const url = new URL("https://console.sendlayer.com/api/v1/events")
  if (params.messageId) url.searchParams.set("MessageID", normalizeMessageId(params.messageId))
  if (params.event) url.searchParams.set("Event", params.event)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`SendLayer Events API failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`)
  }

  const json = await response.json()
  if (Array.isArray(json)) return json as SendLayerApiEvent[]
  if (Array.isArray(json?.data)) return json.data as SendLayerApiEvent[]
  if (Array.isArray(json?.Events)) return json.Events as SendLayerApiEvent[]
  return []
}

export function mapApiEventToRecord(event: SendLayerApiEvent): {
  messageId: string
  event: EmailStatus
  recipient: string | null
  occurredAt: string
  reason: string | null
  code: string | null
  ipAddress: string | null
} {
  const name = String(event.Event || event.EventType || "unknown")
  const ts = event.Timestamp
  const occurredAt =
    typeof ts === "number"
      ? new Date(ts * (ts < 1e12 ? 1000 : 1)).toISOString()
      : typeof ts === "string" && ts
        ? new Date(ts).toISOString()
        : new Date().toISOString()

  return {
    messageId: normalizeMessageId(String(event.MessageID || "")),
    event: normalizeSendLayerEvent(name),
    recipient: typeof event.To === "string" ? event.To : null,
    occurredAt,
    reason: typeof event.Reason === "string" ? event.Reason : null,
    code: typeof event.Code === "string" ? event.Code : null,
    ipAddress: typeof event.IPAddress === "string" ? event.IPAddress : null,
  }
}
