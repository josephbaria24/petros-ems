"use client"

import { useEffect, useState } from "react"
import { tmsDb } from "@/lib/supabase-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Users, MapPin, ChevronDown, ChevronUp, Filter, FilterIcon } from "lucide-react"
import { format } from "date-fns"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "../ui/menubar"

interface CourseDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  courseName: string
}

type Schedule = {
  id: string
  schedule_type: string
  event_type: string
  branch: string
  status: string
  batch_number: number | null
  created_at: string
  schedule_dates?: Array<{ date: string }>
  schedule_ranges?: Array<{ start_date: string; end_date: string }>
  trainings: Array<{
    id: string
    first_name: string
    last_name: string
    status: string
    created_at: string
  }>
}

export function CourseDetailsModal({ isOpen, onClose, courseName }: CourseDetailsModalProps) {
  const supabase = tmsDb
  const [loading, setLoading] = useState(true)
  const [courseData, setCourseData] = useState<any>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [openSchedules, setOpenSchedules] = useState<Record<string, boolean>>({})
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<string>("all")
  const [batchFilter, setBatchFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (isOpen && courseName) {
      loadCourseDetails()
    }
  }, [isOpen, courseName])

  const loadCourseDetails = async () => {
    setLoading(true)
    try {
      // Get course details
      const { data: course } = await supabase
        .from("courses")
        .select("*")
        .eq("name", courseName)
        .single()

      if (!course) {
        setLoading(false)
        return
      }

      setCourseData(course)

      // Get all schedules for this course with related data
      const { data: schedulesData } = await supabase
        .from("schedules")
        .select(`
          id,
          schedule_type,
          event_type,
          branch,
          status,
          batch_number,
          created_at,
          schedule_dates (date),
          schedule_ranges (start_date, end_date),
          trainings (
            id,
            first_name,
            last_name,
            status,
            created_at
          )
        `)
        .eq("course_id", course.id)

      // Sort schedules chronologically (January to December)
      const sortedSchedules = (schedulesData || []).sort((a, b) => {
        const getFirstDate = (schedule: any) => {
          if (schedule.schedule_dates && schedule.schedule_dates.length > 0) {
            return new Date(schedule.schedule_dates[0].date)
          } else if (schedule.schedule_ranges && schedule.schedule_ranges.length > 0) {
            return new Date(schedule.schedule_ranges[0].start_date)
          }
          return new Date(schedule.created_at)
        }

        return getFirstDate(a).getTime() - getFirstDate(b).getTime()
      })

      setSchedules(sortedSchedules)
    } catch (error) {
      console.error("Error loading course details:", error)
    } finally {
      setLoading(false)
    }
  }

  const getScheduleDates = (schedule: Schedule) => {
    if (schedule.schedule_dates && schedule.schedule_dates.length > 0) {
      const dates = schedule.schedule_dates.map(d => format(new Date(d.date), "MMM dd, yyyy"))
      return dates.join(", ")
    } else if (schedule.schedule_ranges && schedule.schedule_ranges.length > 0) {
      const range = schedule.schedule_ranges[0]
      return `${format(new Date(range.start_date), "MMM dd, yyyy")} - ${format(new Date(range.end_date), "MMM dd, yyyy")}`
    }
    return "No dates set"
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      ongoing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      finished: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    }
    return colors[status] || colors.planned
  }

  const toggleSchedule = (scheduleId: string) => {
    setOpenSchedules(prev => ({
      ...prev,
      [scheduleId]: !prev[scheduleId]
    }))
  }

  // Get unique values for filter options
  const uniqueStatuses = Array.from(
  new Set(
    schedules
      .map(s => s.status)
      .filter((s): s is string => Boolean(s && s.trim()))
  )
)

const menubarHover =
  "data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground"


const uniqueEventTypes = Array.from(
  new Set(
    schedules
      .map(s => s.event_type)
      .filter((v): v is string => Boolean(v && v.trim()))
  )
)

const uniqueBranches = Array.from(
  new Set(
    schedules
      .map(s => s.branch)
      .filter((v): v is string => Boolean(v && v.trim()))
  )
)

