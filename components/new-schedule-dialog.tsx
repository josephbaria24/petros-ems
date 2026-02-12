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
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { Input } from "./ui/input"

interface NewScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleCreated?: () => void
}
function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const isBranchRequired = eventType === "face-to-face"
  const [batchNumber, setBatchNumber] = React.useState<number | null>(null)
  const [courseSearch, setCourseSearch] = React.useState("")
  const [courseOpen, setCourseOpen] = React.useState(false)
  const [registrationFormType, setRegistrationFormType] = React.useState<string>("default")

  const [selectedCourseData, setSelectedCourseData] = React.useState<any>(null)

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
    if (!course) {
      setSelectedCourseData(null)
      return
    }

    const fetchedCourse = courseOptions.find(c => c.id === course)
    if (fetchedCourse) {
      setSelectedCourseData(fetchedCourse)
    }
  }, [course, courseOptions])


  React.useEffect(() => {
    if (!course) return

    const fetchNextBatchNumber = async () => {
      const { data, error } = await tmsDb
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
      const { data: scheduleData, error: scheduleError } = await tmsDb
        .from("schedules")
        .insert({
          course_id: course,
          schedule_type: scheduleType,
          event_type: eventType,
          branch: branch,
          batch_number: batchNumber,
          registration_form_type: registrationFormType,
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

      // Final Success Toast
      const courseName = courseOptions.find(c => c.id === course)?.name || "Course"
      const eventTypeLabel = eventType === 'face-to-face' ? 'Face-to-Face' :
        eventType === 'elearning' ? 'E-Learning' : 'Online'
      toast.success("Schedule Created Successfully", {
        id: toastId,
        description: `${courseName} ${eventTypeLabel} training schedule has been created${branch ? ` for ${branch}` : ''}.`,
      })

      // Reset form
      setEventType("")
      setCourse("")
      setBranch("")
      setScheduleType("regular")
      setRangeDates(undefined)
      setMultiDates([])
      setRegistrationFormType("default")
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
      <DialogContent className="sm:max-w-5xl max-w-full p-6">

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
            {/* Training Type + Course (same row) */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Event Type */}
              <div className="grid gap-2">
                <Label htmlFor="event-type">Training Type *</Label>
                <Select value={eventType} onValueChange={setEventType} disabled={isSubmitting}>
                  <SelectTrigger id="event-type" className="w-full">
                    <SelectValue placeholder="Select training type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="face-to-face">Face-to-Face</SelectItem>
                    <SelectItem value="elearning">E-Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Course - Searchable */}
              <div className="grid gap-2">
                <Label htmlFor="course">Course *</Label>
                <div className="relative w-full">
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
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {courseOptions
                          .filter((c) => c.name.toLowerCase().includes(courseSearch.toLowerCase()))
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

              {selectedCourseData && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Training Fees:
                  </p>
                  <div className="space-y-2">
                    {/* Online Fee */}
                    <div
                      className={`p-2 rounded-md transition-all ${eventType === 'online'
                          ? 'bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-500 ring-2 ring-emerald-200'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-medium ${eventType === 'online' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                          Online:
                        </span>
                        <p className={`font-bold text-sm ${eventType === 'online' ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
                          }`}>
                          {selectedCourseData.online_fee !== null
                            ? `₱${Number(selectedCourseData.online_fee).toLocaleString()}`
                            : "N/A"}
                        </p>
                      </div>
                      {eventType === 'online' && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                          ✓ Selected
                        </p>
                      )}
                    </div>

                    {/* Face-to-Face Fee */}
                    <div
                      className={`p-2 rounded-md transition-all ${eventType === 'face-to-face'
                          ? 'bg-blue-100 dark:bg-blue-950 border-2 border-blue-500 ring-2 ring-blue-200'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-medium ${eventType === 'face-to-face' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                          Face-to-Face:
                        </span>
                        <p className={`font-bold text-sm ${eventType === 'face-to-face' ? 'text-blue-900 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'
                          }`}>
                          {selectedCourseData.face_to_face_fee !== null
                            ? `₱${Number(selectedCourseData.face_to_face_fee).toLocaleString()}`
                            : "N/A"}
                        </p>
                      </div>
                      {eventType === 'face-to-face' && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                          ✓ Selected
                        </p>
                      )}
                    </div>

                    {/* E-Learning Fee */}
                    <div
                      className={`p-2 rounded-md transition-all ${eventType === 'elearning'
                          ? 'bg-purple-100 dark:bg-purple-950 border-2 border-purple-500 ring-2 ring-purple-200'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-medium ${eventType === 'elearning' ? 'text-purple-700 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                          E-Learning:
                        </span>
                        <p className={`font-bold text-sm ${eventType === 'elearning' ? 'text-purple-900 dark:text-purple-300' : 'text-slate-900 dark:text-slate-100'
                          }`}>
                          {selectedCourseData.elearning_fee !== null
                            ? `₱${Number(selectedCourseData.elearning_fee).toLocaleString()}`
                            : "N/A"}
                        </p>
                      </div>
                      {eventType === 'elearning' && (
                        <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
                          ✓ Selected
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Info message when no event type selected */}
                  {!eventType && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <span className="text-sm">⚠️</span>
                      Select a training type above to see the applicable fee
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="batch_number">Batch Number *</Label>
                <Input
                  id="batch_number"
                  type="number"
                  min="1"
                  value={batchNumber ?? ""}
                  onChange={(e) => setBatchNumber(e.target.value ? parseInt(e.target.value) : null)}
                  className="max-w-sm"
                  placeholder="Enter batch number"
                  disabled={isSubmitting}
                />
                {batchNumber && (
                  <p className="text-xs text-muted-foreground">
                    Last batch number: {batchNumber - 1 > 0 ? batchNumber - 1 : "None"}
                  </p>
                )}
              </div>

              {/* Registration Form Type */}
              <div className="grid gap-2">
                <Label htmlFor="registration_form_type">Registration Form Type *</Label>
                <Select value={registrationFormType} onValueChange={setRegistrationFormType} disabled={isSubmitting}>
                  <SelectTrigger id="registration_form_type">
                    <SelectValue placeholder="Select form type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="acls">ACLS</SelectItem>
                    <SelectItem value="bls">BLS</SelectItem>
                    <SelectItem value="ivt_therapy">IVT Therapy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {registrationFormType === "default" && "Standard registration form with employment details"}
                  {registrationFormType === "acls" && "CLASS ROSTER format for ACLS training"}
                  {registrationFormType === "bls" && "CLASS ROSTER format for BLS training"}
                  {registrationFormType === "ivt_therapy" && "CLASS ROSTER format for IVT Therapy training"}
                </p>
              </div>

              {/* Branch */}
              {eventType !== "online" && eventType !== "elearning" && (
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