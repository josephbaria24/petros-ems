import { z } from "zod"

export const SendLayerWebhookPayloadSchema = z
  .object({
    Signature: z
      .object({
        Timestamp: z.number().optional(),
        Token: z.string().optional(),
        Signature: z.string().optional(),
      })
      .optional(),
    EventData: z
      .object({
        Event: z.string().optional(),
        EventType: z.string().optional(),
        Domain: z.string().optional(),
        MessageID: z.string().optional(),
        To: z.string().optional(),
        IPAddress: z.string().optional(),
        Reason: z.string().optional(),
        Code: z.string().optional(),
        BouncedEmailAddress: z
          .object({
            EmailAddress: z.string().optional(),
            Status: z.string().optional(),
            DiagnosticCode: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough()

export type SendLayerWebhookPayload = z.infer<typeof SendLayerWebhookPayloadSchema>

/**
 * SECURITY NOTE:
 * SendLayer webhook payloads include a Signature object, but this project does not
 * include an officially documented verification algorithm in installed packages/docs.
 * We validate payload shape, require POST, and recommend HTTPS + dashboard-only URL.
 * Do NOT treat presence of Signature fields as cryptographic verification.
 * Do NOT compare Signature values against SENDLAYER_API_KEY unless official docs say so.
 */
export function assertWebhookPayloadShape(body: unknown): SendLayerWebhookPayload {
  const parsed = SendLayerWebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`Malformed SendLayer webhook payload: ${parsed.error.message}`)
  }
  if (!parsed.data.EventData) {
    throw new Error("Malformed SendLayer webhook payload: missing EventData")
  }
  const eventName = parsed.data.EventData.Event || parsed.data.EventData.EventType
  if (!eventName) {
    throw new Error("Malformed SendLayer webhook payload: missing Event/EventType")
  }
  return parsed.data
}

export function redactWebhookForLog(payload: SendLayerWebhookPayload): unknown {
  return {
    EventData: {
      Event: payload.EventData?.Event,
      EventType: payload.EventData?.EventType,
      MessageID: payload.EventData?.MessageID,
      To: payload.EventData?.To,
      Reason: payload.EventData?.Reason,
      Code: payload.EventData?.Code,
      Domain: payload.EventData?.Domain,
      BouncedEmailAddress: payload.EventData?.BouncedEmailAddress
        ? {
            EmailAddress: payload.EventData.BouncedEmailAddress.EmailAddress,
            Status: payload.EventData.BouncedEmailAddress.Status,
            DiagnosticCode: payload.EventData.BouncedEmailAddress.DiagnosticCode,
          }
        : undefined,
    },
    Signature: payload.Signature
      ? { Timestamp: payload.Signature.Timestamp, present: true }
      : undefined,
  }
}
