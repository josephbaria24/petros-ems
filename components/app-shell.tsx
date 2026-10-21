// components/app-shell.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
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

  // Keep shell height locked to the visible viewport. On iOS PWA / Chrome,
  // 100dvh can be wrong on first paint (blank band at bottom) until a reflow
  // (e.g. opening the drawer) forces a recalculation.
  useEffect(() => {
    const root = document.documentElement
    const setAppHeight = () => {
      const height = Math.round(window.innerHeight)
      if (height > 0) root.style.setProperty("--app-height", `${height}px`)
    }
    setAppHeight()
    const raf = window.requestAnimationFrame(setAppHeight)
    const t1 = window.setTimeout(setAppHeight, 50)
    const t2 = window.setTimeout(setAppHeight, 300)
    window.addEventListener("resize", setAppHeight)
    window.addEventListener("orientationchange", setAppHeight)
    window.visualViewport?.addEventListener("resize", setAppHeight)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener("resize", setAppHeight)
      window.removeEventListener("orientationchange", setAppHeight)
      window.visualViewport?.removeEventListener("resize", setAppHeight)
    }
  }, [])

  if (!isPublicRoute && isChecking) {
    return (
      <div className="flex min-h-[var(--app-height,100svh)] items-center justify-center">
        <div className="space-y-4 text-center">
          <Spinner size={40} className="mx-auto" />
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
    <div className="flex h-[var(--app-height,100svh)] max-h-[var(--app-height,100svh)] max-w-[100vw] overflow-hidden">
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
        {showChrome && isDesktop ? <AppSidebar variant="desktop" /> : null}
        {showChrome && !isDesktop ? <MobileNavDrawer /> : null}

        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
                "flex min-h-full w-full min-w-0 max-w-full flex-1 flex-col",
                isFullBleed
                  ? isGuestRoute || isLoginRoute
                    ? "bg-transparent p-0"
                    : "bg-slate-950 p-0"
                  : "bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4 md:p-6"
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
