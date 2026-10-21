"use client"

import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"

export default function HomeRedirectPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.replace("/dashboard")
      } else {
        router.replace("/login")
      }

      setCheckingAuth(false)
    }

    checkAuth()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={28} />
      </div>
    )
  }

  return null
}