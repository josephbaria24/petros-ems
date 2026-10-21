"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "petrosphere-tms-pwa-install-dismissed"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isIos() {
  if (typeof window === "undefined") return false
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    const host = window.location.hostname
    const allow = process.env.NODE_ENV === "production" || host === "localhost" || host === "127.0.0.1"
    if (!allow) return
    navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === "1") return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)

    if (isIos()) {
      setShowIos(true)
      setVisible(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1")
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
        "pointer-events-none"
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[#e6e6f2] bg-white p-3 shadow-lg dark:border-[#3b3b46] dark:bg-[#161824]">
        <div className="mt-0.5 rounded-xl bg-[#1A1D66] p-2 text-white">
          <Download className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#141454] dark:text-white">Install Petrosphere TMS</p>
          {showIos && !deferred ? (
            <p className="mt-1 text-xs leading-5 text-[#7c7d91] dark:text-[#c4c6d4]">
              On iPhone/iPad: tap <Share className="mx-0.5 inline size-3.5 align-text-bottom" /> Share, then{" "}
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#7c7d91] dark:text-[#c4c6d4]">
              Add it to your home screen for quick access like an app.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {deferred && (
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#1A1D66] text-white hover:bg-[#141654]"
                onClick={install}
              >
                Install
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-md p-1 text-[#7c7d91] hover:bg-[#f3f3fa] dark:hover:bg-[#2e3040]"
          onClick={dismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
