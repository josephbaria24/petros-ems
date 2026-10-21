//components\app-header.tsx
"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Menu, Moon, Sun, Bell } from "lucide-react"
import { createClient, tmsDb } from "@/lib/supabase-client"
import { openMobileNav } from "@/lib/mobile-nav-store"
import { applyThemeInstant } from "@/lib/apply-theme"

import { fetchMicrosoftPhoto } from "@/lib/fetchMicrosoftPhoto"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { GlobalSearch } from "@/components/global-search"

const NOTIF_PREVIEW_LIMIT = 20

function formatTimeAgo(dateString: string) {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatScheduleDate(note: any) {
  if (!note.schedule_info?.dates) return ""
  const scheduleType = note.schedule_info.schedule_type
  const dates = note.schedule_info.dates
  if (scheduleType === "regular" && dates.length > 0) {
    const start = new Date(dates[0].start_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    const end = new Date(dates[0].end_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    return `${start} - ${end}`
  }
  if (scheduleType === "staggered" && dates.length > 0) {
    return dates
      .map((d: any) =>
        new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      )
      .join(", ")
  }
  return ""
}

/** Isolated so theme flips don't re-render the rest of the header. */
function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    setIsDark(resolvedTheme === "dark")
  }, [resolvedTheme])

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md text-[#daae02] outline-none transition-none hover:bg-white/10 active:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#FFCC00]/50"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        const nextDark = !isDark
        const nextTheme = nextDark ? "dark" : "light"
        setIsDark(nextDark)
        applyThemeInstant(nextTheme)
        // Sync next-themes after paint so the click stays instant.
        window.setTimeout(() => setTheme(nextTheme), 0)
      }}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

