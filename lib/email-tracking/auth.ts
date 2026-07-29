import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { timingSafeEqual } from "crypto"

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Protect email-status / reconcile endpoints.
 * Accepts Authorization: Bearer EMAIL_STATUS_ADMIN_TOKEN, or a valid Supabase session cookie.
 * Never accepts tokens via query string.
 */
export async function authorizeEmailStatusRequest(request: Request): Promise<
  | { ok: true; via: "bearer" | "session" }
  | { ok: false; status: number; error: string }
> {
  const authHeader = request.headers.get("authorization")
  const adminToken = process.env.EMAIL_STATUS_ADMIN_TOKEN

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim()
    if (!adminToken) {
      return { ok: false, status: 401, error: "Unauthorized" }
    }
    if (!token || !safeEqual(token, adminToken)) {
      return { ok: false, status: 401, error: "Unauthorized" }
    }
    return { ok: true, via: "bearer" }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // no-op in route handlers when only reading session
          },
        },
      },
    )
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      return { ok: true, via: "session" }
    }
  } catch {
    // fall through
  }

  return { ok: false, status: 401, error: "Unauthorized" }
}
