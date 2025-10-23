'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export default function AuthCallbackPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.push("/") // ✅ redirect to your protected area
      } else {
        // Wait briefly then try again (sometimes token is delayed)
        setTimeout(checkSession, 1000)
      }
    }

    checkSession()
  }, [supabase, router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-sm text-muted-foreground">Finishing login... Please wait.</p>
    </div>
  )
}
