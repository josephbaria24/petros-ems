//components\new-schedule-dialog.tsx

"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar03 } from "@/components/calendar-03"
import { Calendar05 } from "@/components/calendar-05"
import { Button } from "@/components/ui/button"

import { type DateRange } from "react-day-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"
import { Input } from "./ui/input"

interface NewScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleCreated?: () => void
}

export function NewScheduleDialog({ open, onOpenChange, onScheduleCreated }: NewScheduleDialogProps) {
  const [eventType, setEventType] = React.useState<string>("")
  const [course, setCourse] = React.useState<string>("")
  const [branch, setBranch] = React.useState<string>("")
  const [scheduleType, setScheduleType] = React.useState<string>("regular")
  const [rangeDates, setRangeDates] = React.useState<DateRange | undefined>()
  const [multiDates, setMultiDates] = React.useState<Date[]>([])
  const [courseOptions, setCourseOptions] = React.useState<{ id: string; name: string }[]>([])
  const [loadingCourses, setLoadingCourses] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isBranchRequired = eventType !== "online"
  const [batchNumber, setBatchNumber] = React.useState<number | null>(null)
  const [courseSearch, setCourseSearch] = React.useState("")
  const [courseOpen, setCourseOpen] = React.useState(false)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (courseOpen && !target.closest('.relative')) {
        setCourseOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [courseOpen])


  React.useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase.from("courses").select("id, name").order("name")
      if (error) {
        console.error("Failed to load courses", error)
        toast.error("Failed to load courses", {
          description: error.message,
        })
      } else {
        setCourseOptions(data)
      }
      setLoadingCourses(false)
    }

    fetchCourses()
  }, [])


  React.useEffect(() => {
    if (!course) return
  
    const fetchNextBatchNumber = async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("batch_number")
        .eq("course_id", course)
        .not("batch_number", "is", null)
  
      if (error) {
        console.error("Error fetching batches:", error)
        return
      }
  
      const existingBatches = data.map(b => b.batch_number).filter(Boolean) as number[]
      const nextBatch = existingBatches.length > 0 ? Math.max(...existingBatches) + 1 : 1
      setBatchNumber(nextBatch)
    }
  
    fetchNextBatchNumber()
  }, [course])
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
  
    const isRegularValid = scheduleType === "regular" && rangeDates?.from && rangeDates?.to
    const isStaggeredValid = scheduleType === "staggered" && multiDates.length > 0
  
    if (!eventType || !course || (isBranchRequired && !branch) || (!isRegularValid && !isStaggeredValid)) {
      toast.error("Missing Information", {
        description: "Please fill in all required fields.",
      })
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading("Creating schedule...", {
      description: "Please wait while we save your training schedule.",
    })
  
    try {
      // Step 1: Insert into schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedules")
        .insert({
          course_id: course,
          schedule_type: scheduleType,
          event_type: eventType,
          branch: branch,
          batch_number: batchNumber, 
        })
        .select()
        .single()
    
      if (scheduleError || !scheduleData) {
        toast.error("Error Creating Schedule", {
          id: toastId,
          description: scheduleError?.message || "Unknown error occurred.",
        })
        setIsSubmitting(false)
        return
      }
    
      const scheduleId = scheduleData.id
    
      // Step 2: Insert dates
      if (scheduleType === "regular" && rangeDates?.from && rangeDates?.to) {
        const { error: rangeError } = await supabase
          .from("schedule_ranges")
          .insert({
            schedule_id: scheduleId,
            start_date: rangeDates.from.toISOString().split("T")[0],
            end_date: rangeDates.to.toISOString().split("T")[0],
          })
    
        if (rangeError) {
          toast.error("Error Saving Range", {
            id: toastId,
            description: rangeError.message,
          })
          setIsSubmitting(false)
          return
        }
      }
    
      if (scheduleType === "staggered" && multiDates.length > 0) {
        const staggeredInserts = multiDates.map((d) => ({
          schedule_id: scheduleId,
          date: d.toISOString().split("T")[0],
        }))
    
        const { error: dateError } = await supabase
          .from("schedule_dates")
          .insert(staggeredInserts)
    
        if (dateError) {
          toast.error("Error Saving Dates", {
            id: toastId,
            description: dateError.message,
          })
          setIsSubmitting(false)
          return
        }
      }
    
      // Final Success Toast
      const courseName = courseOptions.find(c => c.id === course)?.name || "Course"
      toast.success("Schedule Created Successfully", {
        id: toastId,
        description: `${courseName} training schedule has been created for ${branch}.`,
      })
    
      // Reset form
      setEventType("")
      setCourse("")
      setBranch("")
      setScheduleType("regular")
      setRangeDates(undefined)
      setMultiDates([])
      setIsSubmitting(false)
      onOpenChange(false)
      
      // Notify parent to refresh data
      onScheduleCreated?.()
    } catch (error) {
      console.error("Unexpected error:", error)
      toast.error("Unexpected Error", {
        id: toastId,
        description: "An unexpected error occurred while creating the schedule.",
      })
      setIsSubmitting(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-full p-6">
        <DialogHeader>
          <DialogTitle>New Training Schedule</DialogTitle>
          <DialogDescription>
            Create a new training event. Fill in all the required information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Two-Column Grid */}
          <div className="flex flex-col md:flex-row gap-6 mt-6">
            {/* LEFT COLUMN: Inputs */}
            <div className="flex-1 space-y-4">
              {/* Event Type */}
              <div className="grid gap-2">
                <Label htmlFor="event-type">Event Type *</Label>
                {/* Event Type */}
                <Select value={eventType} onValueChange={setEventType} disabled={isSubmitting}>
                  <SelectTrigger id="event-type" className="max-w-sm">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="in-house">In-house</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>

              </div>

              {/* Course - Searchable */}
              <div className="grid gap-2">
                <Label htmlFor="course">Course *</Label>
                <div className="relative max-w-sm">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting || loadingCourses}
                    onClick={() => setCourseOpen(!courseOpen)}
                    className="w-full justify-between text-left"
                  >
                    <span className="truncate block">
                      {course
                        ? courseOptions.find((c) => c.id === course)?.name
                        : loadingCourses
                        ? "Loading..."
                        : "Select course"}
                    </span>
                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  
                  {courseOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search course..."
                          value={courseSearch}
                          onChange={(e) => setCourseSearch(e.target.value)}
                          className="h-9"
                          autoFocus
                        />
                      </div>
                      <div 
                        className="max-h-[300px] overflow-y-auto overscroll-contain"
                        onWheel={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        {courseOptions
                          .filter((c) =>
                            c.name.toLowerCase().includes(courseSearch.toLowerCase())
                          )
                          .map((c) => (
                            <div
                              key={c.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                course === c.id && "bg-accent"
                              )}
                              onClick={() => {
                                setCourse(c.id)
                                setCourseOpen(false)
                                setCourseSearch("")
                              }}
                            >
                              {c.name}
                            </div>
                          ))}
                        {courseOptions.filter((c) =>
                          c.name.toLowerCase().includes(courseSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            No courses found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="batch_number">Batch Number</Label>
                <Input
                  id="batch_number"
                  value={batchNumber ?? ""}
                  readOnly
                  className="max-w-sm"
                  placeholder="Auto-generated"
                />
              </div>


              {/* Branch */}
              {eventType !== "online" && (
                <div className="grid gap-2">
                  <Label htmlFor="branch">Branch *</Label>
                  <Select value={branch} onValueChange={setBranch} disabled={isSubmitting}>
                    <SelectTrigger id="branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cebu">Cebu City</SelectItem>
                      <SelectItem value="davao">Davao</SelectItem>
                      <SelectItem value="dumaguete">Dumaguete City</SelectItem>
                      <SelectItem value="pampanga">Pampanga</SelectItem>
                      <SelectItem value="pasig">Pasig City</SelectItem>
                      <SelectItem value="puerto-princesa">Puerto Princesa City</SelectItem>
                      <SelectItem value="quezon">Quezon City</SelectItem>
                      <SelectItem value="rio-tuba">Rio Tuba</SelectItem>
                      <SelectItem value="roxas">Roxas City</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Schedule Type */}
              <div className="grid gap-2">
                <Label>Schedule Type *</Label>
                <RadioGroup value={scheduleType} onValueChange={setScheduleType} disabled={isSubmitting}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="regular" id="regular" />
                    <Label htmlFor="regular" className="font-normal cursor-pointer">
                      Regular
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="staggered" id="staggered" />
                    <Label htmlFor="staggered" className="font-normal cursor-pointer">
                      Staggered
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* RIGHT COLUMN: Calendar */}
            <div className="flex-1">
              <Label className="block mb-2">Schedule Dates *</Label>
              {scheduleType === "regular" ? (
                <Calendar05 value={rangeDates} onChange={setRangeDates} />
              ) : (
                <Calendar03 value={multiDates} onChange={setMultiDates} />
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}