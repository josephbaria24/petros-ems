//app\training-calendar\page.tsx

"use client"

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, List, X, Edit2, Save, Plus, Trash2, MoreVertical, Image as ImageIcon, Search } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { tmsDb } from '@/lib/supabase-client'
import Image from "next/image"
import { useRouter } from 'next/navigation'
import CourseCoverUploadDialog from '@/components/course-cover-upload'
import { EditScheduleDialog } from '@/components/edit-schedule-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils'

type ScheduleEvent = {
  id: string
  course: string
  courseTitle: string
  branch: string
  status: 'planned' | 'confirmed' | 'cancelled' | 'finished' | 'ongoing'
  startDate: Date
  endDate: Date
  dates?: Date[]
  scheduleType: 'regular' | 'staggered'
  cover_image?: string
  course_id: string | null

}

type ListStatusFilter =
  | "active"
  | "all"
  | "upcoming"
  | "ongoing"
  | "finished"
  | "cancelled"

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
  labelShort?: string
}[] = [
  { key: "active", label: "Upcoming & ongoing", labelShort: "Active" },
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "finished", label: "Finished" },
  { key: "cancelled", label: "Cancelled", labelShort: "Cancel" },
]

type NewsItem = {
  id?: string;   // id is optional so new items can be created
  title: string;
  image: string;
  date: string;
}

