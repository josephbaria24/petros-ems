import { createFileEmailTrackingStore } from "./file-store"
import type { CreateTrackedEmailInput, EmailTrackingStore } from "./types"

let cachedStore: EmailTrackingStore | null = null
let usingFileFallback = false

export async function getEmailTrackingStore(): Promise<EmailTrackingStore> {
  if (cachedStore) return cachedStore

  const preferFile = process.env.EMAIL_TRACKING_STORE === "file"
  if (!preferFile && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createSupabaseEmailTrackingStore, isSupabaseEmailTrackingAvailable } =
        await import("./supabase-store")
      const ok = await isSupabaseEmailTrackingAvailable()
      if (ok) {
        cachedStore = createSupabaseEmailTrackingStore()
        usingFileFallback = false
        return cachedStore
      }
      console.warn(
        "[email-tracking] tracked_emails table unavailable; falling back to .data/email-events.json (not durable on serverless).",
      )
    } catch (error) {
      console.warn(
        "[email-tracking] Supabase store unavailable; using file fallback.",
        error instanceof Error ? error.message : error,
      )
    }
  }

  cachedStore = createFileEmailTrackingStore()
  usingFileFallback = true
  return cachedStore
}

export function isUsingFileEmailTrackingFallback(): boolean {
  return usingFileFallback
}

/** Best-effort tracking after SMTP send — never throws to callers. */
export async function trackSentEmailSafe(input: CreateTrackedEmailInput): Promise<void> {
  try {
    const store = await getEmailTrackingStore()
    await store.createEmail(input)
  } catch (error) {
    console.error(
      "[email-tracking] failed to create tracked email:",
      error instanceof Error ? error.message : error,
    )
  }
}

export * from "./types"
export { createFileEmailTrackingStore } from "./file-store"
export { createMemoryEmailTrackingStore } from "./memory-store"
