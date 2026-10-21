// components/app-shell.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/lib/supabase-client"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNavDrawer } from "@/components/mobile-nav-drawer"
import { NavigationProgress } from "@/components/navigation-progress"
import { PendingCertPrompt } from "@/components/pending-cert-prompt"
import { PwaProvider } from "@/components/pwa/pwa-provider"
import { PullToRefresh } from "@/components/pwa/pull-to-refresh"
import { cn } from "@/lib/utils"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  )

  const publicRoutes = [
    "/login",
    "/auth/callback",
    "/guest",
    "/reupload",
    "/upload-receipt",
    "/client-upload",
    "/evaluation",
    "/view-material",
    "/privacy-policy",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  const isGuestPage =
    pathname.startsWith("/guest") ||
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/client-upload") ||
    pathname.startsWith("/evaluation") ||
    pathname.startsWith("/view-material") ||
    pathname.startsWith("/privacy-policy")

  useEffect(() => {
    if (isPublicRoute) {
      setIsChecking(false)
      setIsAuthenticated(false)
      return
    }

    const supabase = createClient()

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/login")
        return
      }

      setIsAuthenticated(true)
      setIsChecking(false)
    }

    void checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false)
        router.replace("/login")
      } else if (event === "SIGNED_IN" && session) {
        setIsAuthenticated(true)
        setIsChecking(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router, isPublicRoute])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!isPublicRoute && isChecking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary sm:h-12 sm:w-12" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isPublicRoute && !isAuthenticated) {
    return null
  }

  const isGuestRoute = pathname.startsWith("/guest")
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/auth/callback")
  const isFullBleed =
    isGuestRoute ||
    isLoginRoute ||
    pathname.startsWith("/upload-receipt") ||
    pathname.startsWith("/client-upload") ||
    pathname.startsWith("/evaluation") ||
    pathname.startsWith("/trainer-repository") ||
    pathname.startsWith("/view-material") ||
    pathname.startsWith("/privacy-policy")

  const showChrome = !isGuestPage && isAuthenticated

  return (
    <div className="flex h-dvh max-w-[100vw] overflow-hidden">
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
        {showChrome && isDesktop ? <AppSidebar variant="desktop" /> : null}
        {showChrome && !isDesktop ? <MobileNavDrawer /> : null}

        <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
          {showChrome && <AppHeader />}
          {showChrome && <NavigationProgress />}
          {showChrome && <PendingCertPrompt />}
          <PullToRefresh
            className={cn(
              "relative min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden",
              pathname.startsWith("/trainer-repository") ? "overflow-hidden" : "overflow-y-auto"
            )}
          >
            <main
              className={cn(
                "flex min-h-full min-w-0 flex-1 flex-col",
                isFullBleed
                  ? isGuestRoute || isLoginRoute
                    ? "bg-transparent p-0"
                    : "bg-slate-950 p-0"
                  : "bg-background p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6"
              )}
            >
              {children}
            </main>
          </PullToRefresh>
        </div>
      </Suspense>
      <PwaProvider />
    </div>
  )
}
