//components\edit-schedule-dialog.tsx
"use client"

import * as React from "react"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { format, eachDayOfInterval } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar03 } from "@/components/calendar-03"
import { Calendar05 } from "@/components/calendar-05"
import { Button } from "@/components/ui/button"
import { type DateRange } from "react-day-picker"
import { Mail } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  CommandList,
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
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { recalculateScheduleStatus } from "@/lib/schedule-status-updater"
import { Input } from "./ui/input"

interface EditScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string | null
  onScheduleUpdated?: () => void
}


function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateFromDB(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function EditScheduleDialog({ open, onOpenChange, scheduleId, onScheduleUpdated }: EditScheduleDialogProps) {
  const [eventType, setEventType] = React.useState<string>("")
  const [course, setCourse] = React.useState<string>("")
  const [branch, setBranch] = React.useState<string>("")
  const [scheduleType, setScheduleType] = React.useState<string>("regular")
  const [rangeDates, setRangeDates] = React.useState<DateRange | undefined>()
  const [multiDates, setMultiDates] = React.useState<Date[]>([])
  const [courseOptions, setCourseOptions] = React.useState<{ id: string; name: string; online_fee: number | null; face_to_face_fee: number | null; elearning_fee: number | null }[]>([])
  const [loadingCourses, setLoadingCourses] = React.useState(true)
  const [loadingSchedule, setLoadingSchedule] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isBranchRequired = eventType !== "online" && eventType !== "elearning"
  const [selectedCourseData, setSelectedCourseData] = React.useState<any>(null)
  const [batchNumber, setBatchNumber] = React.useState<number | null>(null)
  const [dayTrainers, setDayTrainers] = React.useState<Record<string, string>>({})
  const [trainerName, setTrainerName] = React.useState<string>("")
  const [trainerOptions, setTrainerOptions] = React.useState<string[]>([])
  const [loadingTrainers, setLoadingTrainers] = React.useState(false)
  // Fetch courses with fee information
  React.useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await tmsDb
        .from("courses")
        .select("id, name, online_fee, face_to_face_fee, elearning_fee")
        .order("name")
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
    const fetchTrainersFromRepo = async () => {
      setLoadingTrainers(true)
      try {
        const { data: rows, error } = await tmsDb
          .from("trainer_repo_rows")
          .select("data")

        if (error) throw error

        if (rows) {
          const names = new Set<string>()
          rows.forEach((row: any) => {
            const d = row.data
            // Try to find name components
            const firstName = d["First Name"] || d["first name"] || d["FirstName"] || ""
            const lastName = d["Last Name"] || d["last name"] || d["LastName"] || ""
            const fullName = d["Full Name"] || d["full name"] || d["FullName"] || d["Trainer Name"] || d["Name"] || ""

            if (firstName && lastName) {
              names.add(`${firstName} ${lastName}`.trim())
            } else if (fullName) {
              names.add(fullName.trim())
            }
          })
          setTrainerOptions(Array.from(names).sort())
        }
      } catch (error) {
        console.error("Error fetching trainers:", error)
      } finally {
        setLoadingTrainers(false)
      }
    }

    if (open) {
      fetchTrainersFromRepo()
    }
  }, [open])

  // Update selectedCourseData when course changes
  React.useEffect(() => {
    if (!course) {
      setSelectedCourseData(null)
      return
    }

    const fetchedCourse = courseOptions.find(c => c.id === course)
    if (fetchedCourse) {
      setSelectedCourseData(fetchedCourse)
    }
  }, [course, courseOptions])

  // Fetch schedule data when dialog opens
  React.useEffect(() => {
    const fetchScheduleData = async () => {
      if (!scheduleId || !open) return

      setLoadingSchedule(true)

      try {
        // Fetch schedule with related data
        const { data: scheduleData, error: scheduleError } = await tmsDb
          .from("schedules")
          .select(`
            *,
            schedule_ranges (*),
            schedule_dates (*)
          `)
          .eq("id", scheduleId)
          .single()

        if (scheduleError) {
          toast.error("Failed to load schedule", {
            description: scheduleError.message,
          })
          return
        }

        // Populate form fields
        setEventType(scheduleData.event_type || "")
        setCourse(scheduleData.course_id)
        setScheduleType(scheduleData.schedule_type)
        setBranch(scheduleData.branch)
        setBatchNumber(scheduleData.batch_number)
        setTrainerName(scheduleData.trainer_name || "")
        setDayTrainers(scheduleData.day_trainers || {})
        setCourse(scheduleData.course_id || "")
        setBranch(scheduleData.branch || "")
        setScheduleType(scheduleData.schedule_type || "regular")
        setBatchNumber(scheduleData.batch_number || null) // ✅ Set batch number

        // Handle dates based on schedule type
        if (scheduleData.schedule_type === "regular" && scheduleData.schedule_ranges?.length > 0) {
          const range = scheduleData.schedule_ranges[0]
          setRangeDates({
            from: parseDateFromDB(range.start_date),
            to: parseDateFromDB(range.end_date),
          })
          setMultiDates([])
        } else if (scheduleData.schedule_type === "staggered" && scheduleData.schedule_dates?.length > 0) {
          const dates = scheduleData.schedule_dates.map((d: { date: string }) => parseDateFromDB(d.date))
          setMultiDates(dates)
          setRangeDates(undefined)
        }
      } catch (error) {
        console.error("Error fetching schedule:", error)
        toast.error("Unexpected error loading schedule")
      } finally {
        setLoadingSchedule(false)
      }
    }

    fetchScheduleData()
  }, [scheduleId, open])

  const scheduleDays = React.useMemo(() => {
    if (scheduleType === "regular") {
      if (rangeDates?.from && rangeDates?.to) {
        try {
          return eachDayOfInterval({ start: rangeDates.from, end: rangeDates.to })
        } catch (e) {
          return []
        }
      }
    } else {
      return [...multiDates].sort((a, b) => a.getTime() - b.getTime())
    }
    return []
  }, [scheduleType, rangeDates, multiDates])

  const handleApplyToAll = (name: string) => {
    const newTrainers: Record<string, string> = {}
    scheduleDays.forEach(day => {
      newTrainers[formatDateForDB(day)] = name
    })
    setDayTrainers(newTrainers)
  }

  const handleSubmit = async (e: React.FormEvent, sendEmail: boolean = false) => {
    e.preventDefault()

    if (!scheduleId) {
      toast.error("No schedule selected")
      return
    }

    const isRegularValid = scheduleType === "regular" && rangeDates?.from && rangeDates?.to
    const isStaggeredValid = scheduleType === "staggered" && multiDates.length > 0

    if (!eventType || !course || (isBranchRequired && !branch) || (!isRegularValid && !isStaggeredValid)) {
      toast.error("Missing Information", {
        description: "Please fill in all required fields.",
      })
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading("Updating schedule...", {
      description: sendEmail
        ? "Saving changes and preparing emails..."
        : "Please wait while we save your changes.",
    })

    try {
      // Step 1: Update the schedule
      const { error: scheduleError } = await tmsDb
        .from("schedules")
        .update({
          course_id: course,
          schedule_type: scheduleType,
          event_type: eventType,
          branch: branch,
          batch_number: batchNumber, // ✅ Update batch number
          trainer_name: trainerName || Object.values(dayTrainers).filter(Boolean)[0] || "",
          day_trainers: dayTrainers,
        })
        .eq("id", scheduleId)

      if (scheduleError) {
        toast.error("Error Updating Schedule", {
          id: toastId,
          description: scheduleError.message,
        })
        setIsSubmitting(false)
        return
      }

      // ✅ NEW: Update all trainees with the new batch number
      if (batchNumber !== null) {
        const { error: batchUpdateError } = await tmsDb
          .from("trainings")
          .update({ batch_number: batchNumber })
          .eq("schedule_id", scheduleId)

        if (batchUpdateError) {
          console.error("Error updating trainee batch numbers:", batchUpdateError)
          // Don't fail the whole operation, just log it
        } else {
          console.log(`✅ Updated batch number to ${batchNumber} for all trainees in schedule ${scheduleId}`)
        }
      }

      // Step 2: Delete existing dates (both ranges and individual dates)
      await tmsDb.from("schedule_ranges").delete().eq("schedule_id", scheduleId)
      await tmsDb.from("schedule_dates").delete().eq("schedule_id", scheduleId)

      // Step 3: Insert new dates based on schedule type
      if (scheduleType === "regular" && rangeDates?.from && rangeDates?.to) {
        const { error: rangeError } = await tmsDb
          .from("schedule_ranges")
          .insert({
            schedule_id: scheduleId,
            start_date: formatDateForDB(rangeDates.from),
            end_date: formatDateForDB(rangeDates.to),
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
          date: formatDateForDB(d),
        }))

        const { error: dateError } = await tmsDb
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

      // Step 4: RECALCULATE SCHEDULE STATUS
      await recalculateScheduleStatus(scheduleId)

      // Step 5: Send emails if requested
      if (sendEmail) {
        try {
          // Fetch all trainees for this schedule
          const { data: trainees, error: traineesError } = await tmsDb
            .from("trainings")
            .select("email, first_name, last_name")
            .eq("schedule_id", scheduleId)
            .not("email", "is", null)

          if (traineesError) {
            console.error("Error fetching trainees:", traineesError)
            toast.warning("Schedule updated but failed to fetch trainees", {
              id: toastId,
              description: "Emails were not sent.",
            })
          } else if (trainees && trainees.length > 0) {
            const courseName = courseOptions.find(c => c.id === course)?.name || "Course"
            const dateText = scheduleType === "regular" && rangeDates?.from && rangeDates?.to
              ? `${rangeDates.from.toLocaleDateString()} - ${rangeDates.to.toLocaleDateString()}`
              : multiDates.map(d => d.toLocaleDateString()).join(", ")

            await fetch("/api/send-schedule-update-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trainees,
                courseName,
                dateText,
                branch,
                eventType,
              }),
            })

            toast.success("Schedule Updated & Emails Sent", {
              id: toastId,
              description: `${courseName} updated and ${trainees.length} trainees notified.`,
            })
          } else {
            toast.success("Schedule Updated", {
              id: toastId,
              description: `No trainees found to notify.`,
            })
          }
        } catch (emailError) {
          console.error("Email error:", emailError)
          toast.warning("Schedule updated but emails failed", {
            id: toastId,
            description: "The schedule was saved successfully.",
          })
        }
      } else {
        // Final Success Toast (no email)
        const courseName = courseOptions.find(c => c.id === course)?.name || "Course"
        toast.success("Schedule Updated Successfully", {
          id: toastId,
          description: `${courseName} training schedule has been updated.`,
        })
      }

      setIsSubmitting(false)
      onOpenChange(false)

      // Notify parent to refresh data
      onScheduleUpdated?.()
    } catch (error) {
      console.error("Unexpected error:", error)
      toast.error("Unexpected Error", {
        id: toastId,
        description: "An unexpected error occurred while updating the schedule.",
      })
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:w-[80vw] p-6 bg-card">
        <DialogHeader>
          <DialogTitle>Edit Training Schedule</DialogTitle>
          <DialogDescription>
            Update the training event information. All changes will be saved.
          </DialogDescription>
        </DialogHeader>

        {loadingSchedule ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading schedule data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Two-Column Grid */}
            <div className="flex flex-col md:flex-row gap-6 mt-6">
              {/* LEFT COLUMN: Inputs */}
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Batch Number */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="batch_number">Batch Number *</Label>
                    <Input
                      id="batch_number"
                      type="number"
                      min="1"
                      value={batchNumber ?? ""}
                      onChange={(e) => setBatchNumber(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSubmitting}
                      className="h-9"
                      placeholder="Batch #"
                    />
                  </div>
                  {/* Event Type */}
                  <div className="grid gap-1.5">
                    <Label htmlFor="event-type">Training Type *</Label>
                    <Select value={eventType} onValueChange={setEventType} disabled={isSubmitting}>
                      <SelectTrigger id="event-type" className="h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="face-to-face">Face-to-Face</SelectItem>
                        <SelectItem value="elearning">E-Learning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Primary Trainer Selection */}
                <div className="grid gap-1.5">
                  <Label htmlFor="trainer">Trainer *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full h-9 justify-between text-left font-normal",
                          !trainerName && "text-muted-foreground"
                        )}
                        disabled={isSubmitting}
                      >
                        <span className="truncate">{trainerName || "Select primary trainer"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search trainer..." className="h-8 text-xs" />
                        <CommandList onWheel={(e) => e.stopPropagation()}>
                          <CommandEmpty>
                            <div className="p-2 text-xs text-muted-foreground">
                              Not found.
                              <div className="mt-2">
                                <Input
                                  placeholder="Manual name..."
                                  className="h-7 text-[10px]"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value
                                      if (val) {
                                        setTrainerName(val)
                                        handleApplyToAll(val)
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Trainers">
                            {trainerOptions.map((trainer: string) => (
                              <CommandItem
                                key={trainer}
                                value={trainer}
                                onSelect={(val: string) => {
                                  setTrainerName(val)
                                  handleApplyToAll(val)
                                }}
                                className="text-xs py-1"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-3 w-3",
                                    trainerName === trainer ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {trainer}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Per-Day Trainer Assignment */}
                {scheduleDays.length > 0 && (
                  <div className="grid gap-2 p-3 bg-muted/30 border rounded-md">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trainers per Day</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const firstTrainer = dayTrainers[formatDateForDB(scheduleDays[0])]
                          if (firstTrainer) handleApplyToAll(firstTrainer)
                        }}
                        className="h-6 text-[10px] px-2"
                        disabled={!dayTrainers[formatDateForDB(scheduleDays[0])]}
                      >
                        Apply first to all
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {scheduleDays.map((day, idx) => {
                        const dateStr = formatDateForDB(day)
                        const currentTrainer = dayTrainers[dateStr] || ""

                        return (
                          <div key={dateStr} className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0">
                              {format(day, "MMM dd")}
                            </span>

                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "h-7 w-full justify-between text-xs font-normal px-2",
                                    !currentTrainer && "text-muted-foreground"
                                  )}
                                  disabled={isSubmitting}
                                >
                                  <span className="truncate">{currentTrainer || "Trainer"}</span>
                                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search..." className="h-8 text-xs" />
                                  <CommandList onWheel={(e) => e.stopPropagation()}>
                                    <CommandEmpty>
                                      <div className="p-2 text-xs text-muted-foreground">
                                        Not found.
                                        <div className="mt-2">
                                          <Input
                                            placeholder="Manual name..."
                                            className="h-7 text-[10px]"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value
                                                if (val) {
                                                  setDayTrainers(prev => ({ ...prev, [dateStr]: val }))
                                                }
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {trainerOptions.map((trainer: string) => (
                                        <CommandItem
                                          key={trainer}
                                          value={trainer}
                                          onSelect={(val: string) => {
                                            setDayTrainers(prev => ({ ...prev, [dateStr]: val }))
                                          }}
                                          className="text-xs py-1"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-3 w-3",
                                              currentTrainer === trainer ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {trainer}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="course">Course *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={isSubmitting}
                        className="w-full h-9 justify-between truncate text-left"
                      >
                        <span className="truncate block">
                          {course
                            ? courseOptions.find((c) => c.id === course)?.name
                            : loadingCourses
                              ? "Loading..."
                              : "Select course"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-full max-w-sm p-0"
                      side="bottom"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search course..." />
                        <CommandList className="max-h-60 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
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
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>


                {/* Training Fees Display - Compact Mode */}
                {selectedCourseData && (
                  <div className="p-2.5 bg-muted/30 border rounded-md">
                    <div className="grid grid-cols-3 gap-3">
                      {/* Online Fee */}
                      <div className={`p-1.5 rounded border ${eventType === 'online' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-background'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Online</span>
                          <span className="text-sm font-bold">
                            {selectedCourseData.online_fee !== null ? `₱${Number(selectedCourseData.online_fee).toLocaleString()}` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Face-to-Face Fee */}
                      <div className={`p-1.5 rounded border ${eventType === 'face-to-face' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-background'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">F2F</span>
                          <span className="text-sm font-bold">
                            {selectedCourseData.face_to_face_fee !== null ? `₱${Number(selectedCourseData.face_to_face_fee).toLocaleString()}` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* E-Learning Fee */}
                      <div className={`p-1.5 rounded border ${eventType === 'elearning' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-background'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">E-Learning</span>
                          <span className="text-sm font-bold">
                            {selectedCourseData.elearning_fee !== null ? `₱${Number(selectedCourseData.elearning_fee).toLocaleString()}` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) || (
                    <div className="h-[58px]" /> // Maintain height stability
                  )}

                <div className="grid grid-cols-2 gap-4 items-end">
                  {/* Branch */}
                  {eventType !== "online" && eventType !== "elearning" ? (
                    <div className="grid gap-1.5">
                      <Label htmlFor="branch">Branch *</Label>
                      <Select value={branch} onValueChange={setBranch} disabled={isSubmitting}>
                        <SelectTrigger id="branch" className="h-9">
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
                  ) : (
                    <div className="flex items-center gap-2 h-9 p-3 bg-muted rounded-md text-xs text-muted-foreground">
                      <span className="italic">Branch not required for {eventType}</span>
                    </div>
                  )}

                  {/* Schedule Type */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <RadioGroup value={scheduleType} onValueChange={setScheduleType} disabled={isSubmitting} className="flex h-9 items-center gap-4 bg-muted/50 px-3 rounded-md">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="regular" id="regular" className="h-3.5 w-3.5" />
                        <Label htmlFor="regular" className="text-xs font-normal cursor-pointer">Regular</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="staggered" id="staggered" className="h-3.5 w-3.5" />
                        <Label htmlFor="staggered" className="text-xs font-normal cursor-pointer">Staggered</Label>
                      </div>
                    </RadioGroup>
                  </div>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? "Updating..." : "Update Schedule"}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit(new Event('submit') as any, false)
                    }}
                    disabled={isSubmitting}
                  >
                    Save Changes Only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit(new Event('submit') as any, true)
                    }}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Save & Send Email to Trainees
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog >
  )
}