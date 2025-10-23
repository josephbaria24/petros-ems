"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [errorMsg, setErrorMsg] = useState("")

  const handleMicrosoftLogin = async () => {
    setErrorMsg("")

    try {
      await supabase.auth.signOut() // clear old session

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo:
            process.env.NODE_ENV === "development"
              ? "http://localhost:3000/auth/callback"
              : "https://tms.petros-global.com/auth/callback", // change to your prod domain
          scopes: "openid profile email offline_access User.Read"
        },
      })

      if (error) {
        setErrorMsg("SSO Login failed. Please try again.")
        console.error("OAuth error:", error)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setErrorMsg("Unexpected error occurred. Please contact support.")
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <div className="relative text-center text-sm">
            <img src="/petroslogo.png" alt="Petrosphere Logo" className="mx-auto h-10" />
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
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" width="20" height="20">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#7FBA00" d="M12 1h10v10H12z" />
                <path fill="#00A4EF" d="M1 12h10v10H1z" />
                <path fill="#FFB900" d="M12 12h10v10H12z" />
              </svg>
              Login with Microsoft
            </Button>

            {errorMsg && (
              <p className="text-sm text-red-500 text-center -mt-2">{errorMsg}</p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
