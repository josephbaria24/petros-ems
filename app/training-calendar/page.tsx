//app\training-calendar\page.tsx

"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, List, X, Edit2, Save, Plus, Trash2, MoreVertical, Image as ImageIcon } from 'lucide-react'
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

type ScheduleEvent = {
  id: string
  course: string
  branch: string
  status: 'planned' | 'confirmed' | 'cancelled' | 'finished' | 'ongoing'
  startDate: Date
  endDate: Date
  dates?: Date[]
  scheduleType: 'regular' | 'staggered'
  cover_image?: string
  course_id: string | null
   
}

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
    <div className="relative">
      <div className="p-2 bg-secondary text-primary-foreground flex justify-between items-center">
        <h3 className="font-bold text-sm text-accent-foreground">Latest News</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 gap-2 hover:bg-primary-foreground/20 text-accent-foreground"
        >
          <Edit2 className="w-4 h-4 text-accent-foreground" />
          Edit News
        </Button>
      </div>
      
      <div className="relative h-62 overflow-hidden">
        {news.map((item, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-500 ${
              idx === currentSlide ? 'opacity-100' : 'opacity-0'
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
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.date}</p>
              <h4 className="text-sm font-semibold line-clamp-2">{item.title}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 pb-4">
        {news.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentSlide ? 'bg-primary w-4' : 'bg-muted-foreground/30'
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
        courses (id, name, cover_image),
        schedule_ranges (start_date, end_date),
        schedule_dates (date)
      `)

    if (!error && data) {
      const mapped = data
        .map((s: any): ScheduleEvent | null => {
          const course = s.courses?.name || 'Unknown'
          const cover_image = s.courses?.cover_image || null
          const course_id = s.courses?.id || null
          
          if (s.schedule_type === 'regular' && s.schedule_ranges?.[0]) {
            return {
              id: s.id,
              course,
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
  
  const monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  
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

  const getStatusLabel = (event: ScheduleEvent) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    if (event.status === 'finished') return 'Finished'
    if (event.status === 'cancelled') return 'Cancelled'
    
    const eventEnd = new Date(event.endDate)
    eventEnd.setHours(0, 0, 0, 0)
    
    const eventStart = new Date(event.startDate)
    eventStart.setHours(0, 0, 0, 0)
    
    if (now > eventEnd) return 'Finished'
    if (now >= eventStart && now <= eventEnd) return 'Ongoing'
    return 'Upcoming'
  }

  const openModal = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setShowModal(true)
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

      cells.push(
        <div key={day} className={`border-r border-b ${isToday ? 'bg-blue-50 dark:bg-cyan-900' : ''} relative ${dayEvents.length === 0 ? 'min-h-20' : ''}`}>
          <div className={`text-sm font-semibold p-2 ${isToday ? 'text-blue-600' : isWeekend ? 'text-red-500' : ''}`}>
            {day}
          </div>
          <div className="px-1 pb-1 relative">
            {dayEvents.length > 0 && allMonthEvents.map((event, idx) => {
              const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
              const eventStart = new Date(event.startDate)
              const eventEnd = new Date(event.endDate)
              eventDate.setHours(0, 0, 0, 0)
              eventStart.setHours(0, 0, 0, 0)
              eventEnd.setHours(0, 0, 0, 0)
              
              let isInRange = false

              if (event.scheduleType === 'staggered' && event.dates) {
                isInRange = event.dates.some(d => {
                  const ed = new Date(d)
                  ed.setHours(0, 0, 0, 0)
                  return ed.getTime() === eventDate.getTime()
                })
              } else {
                isInRange = eventDate >= eventStart && eventDate <= eventEnd
              }
              
              if (!isInRange) {
                return null
              }
              
              const isStart = event.scheduleType === 'staggered'
                ? true
                : eventStart.getDate() === day && eventStart.getMonth() === currentDate.getMonth()
            
              const isEnd = event.scheduleType === 'staggered'
                ? true
                : eventEnd.getDate() === day && eventEnd.getMonth() === currentDate.getMonth()
            
              const color = getStatusColor(event)
              
              return (
                <div
                  key={`${event.id}-${idx}`}
                  className={`text-xs px-2 py-1.5 text-white cursor-pointer 
                    transition-all duration-200 ease-in-out 
                    ${isStart ? 'rounded-l ml-1' : '-ml-1'} 
                    ${isEnd ? 'rounded-r mr-1' : '-mr-1'} 
                    ${hoveredEventId === event.id ? 'ring-3 ring-black dark:ring-white ring-offset-0 scale-[1.02]' : 'scale-100'}
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
                  title={`${event.course} - ${event.branch}`}
                >
                  <div className="truncate">
                    {isStart && `${event.branch} ${event.course} - ${event.status}`}
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
    const eventsByCourse: { [key: string]: ScheduleEvent[] } = {}
    
    events.forEach(event => {
      if (!eventsByCourse[event.course]) {
        eventsByCourse[event.course] = []
      }
      eventsByCourse[event.course].push(event)
    })

    const sortedCourses = Object.keys(eventsByCourse).sort()

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="p-3 text-left font-semibold border border-border">TRAINING PROGRAM</th>
              {monthNamesShort.map(month => (
                <th key={month} className="p-3 text-center font-semibold border border-border min-w-20">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCourses.map(courseName => (
              <tr key={courseName} className="border-b border-border hover:bg-muted/50">
                <td className="p-3 font-medium border border-border">{courseName}</td>
                {[...Array(12)].map((_, monthIdx) => {
                  const monthEvents = eventsByCourse[courseName].filter(event => 
                    new Date(event.startDate).getMonth() === monthIdx
                  )
                  
                  return (
                    <td key={monthIdx} className="p-2 text-center border border-border align-top">
                      {monthEvents.map((event, idx) => {
                        const startDay = new Date(event.startDate).getDate()
                        const endDay = new Date(event.endDate).getDate()
                        const color = getStatusColor(event)
                        
                        return (
                          <div key={idx} className="mb-2">
                            <div
                              className="inline-block px-2 py-1 text-white rounded cursor-pointer hover:opacity-80 text-xs"
                              style={{ backgroundColor: color }}
                              onClick={() => openModal(event)}
                              title={`${event.course} - ${event.branch}`}
                            >
                              {event.scheduleType === 'staggered' && event.dates
                                ? event.dates
                                    .filter(d => d.getMonth() === monthIdx && d.getFullYear() === currentDate.getFullYear())
                                    .map(d => d.getDate())
                                    .join(', ')
                                : `${startDay} - ${endDay}`}
                            </div>

                            {event.branch !== 'Finished' && (
                              <div className="text-xs text-muted-foreground mt-1">{event.branch}</div>
                            )}
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return <Card className="p-6">Loading calendar...</Card>
  }

  return (
    <div className="w-full bg-background p-6">
      <div className="flex gap-6">
        {/* Main Calendar Section */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <h1 className="text-3xl font-bold">Training Calendar</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={viewType === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('calendar')}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </Button>
                <Button
                  variant={viewType === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('list')}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  List
                </Button>
              </div>

              <div className="flex gap-2">
                <Badge variant="outline" className="bg-emerald-500 text-white border-emerald-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  Upcoming
                </Badge>
                <Badge variant="outline" className="bg-orange-500 text-white border-orange-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  Ongoing
                </Badge>
                <Badge variant="outline" className="bg-slate-400 text-white border-slate-400 gap-2">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  Finished
                </Badge>
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

          {viewType === 'list' && (
            <Card className="p-6">
              {renderListView()}
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-100 space-y-2 ">
          <Card className="overflow-y-auto">
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

          <Card className="p-4 space-y-3">
            <h3 className="text-lg font-bold">Admin Tools</h3>
            
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Manage training schedules, courses, and calendar settings.
              </p>
              
              <div className="pt-2 border-t space-y-2">
                <p className="font-medium">Quick Actions:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Edit news carousel above</li>
                  <li>Click events to view details</li>
                  <li>Switch between calendar/list views</li>
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
    <h2 className="text-xl font-bold">{selectedEvent.course}</h2>

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