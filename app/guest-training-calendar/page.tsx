"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, List, X, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase-client'
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTheme } from 'next-themes'
import { CheckCircle, Clock, RefreshCcw } from 'lucide-react'

type ScheduleEvent = {
  id: string
  course: string
  branch: string
  status: 'planned' | 'confirmed' | 'cancelled' | 'finished' | 'ongoing'
  startDate: Date
  endDate: Date
  dates?: Date[]
  scheduleType: 'regular' | 'staggered'
}

// News Carousel Component
function NewsCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const news = [
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
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % news.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [news.length])

  return (
    <div className="relative">
      <div className="p-4 bg-primary text-primary-foreground">
        <h3 className="font-bold text-sm">Latest News</h3>
      </div>
      
      <div className="relative h-48 overflow-hidden">
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

      {/* Dots indicator */}
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

export default function TrainingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
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
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id,
        branch,
        status,
        schedule_type,
        courses (name),
        schedule_ranges (start_date, end_date),
        schedule_dates (date)
      `)

    if (!error && data) {
        const mapped = data
        .map((s: any): ScheduleEvent | null => {
          const course = s.courses?.name || 'Unknown'
      
          if (s.schedule_type === 'regular' && s.schedule_ranges?.[0]) {
            return {
              id: s.id,
              course,
              branch: s.branch,
              status: s.status || 'planned',
              startDate: new Date(s.schedule_ranges[0].start_date),
              endDate: new Date(s.schedule_ranges[0].end_date),
              scheduleType: 'regular'
            }
          }
      
          if (s.schedule_type === 'staggered' && s.schedule_dates?.length) {
            const dates = s.schedule_dates.map((d: any) => new Date(d.date))
            return {
              id: s.id,
              course,
              branch: s.branch,
              status: s.status || 'planned',
              startDate: dates[0],
              endDate: dates[dates.length - 1],
              dates,
              scheduleType: 'staggered'
            }
          }
      
          return null
        })
        .filter((event): event is ScheduleEvent => event !== null)
      
      setEvents(mapped)
      
    }
    setLoading(false)
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
    // Priority: Use database status directly
    if (event.status === 'cancelled') return '#ef4444'    // red
    if (event.status === 'finished') return '#94a3b8'     // gray
    if (event.status === 'ongoing') return '#ed6205'      // orange
    if (event.status === 'confirmed' || event.status === 'planned') return '#facc15' // yellow
    
    // Fallback: calculate based on dates if status is unknown
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    const startDate = new Date(event.startDate)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(event.endDate)
    endDate.setHours(23, 59, 59, 999)
    
    if (now > endDate) return '#94a3b8'                   // finished (gray)
    if (now >= startDate && now <= endDate) return '#f59e0b' // ongoing (orange)
    
    return '#facc15'                                      // upcoming (yellow)
  }

  const getStatusLabel = (event: ScheduleEvent) => {
    const now = new Date()
    
    if (event.status === 'finished') return 'Finished'
    if (event.status === 'cancelled') return 'Cancelled'
    
    if (now > event.endDate) return 'Finished'
    if (now >= event.startDate && now <= event.endDate) return 'Ongoing'
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
              eventDate.setHours(12, 0, 0, 0)
              eventStart.setHours(0, 0, 0, 0)
              eventEnd.setHours(23, 59, 59, 999)
              
              let isInRange = false

              if (event.scheduleType === 'staggered' && event.dates) {
                isInRange = event.dates.some(d => d.toDateString() === eventDate.toDateString())
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
              <th className="p-3 text-left font-semibold border border-border rounded">TRAINING PROGRAM</th>
              {monthNamesShort.map(month => (
                <th key={month} className="p-3 text-center font-semibold border border-border min-w-20 rounded">
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
              <h1 className="text-3xl font-bold">Public Training Calendar</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-2 bg-muted rounded-lg p-1">
                <Button
                  className="cursor-pointer"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <Sun className="h-3 w-3" />
                  ) : (
                    <Moon className="h-3 w-3" />
                  )}
                </Button>
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
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end max-w-full">
                <Badge className="bg-yellow-400 text-black border-yellow-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-black"></span>
                  Upcoming
                </Badge>

                <Badge className="bg-orange-500 text-white border-orange-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  Ongoing
                </Badge>

                <Badge className="bg-slate-400 text-white border-slate-400 gap-2">
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
        <div className="w-80 space-y-6">
          {/* News Section */}
          <Card className="overflow-hidden">
            <NewsCarousel />
          </Card>

          {/* Contact Section */}
          <Card className="p-4 space-y-1">
            <h3 className="text-lg font-bold">Need Help?</h3>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Contact Us</h4>
              <p className="text-sm text-muted-foreground">
                For media inquiries, interviews, or partnership opportunities, please contact:
              </p>
              
              <div className="space-y-2 text-sm">
                <p className="font-medium">Petrosphere Public Relations Office</p>
                <a href="mailto:info@petrosphere.com.ph" className="block text-blue-600 dark:text-blue-400 hover:underline">
                  info@petrosphere.com.ph
                </a>
                <a href="tel:+6348433060" className="block text-blue-600 dark:text-blue-400 hover:underline">
                  (048) 433 0601
                </a>
                <a href="https://www.petrosphere.com.ph" target="_blank" rel="noopener noreferrer" className="block text-blue-600 dark:text-blue-400 hover:underline">
                  www.petrosphere.com.ph
                </a>
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-medium">Submit a ticket or check our FAQ:</p>
              <Button 
                className="w-full cursor-pointer"
                onClick={() => window.open('https://petrosphere.tawk.help/', '_blank')}
              >
                Visit Help Center
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="relative bg-black rounded-2xl overflow-hidden max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full h-[580px]">
              <Image
                src={`/course-covers/${selectedEvent.course.toLowerCase()}.png`}
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
                <h2 className="text-xl font-bold">{selectedEvent.course}</h2>
                <p className="text-sm">{selectedEvent.branch === 'online' ? 'Online' : selectedEvent.branch}</p>
                <p className="text-sm">
                  {selectedEvent.startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} -{' '}
                  {selectedEvent.endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <Badge className="text-white inline-flex items-center gap-1" style={{ backgroundColor: getStatusColor(selectedEvent) }}>
                  {getStatusLabel(selectedEvent) === 'Finished' && <CheckCircle className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent) === 'Ongoing' && <RefreshCcw className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent) === 'Upcoming' && <Clock className="w-4 h-4" />}
                  {getStatusLabel(selectedEvent)}
                </Badge>

                <div className="mt-4">
                  {new Date() > new Date(selectedEvent.endDate) ? (
                    <Button variant="outline" disabled className="w-full text-white">
                      Enrollment Closed
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