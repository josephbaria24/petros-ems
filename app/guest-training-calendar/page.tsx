//app\guest-training-calendar\page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  X,
  Sun,
  Moon,
  Search,
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { tmsDb } from "@/lib/supabase-client"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { CheckCircle, Clock, RefreshCcw } from "lucide-react"
import { cn } from "@/lib/utils"

type NewsItem = {
  title: string
  image: string
  date: string
}

type ScheduleEvent = {
  id: string
  course: string
  courseTitle: string
  branch: string
  status: "planned" | "confirmed" | "cancelled" | "finished" | "ongoing"
  startDate: Date
  endDate: Date
  dates?: Date[]
  scheduleType: "regular" | "staggered"
  cover_image?: string | null
}

function isOnlineBranch(branch: string) {
  const b = branch.trim().toLowerCase()
  return (
    b === "online" ||
    b === "live-online" ||
    b === "live online" ||
    b.includes("online")
  )
}

function deliveryFormatLabel(event: ScheduleEvent): "Live-Online" | "Classroom" {
  return isOnlineBranch(event.branch) ? "Live-Online" : "Classroom"
}

type ListStatusFilter =
  | "active"
  | "all"
  | "upcoming"
  | "ongoing"
  | "finished"
  | "cancelled"

/** Cancelled | Finished | Ongoing | Upcoming — shared by list filter and UI badges. */
function getCalendarStatusLabel(
  event: ScheduleEvent
): "Cancelled" | "Finished" | "Ongoing" | "Upcoming" {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (event.status === "cancelled") return "Cancelled"
  if (event.status === "finished") return "Finished"
  const eventEnd = new Date(event.endDate)
  eventEnd.setHours(0, 0, 0, 0)
  const eventStart = new Date(event.startDate)
  eventStart.setHours(0, 0, 0, 0)
  if (now > eventEnd) return "Finished"
  if (now >= eventStart && now <= eventEnd) return "Ongoing"
  return "Upcoming"
}

function matchesListStatusFilter(event: ScheduleEvent, filter: ListStatusFilter): boolean {
  const label = getCalendarStatusLabel(event)
  switch (filter) {
    case "all":
      return true
    case "active":
      return label === "Upcoming" || label === "Ongoing"
    case "upcoming":
      return label === "Upcoming"
    case "ongoing":
      return label === "Ongoing"
    case "finished":
      return label === "Finished"
    case "cancelled":
      return label === "Cancelled"
    default:
      return true
  }
}

function listStatusSortPriority(label: ReturnType<typeof getCalendarStatusLabel>): number {
  if (label === "Ongoing") return 0
  if (label === "Upcoming") return 1
  if (label === "Finished") return 2
  return 3
}

/** Single lowercased string built from fields so each search keyword can match anywhere (AND). */
function eventSearchHaystack(event: ScheduleEvent): string {
  const label = getCalendarStatusLabel(event)
  const df = deliveryFormatLabel(event)
  const parts: string[] = [
    event.courseTitle,
    event.course,
    event.branch,
    event.id,
    label,
    event.status,
    event.scheduleType,
    df,
    format(event.startDate, "yyyy-MM-dd"),
    format(event.endDate, "yyyy-MM-dd"),
    format(event.startDate, "MMM"),
    format(event.startDate, "MMMM"),
    format(event.endDate, "MMM"),
    format(event.endDate, "MMMM"),
    String(event.startDate.getFullYear()),
    String(event.endDate.getFullYear()),
    String(event.startDate.getDate()),
    String(event.endDate.getDate()),
  ]
  if (event.scheduleType === "staggered" && event.dates?.length) {
    for (const d of event.dates) {
      parts.push(
        format(d, "yyyy-MM-dd"),
        format(d, "MMM"),
        format(d, "MMMM"),
        String(d.getFullYear()),
        String(d.getDate())
      )
    }
  }
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/** Every whitespace-separated keyword must appear somewhere in the haystack. */
function searchMatchesAllKeywords(rawQuery: string, haystack: string): boolean {
  const tokens = rawQuery
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((t) => haystack.includes(t))
}

const LIST_STATUS_FILTER_OPTIONS: {
  key: ListStatusFilter
  label: string
  /** Compact label below `sm` breakpoint */
  labelShort?: string
}[] = [
  { key: "active", label: "Upcoming & ongoing", labelShort: "Active" },
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "finished", label: "Finished" },
  { key: "cancelled", label: "Cancelled", labelShort: "Cancel" },
]

