"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { closeMobileNav, subscribeMobileNav } from "@/lib/mobile-nav-store"
import { cn } from "@/lib/utils"

/**
 * Owns mobile drawer open state outside AppShell so opening the menu
 * does not re-render page content (which felt like lag on heavy routes).
 */
export function MobileNavDrawer() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  )

  useEffect(() => subscribeMobileNav(setOpen), [])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      setIsDesktop(mq.matches)
      if (mq.matches) closeMobileNav()
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    closeMobileNav()
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNav()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (isDesktop) return null

  return (
    <div aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity duration-150 ease-out",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobileNav}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[80] w-[min(100vw,18.5rem)] max-w-[18.5rem]",
          "transform-gpu will-change-transform contain-paint",
          "transition-transform duration-150 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar variant="mobile" onNavigate={closeMobileNav} />
      </aside>
    </div>
  )
}
