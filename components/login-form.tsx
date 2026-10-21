"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { clearSupabaseAuthStorage } from "@/lib/clear-supabase-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    if (err === "exchange" || err === "missing_code" || err === "headers") {
      clearSupabaseAuthStorage()
    }
    if (!err) return
    if (err === "exchange" || err === "missing_code") {
      setErrorMsg("Login session was reset because cookies were too large or incomplete. Click Login with Microsoft again.")
    } else if (err === "oauth") {
      setErrorMsg("Microsoft sign-in was cancelled or failed. Please try again.")
    } else if (err === "config") {
      setErrorMsg("Auth is misconfigured. Contact an administrator.")
    }
  }, [])

  const handleMicrosoftLogin = async () => {
    setErrorMsg("")
    setIsLoading(true)

    try {
      clearSupabaseAuthStorage()
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile",
          skipBrowserRedirect: true,
        },
      })

      if (error || !data?.url) {
        setErrorMsg("SSO Login failed. Please try again.")
        console.error("OAuth error:", error)
        setIsLoading(false)
        return
      }

      window.location.assign(data.url)
    } catch (err) {
      console.error("Unexpected error:", err)
      setErrorMsg("Unexpected error occurred. Please contact support.")
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex w-full flex-col gap-4", className)} {...props}>
      <Button
        type="button"
        onClick={handleMicrosoftLogin}
        disabled={isLoading}
        className="group h-12 w-full gap-3 rounded-xl border-0 bg-white text-[15px] font-semibold text-[#1A1D66] shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:bg-[#FFCC00] hover:text-[#1A1D66] disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" width="20" height="20" aria-hidden>
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M12 1h10v10H12z" />
            <path fill="#00A4EF" d="M1 12h10v10H1z" />
            <path fill="#FFB900" d="M12 12h10v10H12z" />
          </svg>
        )}
        {isLoading ? "Redirecting…" : "Continue with Microsoft"}
      </Button>

      {errorMsg ? (
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-center text-sm leading-snug text-rose-100">
          {errorMsg}
        </p>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-white/55">
        Use your Petrosphere Microsoft account. Access is limited to authorized staff.
      </p>
    </div>
  )
}
