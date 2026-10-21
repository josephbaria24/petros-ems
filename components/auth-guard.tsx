// components/auth-guard.tsx
"use client"

import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase-client"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No session, redirect to login
        router.replace("/login")
        return
      }

      setIsAuthenticated(true)
      setIsChecking(false)
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          router.replace("/login")
        } else if (event === "SIGNED_IN" && session) {
          setIsAuthenticated(true)
          setIsChecking(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={40} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}