// News Carousel Component
function NewsCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [news, setNews] = useState<NewsItem[]>([])

  // Load news from Supabase
  useEffect(() => {
    const loadNews = async () => {
      const { data, error } = await tmsDb
        .from("news_items")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setNews(data)
      }
    }

    loadNews()
  }, [])

  // Auto-slide effect
  useEffect(() => {
    if (news.length === 0) return

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % news.length)
    }, 4000)

    return () => clearInterval(timer)
  }, [news])

  return (
    <div className="relative">
      <div className="p-2 bg-card ">
        <h3 className="font-bold text-lg">Latest News</h3>
      </div>

      <div className="relative h-62 overflow-hidden">
        {news.map((item, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-500 ${idx === currentSlide ? "opacity-100" : "opacity-0"
              }`}
          >
            <div className="relative h-32 bg-muted">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/course-covers/default.png"
                }}
              />
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.date}</p>
              <h4 className="text-sm font-semibold line-clamp-2">
                {item.title}
              </h4>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 pb-4">
        {news.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide
              ? "bg-primary w-4"
              : "bg-muted-foreground/30"
              }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function TrainingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<"calendar" | "list">("list")
  const [listQuery, setListQuery] = useState("")
  const [listStatusFilter, setListStatusFilter] = useState<ListStatusFilter>("active")
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    const { data, error } = await tmsDb
      .from('schedules')
      .select(`
      id,
      branch,
      status,
      schedule_type,
      courses (name, title, cover_image),
      schedule_ranges (start_date, end_date),
      schedule_dates (date)
    `)

    if (!error && data) {
      const mapped = data
        .map((s: any): ScheduleEvent | null => {
          const course = s.courses?.name || 'Unknown'
          const courseTitle = s.courses?.title || course
          const cover_image = s.courses?.cover_image || null

          if (s.schedule_type === 'regular' && s.schedule_ranges?.[0]) {
            return {
              id: s.id,
              course,
              courseTitle,
              branch: s.branch,
              status: s.status || 'planned',
              startDate: new Date(s.schedule_ranges[0].start_date),
              endDate: new Date(s.schedule_ranges[0].end_date),
              scheduleType: 'regular',
              cover_image
            }
          }

          if (s.schedule_type === 'staggered' && s.schedule_dates?.length) {
            const dates = s.schedule_dates.map((d: any) => new Date(d.date))
            return {
              id: s.id,
              course,
              courseTitle,
              branch: s.branch,
              status: s.status || 'planned',
              startDate: dates[0],
              endDate: dates[dates.length - 1],
              dates,
              scheduleType: 'staggered',
              cover_image
            }
          }

          return null
        })
        .filter((event): event is ScheduleEvent => event !== null)

      setEvents(mapped)
    }
    setLoading(false)
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const listFilteredEvents = useMemo(() => {
    let list = events.filter((e) => matchesListStatusFilter(e, listStatusFilter))
    list.sort((a, b) => {
      const pa = listStatusSortPriority(getCalendarStatusLabel(a))
      const pb = listStatusSortPriority(getCalendarStatusLabel(b))
      if (pa !== pb) return pa - pb
      return a.startDate.getTime() - b.startDate.getTime()
    })
    if (listQuery.trim()) {
      list = list.filter((e) =>
        searchMatchesAllKeywords(listQuery, eventSearchHaystack(e))
      )
    }
    return list
  }, [events, listStatusFilter, listQuery])

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getEventsForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    date.setHours(12, 0, 0, 0)

    const dayEvents = events.filter(event => {
      if (event.scheduleType === 'staggered' && event.dates) {
        return event.dates.some(d => d.toDateString() === date.toDateString())
      } else {
        const eventStart = new Date(event.startDate)
        const eventEnd = new Date(event.endDate)
        eventStart.setHours(0, 0, 0, 0)
        eventEnd.setHours(23, 59, 59, 999)
        return date >= eventStart && date <= eventEnd
      }
    })

    return dayEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }


  const getAllEventsForMonth = () => {
    return events.filter(event => {
      if (event.scheduleType === 'staggered' && event.dates) {
        return event.dates.some(d =>
          d.getFullYear() === currentDate.getFullYear() &&
          d.getMonth() === currentDate.getMonth()
        )
      }

      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)

      return (
        (eventStart.getFullYear() === currentDate.getFullYear() &&
          eventStart.getMonth() === currentDate.getMonth()) ||
        (eventEnd.getFullYear() === currentDate.getFullYear() &&
          eventEnd.getMonth() === currentDate.getMonth()) ||
        (eventStart <= new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0) &&
          eventEnd >= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
      )
    }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }


  const getStatusColor = (event: ScheduleEvent) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // Check cancelled status first
    if (event.status === 'cancelled') return '#ef4444' // red
    if (event.status === 'finished') return '#94a3b8'

    const eventEnd = new Date(event.endDate)
    eventEnd.setHours(0, 0, 0, 0)

    const eventStart = new Date(event.startDate)
    eventStart.setHours(0, 0, 0, 0)

    if (now > eventEnd) return '#94a3b8'
    if (now >= eventStart && now <= eventEnd) return '#f59e0b'
    return '#10b981'
  }

  const getStatusLabel = (event: ScheduleEvent) => getCalendarStatusLabel(event)

  const getStatusBadgeClass = (event: ScheduleEvent) => {
    if (event.status === "cancelled") {
      return "border-red-200 bg-red-100 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    }
    const label = getStatusLabel(event)
    if (label === "Finished") {
      return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    }
    if (label === "Ongoing") {
      return "border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    }
    return "border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
  }

  const enrollmentBlocked = (event: ScheduleEvent) => {
    if (event.status === "cancelled") return true
    if (getStatusLabel(event) === "Ongoing") return true
    if (new Date() > new Date(event.endDate)) return true
    return false
  }

  const openModal = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedEvent(null)
  }

  const renderCalendar = () => {
    const days = daysInMonth(currentDate)
    const firstDay = firstDayOfMonth(currentDate)
    const prevMonthDays = daysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    const cells = []
    const allMonthEvents = getAllEventsForMonth()

    // 1. Assign tracks to all events in the month
    const eventTracks: Record<string, number> = {}

    allMonthEvents.forEach(event => {
      let track = 0
      while (true) {
        const conflict = allMonthEvents.some(otherEvent => {
          if (eventTracks[otherEvent.id] !== track || otherEvent.id === event.id) return false

          if (event.scheduleType === 'staggered' && otherEvent.scheduleType === 'staggered') {
            return event.dates?.some(d1 => otherEvent.dates?.some(d2 => d1.toDateString() === d2.toDateString()))
          } else if (event.scheduleType === 'regular' && otherEvent.scheduleType === 'regular') {
            return event.startDate <= otherEvent.endDate && event.endDate >= otherEvent.startDate
          } else {
            const reg = event.scheduleType === 'regular' ? event : otherEvent
            const stag = event.scheduleType === 'staggered' ? event : otherEvent
            return stag.dates?.some(d => {
              const ds = new Date(d)
              ds.setHours(12, 0, 0, 0)
              return ds >= reg.startDate && ds <= reg.endDate
            })
          }
        })

        if (!conflict) {
          eventTracks[event.id] = track
          break
        }
        track++
      }
    })

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="min-h-20 bg-muted/30 text-muted-foreground text-sm border-r border-b">
          <div className="p-2">{prevMonthDays - i}</div>
        </div>
      )
    }

    for (let day = 1; day <= days; day++) {
      const dayEvents = getEventsForDay(day)
      const isToday = day === new Date().getDate() &&
        currentDate.getMonth() === new Date().getMonth() &&
        currentDate.getFullYear() === new Date().getFullYear()

      const isWeekend = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay() % 6 === 0

      // Get events for this day sorted by track
      const dayEventsWithTracks = dayEvents
        .map(event => ({ event, track: eventTracks[event.id] }))
        .sort((a, b) => a.track - b.track)

      const maxTrack = dayEventsWithTracks.length > 0
        ? Math.max(...dayEventsWithTracks.map(e => e.track))
        : -1

      cells.push(
        <div key={day} className={`border-r border-b ${isToday ? 'bg-blue-50 dark:bg-cyan-900' : ''} relative ${dayEvents.length === 0 ? 'min-h-20' : ''}`}>
          <div className={`text-sm font-semibold p-2 ${isToday ? 'text-blue-600' : isWeekend ? 'text-red-500' : ''}`}>
            {day}
          </div>
          <div className="px-1 pb-1 relative">
            {maxTrack >= 0 && Array.from({ length: maxTrack + 1 }).map((_, trackIdx) => {
              const trackEvent = dayEventsWithTracks.find(e => e.track === trackIdx)

              if (!trackEvent) {
                // Placeholder for empty track to maintain alignment
                return (
                  <div key={`placeholder-${day}-${trackIdx}`} style={{ height: '28px', marginBottom: '4px' }} />
                )
              }

              const { event } = trackEvent
              const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
              const eventStart = new Date(event.startDate)
              const eventEnd = new Date(event.endDate)
              eventDate.setHours(12, 0, 0, 0)
              eventStart.setHours(0, 0, 0, 0)
              eventEnd.setHours(23, 59, 59, 999)

              const isStart = event.scheduleType === 'staggered'
                ? true
                : eventStart.getDate() === day && eventStart.getMonth() === currentDate.getMonth()

              const isEnd = event.scheduleType === 'staggered'
                ? true
                : eventEnd.getDate() === day && eventEnd.getMonth() === currentDate.getMonth()

              const color = getStatusColor(event)
              const displayStatus = getStatusLabel(event)

              return (
                <div
                  key={`${event.id}-${trackIdx}`}
                  className={`text-xs px-2 py-1.5 text-white cursor-pointer 
                    transition-all duration-200 ease-in-out 
                    ${isStart ? 'rounded-l ml-1' : '-ml-1'} 
                    ${isEnd ? 'rounded-r mr-1' : '-mr-1'} 
                    ${hoveredEventId === event.id ? 'ring-3 ring-black dark:ring-white ring-offset-0 scale-[1.02] z-10' : 'scale-100'}
                  `}
                  style={{
                    backgroundColor: color,
                    height: '28px',
                    lineHeight: '16px',
                    marginBottom: '4px'
                  }}
                  onClick={() => openModal(event)}
                  onMouseEnter={() => setHoveredEventId(event.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  title={`${event.courseTitle} - ${event.branch}`}
                >
                  <div className="truncate">
                    {isStart && (
                      <span className={event.status === 'cancelled' ? 'line-through' : ''}>
                        {event.branch} {event.courseTitle} - {displayStatus}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    const totalCells = cells.length
    const remainingCells = Math.ceil(totalCells / 7) * 7 - totalCells
    for (let i = 1; i <= remainingCells; i++) {
      cells.push(
        <div key={`next-${i}`} className="min-h-20 bg-muted/30 text-muted-foreground text-sm border-r border-b">
          <div className="p-2">{i}</div>
        </div>
      )
    }

    return cells
  }

  if (loading) {
    return (
      <div className="bg-background min-h-[50vh] p-6">
        <Card className="mx-auto max-w-lg p-8 text-center text-muted-foreground">Loading calendar…</Card>
      </div>
    )
  }

  return (
    <div className="bg-background w-full min-h-screen">
      <div className="mx-auto max-w-[1400px] px-2 py-3 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex min-h-0 flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="mb-3 flex flex-col gap-2.5 sm:mb-5 sm:gap-4 lg:mb-6">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card shadow-sm sm:h-12 sm:w-12 sm:rounded-xl">
                    <Image
                      src="/logo.png"
                      alt="Logo"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold tracking-tight sm:text-2xl lg:text-3xl">
                      Public Training Calendar
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug sm:text-sm">
                      Browse schedules and enroll in open classes
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="bg-muted inline-flex h-8 w-full max-w-full rounded-full p-0.5 sm:h-9 sm:w-auto sm:p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-full sm:size-8"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="size-3.5 sm:size-4" />
                      ) : (
                        <Moon className="size-3.5 sm:size-4" />
                      )}
                    </Button>
                    <Button
                      variant={viewType === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewType("list")}
                      className="h-7 flex-1 gap-1 rounded-full px-2.5 text-xs sm:h-8 sm:flex-initial sm:gap-1.5 sm:px-3 sm:text-sm"
                    >
                      <List className="size-3.5 shrink-0 sm:size-4" />
                      List
                    </Button>
                    <Button
                      variant={viewType === "calendar" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewType("calendar")}
                      className="h-7 flex-1 gap-1 rounded-full px-2.5 text-xs sm:h-8 sm:flex-initial sm:gap-1.5 sm:px-3 sm:text-sm"
                    >
                      <Calendar className="size-3.5 shrink-0 sm:size-4" />
                      Calendar
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 sm:justify-end">
                    <Badge className="gap-1 border border-yellow-500/30 bg-yellow-400 px-1.5 py-0 text-[9px] text-black sm:gap-1.5 sm:px-2 sm:py-0.5 sm:text-[10px] sm:text-xs">
                      <span className="size-1 rounded-full bg-black sm:size-1.5 sm:size-2" />
                      Upcoming
                    </Badge>
                    <Badge className="gap-1 border border-orange-500/50 bg-orange-500 px-1.5 py-0 text-[9px] text-white sm:gap-1.5 sm:px-2 sm:py-0.5 sm:text-xs">
                      <span className="size-1 rounded-full bg-white sm:size-1.5 sm:size-2" />
                      Ongoing
                    </Badge>
                    <Badge className="gap-1 border-slate-400 bg-slate-400 px-1.5 py-0 text-[9px] text-white sm:gap-1.5 sm:px-2 sm:py-0.5 sm:text-xs">
                      <span className="size-1 rounded-full bg-white sm:size-1.5 sm:size-2" />
                      Finished
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

          {viewType === 'calendar' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={previousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={goToToday}>
                    today
                  </Button>
                </div>

                <h2 className="text-2xl font-bold">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>

                <div className="w-32"></div>
              </div>

              <Card className="overflow-hidden">
                <div className="grid grid-cols-7 border-b bg-muted/50">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                    <div key={day} className={`p-3 text-center font-semibold text-sm border-r last:border-r-0 ${idx === 0 || idx === 6 ? 'text-red-500' : ''}`}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {renderCalendar()}
                </div>
              </Card>
            </>
          )}

            {viewType === "list" && (
              <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
                <div className="flex shrink-0 flex-col gap-2 sm:gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide sm:text-xs sm:normal-case sm:font-medium">
                      Filters
                    </span>
                    <div
                      className="flex max-w-full flex-wrap gap-1 sm:-mx-1 sm:flex-nowrap sm:gap-0.5 sm:overflow-x-auto sm:pb-0.5 sm:[scrollbar-width:thin]"
                      role="tablist"
                      aria-label="Filter by schedule status"
                    >
                      <div className="contents sm:flex sm:rounded-full sm:bg-muted/80 sm:p-0.5 sm:ring-1 sm:ring-border/60">
                        {LIST_STATUS_FILTER_OPTIONS.map(({ key, label, labelShort }) => {
                          const active = listStatusFilter === key
                          return (
                            <button
                              key={key}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setListStatusFilter(key)}
                              className={cn(
                                "shrink-0 rounded-full border font-medium whitespace-nowrap transition-all",
                                "px-2 py-1 text-[10px] sm:border-0 sm:px-3 sm:py-1.5 sm:text-xs sm:text-sm",
                                active
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm sm:shadow-sm"
                                  : "border-border/70 bg-card/50 text-muted-foreground hover:border-border hover:bg-background/90 hover:text-foreground sm:bg-transparent sm:text-muted-foreground",
                                !active && "sm:hover:bg-background/80"
                              )}
                            >
                              {labelShort ? (
                                <>
                                  <span className="sm:hidden">{labelShort}</span>
                                  <span className="hidden sm:inline">{label}</span>
                                </>
                              ) : (
                                label
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="relative w-full shrink-0 sm:max-w-xs lg:max-w-sm">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 sm:left-3 sm:size-4" />
                    <Input
                      value={listQuery}
                      onChange={(e) => setListQuery(e.target.value)}
                      placeholder="Search…"
                      className="h-8 rounded-full border-border/80 py-1 pr-2.5 pl-8 text-xs shadow-sm sm:h-10 sm:pl-9 sm:text-sm"
                      aria-label="Search events"
                    />
                  </div>
                </div>

                <p className="text-muted-foreground shrink-0 text-[10px] sm:text-xs sm:text-sm">
                  {listFilteredEvents.length} event
                  {listFilteredEvents.length !== 1 ? "s" : ""}
                  {events.length !== listFilteredEvents.length
                    ? ` (of ${events.length} total)`
                    : ""}
                </p>

                <div
                  className={cn(
                    "border-border/80 bg-muted/10 flex flex-col overflow-hidden rounded-lg border shadow-inner sm:rounded-xl",
                    "h-[min(520px,calc(100dvh-11.5rem))] min-h-[240px] sm:h-[min(720px,calc(100dvh-14rem))] sm:min-h-[320px]"
                  )}
                >
                  {listFilteredEvents.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-8">
                      <p className="text-muted-foreground text-sm">
                        No events match your filters. Try another status or clear search.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setListQuery("")
                          setListStatusFilter("active")
                        }}
                      >
                        Reset to upcoming & ongoing
                      </Button>
                    </div>
                  ) : (
                    <ul className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain p-1.5 sm:gap-4 sm:p-3">
                      {listFilteredEvents.map((event) => {
                      const dateRange = `${format(event.startDate, "MMM dd, yyyy")} - ${format(event.endDate, "MMM dd, yyyy")}`
                      const dateRangeShort = `${format(event.startDate, "MMM dd")} - ${format(event.endDate, "MMM dd")}`
                      const locationLine =
                        event.branch === "online"
                          ? "Online"
                          : event.branch.charAt(0).toUpperCase() + event.branch.slice(1)
                      const blocked = enrollmentBlocked(event)
                      return (
                        <li key={event.id}>
                          <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm transition-shadow hover:shadow-md sm:rounded-2xl">
                            <div className="flex flex-col gap-2 p-2.5 sm:gap-4 sm:p-4 lg:flex-row lg:items-stretch lg:gap-5 lg:p-5">
                              <div className="flex min-w-0 gap-2.5 sm:gap-4 lg:max-w-[min(100%,28rem)] lg:flex-[1.15]">
                                <div className="bg-muted text-foreground flex size-11 shrink-0 flex-col items-center justify-center rounded-lg sm:size-14 sm:rounded-xl lg:size-16">
                                  <span className="text-muted-foreground text-[8px] font-bold tracking-wide uppercase sm:text-[10px] sm:font-semibold lg:text-xs">
                                    {format(event.startDate, "EEE")}
                                  </span>
                                  <span className="text-base font-bold leading-none sm:text-xl lg:text-2xl">
                                    {format(event.startDate, "dd")}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h2 className="line-clamp-2 text-sm font-bold leading-snug sm:line-clamp-none sm:text-base lg:text-lg">
                                    {event.courseTitle}
                                  </h2>
                                  <p className="text-muted-foreground mt-0.5 hidden font-mono text-xs sm:mt-1 sm:block sm:text-sm">
                                    {event.course}
                                  </p>
                                  <p className="text-muted-foreground mt-0.5 truncate text-[10px] sm:mt-1.5 sm:text-xs sm:text-sm">
                                    <span className="text-foreground/80 hidden font-medium sm:inline">
                                      Location ·{" "}
                                    </span>
                                    {locationLine}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 sm:hidden">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full border px-1.5 py-0 text-[9px] font-semibold",
                                    getStatusBadgeClass(event)
                                  )}
                                >
                                  {getStatusLabel(event)}
                                </Badge>
                                <span className="text-muted-foreground max-w-[55%] truncate font-mono text-[9px] tabular-nums">
                                  {dateRangeShort}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="rounded-full px-1.5 py-0 text-[9px] font-normal"
                                >
                                  {deliveryFormatLabel(event)}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="rounded-full px-1.5 py-0 text-[9px] capitalize"
                                >
                                  {event.scheduleType}
                                </Badge>
                              </div>

                              <div className="hidden flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid lg:grid-cols-2 xl:grid-cols-3">
                                <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-3">
                                  <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                                    Status
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                        getStatusBadgeClass(event)
                                      )}
                                    >
                                      {getStatusLabel(event)}
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="rounded-full text-xs font-normal capitalize"
                                    >
                                      {event.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
                                  <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                                    Event dates
                                  </span>
                                  <span className="text-foreground text-xs font-medium sm:text-sm">
                                    {dateRange}
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-col gap-1">
                                  <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                                    Format
                                  </span>
                                  <Badge variant="secondary" className="w-fit rounded-full text-xs">
                                    {deliveryFormatLabel(event)}
                                  </Badge>
                                </div>
                                <div className="flex min-w-0 flex-col gap-1">
                                  <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                                    Schedule
                                  </span>
                                  <Badge variant="secondary" className="w-fit rounded-full text-xs capitalize">
                                    {event.scheduleType}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex flex-row gap-1.5 sm:justify-end lg:w-40 lg:flex-col lg:justify-center">
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 rounded-full px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm lg:h-10 lg:flex-none"
                                  disabled={blocked}
                                  onClick={() =>
                                    router.push(`/guest-training-registration?schedule_id=${event.id}`)
                                  }
                                >
                                  {event.status === "cancelled" ? (
                                    "Cancelled"
                                  ) : blocked ? (
                                    "Closed"
                                  ) : (
                                    <>
                                      <span className="sm:hidden">Enroll</span>
                                      <span className="hidden sm:inline">Enroll now</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 rounded-full px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm lg:h-10 lg:flex-none"
                                  onClick={() => openModal(event)}
                                >
                                  <span className="sm:hidden">Details</span>
                                  <span className="hidden sm:inline">View more</span>
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </li>
                      )
                    })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 space-y-4 lg:w-72 xl:w-80">
            <Card className="overflow-hidden">
              <NewsCarousel />
            </Card>

            <Card className="space-y-1 p-4">
              <h3 className="text-lg font-bold">Need Help?</h3>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Contact Us</h4>
                <p className="text-muted-foreground text-sm">
                  For media inquiries, interviews, or partnership opportunities, please contact:
                </p>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">Petrosphere Public Relations Office</p>
                  <a
                    href="mailto:training@petrosphere.com.ph"
                    className="block text-blue-600 hover:underline dark:text-blue-400"
                  >
                    training@petrosphere.com.ph
                  </a>
                  <a
                    href="tel:+639177087994"
                    className="block text-blue-600 hover:underline dark:text-blue-400"
                  >
                    0917-708-7994 - GLOBE
                  </a>
                  <a
                    href="https://www.petrosphere.com.ph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline dark:text-blue-400"
                  >
                    www.petrosphere.com.ph
                  </a>
                </div>
              </div>

              <div className="space-y-2 border-t pt-2">
                <p className="text-sm font-medium">Submit a ticket or check our FAQ:</p>
                <Button
                  className="w-full cursor-pointer"
                  onClick={() => window.open("https://petrosphere.tawk.help/", "_blank")}
                >
                  Visit Help Center
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="relative bg-black rounded-2xl overflow-hidden max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full h-[580px]">
              <Image
                src={selectedEvent.cover_image || `/course-covers/default.png`}
                onError={(e) => {
                  e.currentTarget.src = '/course-covers/default.png'
                }}
                alt={`${selectedEvent.course} cover`}
                fill
                className="object-cover"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={closeModal}
                className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white rounded-full cursor-pointer"
              >
                <X className="w-5 h-5 text-black" />
              </Button>

              <div className="absolute bottom-0 left-0 w-full p-5 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white space-y-0">
                <h2 className="text-xl font-bold">{selectedEvent.courseTitle}</h2>
                <p className="text-sm font-medium text-gray-300">{selectedEvent.course}</p>
                <p className="text-sm">{selectedEvent.branch === 'online' ? 'Online' : selectedEvent.branch}</p>
                {selectedEvent.scheduleType === 'staggered' && selectedEvent.dates ? (
                  <div className="text-sm space-y-1">
                    {selectedEvent.dates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map(d => (
                        <div key={d.toISOString()}>
                          {format(d, "MMM dd, yyyy")}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm">
                    {format(selectedEvent.startDate, "MMM dd, yyyy")}
                    {' - '}
                    {format(selectedEvent.endDate, "MMM dd, yyyy")}
                  </p>
                )}

                <Badge className="text-white inline-flex items-center gap-1" style={{ backgroundColor: getStatusColor(selectedEvent) }}>
                  {getStatusLabel(selectedEvent) === 'Finished' && <CheckCircle className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent) === 'Ongoing' && <RefreshCcw className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent) === 'Upcoming' && <Clock className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent)}
                </Badge>

                <div className="mt-4">
                  {new Date() > new Date(selectedEvent.endDate) ||
                    getStatusLabel(selectedEvent) === 'Ongoing' ||
                    selectedEvent.status === 'cancelled' ? (
                    <Button variant="outline" disabled className="w-full text-black cursor-not-allowed dark:text-white">
                      {selectedEvent.status === 'cancelled' ? 'Training Cancelled' : 'Enrollment Closed'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-white text-black hover:bg-gray-200 cursor-pointer"
                      onClick={() => router.push(`/guest-training-registration?schedule_id=${selectedEvent.id}`)}
                    >
                      Enroll Now
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}