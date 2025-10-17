"use client"

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase-client'
import Image from "next/image"

type ScheduleEvent = {
  id: string
  course: string
  branch: string
  status: 'planned' | 'confirmed' | 'cancelled' | 'finished'
  startDate: Date
  endDate: Date
  dates?: Date[]
  scheduleType: 'regular' | 'staggered'
}

export default function TrainingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)

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
  

  const getEventRowIndex = (event: ScheduleEvent, allEvents: ScheduleEvent[]) => {
    return allEvents.findIndex(e => e.id === event.id)
  }

  const getStatusColor = (event: ScheduleEvent) => {
    const now = new Date()
    
    if (event.status === 'finished') return '#94a3b8'
    if (event.status === 'cancelled') return '#ef4444'
    
    if (now > event.endDate) return '#94a3b8'
    if (now >= event.startDate && now <= event.endDate) return '#f59e0b'
    return '#10b981'
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
        <div key={`prev-${i}`} className="min-h-24 bg-muted/30 text-muted-foreground text-sm border-r border-b">
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
        <div key={day} className={`min-h-24 border-r border-b ${isToday ? 'bg-blue-50 dark:bg-cyan-900' : ''} relative`}>
          <div className={`text-sm font-semibold p-2 ${isToday ? 'text-blue-600' : isWeekend ? 'text-red-500' : ''}`}>
            {day}
          </div>
          <div className="px-1 pb-1 relative" style={{ minHeight: `${allMonthEvents.length * 32}px` }}>
            {allMonthEvents.map((event, idx) => {
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
                return <div key={`${event.id}-${idx}`} style={{ height: '32px' }} />
              }
              
              const isStart = event.scheduleType === 'staggered'
              ? true // treat every staggered day as start/end
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
        <div key={`next-${i}`} className="min-h-24 bg-muted/30 text-muted-foreground text-sm border-r border-b">
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-transparent">
                <Image
                src="/logo.png" // Make sure logo.png is in your public/ directory
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

      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-card rounded-lg max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-start justify-between">
              <h2 className="text-xl font-bold">{selectedEvent.course}</h2>
              <Button variant="ghost" size="icon" onClick={closeModal}>
                <X className="w-5 h-5" />
              </Button>
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
                <Button>Enroll Now</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}