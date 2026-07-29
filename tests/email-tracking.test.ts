import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildEventFingerprint,
  createMemoryEmailTrackingStore,
  normalizeMessageId,
  normalizeSendLayerEvent,
  shouldUpdateCurrentStatus,
  type EmailStatus,
} from "../lib/email-tracking"
import { assertWebhookPayloadShape } from "../lib/sendlayer/webhook"

const deliveredFixture = {
  Signature: {
    Timestamp: 1758100959,
    Token: "example-token",
    Signature: "example-signature",
  },
  EventData: {
    Event: "delivered",
    Domain: "example.com",
    MessageID: "example-message-id",
    To: "recipient@example.com",
  },
}

const bouncedFixture = {
  Signature: {
    Timestamp: 1758100959,
    Token: "example-token",
    Signature: "example-signature",
  },
  EventData: {
    Event: "bounced",
    EventType: "failed",
    Domain: "example.com",
    MessageID: "example-message-id",
    BouncedEmailAddress: {
      EmailAddress: "recipient@example.com",
      Status: "smtp;550 5.1.1 User Unknown",
      DiagnosticCode: "5.1.1",
    },
    Reason: "smtp;550 5.1.1 User Unknown",
    Code: "5.1.1",
  },
}

describe("normalizeMessageId", () => {
  it("strips angle brackets", () => {
    assert.equal(normalizeMessageId("<abc@x.com>"), "abc@x.com")
  })
  it("handles nullish", () => {
    assert.equal(normalizeMessageId(null), "")
    assert.equal(normalizeMessageId(undefined), "")
  })
})

describe("normalizeSendLayerEvent", () => {
  it("maps delivery variants", () => {
    assert.equal(normalizeSendLayerEvent("delivery"), "delivered")
    assert.equal(normalizeSendLayerEvent("Delivered"), "delivered")
  })
  it("maps bounce variants", () => {
    assert.equal(normalizeSendLayerEvent("bounce"), "bounced")
    assert.equal(normalizeSendLayerEvent("failed"), "bounced")
    assert.equal(normalizeSendLayerEvent("rejected"), "bounced")
  })
  it("maps engagement events", () => {
    assert.equal(normalizeSendLayerEvent("open"), "opened")
    assert.equal(normalizeSendLayerEvent("click"), "clicked")
    assert.equal(normalizeSendLayerEvent("unsubscribe"), "unsubscribed")
    assert.equal(normalizeSendLayerEvent("complaint"), "complained")
  })
  it("returns unknown for garbage", () => {
    assert.equal(normalizeSendLayerEvent("weird"), "unknown")
  })
})

describe("shouldUpdateCurrentStatus", () => {
  it("does not downgrade opened to delivered", () => {
    assert.equal(shouldUpdateCurrentStatus("opened", "delivered"), false)
  })
  it("does not replace clicked with opened", () => {
    assert.equal(shouldUpdateCurrentStatus("clicked", "opened"), false)
  })
  it("allows terminal bounce over opened", () => {
    assert.equal(shouldUpdateCurrentStatus("opened", "bounced"), true)
  })
  it("keeps bounce against later delivered", () => {
    assert.equal(shouldUpdateCurrentStatus("bounced", "delivered"), false)
  })
  it("ignores unknown", () => {
    assert.equal(shouldUpdateCurrentStatus("sent", "unknown"), false)
  })
})

describe("webhook payload validation", () => {
  it("accepts delivered fixture", () => {
    const parsed = assertWebhookPayloadShape(deliveredFixture)
    assert.equal(parsed.EventData?.Event, "delivered")
  })
  it("accepts bounced fixture", () => {
    const parsed = assertWebhookPayloadShape(bouncedFixture)
    assert.equal(parsed.EventData?.Event, "bounced")
  })
  it("rejects missing EventData", () => {
    assert.throws(() => assertWebhookPayloadShape({ Signature: {} }), /EventData/)
  })
  it("rejects missing event name", () => {
    assert.throws(
      () => assertWebhookPayloadShape({ EventData: { MessageID: "x" } }),
      /Event/,
    )
  })
})

