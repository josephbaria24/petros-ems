import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { copyResponseCookies } from "@/lib/supabase-cookie-options"

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/training-schedules",
  "/training-calendar",
  "/courses",
  "/submissions",
  "/admin",
  "/directory-of-trainees",
  "/certificate-id-management",
  "/cert-tracker",
  "/certificate-verifier",
  "/voucher-manager",
  "/trainer-repository",
  "/training-reports",
] as const

/**
 * Supabase session refresh + route protection.
 * Must never throw — uncaught errors become Vercel MIDDLEWARE_INVOCATION_FAILED (500).
 */
export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    // Critical: do NOT touch cookies on the OAuth callback.
    // getUser()/setAll can drop the PKCE code-verifier cookie before exchange.
    if (pathname.startsWith("/auth/callback")) {
      return NextResponse.next()
    }

    const isLogin = pathname === "/login"

    // Do not refresh/write auth cookies on the login page. Oversized Azure
    // session cookies were causing HTTP 431 and wiping the PKCE verifier.
    if (isLogin) {
      return NextResponse.next()
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
      const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
      if (isProtected) {
        return NextResponse.redirect(new URL("/login", req.url))
      }
      return NextResponse.next()
    }

    let supabaseResponse = NextResponse.next({
      request: {
        headers: req.headers,
      },
    })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) => {
              req.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({
              request: {
                headers: req.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
          } catch (cookieError) {
            console.warn(
              "[middleware] cookie setAll fallback:",
              cookieError instanceof Error ? cookieError.message : cookieError,
            )
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                supabaseResponse.cookies.set(name, value, options)
              } catch {
                // ignore individual cookie failures
              }
            })
          }
        },
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // Network / Auth API errors must not look like "logged out" or SSO appears to fail.
    if (userError && userError.message !== "Auth session missing!") {
      console.error("[middleware] getUser:", userError.message)
      return supabaseResponse
    }

    const isProtectedRoute = PROTECTED_PREFIXES.some((route) => pathname.startsWith(route))

    if (isProtectedRoute && !user) {
      const redirectResponse = NextResponse.redirect(new URL("/login", req.url))
      copyResponseCookies(supabaseResponse, redirectResponse)
      return redirectResponse
    }

    return supabaseResponse
  } catch (error) {
    console.error(
      "[middleware] unexpected error (fail-open):",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.next({
      request: {
        headers: req.headers,
      },
    })
  }
}
