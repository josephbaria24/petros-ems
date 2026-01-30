//app\auth\callback\page.tsx
'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.push("/dashboard")
      } else {
        // Wait briefly then try again (sometimes token is delayed)
        setTimeout(checkSession, 1000)
      }
    }

    checkSession()
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-sm text-muted-foreground">Finishing login... Please wait.</p>
    </div>
  )
}