// News Carousel Component
function NewsCarousel({
  news,
  onEdit
}: {
  news: NewsItem[]
  onEdit: () => void
}) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % news.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [news.length])

  return (
    <div className="relative min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-secondary p-2 text-primary-foreground">
        <h3 className="min-w-0 truncate text-sm font-bold text-accent-foreground">Latest News</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 shrink-0 gap-1.5 px-2 text-accent-foreground hover:bg-primary-foreground/20"
        >
          <Edit2 className="h-4 w-4 text-accent-foreground" />
          <span className="hidden sm:inline">Edit News</span>
          <span className="sm:hidden">Edit</span>
        </Button>
      </div>

      <div className="relative h-52 min-w-0 overflow-hidden sm:h-62">
        {news.map((item, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-500 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <div className="relative h-32 bg-muted">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/course-covers/default.png'
                }}
              />
            </div>
            <div className="min-w-0 p-3 sm:p-4">
              <p className="mb-1 text-xs text-muted-foreground">{item.date}</p>
              <h4 className="line-clamp-2 text-sm font-semibold break-words">{item.title}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 pb-4">
        {news.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-primary w-4' : 'bg-muted-foreground/30'
              }`}
          />
        ))}
      </div>
    </div>
  )
}

// News Editor Component
function NewsEditor({
  news,
  onSave,
  onCancel
}: {
  news: NewsItem[]
  onSave: (items: NewsItem[]) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<NewsItem[]>(news)

  const handleImageUpload = (index: number, file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const newItems = [...items]
      newItems[index].image = reader.result as string
      setItems(newItems)
    }
    reader.readAsDataURL(file)
  }

  const updateItem = (index: number, field: keyof NewsItem, value: string) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        title: "New News Item",
        image: "/course-covers/default.png",
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        })
      }
    ])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }




  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Edit News Items</h3>
        <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      {items.map((item, idx) => (
        <Card key={idx} className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold">Item {idx + 1}</span>
            {items.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(idx)}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">Title</label>
            <Input
              value={item.title}
              onChange={(e) => updateItem(idx, 'title', e.target.value)}
              placeholder="News title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">Date</label>
            <Input
              value={item.date}
              onChange={(e) => updateItem(idx, 'date', e.target.value)}
              placeholder="Date"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">Image</label>
            <div className="relative h-32 bg-muted rounded overflow-hidden">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/course-covers/default.png'
                }}
              />
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(idx, file)
              }}
              className="text-xs"
            />
          </div>
        </Card>
      ))}
      <div className="flex gap-2 pt-4">
        <Button onClick={() => onSave(items)} className="flex-1 gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}
// Main TrainingCalendar Component (continues from Part 1)

export default function TrainingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [listQuery, setListQuery] = useState("")
  const [listStatusFilter, setListStatusFilter] = useState<ListStatusFilter>("active")
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [isEditingNews, setIsEditingNews] = useState(false)
  const [showCoverUploadDialog, setShowCoverUploadDialog] = useState(false)
  const handleCoverUploadSuccess = (newUrl: string) => {
    setShowCoverUploadDialog(false)
    fetchSchedules() // Refresh the calendar
    setShowModal(false) // Close the event modal
  }
  const [newsItems, setNewsItems] = useState<NewsItem[]>([
    {
      title: "New HSE Training Program Launched",
      image: "/news/hse-training.jpg",
      date: "Nov 20, 2025"
    },
    {
      title: "Industry Safety Standards Update",
      image: "/news/safety-update.jpg",
      date: "Nov 15, 2025"
    },
    {
      title: "Certification Workshop Success",
      image: "/news/workshop.jpg",
      date: "Nov 10, 2025"
    }
  ])
  const [editScheduleOpen, setEditScheduleOpen] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchNews()
    fetchSchedules()
  }, [])

  const fetchNews = async () => {
    const { data, error } = await tmsDb
      .from("news_items")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setNewsItems(data) // now includes id
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    const { data, error } = await tmsDb
      .from('schedules')
      .select(`
        id,
        branch,
        status,
        schedule_type,
        courses (id, name, title, cover_image),
        schedule_ranges (start_date, end_date),
        schedule_dates (date)
      `)

    if (!error && data) {
      const mapped = data
        .map((s: any): ScheduleEvent | null => {
          const course = s.courses?.name || 'Unknown'
          const courseTitle = s.courses?.title || course
          const cover_image = s.courses?.cover_image || null
          const course_id = s.courses?.id || null

          if (s.schedule_type === 'regular' && s.schedule_ranges?.[0]) {
            return {
              id: s.id,
              course,
              courseTitle,
              branch: s.branch,
              status: s.status || 'planned',
              startDate: new Date(s.schedule_ranges[0].start_date + 'T00:00:00'),
              endDate: new Date(s.schedule_ranges[0].end_date + 'T00:00:00'),
              scheduleType: 'regular',
              cover_image: cover_image || `/course-covers/default.png`,
              course_id
            }
          }

          if (s.schedule_type === 'staggered' && s.schedule_dates?.length) {
            const dates = s.schedule_dates.map((d: any) => new Date(d.date + 'T00:00:00'))
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
              cover_image: cover_image || `/course-covers/default.png`,
              course_id
            }
          }

          return null
        })
        .filter((event): event is ScheduleEvent => event !== null)

      setEvents(mapped)
    }
    setLoading(false)
  }

  const handleSaveNews = async (items: NewsItem[]) => {
    try {
      // Split into updates and inserts
      const itemsToUpdate = items.filter(item => item.id);
      const itemsToInsert = items.filter(item => !item.id);

      // Detect deleted items
      const existingIds = newsItems.map(n => n.id).filter(Boolean);
      const newIds = itemsToUpdate.map(n => n.id).filter(Boolean);
      const deletedIds = existingIds.filter(id => !newIds.includes(id));

      // Delete removed items
      if (deletedIds.length > 0) {
        const { error: deleteError } = await tmsDb
          .from("news_items")
          .delete()
          .in("id", deletedIds);

        if (deleteError) {
          console.error("Failed to delete news items:", deleteError);
          alert("Failed to delete some items");
          return;
        }
      }

      // Update existing items
      if (itemsToUpdate.length > 0) {
        const { error: updateError } = await tmsDb
          .from("news_items")
          .upsert(itemsToUpdate.map(item => ({
            id: item.id,
            title: item.title,
            image: item.image,
            date: item.date
          })), { onConflict: "id" });

        if (updateError) {
          console.error("Failed to update news items:", updateError);
          alert("Failed to update items");
          return;
        }
      }

      // Insert new items
      if (itemsToInsert.length > 0) {
        const { error: insertError } = await tmsDb
          .from("news_items")
          .insert(itemsToInsert.map(item => ({
            title: item.title,
            image: item.image,
            date: item.date
          })));

        if (insertError) {
          console.error("Failed to insert news items:", insertError);
          alert("Failed to add new items");
          return;
        }
      }

      // Reload IDs from database
      await fetchNews();
      setIsEditingNews(false);

      // Show success message
      alert("News items saved successfully!");
    } catch (err) {
      console.error("Unexpected error saving news:", err);
      alert("An unexpected error occurred");
    }
  };

  const handleEditSchedule = () => {
    if (selectedEvent) {
      setEditingScheduleId(selectedEvent.id)
      setEditScheduleOpen(true)
      setShowModal(false)
    }
  }

  const handleScheduleUpdated = () => {
    fetchSchedules()
    setEditScheduleOpen(false)
    setEditingScheduleId(null)
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

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
    date.setHours(0, 0, 0, 0)

    const dayEvents = events.filter(event => {
      if (event.scheduleType === 'staggered' && event.dates) {
        return event.dates.some(d => {
          const eventDate = new Date(d)
          eventDate.setHours(0, 0, 0, 0)
          return eventDate.getTime() === date.getTime()
        })
      } else {
        const eventStart = new Date(event.startDate)
        const eventEnd = new Date(event.endDate)
        eventStart.setHours(0, 0, 0, 0)
        eventEnd.setHours(0, 0, 0, 0)
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

    if (event.status === 'finished') return '#94a3b8'
    if (event.status === 'cancelled') return '#ef4444'

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

  const openModal = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setShowModal(true)
  }

  const openEditFromList = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setEditingScheduleId(event.id)
    setEditScheduleOpen(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedEvent(null)
  }

  // Continued from Part 2...

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

          // Check for date overlaps
          if (event.scheduleType === 'staggered' && otherEvent.scheduleType === 'staggered') {
            return event.dates?.some(d1 => otherEvent.dates?.some(d2 => d1.toDateString() === d2.toDateString()))
          } else if (event.scheduleType === 'regular' && otherEvent.scheduleType === 'regular') {
            return event.startDate <= otherEvent.endDate && event.endDate >= otherEvent.startDate
          } else {
            // Mixed types
            const reg = event.scheduleType === 'regular' ? event : otherEvent
            const stag = event.scheduleType === 'staggered' ? event : otherEvent
            return stag.dates?.some(d => {
              const ds = new Date(d)
              ds.setHours(0, 0, 0, 0)
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
        <div key={`prev-${i}`} className="min-h-16 min-w-0 overflow-hidden border-b border-r bg-muted/30 text-sm text-muted-foreground sm:min-h-20">
          <div className="p-1.5 sm:p-2">{prevMonthDays - i}</div>
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
        <div
          key={day}
          className={`relative min-w-0 overflow-hidden border-b border-r ${isToday ? "bg-blue-50 dark:bg-cyan-900" : ""} ${dayEvents.length === 0 ? "min-h-16 sm:min-h-20" : ""}`}
        >
          <div className={`p-1 text-[11px] font-semibold sm:p-2 sm:text-sm ${isToday ? "text-blue-600" : isWeekend ? "text-red-500" : ""}`}>
            {day}
          </div>
          <div className="relative min-w-0 overflow-hidden px-0.5 pb-1 sm:px-1">
            {maxTrack >= 0 && Array.from({ length: maxTrack + 1 }).map((_, trackIdx) => {
              const trackEvent = dayEventsWithTracks.find(e => e.track === trackIdx)

              if (!trackEvent) {
                // Placeholder for empty track to maintain alignment
                return (
                  <div key={`placeholder-${day}-${trackIdx}`} className="mb-0.5 h-5 sm:mb-1 sm:h-7" />
                )
              }

              const { event } = trackEvent
              const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
              const eventStart = new Date(event.startDate)
              const eventEnd = new Date(event.endDate)
              eventDate.setHours(0, 0, 0, 0)
              eventStart.setHours(0, 0, 0, 0)
              eventEnd.setHours(23, 59, 59, 999)

              const isStart = event.scheduleType === 'staggered'
                ? true
                : eventStart.getDate() === day && eventStart.getMonth() === currentDate.getMonth()

              const isEnd = event.scheduleType === 'staggered'
                ? true
                : eventEnd.getDate() === day && eventEnd.getMonth() === currentDate.getMonth()

              const color = getStatusColor(event)

              return (
                <div
                  key={`${event.id}-${trackIdx}`}
                  className={`mb-0.5 h-5 cursor-pointer px-1 py-0.5 text-[9px] leading-4 text-white transition-colors sm:mb-1 sm:h-7 sm:px-2 sm:py-1.5 sm:text-xs sm:leading-4
                    ${isStart ? "ml-0.5 rounded-l sm:ml-1" : ""}
                    ${isEnd ? "mr-0.5 rounded-r sm:mr-1" : ""}
                    ${hoveredEventId === event.id ? "z-10 ring-2 ring-black dark:ring-white" : ""}
                  `}
                  style={{ backgroundColor: color }}
                  onClick={() => openModal(event)}
                  onMouseEnter={() => setHoveredEventId(event.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  title={`${event.courseTitle} - ${event.branch}`}
                >
                  <div className="truncate">
                    {isStart && `${event.branch} ${event.courseTitle}`}
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
        <div key={`next-${i}`} className="min-h-16 min-w-0 overflow-hidden border-b border-r bg-muted/30 text-sm text-muted-foreground sm:min-h-20">
          <div className="p-1.5 sm:p-2">{i}</div>
        </div>
      )
    }

    return cells
  }







  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, event: ScheduleEvent) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await res.json();

    if (!result.url) {
      alert("Upload failed");
      return;
    }

    // Save into SUPABASE using course_id
    const { error } = await tmsDb
      .from("courses")
      .update({ cover_image: result.url })
      .eq("id", event.course_id);

    if (error) {
      console.error(error);
      alert("Failed to save cover image.");
      return;
    }

    fetchSchedules(); // Refresh UI
    alert("Cover photo updated!");
  };



  const renderListView = () => {
    return (
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
                        "px-2 py-1 text-[10px] sm:border-0 sm:px-3 sm:py-1.5 sm:text-xs",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/70 bg-card/50 text-muted-foreground hover:border-border hover:bg-background/90 hover:text-foreground sm:bg-transparent",
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

        <p className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
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
                            <p className="text-muted-foreground mt-0.5 truncate text-[10px] sm:mt-1.5 sm:text-xs">
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
                            onClick={() => openModal(event)}
                          >
                            <span className="sm:hidden">Details</span>
                            <span className="hidden sm:inline">View details</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 rounded-full px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm lg:h-10 lg:flex-none"
                            onClick={() => openEditFromList(event)}
                          >
                            <Edit2 className="mr-1 hidden size-3.5 sm:inline" />
                            <span className="sm:hidden">Edit</span>
                            <span className="hidden sm:inline">Edit schedule</span>
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
    )
  }

  if (loading) {
    return <Card className="p-6">Loading calendar...</Card>
  }

  return (
    <div className="page-shell min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Main Calendar Section */}
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mb-3 flex min-w-0 flex-col gap-3 sm:mb-6 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white sm:h-12 sm:w-12">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <h1 className="page-title min-w-0 truncate text-xl font-bold sm:text-3xl">Training Calendar</h1>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <div className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto sm:gap-2">
                <Button
                  variant={viewType === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('calendar')}
                  className="h-8 flex-1 gap-1.5 px-2 sm:flex-none sm:gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Calendar
                </Button>
                <Button
                  variant={viewType === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('list')}
                  className="h-8 flex-1 gap-1.5 px-2 sm:flex-none sm:gap-2"
                >
                  <List className="h-4 w-4" />
                  List
                </Button>
              </div>

              <div className="flex min-w-0 flex-wrap gap-1.5">
                <Badge variant="outline" className="gap-1.5 border-emerald-500 bg-emerald-500 px-1.5 text-[10px] text-white sm:gap-2 sm:px-2.5 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-white sm:h-2 sm:w-2"></span>
                  Upcoming
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-orange-500 bg-orange-500 px-1.5 text-[10px] text-white sm:gap-2 sm:px-2.5 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-white sm:h-2 sm:w-2"></span>
                  Ongoing
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-slate-400 bg-slate-400 px-1.5 text-[10px] text-white sm:gap-2 sm:px-2.5 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-white sm:h-2 sm:w-2"></span>
                  Finished
                </Badge>
              </div>
            </div>
          </div>

          {viewType === 'calendar' && (
            <>
              <div className="mb-3 flex min-w-0 items-center justify-between gap-2 sm:mb-6">
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={previousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 text-xs sm:px-3" onClick={goToToday}>
                    Today
                  </Button>
                </div>

                <h2 className="min-w-0 truncate text-center text-base font-bold sm:text-2xl">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>

                <div className="hidden w-32 sm:block" aria-hidden />
              </div>

              <Card className="min-w-0 overflow-hidden">
                <div className="grid min-w-0 grid-cols-7 border-b bg-muted/50">
                  {(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).map((day, idx) => (
                    <div
                      key={day}
                      className={`min-w-0 border-r p-1.5 text-center text-[10px] font-semibold last:border-r-0 sm:p-3 sm:text-sm ${idx === 0 || idx === 6 ? "text-red-500" : ""}`}
                    >
                      <span className="sm:hidden">{day.charAt(0)}</span>
                      <span className="hidden sm:inline">{day}</span>
                    </div>
                  ))}
                </div>
                <div className="grid min-w-0 grid-cols-7">
                  {renderCalendar()}
                </div>
              </Card>
            </>
          )}

          {viewType === 'list' && (
            <div className="min-w-0">{renderListView()}</div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-full min-w-0 shrink-0 space-y-2 overflow-x-hidden lg:w-80">
          <Card className="min-w-0 overflow-hidden">
            {isEditingNews ? (
              <NewsEditor
                news={newsItems}
                onSave={handleSaveNews}
                onCancel={() => setIsEditingNews(false)}
              />
            ) : (
              <NewsCarousel
                news={newsItems}
                onEdit={() => setIsEditingNews(true)}
              />
            )}
          </Card>

          <Card className="min-w-0 space-y-3 overflow-hidden p-3 sm:p-4">
            <h3 className="text-base font-bold sm:text-lg">Admin Tools</h3>

            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Manage training schedules, courses, and calendar settings.
              </p>

              <div className="space-y-2 border-t pt-2">
                <p className="font-medium">Quick Actions:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Edit news carousel above</li>
                  <li>Click events to view details</li>
                  <li>Use List filters to browse upcoming & ongoing events</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Event Details Modal */}
      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-card rounded-lg max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b space-y-4">
              {/* Cover Preview */}
              <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-muted">
                <Image
                  src={selectedEvent.cover_image || "/course-covers/default.png"}
                  alt={`${selectedEvent.course} cover`}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Title + Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedEvent.courseTitle}</h2>
                  <p className="text-sm font-medium text-muted-foreground">{selectedEvent.course}</p>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEditSchedule}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Schedule
                      </DropdownMenuItem>

                      {/* File Upload */}
                      <DropdownMenuItem onClick={() => setShowCoverUploadDialog(true)}>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Edit Cover Photo
                      </DropdownMenuItem>

                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" size="icon" onClick={closeModal}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>


            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Course Title</div>
                <div className="text-sm font-bold">{selectedEvent.courseTitle}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Course Name</div>
                <div className="text-sm">{selectedEvent.course}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Location</div>
                <div className="text-sm">{selectedEvent.branch === 'online' ? 'Online' : selectedEvent.branch}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Schedule</div>
                <div className="text-sm">
                  {selectedEvent.startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {selectedEvent.endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Status</div>
                <Badge
                  className="text-white"
                  style={{ backgroundColor: getStatusColor(selectedEvent) }}
                >
                  {getStatusLabel(selectedEvent)}
                </Badge>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <Button variant="secondary" onClick={closeModal}>Close</Button>
              {selectedEvent.status !== 'finished' && (
                <Button
                  className="cursor-pointer"
                  onClick={() => router.push(`/guest-training-registration?schedule_id=${selectedEvent.id}`)}
                >
                  Enroll Now
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <CourseCoverUploadDialog
        open={showCoverUploadDialog}
        onOpenChange={setShowCoverUploadDialog}
        courseId={selectedEvent?.course_id || null}
        courseName={selectedEvent?.course || ''}
        currentCoverUrl={selectedEvent?.cover_image}
        onUploadSuccess={handleCoverUploadSuccess}
      />

      {/* Edit Schedule Dialog */}
      <EditScheduleDialog
        open={editScheduleOpen}
        onOpenChange={setEditScheduleOpen}
        scheduleId={editingScheduleId}
        onScheduleUpdated={handleScheduleUpdated}
      />

    </div>
  )
}