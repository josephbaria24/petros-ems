// components/app-shell.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Suspense } from "react"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Define which routes are public (don't require auth)
  const publicRoutes = ["/login", "/auth/callback", "/guest", "/reupload"]
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Define which routes should hide sidebar and header
  const isGuestPage = pathname.startsWith("/guest") || pathname === "/login" || pathname === "/auth/callback"

  useEffect(() => {
    // Skip auth check for public routes (including guest pages)
    if (isPublicRoute) {
      setIsChecking(false)
      setIsAuthenticated(false)
      return
    }

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
          setIsAuthenticated(false)
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
  }, [pathname, router, isPublicRoute])

  // Show loading screen while checking auth (only for protected routes)
  if (!isPublicRoute && isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render protected content if not authenticated (only for protected routes)
  if (!isPublicRoute && !isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<div>Loading...</div>}>
        {!isGuestPage && isAuthenticated && <AppSidebar />}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!isGuestPage && isAuthenticated && <AppHeader />}
          <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
        </div>
      </Suspense>
    </div>
  )
}