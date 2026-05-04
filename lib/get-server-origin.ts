import type { NextRequest } from "next/server"

/**
 * Base URL for server-side HTTP calls to this deployment's own API routes.
 * On Vercel, prefer NEXT_PUBLIC_APP_URL (canonical https URL) — req.nextUrl.origin
 * can be wrong for internal fetches in some cases.
 */
export function getServerOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return req.nextUrl.origin
}
