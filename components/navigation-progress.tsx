"use client"

import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { usePathname, useSearchParams } from "next/navigation"
import { stopNavLoading, subscribeNavLoading } from "@/lib/nav-loading-store"
import { cn } from "@/lib/utils"

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const [bar, setBar] = useState(0)
  const [showChrome, setShowChrome] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return subscribeNavLoading((loading) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
      if (tickTimer.current) {
        clearInterval(tickTimer.current)
        tickTimer.current = null
      }

      if (loading) {
        setShowChrome(true)
        setActive(true)
        setBar(14)
        tickTimer.current = setInterval(() => {
          setBar((prev) => {
            if (prev >= 88) return prev
            const step = prev < 40 ? 8 : prev < 70 ? 4 : 1.5
            return Math.min(88, prev + step)
          })
        }, 180)
        return
      }

      setBar(100)
      setActive(false)
      hideTimer.current = setTimeout(() => {
        setShowChrome(false)
        setBar(0)
        hideTimer.current = null
      }, 220)
    })
  }, [])

  useEffect(() => {
    stopNavLoading()
  }, [pathname, searchParams])

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
    }
  }, [])

  if (!showChrome) return null

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bar)}
        aria-label="Page loading"
      >
        <div
          className="h-full origin-left bg-[#FFCC00] shadow-[0_0_8px_rgba(255,204,0,0.7)] transition-[width] duration-200 ease-out"
          style={{ width: `${bar}%` }}
        />
      </div>

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[90] flex items-start justify-center bg-background/35 pt-[30vh] backdrop-blur-[1px] transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={!active}
      >
        <div className="pointer-events-none flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-2 text-sm font-medium text-foreground shadow-lg">
          <Spinner size={20} />
          Loading…
        </div>
      </div>
    </>
  )
}
