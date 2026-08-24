"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"

/**
 * Exchange the OAuth code in the browser.
 * The PKCE verifier lives in browser cookies/storage; a server Route Handler
 * cannot see it, which caused login to bounce back to /login.
 */
export default function AuthCallbackPage() {
  const [status] = useState("Signing you in…")

  useEffect(() => {
    let cancelled = false

    const finishLogin = async () => {
      const supabase = createClient()
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const oauthError = params.get("error_description") || params.get("error")

      if (oauthError) {
        window.location.replace(`/login?error=oauth`)
        return
      }

      if (!code) {
        window.location.replace("/login?error=missing_code")
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return

      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message)
        window.location.replace("/login?error=exchange")
        return
      }

      window.location.replace("/dashboard")
    }

    void finishLogin()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{status}</p>
    </div>
  )
}