const uniqueScheduleTypes = Array.from(
  new Set(
    schedules
      .map(s => s.schedule_type)
      .filter((v): v is string => Boolean(v && v.trim()))
  )
)

  const uniqueBatches = Array.from(
    new Set(
      schedules
        .map(s => s.batch_number)
        .filter(batch => batch !== null && batch !== undefined)
    )
  ).sort((a, b) => (a || 0) - (b || 0))
  
  // Filter schedules
  const filteredSchedules = schedules.filter(schedule => {
    if (statusFilter !== "all" && schedule.status !== statusFilter) return false
    if (eventTypeFilter !== "all" && schedule.event_type !== eventTypeFilter) return false
    if (branchFilter !== "all" && schedule.branch !== branchFilter) return false
    if (scheduleTypeFilter !== "all" && schedule.schedule_type !== scheduleTypeFilter) return false
    if (batchFilter !== "all" && schedule.batch_number?.toString() !== batchFilter) return false
    return true
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="lg:w-[60vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{courseName}</DialogTitle>
          <DialogDescription>
            Course events and participant details
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Course Info */}
            {courseData && (
              <Card>
                <CardContent className="pt-4 pb-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Training Fee</p>
                      <p className="text-base font-semibold">
                        ₱{courseData.training_fee ? Number(courseData.training_fee).toLocaleString() : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Events</p>
                      <p className="text-base font-semibold">{schedules.length}</p>
                    </div>
                    {courseData.description && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Description</p>
                        <p className="text-sm mt-1">{courseData.description}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Schedules/Events */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Scheduled Events ({filteredSchedules.length})</h3>
                <div className="flex items-center gap-2">
                <span className="text-sm font-light text-gray-500">Filters</span>
                <Menubar className="border rounded-md">
                    {/* STATUS */}
                    <MenubarMenu>
                        <MenubarTrigger className={menubarHover}>
                            Status
                            </MenubarTrigger>

                        <MenubarContent>
                        <MenubarItem onClick={() => setStatusFilter("all")}>
                            All statuses
                        </MenubarItem>
                        <MenubarSeparator />
                        {uniqueStatuses.map(status => (
                            <MenubarItem
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                            </MenubarItem>
                        ))}
                        </MenubarContent>
                    </MenubarMenu>

                    {/* EVENT TYPE */}
                    <MenubarMenu>
                        <MenubarTrigger className={menubarHover}>Event Type</MenubarTrigger>
                        <MenubarContent>
                        <MenubarItem onClick={() => setEventTypeFilter("all")}>
                            All event types
                        </MenubarItem>
                        <MenubarSeparator />
                        {uniqueEventTypes.map(type => (
                            <MenubarItem
                            key={type}
                            onClick={() => setEventTypeFilter(type)}
                            >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                            </MenubarItem>
                        ))}
                        </MenubarContent>
                    </MenubarMenu>

                    {/* BRANCH */}
                    <MenubarMenu>
                        <MenubarTrigger className={menubarHover}>Branch</MenubarTrigger>
                        <MenubarContent>
                        <MenubarItem onClick={() => setBranchFilter("all")}>
                            All branches
                        </MenubarItem>
                        <MenubarSeparator />
                        {uniqueBranches.map(branch => (
                            <MenubarItem
                            key={branch}
                            onClick={() => setBranchFilter(branch)}
                            >
                            {branch}
                            </MenubarItem>
                        ))}
                        </MenubarContent>
                    </MenubarMenu>

                    {/* SCHEDULE TYPE */}
                    <MenubarMenu>
                        <MenubarTrigger className={menubarHover}>Schedule</MenubarTrigger>
                        <MenubarContent>
                        <MenubarItem onClick={() => setScheduleTypeFilter("all")}>
                            All schedules
                        </MenubarItem>
                        <MenubarSeparator />
                        {uniqueScheduleTypes.map(type => (
                            <MenubarItem
                            key={type}
                            onClick={() => setScheduleTypeFilter(type)}
                            >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                            </MenubarItem>
                        ))}
                        </MenubarContent>
                    </MenubarMenu>

                    {/* BATCH */}
                    <MenubarMenu>
                        <MenubarTrigger className={menubarHover}>Batch</MenubarTrigger>
                        <MenubarContent>
                        <MenubarItem onClick={() => setBatchFilter("all")}>
                            All batches
                        </MenubarItem>
                        <MenubarSeparator />
                        {uniqueBatches.map(batch => (
                            <MenubarItem
                            key={batch}
                            onClick={() => setBatchFilter(String(batch))}
                            >
                            Batch {batch}
                            </MenubarItem>
                        ))}
                        </MenubarContent>
                    </MenubarMenu>

                    {/* CLEAR */}
                    <MenubarMenu>
                        <MenubarTrigger
                        className="text-destructive"
                        onClick={() => {
                            setStatusFilter("all")
                            setEventTypeFilter("all")
                            setBranchFilter("all")
                            setScheduleTypeFilter("all")
                            setBatchFilter("all")
                        }}
                        >
                        Clear
                        </MenubarTrigger>
                    </MenubarMenu>
                    </Menubar>
                    </div>

                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button> */}
              </div>

              {/* Filters Section */}
              {showFilters && (
                <Card className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="status-filter" className="text-xs">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="status-filter" className="h-9">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {uniqueStatuses.map(status => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="event-type-filter" className="text-xs">Event Type</Label>
                      <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                        <SelectTrigger id="event-type-filter" className="h-9">
                          <SelectValue placeholder="All event types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Event Types</SelectItem>
                          {uniqueEventTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="branch-filter" className="text-xs">Branch</Label>
                      <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger id="branch-filter" className="h-9">
                          <SelectValue placeholder="All branches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {uniqueBranches.map(branch => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="schedule-type-filter" className="text-xs">Schedule Type</Label>
                      <Select value={scheduleTypeFilter} onValueChange={setScheduleTypeFilter}>
                        <SelectTrigger id="schedule-type-filter" className="h-9">
                          <SelectValue placeholder="All schedule types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Schedule Types</SelectItem>
                          {uniqueScheduleTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="batch-filter" className="text-xs">Batch Number</Label>
                      <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger id="batch-filter" className="h-9">
                          <SelectValue placeholder="All batches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Batches</SelectItem>
                          {uniqueBatches.map(batch => (
                            <SelectItem key={batch} value={String(batch)}>
                              Batch {batch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatusFilter("all")
                          setEventTypeFilter("all")
                          setBranchFilter("all")
                          setScheduleTypeFilter("all")
                          setBatchFilter("all")
                        }}
                        className="w-full h-9"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
              
              {filteredSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {schedules.length === 0 
                    ? "No scheduled events found for this course."
                    : "No events match the selected filters."}
                </p>
              ) : (
                filteredSchedules.map((schedule) => (
                  <Card key={schedule.id} className="overflow-hidden">
                    <CardContent className="px-3">
                      <div className="space-y-0">
                        {/* Schedule Header - Compact */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <Badge variant="outline" className={`${getStatusColor(schedule.status)} text-xs px-2 py-0`}>
                              {schedule.status}
                            </Badge>
                            {schedule.batch_number && (
                              <Badge variant="outline" className="text-xs px-2 py-0">
                                Batch {schedule.batch_number}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs px-2 py-0">
                              {schedule.event_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs px-2 py-0">
                              {schedule.schedule_type}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Schedule Details - Compact */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{getScheduleDates(schedule)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{schedule.branch}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{schedule.trainings?.length || 0} participants</span>
                          </div>
                        </div>

                        {/* Collapsible Participants List */}
                        {schedule.trainings && schedule.trainings.length > 0 && (
                          <Collapsible
                            open={openSchedules[schedule.id]}
                            onOpenChange={() => toggleSchedule(schedule.id)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-between h-7 text-xs px-2 mt-1"
                              >
                                <span className="font-medium">
                                  {openSchedules[schedule.id] ? 'Hide' : 'Show'} Participants ({schedule.trainings.length})
                                </span>
                                {openSchedules[schedule.id] ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="border-t pt-2">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {schedule.trainings.map((training) => (
                                    <div
                                      key={training.id}
                                      className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50"
                                    >
                                      <span className="truncate">
                                        {training.first_name} {training.last_name}
                                      </span>
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                                        {training.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}