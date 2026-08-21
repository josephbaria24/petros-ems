import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * OAuth PKCE callback (Microsoft/Azure via Supabase).
 * Exchanges ?code= for a session using cookie-stored code verifier.
 * Must be a Route Handler (not a client page) so @supabase/ssr can read/write cookies.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error")

  let next = url.searchParams.get("next") ?? "/dashboard"
  if (!next.startsWith("/")) next = "/dashboard"

  const loginUrl = new URL("/login", url.origin)
  if (oauthError) {
    loginUrl.searchParams.set("error", "oauth")
    return NextResponse.redirect(loginUrl)
  }

  if (!code) {
    loginUrl.searchParams.set("error", "missing_code")
    return NextResponse.redirect(loginUrl)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    loginUrl.searchParams.set("error", "config")
    return NextResponse.redirect(loginUrl)
  }

  const cookieStore = await cookies()
  const redirectUrl = new URL(next, url.origin)
  // Prefer forwarded host on Vercel so redirects stay on the public domain
  const forwardedHost = request.headers.get("x-forwarded-host")
  const isLocal = process.env.NODE_ENV === "development"
  if (!isLocal && forwardedHost) {
    redirectUrl.protocol = "https:"
    redirectUrl.host = forwardedHost
  }

  let response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Ignored in some runtimes; response cookies below still apply.
          }
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession:", error.message)
    loginUrl.searchParams.set("error", "exchange")
    const fail = NextResponse.redirect(loginUrl)
    // Preserve any cookies already written
    response.cookies.getAll().forEach((c) => fail.cookies.set(c.name, c.value))
    return fail
  }

  return response
}
