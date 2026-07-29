/**
 * One-time helper: register missing SendLayer webhooks for this app.
 * Never runs automatically on build/startup.
 *
 * Usage:
 *   npx tsx scripts/register-sendlayer-webhooks.ts
 *
 * Requires: SENDLAYER_API_KEY, NEXT_PUBLIC_APP_URL (https://your-domain.com)
 */

const EVENTS = ["delivery", "bounce", "open", "click", "unsubscribe", "complaint"] as const

type ListedWebhook = {
  WebhookID?: number
  Id?: number
  Event?: string
  event?: string
  WebhookURL?: string
  Url?: string
  url?: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const apiKey = requireEnv("SENDLAYER_API_KEY")
  const baseUrl = requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")
  const webhookUrl = `${baseUrl}/api/webhooks/sendlayer`

  if (!webhookUrl.startsWith("https://") && !webhookUrl.includes("localhost")) {
    console.warn("Warning: SendLayer expects a publicly accessible HTTPS endpoint.")
  }

  console.log(`Target webhook URL: ${webhookUrl}`)
  console.log("Listing existing webhooks…")

  const listRes = await fetch("https://console.sendlayer.com/api/v1/webhooks", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  })

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "")
    console.error(`Failed to list webhooks (${listRes.status}): ${text.slice(0, 300)}`)
    process.exit(1)
  }

  const listJson = await listRes.json()
  const existing: ListedWebhook[] = Array.isArray(listJson)
    ? listJson
    : Array.isArray(listJson?.data)
      ? listJson.data
      : Array.isArray(listJson?.Webhooks)
        ? listJson.Webhooks
        : []

  const normalizeUrl = (u: string) => u.replace(/\/$/, "").toLowerCase()
  const target = normalizeUrl(webhookUrl)

  for (const event of EVENTS) {
    const already = existing.some((w) => {
      const ev = String(w.Event || w.event || "").toLowerCase()
      const url = normalizeUrl(String(w.WebhookURL || w.Url || w.url || ""))
      return ev === event && url === target
    })

    if (already) {
      console.log(`skip  ${event} (already registered)`)
      continue
    }

    const createRes = await fetch("https://console.sendlayer.com/api/v1/webhooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Event: event,
        WebhookURL: webhookUrl,
      }),
    })

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => "")
      console.error(`fail  ${event}: ${createRes.status} ${text.slice(0, 200)}`)
      continue
    }

    const created = await createRes.json().catch(() => ({}))
    const id = created?.NewWebhookID ?? created?.id ?? "?"
    console.log(`ok    ${event} → webhook id ${id}`)
  }

  console.log("Done. API key was not printed.")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
