/**
 * Minimal HTTP-level checks for webhook + protected status endpoint.
 * Run with: npm test
 */

import assert from "node:assert/strict"
import { describe, it, before } from "node:test"
import { mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const tmpRoot = path.join(os.tmpdir(), `email-tracking-test-${process.pid}`)

before(() => {
  process.env.EMAIL_TRACKING_STORE = "file"
  process.env.EMAIL_STATUS_ADMIN_TOKEN = "test-admin-token-please-change"
  // Isolate file store from project .data by chdir into temp — file store uses process.cwd()
  mkdirSync(tmpRoot, { recursive: true })
  process.chdir(tmpRoot)
})

describe("webhook route", () => {
  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("../app/api/webhooks/sendlayer/route")
    const req = new Request("http://localhost/api/webhooks/sendlayer", {
      method: "POST",
      body: "{not-json",
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    assert.equal(res.status, 400)
  })

  it("returns 400 for missing EventData", async () => {
    const { POST } = await import("../app/api/webhooks/sendlayer/route")
    const req = new Request("http://localhost/api/webhooks/sendlayer", {
      method: "POST",
      body: JSON.stringify({ Signature: {} }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    assert.equal(res.status, 400)
  })

  it("returns 200 for delivered event", async () => {
    const { POST } = await import("../app/api/webhooks/sendlayer/route")
    const req = new Request("http://localhost/api/webhooks/sendlayer", {
      method: "POST",
      body: JSON.stringify({
        Signature: { Timestamp: 1758100959, Token: "t", Signature: "s" },
        EventData: {
          Event: "delivered",
          MessageID: "route-test-message-id",
          To: "recipient@example.com",
        },
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.ok, true)
  })
})

describe("email-status auth", () => {
  it("rejects missing auth", async () => {
    const { GET } = await import("../app/api/email-status/route")
    const req = new Request("http://localhost/api/email-status")
    const res = await GET(req)
    assert.equal(res.status, 401)
  })

  it("accepts bearer token", async () => {
    const { GET } = await import("../app/api/email-status/route")
    const req = new Request("http://localhost/api/email-status?limit=5", {
      headers: { Authorization: "Bearer test-admin-token-please-change" },
    })
    const res = await GET(req)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.ok(Array.isArray(json.emails))
  })

  it("never treats query token as auth", async () => {
    const { GET } = await import("../app/api/email-status/route")
    const req = new Request(
      "http://localhost/api/email-status?token=test-admin-token-please-change",
    )
    const res = await GET(req)
    assert.equal(res.status, 401)
  })
})

process.on("exit", () => {
  try {
    rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    // ignore
  }
})
