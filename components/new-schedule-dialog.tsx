//components\new-schedule-dialog.tsx

"use client"

import * as React from "react"
import { CalendarIcon, AlertTriangle, ExternalLink, Check, ChevronsUpDown } from "lucide-react"
import { format, eachDayOfInterval } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar03 } from "@/components/calendar-03"
import { Calendar05 } from "@/components/calendar-05"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

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
  const isBranchRequired = false
  const [batchNumber, setBatchNumber] = React.useState<number | null>(null)
  const [courseSearch, setCourseSearch] = React.useState("")
  const [courseOpen, setCourseOpen] = React.useState(false)
  const [registrationFormType, setRegistrationFormType] = React.useState<string>("default")
  const [dayTrainers, setDayTrainers] = React.useState<Record<string, string>>({})
  const [trainerName, setTrainerName] = React.useState<string>("")
  const [trainerOptions, setTrainerOptions] = React.useState<string[]>([])
  const [loadingTrainers, setLoadingTrainers] = React.useState(false)

  const [selectedCourseData, setSelectedCourseData] = React.useState<any>(null)
  const router = useRouter()

  const isPriceMissing = React.useMemo(() => {
    if (!selectedCourseData || !eventType) return false
    const fee = eventType === 'online' ? selectedCourseData.online_fee :
      eventType === 'face-to-face' ? selectedCourseData.face_to_face_fee :
        eventType === 'elearning' ? selectedCourseData.elearning_fee : null
    return fee === null || Number(fee) === 0
  }, [selectedCourseData, eventType])

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
          trainer_name: trainerName || Object.values(dayTrainers).filter(Boolean)[0] || "",
          day_trainers: dayTrainers,
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
      setDayTrainers({})
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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl p-4 sm:w-[95vw] sm:p-6 lg:w-[88vw] xl:w-[82vw] max-h-[90vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle>New Training Schedule</DialogTitle>
          <DialogDescription>
            Create a new training event. Fill in all the required information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Two-Column Grid */}
          <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-6">
            {/* LEFT COLUMN: Inputs */}
            {/* Course + Training Type & Fees */}
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
              {/* Course - Searchable */}
              <div className="grid gap-2 md:col-span-2">
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
                    Training Types and fees:
                  </p>
                  <div className="space-y-2">
                    {/* Online Fee */}
                    <button
                      type="button"
                      onClick={() => setEventType("online")}
                      disabled={isSubmitting}
                      className={`p-2 rounded-md transition-all ${eventType === 'online'
                        ? 'bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
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
                    </button>

                    {/* Face-to-Face Fee */}
                    <button
                      type="button"
                      onClick={() => setEventType("face-to-face")}
                      disabled={isSubmitting}
                      className={`p-2 rounded-md transition-all ${eventType === 'face-to-face'
                        ? 'bg-blue-100 dark:bg-blue-950 border-2 border-blue-500 ring-2 ring-blue-200'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
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
                    </button>

                    {/* E-Learning Fee */}
                    <button
                      type="button"
                      onClick={() => setEventType("elearning")}
                      disabled={isSubmitting}
                      className={`p-2 rounded-md transition-all ${eventType === 'elearning'
                        ? 'bg-purple-100 dark:bg-purple-950 border-2 border-purple-500 ring-2 ring-purple-200'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
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
                    </button>
                  </div>

                  {/* Info message when no event type selected */}
                  {!eventType && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <span className="text-sm">⚠️</span>
                      Click one of the training type cards above to continue
                    </p>
                  )}

                  {isPriceMissing && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                      <div className="flex gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-xs font-bold">Missing Course Fee!</p>
                          <p className="text-[11px] leading-relaxed">
                            The selected training type does not have a price set for this course in the database.
                          </p>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 w-full text-xs gap-2"
                            onClick={() => {
                              router.push(`/courses?editId=${course}`)
                            }}
                          >
                            <ExternalLink className="h-3.3 w-3" />
                            Edit Course Price
                          </Button>
                        </div>
                      </div>
                    </div>
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
                  className="w-full"
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

              <div className="grid gap-2">
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
                      {trainerName || "Select primary trainer"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] max-w-[min(92vw,420px)] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search trainer..." />
                      <CommandList onWheel={(e) => e.stopPropagation()}>
                        <CommandEmpty>
                          <div className="p-2 text-xs text-muted-foreground">
                            No trainer found in repository.
                            <div className="mt-2 text-left">
                              <p className="mb-1">Type manual name and press Enter:</p>
                              <Input
                                placeholder="Manual trainer name..."
                                className="h-8 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value
                                    if (val) {
                                      setTrainerName(val)
                                      // Also apply to all days if they exist
                                      handleApplyToAll(val)
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading="Trainers from Repository">
                          {trainerOptions.map((trainer: string) => (
                            <CommandItem
                              key={trainer}
                              value={trainer}
                              onSelect={(val: string) => {
                                setTrainerName(val)
                                handleApplyToAll(val)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
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
                <div className="grid gap-3 p-4 bg-muted/30 border rounded-md">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">Trainers per Day</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const firstTrainer = dayTrainers[formatDateForDB(scheduleDays[0])]
                        if (firstTrainer) handleApplyToAll(firstTrainer)
                      }}
                      className="h-7 text-xs"
                      disabled={!dayTrainers[formatDateForDB(scheduleDays[0])]}
                    >
                      Apply first to all days
                    </Button>
                  </div>
                  <div className="grid gap-4 max-h-[300px] overflow-y-auto pr-2">
                    {scheduleDays.map((day, idx) => {
                      const dateStr = formatDateForDB(day)
                      const currentTrainer = dayTrainers[dateStr] || ""

                      return (
                        <div key={dateStr} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            Day {idx + 1}: {format(day, "MMM dd")}
                          </span>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "h-9 justify-between text-left font-normal",
                                  !currentTrainer && "text-muted-foreground"
                                )}
                                disabled={isSubmitting}
                              >
                                {currentTrainer || "Select trainer"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] max-w-[min(92vw,320px)] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Search trainer..." />
                                <CommandList onWheel={(e) => e.stopPropagation()}>
                                  <CommandEmpty>
                                    <div className="p-2 text-xs text-muted-foreground">
                                      No trainer found in repository.
                                      <div className="mt-2 text-left">
                                        <Input
                                          placeholder="Type manual name..."
                                          className="h-8 text-[11px]"
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
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
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

              {/* Branch */}
              {eventType !== "online" && eventType !== "elearning" && (
                <div className="grid gap-2">
                  <Label htmlFor="branch">Branch (optional)</Label>
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
            <div className="min-w-0">
              <Label className="block mb-2">Schedule Dates *</Label>
              <div className="w-full overflow-x-auto rounded-md border p-1">
                <div className="min-w-[300px]">
                  {scheduleType === "regular" ? (
                    <Calendar05 value={rangeDates} onChange={setRangeDates} />
                  ) : (
                    <Calendar03 value={multiDates} onChange={setMultiDates} />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:gap-0">
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