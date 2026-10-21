"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const THRESHOLD = 72
const MAX_PULL = 128
const RESISTANCE = 0.42

function isInstalledApp() {
  if (typeof window === "undefined") return false
  const mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches
  const iosStandalone =
    "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

type Phase = "idle" | "pulling" | "ready" | "refreshing"

export function PullToRefresh({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const startX = useRef(0)
  const pulling = useRef(false)
  const armed = useRef(false)
  const pullRef = useRef(0)
  const phaseRef = useRef<Phase>("idle")
  const [enabled, setEnabled] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [pull, setPull] = useState(0)

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const setPullBoth = useCallback((next: number) => {
    pullRef.current = next
    setPull(next)
  }, [])

  useEffect(() => {
    setEnabled(isInstalledApp())
    const mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)")
    const sync = () => setEnabled(isInstalledApp())
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  const reset = useCallback(() => {
    pulling.current = false
    armed.current = false
    setPullBoth(0)
    if (phaseRef.current !== "refreshing") setPhaseBoth("idle")
  }, [setPhaseBoth, setPullBoth])

  const refresh = useCallback(async () => {
    setPhaseBoth("refreshing")
    setPullBoth(THRESHOLD)
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    window.location.reload()
  }, [setPhaseBoth, setPullBoth])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !enabled) return

    const onTouchStart = (event: TouchEvent) => {
      if (phaseRef.current === "refreshing") return
      if (event.touches.length !== 1) return
      if (scroller.scrollTop > 1) {
        armed.current = false
        return
      }
      const touch = event.touches[0]
      startY.current = touch.clientY
      startX.current = touch.clientX
      armed.current = true
      pulling.current = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!armed.current || phaseRef.current === "refreshing") return

      const touch = event.touches[0]
      const dy = touch.clientY - startY.current
      const dx = touch.clientX - startX.current

      if (!pulling.current) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          armed.current = false
          return
        }
        if (dy < 8 || scroller.scrollTop > 1) {
          if (dy < 0) armed.current = false
          return
        }
        pulling.current = true
      }

      if (dy <= 0) {
        setPullBoth(0)
        setPhaseBoth("idle")
        return
      }

      if (event.cancelable) event.preventDefault()

      const distance = Math.min(MAX_PULL, dy * RESISTANCE)
      setPullBoth(distance)
      setPhaseBoth(distance >= THRESHOLD ? "ready" : "pulling")
    }

    const onTouchEnd = () => {
      if (phaseRef.current === "refreshing") return
      if (!pulling.current) {
        reset()
        return
      }
      if (pullRef.current >= THRESHOLD) {
        void refresh()
        return
      }
      reset()
    }

    scroller.addEventListener("touchstart", onTouchStart, { passive: true })
    scroller.addEventListener("touchmove", onTouchMove, { passive: false })
    scroller.addEventListener("touchend", onTouchEnd)
    scroller.addEventListener("touchcancel", onTouchEnd)

    return () => {
      scroller.removeEventListener("touchstart", onTouchStart)
      scroller.removeEventListener("touchmove", onTouchMove)
      scroller.removeEventListener("touchend", onTouchEnd)
      scroller.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [enabled, refresh, reset, setPhaseBoth, setPullBoth])

  const progress = Math.min(1, pull / THRESHOLD)
  const visible = enabled && (phase !== "idle" || pull > 0)

  return (
    <div
      ref={scrollerRef}
      className={cn("relative", className)}
      style={{ overscrollBehaviorY: enabled ? "contain" : undefined }}
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-[65] flex justify-center pt-2 transition-opacity duration-150",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
        <div
          className="flex flex-col items-center gap-1.5"
          style={{
            transform: `translateY(${Math.max(4, pull * 0.9)}px) scale(${0.72 + progress * 0.28})`,
          }}
        >
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full border border-[#FFCC00]/70 bg-white/95 shadow-lg shadow-[#FFCC00]/25 dark:bg-[#161824]",
              phase === "ready" && "ring-2 ring-[#FFCC00]/80 ring-offset-2 ring-offset-transparent"
            )}
          >
            <Spinner size={phase === "refreshing" ? 28 : 22 + Math.round(progress * 6)} />
          </div>
          <span className="rounded-full bg-[#1A1D66]/90 px-2.5 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
            {phase === "refreshing" ? "Refreshing…" : phase === "ready" ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      <div
        className="min-h-full w-full min-w-0 max-w-full"
        style={{
          transform: pull > 0 || phase === "refreshing" ? `translateY(${pull * 0.35}px)` : undefined,
          transition: phase === "pulling" || phase === "ready" ? "none" : "transform 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  )
}