function NotificationsMenu({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: any[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [listReady, setListReady] = React.useState(false)
  const unreadCount = React.useMemo(
    () => notifications.reduce((n, item) => n + (item.read ? 0 : 1), 0),
    [notifications]
  )
  const preview = React.useMemo(
    () => notifications.slice(0, NOTIF_PREVIEW_LIMIT),
    [notifications]
  )

  React.useEffect(() => {
    if (!open) {
      setListReady(false)
      return
    }
    const id = requestAnimationFrame(() => setListReady(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  const handleNotificationClick = async (note: any) => {
    void onMarkRead(note.id)

    let scheduleId: string | undefined = note.schedule_info?.schedule_id
    let trainingId: string | undefined = note.training_id

    if (!scheduleId || !trainingId) {
      const title = typeof note.title === "string" ? note.title : ""
      const m = title.match(/New receipt uploaded for\s+(\S+)/i)
      const ref = m?.[1]?.trim()
      if (ref) {
        let { data: bs } = await tmsDb
          .from("booking_summary")
          .select("training_id")
          .eq("reference_number", ref)
          .maybeSingle()
        if (!bs?.training_id) {
          const alt = await tmsDb
            .from("booking_summary")
            .select("training_id")
            .eq("reference_number", ref.toUpperCase())
            .maybeSingle()
          bs = alt.data
        }
        if (bs?.training_id) {
          trainingId = bs.training_id as string
          const { data: tr } = await tmsDb
            .from("trainings")
            .select("schedule_id")
            .eq("id", bs.training_id)
            .single()
          if (tr?.schedule_id) scheduleId = tr.schedule_id as string
        }
      }
    }

    if (!scheduleId || !trainingId) return

    const isReceipt =
      typeof note.title === "string" && note.title.toLowerCase().includes("receipt")
    const paymentParam = isReceipt ? "&openPayment=1" : ""
    router.push(
      `/submissions?scheduleId=${scheduleId}&highlight=${trainingId}&from=all${paymentParam}`
    )
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md text-[#daae02] outline-none transition-none hover:bg-white/10 active:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#FFCC00]/50"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(20rem,calc(100vw-1.5rem))] max-h-96 overflow-auto bg-card duration-100"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-auto cursor-pointer px-2 py-1 text-xs hover:bg-muted"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!listReady ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : preview.length === 0 ? (
          <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
        ) : (
          preview.map((note) => {
            const scheduleLabel = formatScheduleDate(note)
            const initials =
              note.trainee_name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase() || "?"
            return (
              <DropdownMenuItem
                key={note.id}
                onClick={() => void handleNotificationClick(note)}
                className={`flex cursor-pointer items-start space-x-3 py-3 ${
                  !note.read ? "bg-muted/50" : ""
                }`}
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className={`text-sm ${!note.read ? "font-bold" : "text-muted-foreground"}`}>
                    {note.trainee_name || "Unknown"}
                  </p>
                  <p
                    className={`line-clamp-2 text-xs ${
                      !note.read ? "font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {note.title}
                  </p>
                  {scheduleLabel ? (
                    <p className="mt-0.5 text-xs text-blue-600">{scheduleLabel}</p>
                  ) : null}
                </div>
                <span className="flex-shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {formatTimeAgo(note.created_at)}
                </span>
              </DropdownMenuItem>
            )
          })
        )}
        {listReady && notifications.length > NOTIF_PREVIEW_LIMIT ? (
          <div className="px-3 py-2 text-center text-[11px] text-muted-foreground">
            Showing latest {NOTIF_PREVIEW_LIMIT}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader() {
  const router = useRouter()

  const [mounted, setMounted] = React.useState(false)
  const [user, setUser] = React.useState<any>(null)
  const [userPhoto, setUserPhoto] = React.useState<string | null>(null)
  const [notifications, setNotifications] = React.useState<any[]>([])

  React.useEffect(() => {
    const supabase = createClient()

    const fetchUserAndPhoto = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
  
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        const photoUrl = await fetchMicrosoftPhoto(session.provider_token)
        setUserPhoto(photoUrl)
      }
    }
  
  const fetchNotifications = async () => {
  const { data, error } = await tmsDb
    .from("notifications")
    .select("id, title, read, created_at, trainee_name, photo_url, schedule_info, training_id")
    .order("created_at", { ascending: false })

  if (!error) setNotifications(data || [])
}
  
    // 🚀 Real-time subscription
    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new
          setNotifications((prev) => [newNotification, ...prev])
        }
      )
      .subscribe()
  
    fetchUserAndPhoto()
    fetchNotifications()
    setMounted(true)
  
    // 🔁 Clean up subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Cache-Control": "no-store" },
      })
      
      // Force redirect to login
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      router.push("/login")
    }
  }
  
  const markAsRead = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    await tmsDb.from("notifications").update({ read: true }).eq("id", id)
  }, [])

  const markAllAsRead = React.useCallback(async () => {
    setNotifications((prev) => {
      const unreadIds = prev.filter((n) => !n.read).map((n) => n.id)
      if (unreadIds.length === 0) return prev
      void tmsDb.from("notifications").update({ read: true }).in("id", unreadIds)
      return prev.map((n) => ({ ...n, read: true }))
    })
  }, [])

  if (!mounted) return null

  const userName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || "User"
  const userEmail = user?.email || "unknown@domain.com"
  const fallbackInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()


    
  return (
    <header className="sticky top-0 z-40 border-0 border-b-4 border-[#FFCC00] bg-[#1A1D66] pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] shadow-md">
      <div className="flex h-14 items-center gap-1.5 px-3 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 touch-manipulation text-[#FFCC00] transition-none hover:bg-white/10 active:bg-white/15 lg:hidden"
          aria-label="Open menu"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            openMobileNav()
          }}
          onClick={(e) => {
            e.preventDefault()
          }}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img
          src="/logo.png"
          alt="Petrosphere Logo"
          className="h-8 w-8 shrink-0 rounded-md object-contain sm:hidden"
        />
        <img
          src="/trans-logo.png"
          alt="Petrosphere Logo"
          className="hidden h-10 w-auto shrink-0 object-contain sm:block md:h-12"
        />

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:justify-start sm:gap-3">
          <GlobalSearch />
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-0.5 sm:gap-2">
          <ThemeToggleButton />
          <NotificationsMenu
            notifications={notifications}
            onMarkRead={markAsRead}
            onMarkAllRead={markAllAsRead}
          />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-9 shrink-0 rounded-full touch-manipulation transition-none hover:bg-white/10"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userPhoto ?? undefined} alt={userName} />
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {fallbackInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem>Profile Settings</DropdownMenuItem> */}
            {/* <DropdownMenuItem>Account</DropdownMenuItem> */}
            {/* <DropdownMenuItem>Preferences</DropdownMenuItem> */}
            
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive cursor-pointer"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  )
}