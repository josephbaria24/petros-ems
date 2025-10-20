"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar03 } from "@/components/calendar-03"
import { Calendar05 } from "@/components/calendar-05"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { type DateRange } from "react-day-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command"

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
  
    const isRegularValid = scheduleType === "regular" && rangeDates?.from && rangeDates?.to
    const isStaggeredValid = scheduleType === "staggered" && multiDates.length > 0
  
    if (!eventType || !course || !branch || (!isRegularValid && !isStaggeredValid)) {
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
                <Select value={eventType} onValueChange={setEventType} disabled={isSubmitting}>
                  <SelectTrigger id="event-type">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={isSubmitting}
                      className="w-full justify-between"
                    >
                      {course
                        ? courseOptions.find((c) => c.id === course)?.name
                        : loadingCourses
                        ? "Loading..."
                        : "Select course"}
                    </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-full p-0"
                          side="bottom"
                          align="start"
                          style={{
                            maxHeight: "40vh",
                            overflowY: "auto",
                            overscrollBehavior: "contain",
                          }}
                        >
                          <Command>
                            <CommandInput placeholder="Search course..." />
                            <CommandEmpty>No course found.</CommandEmpty>
                            <CommandGroup>
                              {courseOptions.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => setCourse(c.id)}
                                >
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>

                      </Popover>
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