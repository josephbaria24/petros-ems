//components\app-header.tsx
"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Moon, Sun, Bell } from "lucide-react"
import { createClient, tmsDb } from "@/lib/supabase-client"

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

export function AppHeader() {
  const { theme, setTheme } = useTheme()
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
  
  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = async (id: string) => {
    await tmsDb
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    
    if (unreadIds.length === 0) return

    await tmsDb
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds)
    
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    )
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

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
    <header className="sticky top-0 z-50 flex h-16 items-center border-b-4 border-[#FFCC00] justify-between border-0 shadow-md bg-[#1A1D66] px-6">
      <div className="container mx-auto flex items-center gap-4 px-4 py-4 sm:py-5">
    <img
      src="/trans-logo.png"
      alt="Petrosphere Logo"
      className="h-10 sm:h-12 w-auto object-contain"
    />

  </div>
    


      <div className="flex items-center gap-3">
        <Button
          className="cursor-pointer text-[#daae02]"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative cursor-pointer">
              <Bell className="h-5 w-5 text-[#daae02]" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto bg-card">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-auto py-1 px-2 text-xs cursor-pointer hover:bg-muted"
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
  <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
) : (
  notifications.map((note) => {
    const formatScheduleDate = () => {
      if (!note.schedule_info?.dates) return "";
      
      const scheduleType = note.schedule_info.schedule_type;
      const dates = note.schedule_info.dates;
      
      if (scheduleType === "regular" && dates.length > 0) {
        const start = new Date(dates[0].start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const end = new Date(dates[0].end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${start} - ${end}`;
      } else if (scheduleType === "staggered" && dates.length > 0) {
        return dates.map((d: any) => 
          new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        ).join(", ");
      }
      return "";
    };

    const handleNotificationClick = () => {
      markAsRead(note.id);
      
      if (note.schedule_info?.schedule_id && note.training_id) {
        // Navigate to submissions page with highlight parameter
        router.push(
          `/submissions?scheduleId=${note.schedule_info.schedule_id}&highlight=${note.training_id}`
        );
      }
    };

    return (
      <DropdownMenuItem
        key={note.id}
        onClick={handleNotificationClick}
        className={`flex items-start space-x-3 cursor-pointer py-3 ${
          !note.read ? "bg-muted/50" : ""
        }`}
      >
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={note.photo_url || "/placeholder.svg"} alt={note.trainee_name || "User"} />
          <AvatarFallback>
            {note.trainee_name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col flex-1 min-w-0">
          <p className={`text-sm ${!note.read ? "font-bold" : "text-muted-foreground"}`}>
            {note.trainee_name || "Unknown"}
          </p>
          <p className={`text-xs ${!note.read ? "font-semibold" : "text-muted-foreground"}`}>
            {note.title}
          </p>
          {formatScheduleDate() && (
            <p className="text-xs text-blue-600 mt-0.5">
              📅 {formatScheduleDate()}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {formatTimeAgo(note.created_at)}
        </span>
      </DropdownMenuItem>
    );
  })
)}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage src={userPhoto ?? undefined} alt={userName} />
                <AvatarFallback className="bg-primary text-primary-foreground">
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
    </header>
  )
}