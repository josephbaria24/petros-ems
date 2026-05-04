"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import {
  ArrowLeft,
  Loader2,
  UserCheck,
  Upload,
  Download,
  Video,
  Users,
  Calendar,
  MapPin,
  GraduationCap,
  ChevronDown,
  Search,
} from "lucide-react"
import { tmsDb } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  getAttendanceFromCustomData,
  mergeAttendanceIntoCustomData,
  normalizeAttendanceInput,
  type AttendanceStatusValue,
} from "@/lib/attendance-status"
import { cn } from "@/lib/utils"

type TrainingRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company_name: string | null
  custom_data: Record<string, unknown> | null
  payments?: { online_classroom_url: string | null }[] | null
}

function formatScheduleDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  const fullMonth = s.toLocaleString("en-US", { month: "long" })
  const shortMonth = s.toLocaleString("en-US", { month: "short" })
  const endShortMonth = e.toLocaleString("en-US", { month: "short" })
  if (s.toDateString() === e.toDateString()) {
    return `${fullMonth} ${s.getDate()}, ${s.getFullYear()}`
  }
  if (sameMonth) {
    return `${fullMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
  }
  return `${shortMonth}. ${s.getDate()}, ${s.getFullYear()} – ${endShortMonth}. ${e.getDate()}, ${e.getFullYear()}`
}

function pickMeetingUrl(trainings: TrainingRow[]): string | null {
  for (const t of trainings) {
    const urls = t.payments || []
    for (const p of urls) {
      if (p?.online_classroom_url?.trim()) return p.online_classroom_url.trim()
    }
  }
  return null
}

function detectProvider(url: string): "Microsoft Teams" | "Zoom" | "Other" {
  const u = url.toLowerCase()
  if (u.includes("teams.microsoft") || u.includes("teams.live")) return "Microsoft Teams"
  if (u.includes("zoom.us")) return "Zoom"
  return "Other"
}

const STATUS_LABEL: Record<AttendanceStatusValue, string> = {
  unmarked: "Unmarked",
  present: "Present",
  absent: "Absent",
  late: "Late",
}

const STATUS_BADGE: Record<AttendanceStatusValue, string> = {
  unmarked: "bg-muted text-muted-foreground border-border",
  present: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
  absent: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
  late: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800",
}

/** Stronger contrast in light mode; default checkbox styling in dark mode. */
const attendanceCheckboxClassName = cn(
  "size-[1.125rem] shrink-0 rounded-[4px] border-2 border-zinc-600 bg-white shadow-sm",
  "focus-visible:border-zinc-700 focus-visible:ring-[3px] focus-visible:ring-zinc-400/45",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
  "dark:size-4 dark:border dark:border-input dark:bg-input/30 dark:shadow-xs dark:focus-visible:border-ring dark:focus-visible:ring-ring/50",
)

export default function ScheduleAttendancePage() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId")
  const fromTab = searchParams.get("from") || "all"

  const [loading, setLoading] = React.useState(true)
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set())
  const [courseName, setCourseName] = React.useState("")
  const [scheduleMeta, setScheduleMeta] = React.useState<{
    status: string
    event_type: string
    branch: string | null
    batch_number: number | null
    trainer_name: string | null
    day_trainers: Record<string, string> | null
    schedule_type: string
    schedule_ranges: { start_date: string; end_date: string }[]
    schedule_dates: { date: string }[]
  } | null>(null)
  const [rows, setRows] = React.useState<TrainingRow[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [participantSearch, setParticipantSearch] = React.useState("")
  const [applyingQuickAction, setApplyingQuickAction] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const backHref = `/training-schedules?tab=${encodeURIComponent(fromTab)}`

  const load = React.useCallback(async () => {
    if (!scheduleId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: schedule, error: se } = await tmsDb
        .from("schedules")
        .select(
          `
          id,
          status,
          event_type,
          branch,
          batch_number,
          trainer_name,
          day_trainers,
          schedule_type,
          courses ( name ),
          schedule_ranges ( start_date, end_date ),
          schedule_dates ( date )
        `
        )
        .eq("id", scheduleId)
        .single()

      if (se || !schedule) {
        toast.error("Schedule not found")
        setScheduleMeta(null)
        setRows([])
        setCourseName("")
        return
      }

      setCourseName((schedule.courses as { name?: string } | null)?.name || "Course")
      setScheduleMeta({
        status: schedule.status,
        event_type: schedule.event_type,
        branch: schedule.branch,
        batch_number: schedule.batch_number,
        trainer_name: schedule.trainer_name,
        day_trainers: schedule.day_trainers,
        schedule_type: schedule.schedule_type,
        schedule_ranges: schedule.schedule_ranges || [],
        schedule_dates: schedule.schedule_dates || [],
      })

      const { data: trainings, error: te } = await tmsDb
        .from("trainings")
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          company_name,
          custom_data,
          payments ( online_classroom_url )
        `
        )
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })

      if (te) {
        toast.error("Failed to load participants", { description: te.message })
        setRows([])
        setSelected(new Set())
        return
      }
      setRows((trainings as TrainingRow[]) || [])
      setSelected(new Set())
      setParticipantSearch("")
    } finally {
      setLoading(false)
    }
  }, [scheduleId])

  React.useEffect(() => {
    load()
  }, [load])

  const scheduleLabel = React.useMemo(() => {
    if (!scheduleMeta) return "—"
    if (scheduleMeta.schedule_type === "regular" && scheduleMeta.schedule_ranges[0]) {
      const r = scheduleMeta.schedule_ranges[0]
      return formatScheduleDateRange(r.start_date, r.end_date)
    }
    if (scheduleMeta.schedule_type === "staggered" && scheduleMeta.schedule_dates?.length) {
      return scheduleMeta.schedule_dates
        .map((d) => formatScheduleDateRange(d.date, d.date))
        .join(", ")
    }
    return "Dates TBD"
  }, [scheduleMeta])

  const meetingUrl = React.useMemo(() => pickMeetingUrl(rows), [rows])
  const meetingProvider = meetingUrl ? detectProvider(meetingUrl) : null

  const counts = React.useMemo(() => {
    let present = 0,
      absent = 0,
      late = 0,
      unmarked = 0
    for (const r of rows) {
      const s = getAttendanceFromCustomData(r.custom_data)
      if (s === "present") present++
      else if (s === "absent") absent++
      else if (s === "late") late++
      else unmarked++
    }
    return { present, absent, late, unmarked, total: rows.length }
  }, [rows])

  const filteredRows = React.useMemo(() => {
    const q = participantSearch.trim().toLowerCase()
    if (!q) return rows
    const tokens = q.split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const hay = [
        r.first_name,
        r.last_name,
        `${r.first_name} ${r.last_name}`,
        `${r.last_name} ${r.first_name}`,
        r.email,
        r.company_name,
        r.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [rows, participantSearch])

  const persistOne = async (id: string, status: AttendanceStatusValue, source: "manual" | "bulk" | "excel") => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setSavingIds((s) => new Set(s).add(id))
    const custom_data = mergeAttendanceIntoCustomData(row.custom_data, status, source)
    const { error } = await tmsDb.from("trainings").update({ custom_data }).eq("id", id)
    setSavingIds((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    if (error) {
      toast.error("Could not save attendance", { description: error.message })
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, custom_data } : r)))
  }

  const toggleSelect = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** Select / clear only rows that match the current search (visible rows). */
  const selectAllVisibleToggle = (on: boolean) => {
    if (on) {
      setSelected((prev) => new Set([...prev, ...filteredRows.map((r) => r.id)]))
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredRows.forEach((r) => next.delete(r.id))
        return next
      })
    }
  }

  const headerCheckboxChecked: boolean | "indeterminate" =
    filteredRows.length === 0
      ? false
      : filteredRows.every((r) => selected.has(r.id))
        ? true
        : filteredRows.some((r) => selected.has(r.id))
          ? "indeterminate"
          : false

  const applyQuickActionToSelected = async (status: AttendanceStatusValue) => {
    const ids = [...selected]
    if (ids.length === 0) {
      toast.info("Select at least one participant.")
      return
    }
    setApplyingQuickAction(true)
    const toastId = toast.loading(`Updating ${ids.length} selected participant(s)…`)
    const idToCustom: Record<string, Record<string, unknown>> = {}
    let ok = 0
    for (const id of ids) {
      const row = rows.find((r) => r.id === id)
      if (!row) continue
      const custom_data = mergeAttendanceIntoCustomData(row.custom_data, status, "bulk")
      const { error } = await tmsDb.from("trainings").update({ custom_data }).eq("id", id)
      if (!error) {
        ok++
        idToCustom[id] = custom_data
      }
    }
    setRows((prev) => prev.map((r) => (idToCustom[r.id] ? { ...r, custom_data: idToCustom[r.id] } : r)))
    setApplyingQuickAction(false)
    toast.dismiss(toastId)
    toast.success(`Updated ${ok} of ${ids.length}`)
    setSelected(new Set())
  }

  const downloadTemplate = () => {
    const sheetRows = rows.map((r) => ({
      "Training ID": r.id,
      Email: r.email || "",
      "Last Name": r.last_name,
      "First Name": r.first_name,
      Attendance: getAttendanceFromCustomData(r.custom_data),
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Attendance")
    XLSX.writeFile(wb, `attendance-import-${scheduleId?.slice(0, 8) || "schedule"}.xlsx`)
    toast.success("Template downloaded", {
      description: "Edit the Attendance column and re-import.",
    })
  }

  const handleExcelImport: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !scheduleId) return

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: "array" })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    if (!json.length) {
      toast.error("Empty spreadsheet")
      return
    }

    const normKey = (k: string) =>
      String(k)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")

    const headerMap = new Map<string, string>()
    for (const k of Object.keys(json[0])) {
      headerMap.set(normKey(k), k)
    }

    const col = (aliases: string[]) => {
      for (const a of aliases) {
        const orig = headerMap.get(normKey(a))
        if (orig) return orig
      }
      return null
    }

    const cId = col(["training_id", "training id", "id"])
    const cEmail = col(["email", "e-mail"])
    const cLast = col(["last_name", "lastname", "last name", "surname"])
    const cFirst = col(["first_name", "firstname", "first name", "given name"])
    const cAtt = col([
      "attendance",
      "status",
      "ems_attendance_status",
      "present_absent",
      "present/absent",
    ])

    if (!cAtt) {
      toast.error("Missing attendance column", {
        description: "Add a column named Attendance, Status, or ems_attendance_status.",
      })
      return
    }

    const byId = new Map(rows.map((r) => [r.id, r]))
    const byEmail = new Map(
      rows
        .filter((r) => r.email?.trim())
        .map((r) => [r.email!.trim().toLowerCase(), r])
    )
    const byName = new Map(
      rows.map((r) => [
        `${String(r.last_name).trim().toLowerCase()}|${String(r.first_name).trim().toLowerCase()}`,
        r,
      ])
    )

    let matched = 0
    let updated = 0
    const toastId = toast.loading("Importing attendance…")

    for (const rec of json) {
      const statusRaw = String(rec[cAtt] ?? "")
      const status = normalizeAttendanceInput(statusRaw)
      if (status === null || status === "unmarked") continue

      let row: TrainingRow | undefined
      if (cId && rec[cId]) {
        const id = String(rec[cId]).trim()
        row = byId.get(id)
      }
      if (!row && cEmail && rec[cEmail]) {
        row = byEmail.get(String(rec[cEmail]).trim().toLowerCase())
      }
      if (!row && cLast && cFirst) {
        const key = `${String(rec[cLast]).trim().toLowerCase()}|${String(rec[cFirst]).trim().toLowerCase()}`
        row = byName.get(key)
      }

      if (!row) continue
      matched++
      const custom_data = mergeAttendanceIntoCustomData(row.custom_data, status, "excel")
      const { error } = await tmsDb.from("trainings").update({ custom_data }).eq("id", row.id)
      if (!error) {
        updated++
        setRows((prev) => prev.map((r) => (r.id === row!.id ? { ...r, custom_data } : r)))
      }
    }

    toast.dismiss(toastId)
    toast.success("Import finished", {
      description: `Applied ${updated} update(s); ${matched} row(s) matched participants.`,
    })
  }

  if (!scheduleId) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Missing schedule. Open attendance from a schedule row.</p>
        <Button asChild variant="outline">
          <Link href="/training-schedules?tab=all">Back to schedules</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 gap-1 text-muted-foreground" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Schedules
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Attendance</h1>
            <Badge variant="outline" className="gap-1">
              <UserCheck className="h-3 w-3" />
              Participants
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
            {courseName} — mark presence per trainee, use bulk actions for selected rows, or import an
            Excel sheet. Data is stored on each registration record.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelImport}
          />
          <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={downloadTemplate} disabled={!rows.length}>
            <Download className="h-4 w-4" />
            Download template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-medium">Loading schedule and participants…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Session details
                </CardTitle>
                <CardDescription>Context for this run of the course</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {scheduleMeta?.status && (
                    <Badge className="capitalize">{scheduleMeta.status}</Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">
                    {scheduleMeta?.event_type?.replace(/-/g, " ") || "—"}
                  </Badge>
                  {scheduleMeta?.batch_number != null && (
                    <Badge variant="outline">Batch #{scheduleMeta.batch_number}</Badge>
                  )}
                </div>
                <div className="flex items-start gap-2 text-card-foreground">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{scheduleLabel}</span>
                </div>
                <div className="flex items-start gap-2 text-card-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{scheduleMeta?.branch || "—"}</span>
                </div>
                <div className="flex items-start gap-2 text-card-foreground">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {scheduleMeta?.day_trainers && Object.keys(scheduleMeta.day_trainers).length > 0 ? (
                      <span className="space-y-1">
                        {Object.entries(scheduleMeta.day_trainers)
                          .sort()
                          .map(([d, name]) => (
                            <span key={d} className="mr-2 block sm:inline sm:block">
                              <span className="text-muted-foreground">
                                {format(new Date(d), "MMM d")}:
                              </span>{" "}
                              {name || "—"}
                            </span>
                          ))}
                      </span>
                    ) : (
                      scheduleMeta?.trainer_name || "Trainer TBD"
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4 text-primary" />
                  Online classroom
                </CardTitle>
                <CardDescription>From payment records when a room link was sent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {meetingUrl ? (
                  <>
                    <Badge variant="outline">{meetingProvider}</Badge>
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-primary underline-offset-4 hover:underline"
                    >
                      {meetingUrl}
                    </a>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Links are typically set from the Submissions page when you email the online
                      classroom URL to trainees. Use Teams or Zoom attendance reports, align columns
                      with the import template, then import here.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No meeting URL found on participant payment records yet. For hybrid sessions,
                    add links when processing payments or paste an attendance export after the
                    session.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Summary</CardTitle>
                <CardDescription>Live counts from saved attendance flags</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_BADGE.present}>{counts.present} present</Badge>
                <Badge className={STATUS_BADGE.absent}>{counts.absent} absent</Badge>
                <Badge className={STATUS_BADGE.late}>{counts.late} late</Badge>
                <Badge className={STATUS_BADGE.unmarked}>{counts.unmarked} unmarked</Badge>
                <Badge variant="outline">{counts.total} total</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Participants</CardTitle>
                  <CardDescription>
                    Select rows, then use Quick action to set attendance for those participants only.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {selected.size} selected
                  </span>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={applyingQuickAction || rows.length === 0 || selected.size === 0}
                      className="gap-2 shrink-0"
                    >
                      {applyingQuickAction ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        <>
                          Quick action
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("present")}
                    >
                      Mark selected as present
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("absent")}
                    >
                      Mark selected as absent
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("late")}
                    >
                      Mark selected as late
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("unmarked")}
                    >
                      Clear selected attendance
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b bg-muted/20 px-4 py-3">
                <div className="relative max-w-md">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    placeholder="Search by name, email, company, or ID…"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="bg-background border-border/80 pl-9 shadow-sm"
                    aria-label="Search participants"
                  />
                </div>
                {participantSearch.trim() && rows.length > 0 && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Showing {filteredRows.length} of {rows.length}
                  </p>
                )}
              </div>
              <div className="max-h-[min(560px,70vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          className={attendanceCheckboxClassName}
                          checked={headerCheckboxChecked}
                          onCheckedChange={(c) => selectAllVisibleToggle(c === true)}
                          disabled={filteredRows.length === 0}
                          aria-label="Select all visible participants"
                        />
                      </TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Company</TableHead>
                      <TableHead className="w-[160px]">Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                          No participants registered for this schedule yet.
                        </TableCell>
                      </TableRow>
                    ) : filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                          No participants match your search. Try a different name, email, or company.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((r) => {
                        const st = getAttendanceFromCustomData(r.custom_data)
                        const busy = savingIds.has(r.id)
                        return (
                          <TableRow key={r.id} className="group">
                            <TableCell className="pl-4">
                              <Checkbox
                                className={attendanceCheckboxClassName}
                                checked={selected.has(r.id)}
                                onCheckedChange={(c) => toggleSelect(r.id, !!c)}
                                aria-label={`Select ${r.first_name} ${r.last_name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {r.last_name}, {r.first_name}
                              </div>
                              <div className="text-muted-foreground mt-0.5 font-mono text-[10px] md:hidden">
                                {r.email || "—"}
                              </div>
                              <Badge variant="outline" className={cn("mt-1 text-[10px] md:hidden", STATUS_BADGE[st])}>
                                {STATUS_LABEL[st]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden max-w-[220px] truncate text-sm md:table-cell">
                              {r.email || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden max-w-[160px] truncate text-sm lg:table-cell">
                              {r.company_name || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {busy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                                <Select
                                  value={st}
                                  onValueChange={(v) =>
                                    persistOne(r.id, v as AttendanceStatusValue, "manual")
                                  }
                                  disabled={busy}
                                >
                                  <SelectTrigger className="h-9 w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unmarked">Unmarked</SelectItem>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
