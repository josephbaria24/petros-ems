//components\login-form.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { clearSupabaseAuthStorage } from "@/lib/clear-supabase-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

      // Navigate only after the PKCE verifier cookie is written.
      window.location.assign(data.url)
    } catch (err) {
      console.error("Unexpected error:", err)
      setErrorMsg("Unexpected error occurred. Please contact support.")
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <div className="relative text-center text-sm">
            <img src="/trans-logo-dark.png" alt="Petrosphere Logo" className="mx-auto h-10" />
          </div>
          <CardTitle className="text-xl">Sign in to your account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 cursor-pointer"
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" width="20" height="20">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
              )}
              {isLoading ? "Redirecting..." : "Login with Microsoft"}
            </Button>

            {errorMsg && (
              <p className="text-sm text-red-500 text-center -mt-2">{errorMsg}</p>
            )}
          </div>
        </CardContent>
      </Card>
      {/* <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </div> */}
    </div>
  )
}