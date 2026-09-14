"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { CheckCircle2, Clock, Loader2, UserCheck } from "lucide-react"
import { tmsDb } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  getAttendanceForDay,
  getTrainingDayKeys,
  mergeAttendanceForDay,
  mergeAttendanceIntoCustomData,
} from "@/lib/attendance-status"

type TraineeOption = {
  id: string
  first_name: string
  last_name: string
  custom_data: Record<string, unknown> | null
}

const MANUAL_NAME_VALUE = "__manual__"

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function fullName(t: TraineeOption) {
  return `${t.first_name || ""} ${t.last_name || ""}`.trim()
}

function formatDayLabel(dayKey: string) {
  try {
    return format(parseISO(dayKey), "EEEE, MMM d, yyyy")
  } catch {
    return dayKey
  }
}

function formatClock(date: Date) {
  return format(date, "h:mm a")
}

function GuestAttendanceForm() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("schedule_id") || searchParams.get("scheduleId")

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState<{ name: string; dayLabel: string; timeLabel: string } | null>(null)
  const [courseName, setCourseName] = React.useState("")
  const [branch, setBranch] = React.useState<string | null>(null)
  const [dayKeys, setDayKeys] = React.useState<string[]>([])
  const [trainees, setTrainees] = React.useState<TraineeOption[]>([])
  const [selectedTraineeId, setSelectedTraineeId] = React.useState("")
  const [manualName, setManualName] = React.useState("")
  const [dayKey, setDayKey] = React.useState("")
  const [now, setNow] = React.useState(() => new Date())
  const [nameFilter, setNameFilter] = React.useState("")

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const loadTrainees = React.useCallback(async () => {
    if (!scheduleId) return [] as TraineeOption[]
    const { data: rows, error: te } = await tmsDb
      .from("trainings")
      .select("id, first_name, last_name, custom_data")
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })
    if (te) throw te
    return ((rows as TraineeOption[]) || []).sort((a, b) => fullName(a).localeCompare(fullName(b)))
  }, [scheduleId])

  React.useEffect(() => {
    if (!scheduleId) {
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data: schedule, error } = await tmsDb
          .from("schedules")
          .select(`
            id,
            branch,
            schedule_type,
            courses ( name ),
            schedule_ranges ( start_date, end_date ),
            schedule_dates ( date )
          `)
          .eq("id", scheduleId)
          .single()

        if (error || !schedule) {
          toast.error("This attendance link is not valid.")
          return
        }

        const days = getTrainingDayKeys({
          schedule_type: schedule.schedule_type,
          schedule_ranges: schedule.schedule_ranges || [],
          schedule_dates: schedule.schedule_dates || [],
        })

        const rows = await loadTrainees()
        if (cancelled) return

        const course = schedule.courses as { name?: string } | { name?: string }[] | null
        const courseLabel = Array.isArray(course) ? course[0]?.name : course?.name
        setCourseName(courseLabel || "Training")
        setBranch(schedule.branch || null)
        setDayKeys(days)
        setTrainees(rows)
        const today = format(new Date(), "yyyy-MM-dd")
        setDayKey(days.includes(today) ? today : days[0] || "")
      } catch {
        toast.error("Could not load attendance form.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [scheduleId, loadTrainees])

  const sortedTrainees = React.useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    if (!q) return trainees
    return trainees.filter((t) => fullName(t).toLowerCase().includes(q))
  }, [trainees, nameFilter])

  const findTrainee = (list: TraineeOption[], rawName: string) => {
    const needle = normalizeName(rawName)
    if (!needle) return null
    const exact = list.find((t) => normalizeName(fullName(t)) === needle)
    if (exact) return exact
    const flipped = list.find((t) => normalizeName(`${t.last_name} ${t.first_name}`) === needle)
    if (flipped) return flipped
    const parts = needle.split(" ")
    if (parts.length >= 2) {
      const first = parts[0]
      const last = parts[parts.length - 1]
      return (
        list.find(
          (t) => normalizeName(t.first_name) === first && normalizeName(t.last_name) === last
        ) || null
      )
    }
    return null
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!scheduleId) return

    const usingManual = selectedTraineeId === MANUAL_NAME_VALUE
    const trimmedManual = manualName.trim()
    if (!selectedTraineeId) {
      toast.error("Select your name from the list.")
      return
    }
    if (usingManual && !trimmedManual) {
      toast.error("Type your full name.")
      return
    }
    if (dayKeys.length > 0 && !dayKey) {
      toast.error("Select the training date.")
      return
    }

    setSubmitting(true)
    try {
      let list = trainees
      let trainee =
        !usingManual
          ? list.find((t) => t.id === selectedTraineeId) || null
          : findTrainee(list, trimmedManual)

      // Late registration: refresh roster once and try again.
      if (!trainee && usingManual) {
        list = await loadTrainees()
        setTrainees(list)
        trainee = findTrainee(list, trimmedManual)
      }

      if (!trainee) {
        toast.error("Name not found on this schedule.", {
          description: "If you just registered, wait a moment and try again, or ask staff to refresh the roster.",
        })
        return
      }

      const checkInAt = new Date()
      const timeLabel = formatClock(checkInAt)
      const dayLabel = dayKeys.length > 0 ? formatDayLabel(dayKey) : "this training"

      if (dayKeys.length > 0) {
        const existing = getAttendanceForDay(trainee.custom_data, dayKey)
        if (existing === "present" || existing === "late") {
          setDone({
            name: fullName(trainee),
            dayLabel,
            timeLabel,
          })
          toast.success("Already marked for this day.")
          return
        }
      }

      const custom_data =
        dayKeys.length > 0
          ? mergeAttendanceForDay(trainee.custom_data, dayKeys, dayKey, "present", "qr")
          : mergeAttendanceIntoCustomData(trainee.custom_data, "present", "qr")

      const { error } = await tmsDb.from("trainings").update({ custom_data }).eq("id", trainee.id)
      if (error) {
        toast.error("Could not save attendance.", { description: error.message })
        return
      }

      setTrainees((prev) => prev.map((t) => (t.id === trainee!.id ? { ...t, custom_data } : t)))
      setDone({
        name: fullName(trainee),
        dayLabel,
        timeLabel,
      })
      toast.success("Attendance recorded.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!scheduleId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-base text-muted-foreground">This attendance link is missing a schedule.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-base">Loading attendance form…</span>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-semibold text-[#1A1D66]">You are marked present</h1>
        <p className="mt-3 text-base text-muted-foreground">{done.name}</p>
        <p className="mt-1 text-base font-medium text-[#1A1D66]">
          {done.dayLabel} · {done.timeLabel}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{courseName}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-8 h-11 px-6"
          onClick={() => {
            setDone(null)
            setSelectedTraineeId("")
            setManualName("")
            setNameFilter("")
          }}
        >
          Mark another person
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[80vh] w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1D66] text-[#FFCC00]">
          <UserCheck className="h-8 w-8" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a8c9a]">Petrosphere TMS</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1A1D66] sm:text-4xl">Attendance check-in</h1>
        <p className="mt-2 text-base font-medium text-[#1c1e28]">{courseName}</p>
        {branch && <p className="mt-1 text-sm text-muted-foreground">{branch}</p>}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#FFCC00]/50 bg-[#1A1D66]/5 px-4 py-2 text-sm font-semibold text-[#1A1D66]">
          <Clock className="h-4 w-4 text-[#daae02]" />
          Check-in time · {formatClock(now)}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-3xl border border-[#e6e7ee] bg-white p-6 shadow-lg sm:p-8"
      >
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Your name</Label>
          <Select
            value={selectedTraineeId}
            onValueChange={(value) => {
              setSelectedTraineeId(value)
              if (value !== MANUAL_NAME_VALUE) setManualName("")
            }}
          >
            <SelectTrigger className="h-12 w-full text-base">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <div className="sticky top-0 z-10 border-b bg-popover p-2">
                <Input
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Search name…"
                  className="h-9"
                  onKeyDown={(event) => event.stopPropagation()}
                />
              </div>
              {sortedTrainees.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-base py-2.5">
                  {fullName(t)}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL_NAME_VALUE} className="text-base py-2.5 font-medium text-[#1A1D66]">
                Not in the list — type my name
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose from registered participants for this schedule.
          </p>
        </div>

        {selectedTraineeId === MANUAL_NAME_VALUE && (
          <div className="space-y-2">
            <Label htmlFor="attendee-name" className="text-sm font-semibold">
              Type full name
            </Label>
            <Input
              id="attendee-name"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Same name used at registration"
              autoComplete="name"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              For late registrations, type your registered name. We will match it to the roster.
            </p>
          </div>
        )}

        {dayKeys.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Training date</Label>
            <Select value={dayKey} onValueChange={setDayKey}>
              <SelectTrigger className="h-12 w-full text-base">
                <SelectValue placeholder="Select training day" />
              </SelectTrigger>
              <SelectContent>
                {dayKeys.map((key) => (
                  <SelectItem key={key} value={key} className="text-base py-2.5">
                    {formatDayLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Same QR works for every day · time recorded at submit: {formatClock(now)}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            This schedule has no day list yet. Check-in will mark you present for the whole training.
            Time recorded: {formatClock(now)}
          </p>
        )}

        <Button
          type="submit"
          className="h-12 w-full text-base bg-[#1A1D66] hover:bg-[#141654]"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving…
            </>
          ) : (
            "Mark me present"
          )}
        </Button>
      </form>
    </div>
  )
}

export default function GuestAttendancePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base">Loading…</span>
        </div>
      }
    >
      <GuestAttendanceForm />
    </React.Suspense>
  )
}