describe("memory store event handling", () => {
  it("records delivery and updates status", async () => {
    const store = createMemoryEmailTrackingStore()
    await store.createEmail({
      messageId: "<example-message-id>",
      recipient: "recipient@example.com",
      subject: "Booking confirmation",
    })
    const { created } = await store.recordEvent({
      messageId: "example-message-id",
      event: normalizeSendLayerEvent("delivered"),
      recipient: "recipient@example.com",
      occurredAt: "2026-01-01T10:00:05.000Z",
    })
    assert.equal(created, true)
    const email = await store.findByMessageId("example-message-id")
    assert.equal(email?.currentStatus, "delivered")
    assert.ok(email?.deliveredAt)
  })

  it("records bounce reason", async () => {
    const store = createMemoryEmailTrackingStore()
    await store.createEmail({
      messageId: "example-message-id",
      recipient: "recipient@example.com",
      subject: "Hi",
    })
    await store.recordEvent({
      messageId: "example-message-id",
      event: "bounced",
      recipient: "recipient@example.com",
      reason: bouncedFixture.EventData.Reason,
      code: bouncedFixture.EventData.Code,
      occurredAt: "2026-01-01T10:00:06.000Z",
    })
    const email = await store.findByMessageId("example-message-id")
    assert.equal(email?.currentStatus, "bounced")
    assert.equal(email?.bounceReason, "smtp;550 5.1.1 User Unknown")
  })

  it("is idempotent for duplicate webhooks", async () => {
    const store = createMemoryEmailTrackingStore()
    await store.createEmail({
      messageId: "example-message-id",
      recipient: "a@b.com",
      subject: "Hi",
    })
    const input = {
      messageId: "example-message-id",
      event: "delivered" as EmailStatus,
      recipient: "a@b.com",
      occurredAt: "2026-01-01T10:00:05.000Z",
    }
    const first = await store.recordEvent(input)
    const second = await store.recordEvent(input)
    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(
      buildEventFingerprint({
        messageId: input.messageId,
        event: input.event,
        recipient: input.recipient,
        occurredAt: input.occurredAt,
      }),
      first.event.eventFingerprint,
    )
  })

  it("stores unmatched events without rejecting", async () => {
    const store = createMemoryEmailTrackingStore()
    const result = await store.recordEvent({
      messageId: "unknown-id",
      event: "opened",
      recipient: "x@y.com",
      occurredAt: "2026-01-01T10:00:05.000Z",
    })
    assert.equal(result.created, true)
    assert.equal(result.event.unmatched, true)
    assert.equal(await store.findByMessageId("unknown-id"), null)
  })

  it("preserves opened when duplicate delivered arrives later", async () => {
    const store = createMemoryEmailTrackingStore()
    await store.createEmail({
      messageId: "m1",
      recipient: "a@b.com",
      subject: "Hi",
    })
    await store.recordEvent({
      messageId: "m1",
      event: "delivered",
      occurredAt: "2026-01-01T10:00:01.000Z",
    })
    await store.recordEvent({
      messageId: "m1",
      event: "opened",
      occurredAt: "2026-01-01T10:00:02.000Z",
    })
    await store.recordEvent({
      messageId: "m1",
      event: "delivered",
      occurredAt: "2026-01-01T10:00:03.000Z",
    })
    const email = await store.findByMessageId("m1")
    assert.equal(email?.currentStatus, "opened")
  })

  it("keeps event history for unknown events without changing status", async () => {
    const store = createMemoryEmailTrackingStore()
    await store.createEmail({
      messageId: "m2",
      recipient: "a@b.com",
      subject: "Hi",
    })
    await store.recordEvent({
      messageId: "m2",
      event: "unknown",
      occurredAt: "2026-01-01T10:00:01.000Z",
    })
    const email = await store.findByMessageId("m2")
    assert.equal(email?.currentStatus, "sent")
    const events = await store.listEventsForMessage("m2")
    assert.ok(events.some((e) => e.event === "unknown"))
  })
})
