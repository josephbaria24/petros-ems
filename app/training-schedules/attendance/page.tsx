"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as XLSX from "xlsx"
import { format, parseISO } from "date-fns"
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
  QrCode,
  Link2,
  Copy,
  Check,
  History,
} from "lucide-react"
import QRCode from "qrcode"
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
  countAttendanceSlots,
  getAttendanceForDay,
  getAttendanceFromCustomData,
  getAttendanceLog,
  getTrainingDayKeys,
  mergeAttendanceAllDays,
  mergeAttendanceForDay,
  mergeAttendanceIntoCustomData,
  normalizeAttendanceInput,
  type AttendanceStatusValue,
} from "@/lib/attendance-status"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  bulk: "Quick action",
  excel: "Excel import",
  integration: "Integration",
  qr: "QR check-in",
}

function attendanceStatusSelectTriggerClass(
  status: AttendanceStatusValue,
  variant: "compact" | "default"
) {
  return cn(
    variant === "compact" ? "h-8 w-[96px] text-xs" : "h-9 w-[130px] text-sm",
    "font-semibold shadow-none transition-colors",
    "border",
    STATUS_BADGE[status],
    "[&_svg]:text-current [&_svg]:opacity-60"
  )
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
  const [generatingQr, setGeneratingQr] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)
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

  const trainingDayKeys = React.useMemo(
    () => getTrainingDayKeys(scheduleMeta),
    [scheduleMeta]
  )

  const counts = React.useMemo(
    () => countAttendanceSlots(rows, trainingDayKeys),
    [rows, trainingDayKeys]
  )

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

  const persistAttendance = async (
    id: string,
    status: AttendanceStatusValue,
    source: "manual" | "bulk" | "excel",
    dayKey?: string
  ) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setSavingIds((s) => new Set(s).add(id))
    const custom_data =
      trainingDayKeys.length > 0 && dayKey !== undefined
        ? mergeAttendanceForDay(row.custom_data, trainingDayKeys, dayKey, status, source)
        : mergeAttendanceIntoCustomData(row.custom_data, status, source)
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
      const custom_data =
        trainingDayKeys.length > 0
          ? mergeAttendanceAllDays(row.custom_data, trainingDayKeys, status, "bulk")
          : mergeAttendanceIntoCustomData(row.custom_data, status, "bulk")
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

  const attendanceUrl = React.useMemo(() => {
    if (!scheduleId || typeof window === "undefined") return ""
    return `${window.location.origin}/guest-attendance?schedule_id=${encodeURIComponent(scheduleId)}`
  }, [scheduleId])

  const copyAttendanceLink = async () => {
    if (!attendanceUrl) return
    try {
      await navigator.clipboard.writeText(attendanceUrl)
      setCopiedLink(true)
      toast.success("Attendance link copied")
      window.setTimeout(() => setCopiedLink(false), 1800)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const downloadAttendanceQr = async () => {
    if (!scheduleId) return
    setGeneratingQr(true)
    try {
      const url =
        attendanceUrl ||
        `${window.location.origin}/guest-attendance?schedule_id=${encodeURIComponent(scheduleId)}`
      const qrSize = 720
      const qrCanvas = document.createElement("canvas")
      await QRCode.toCanvas(qrCanvas, url, {
        width: qrSize,
        margin: 1,
        color: { dark: "#1A1D66", light: "#ffffff" },
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Could not draw QR")

      const width = 860
      const height = 1120
      canvas.width = width
      canvas.height = height

      ctx.fillStyle = "#1A1D66"
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = "#FFCC00"
      ctx.fillRect(0, 0, width, 18)
      ctx.fillRect(0, height - 18, width, 18)

      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.font = "bold 28px Arial, sans-serif"
      ctx.fillText("PETROSPHERE", width / 2, 62)
      ctx.font = "16px Arial, sans-serif"
      ctx.fillStyle = "#FFCC00"
      ctx.fillText("ATTENDANCE CHECK-IN", width / 2, 92)

      ctx.fillStyle = "#ffffff"
      ctx.fillRect(70, 120, qrSize, qrSize)
      ctx.drawImage(qrCanvas, 70, 120)

      const label = courseName || "Training"
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 26px Arial, sans-serif"
      const words = label.split(" ")
      const lines: string[] = []
      let current = ""
      for (const word of words) {
        const next = current ? `${current} ${word}` : word
        if (ctx.measureText(next).width > 760) {
          if (current) lines.push(current)
          current = word
        } else current = next
      }
      if (current) lines.push(current)
      lines.slice(0, 2).forEach((line, index) => ctx.fillText(line, width / 2, 890 + index * 34))

      ctx.font = "16px Arial, sans-serif"
      ctx.fillStyle = "#FFCC00"
      ctx.fillText(scheduleLabel, width / 2, 980)
      ctx.font = "14px Arial, sans-serif"
      ctx.fillText("Valid for all training days on this schedule", width / 2, 1018)

      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `QR-Attendance-${(courseName || "training").replace(/[^a-z0-9]+/gi, "-")}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      await navigator.clipboard.writeText(url).catch(() => undefined)
      toast.success("Attendance QR downloaded", {
        description: "Same QR works for every day. Link also copied.",
      })
    } catch (error) {
      console.error(error)
      toast.error("Could not generate attendance QR.")
    } finally {
      setGeneratingQr(false)
    }
  }

  const downloadTemplate = () => {
    const sheetRows = rows.map((r) => {
      const base: Record<string, string> = {
        "Training ID": r.id,
        Email: r.email || "",
        "Last Name": r.last_name,
        "First Name": r.first_name,
      }
      if (trainingDayKeys.length > 0) {
        for (const dk of trainingDayKeys) {
          base[dk] = getAttendanceForDay(r.custom_data, dk)
        }
      } else {
        base.Attendance = getAttendanceFromCustomData(r.custom_data)
      }
      return base
    })
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

    const dayCols: { key: string; col: string }[] = []
    for (const dk of trainingDayKeys) {
      const orig = headerMap.get(normKey(dk))
      if (orig) dayCols.push({ key: dk, col: orig })
    }

    if (!cAtt && dayCols.length === 0) {
      toast.error("Missing attendance columns", {
        description:
          trainingDayKeys.length > 0
            ? `Add one column per training day (${trainingDayKeys.slice(0, 3).join(", ")}${trainingDayKeys.length > 3 ? ", …" : ""}) using yyyy-MM-dd headers, or a single Attendance column.`
            : "Add a column named Attendance, Status, or ems_attendance_status.",
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

      if (dayCols.length > 0 && trainingDayKeys.length > 0) {
        let rowUpdated = false
        let nextCustom = { ...(row.custom_data && typeof row.custom_data === "object" ? row.custom_data : {}) } as Record<string, unknown>
        for (const { key, col } of dayCols) {
          const statusRaw = String(rec[col] ?? "")
          const status = normalizeAttendanceInput(statusRaw)
          if (status === null || status === "unmarked") continue
          nextCustom = mergeAttendanceForDay(nextCustom, trainingDayKeys, key, status, "excel")
          rowUpdated = true
        }
        if (rowUpdated) {
          const { error } = await tmsDb.from("trainings").update({ custom_data: nextCustom }).eq("id", row.id)
          if (!error) {
            updated++
            setRows((prev) => prev.map((r) => (r.id === row!.id ? { ...r, custom_data: nextCustom } : r)))
          }
        }
        continue
      }

      if (!cAtt) continue
      const statusRaw = String(rec[cAtt] ?? "")
      const status = normalizeAttendanceInput(statusRaw)
      if (status === null || status === "unmarked") continue

      const custom_data =
        trainingDayKeys.length > 0
          ? mergeAttendanceAllDays(row.custom_data, trainingDayKeys, status, "excel")
          : mergeAttendanceIntoCustomData(row.custom_data, status, "excel")
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
      <div className="overflow-hidden rounded-2xl border border-[#FFCC00]/40 bg-gradient-to-br from-[#1A1D66] via-[#24286f] to-[#141654] text-white shadow-md">
        <div className="h-1.5 bg-[#FFCC00]" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="mb-1 -ml-2 gap-1 text-white/75 hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Schedules
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Attendance</h1>
              <Badge className="gap-1 border-0 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#FFCC00]">
                <UserCheck className="h-3 w-3" />
                Participants
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-white/80 md:text-base">
              <span className="font-semibold text-[#FFCC00]">{courseName || "Training"}</span>
              {" — "}
              mark attendance per training day, use quick actions, generate a QR for self check-in, or import Excel.
            </p>
            {attendanceUrl && (
              <div className="mt-3 flex max-w-2xl flex-col gap-2 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FFCC00]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#FFCC00]">Attendance link</p>
                    <a
                      href={attendanceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-white underline-offset-2 hover:underline"
                    >
                      {attendanceUrl}
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={() => void copyAttendanceLink()}
                  >
                    {copiedLink ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copiedLink ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
                    asChild
                  >
                    <a href={attendanceUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelImport}
            />
            <Button
              className="gap-2 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
              onClick={() => void downloadAttendanceQr()}
              disabled={generatingQr || loading}
            >
              {generatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Generate attendance QR
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={downloadTemplate}
              disabled={!rows.length}
            >
              <Download className="h-4 w-4" />
              Download template
            </Button>
          </div>
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
                {trainingDayKeys.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                      Attendance days ({trainingDayKeys.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {trainingDayKeys.map((dk) => (
                        <Badge key={dk} variant="secondary" className="font-normal">
                          {format(parseISO(dk), "EEE MMM d, yyyy")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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
                <CardDescription>
                  {trainingDayKeys.length > 0
                    ? "Counts are per participant per training day (session slots)."
                    : "Live counts from saved attendance flags (whole schedule)."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_BADGE.present}>{counts.present} present</Badge>
                <Badge className={STATUS_BADGE.absent}>{counts.absent} absent</Badge>
                <Badge className={STATUS_BADGE.late}>{counts.late} late</Badge>
                <Badge className={STATUS_BADGE.unmarked}>{counts.unmarked} unmarked</Badge>
                <Badge variant="outline">{counts.total} slots</Badge>
                <Badge variant="outline">{rows.length} participants</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Participants</CardTitle>
                  <CardDescription>
                    Select rows, then use Quick action to set{" "}
                    {trainingDayKeys.length > 0 ? "all training days at once for" : "attendance for"}{" "}
                    those participants only.
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
                      {trainingDayKeys.length > 0
                        ? "Present — all days (selected)"
                        : "Mark selected as present"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("absent")}
                    >
                      {trainingDayKeys.length > 0
                        ? "Absent — all days (selected)"
                        : "Mark selected as absent"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("late")}
                    >
                      {trainingDayKeys.length > 0
                        ? "Late — all days (selected)"
                        : "Mark selected as late"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => applyQuickActionToSelected("unmarked")}
                    >
                      {trainingDayKeys.length > 0
                        ? "Clear — all days (selected)"
                        : "Clear selected attendance"}
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
              <div className="max-h-[min(560px,70vh)] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="sticky left-0 z-10 w-10 bg-muted/95 pl-4 backdrop-blur-sm">
                        <Checkbox
                          className={attendanceCheckboxClassName}
                          checked={headerCheckboxChecked}
                          onCheckedChange={(c) => selectAllVisibleToggle(c === true)}
                          disabled={filteredRows.length === 0}
                          aria-label="Select all visible participants"
                        />
                      </TableHead>
                      <TableHead className="sticky left-10 z-10 min-w-[140px] bg-muted/95 backdrop-blur-sm">
                        Participant
                      </TableHead>
                      <TableHead className="hidden min-w-[160px] md:table-cell">Email</TableHead>
                      <TableHead className="hidden min-w-[120px] lg:table-cell">Company</TableHead>
                      <TableHead className="w-[88px] text-center">History</TableHead>
                      {trainingDayKeys.length > 0 ? (
                        trainingDayKeys.map((dk) => (
                          <TableHead
                            key={dk}
                            className="min-w-[104px] whitespace-nowrap px-1 text-center align-bottom text-xs font-semibold"
                            title={format(parseISO(dk), "EEEE, MMMM d, yyyy")}
                          >
                            <div className="text-muted-foreground">{format(parseISO(dk), "EEE")}</div>
                            <div>{format(parseISO(dk), "MMM d")}</div>
                          </TableHead>
                        ))
                      ) : (
                        <TableHead className="w-[160px]">Attendance</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5 + Math.max(trainingDayKeys.length, 1)}
                          className="text-muted-foreground py-12 text-center"
                        >
                          No participants registered for this schedule yet.
                        </TableCell>
                      </TableRow>
                    ) : filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5 + Math.max(trainingDayKeys.length, 1)}
                          className="text-muted-foreground py-12 text-center"
                        >
                          No participants match your search. Try a different name, email, or company.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((r) => {
                        const busy = savingIds.has(r.id)
                        return (
                          <TableRow key={r.id} className="group">
                            <TableCell className="sticky left-0 z-[1] bg-background pl-4 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                              <Checkbox
                                className={attendanceCheckboxClassName}
                                checked={selected.has(r.id)}
                                onCheckedChange={(c) => toggleSelect(r.id, !!c)}
                                aria-label={`Select ${r.first_name} ${r.last_name}`}
                              />
                            </TableCell>
                            <TableCell className="sticky left-10 z-[1] min-w-[140px] bg-background shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                              <div className="font-medium">
                                {r.last_name}, {r.first_name}
                              </div>
                              <div className="text-muted-foreground mt-0.5 font-mono text-[10px] md:hidden">
                                {r.email || "—"}
                              </div>
                              {trainingDayKeys.length === 0 ? (
                                (() => {
                                  const st = getAttendanceFromCustomData(r.custom_data)
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={cn("mt-1 text-[10px] md:hidden", STATUS_BADGE[st])}
                                    >
                                      {STATUS_LABEL[st]}
                                    </Badge>
                                  )
                                })()
                              ) : (
                                <p className="text-muted-foreground mt-1 text-[10px] md:hidden">
                                  Scroll → per day
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden max-w-[220px] truncate text-sm md:table-cell">
                              {r.email || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden max-w-[160px] truncate text-sm lg:table-cell">
                              {r.company_name || "—"}
                            </TableCell>
                            <TableCell className="p-1 text-center align-middle">
                              {(() => {
                                const log = getAttendanceLog(r.custom_data)
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1 px-2 text-xs"
                                        disabled={log.length === 0}
                                        title={log.length ? "View attendance history" : "No history yet"}
                                      >
                                        <History className="h-3.5 w-3.5" />
                                        {log.length || "—"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-80 p-0">
                                      <div className="border-b px-3 py-2">
                                        <p className="text-sm font-semibold">Attendance history</p>
                                        <p className="text-muted-foreground text-xs">
                                          {r.first_name} {r.last_name}
                                        </p>
                                      </div>
                                      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                                        {log.map((entry, index) => (
                                          <div
                                            key={`${entry.at}-${index}`}
                                            className="rounded-lg border bg-muted/30 px-2.5 py-2 text-xs"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <Badge
                                                variant="outline"
                                                className={cn("capitalize", STATUS_BADGE[entry.status])}
                                              >
                                                {STATUS_LABEL[entry.status]}
                                              </Badge>
                                              <span className="font-medium text-[#1A1D66] dark:text-[#FFCC00]">
                                                {entry.time}
                                              </span>
                                            </div>
                                            <p className="mt-1.5 text-muted-foreground">
                                              {entry.day
                                                ? format(parseISO(entry.day), "EEE, MMM d, yyyy")
                                                : "Whole schedule"}
                                              {" · "}
                                              {SOURCE_LABEL[entry.source] || entry.source}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                                              {format(new Date(entry.at), "MMM d, yyyy h:mm:ss a")}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )
                              })()}
                            </TableCell>
                            {trainingDayKeys.length > 0 ? (
                              trainingDayKeys.map((dk) => {
                                const stDay = getAttendanceForDay(r.custom_data, dk)
                                return (
                                  <TableCell key={dk} className="p-1 align-middle">
                                    <div className="flex items-center justify-center gap-0.5">
                                      {busy && (
                                        <Loader2 className="text-muted-foreground h-3 w-3 shrink-0 animate-spin" />
                                      )}
                                      <Select
                                        value={stDay}
                                        onValueChange={(v) =>
                                          persistAttendance(
                                            r.id,
                                            v as AttendanceStatusValue,
                                            "manual",
                                            dk
                                          )
                                        }
                                        disabled={busy}
                                      >
                                        <SelectTrigger
                                          className={attendanceStatusSelectTriggerClass(stDay, "compact")}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unmarked" className={STATUS_BADGE.unmarked}>
                                            —
                                          </SelectItem>
                                          <SelectItem value="present" className={STATUS_BADGE.present}>
                                            Present
                                          </SelectItem>
                                          <SelectItem value="absent" className={STATUS_BADGE.absent}>
                                            Absent
                                          </SelectItem>
                                          <SelectItem value="late" className={STATUS_BADGE.late}>
                                            Late
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </TableCell>
                                )
                              })
                            ) : (
                              <TableCell>
                                {(() => {
                                  const st = getAttendanceFromCustomData(r.custom_data)
                                  return (
                                    <div className="flex items-center gap-2">
                                      {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                                      <Select
                                        value={st}
                                        onValueChange={(v) =>
                                          persistAttendance(r.id, v as AttendanceStatusValue, "manual")
                                        }
                                        disabled={busy}
                                      >
                                        <SelectTrigger
                                          className={attendanceStatusSelectTriggerClass(st, "default")}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unmarked" className={STATUS_BADGE.unmarked}>
                                            Unmarked
                                          </SelectItem>
                                          <SelectItem value="present" className={STATUS_BADGE.present}>
                                            Present
                                          </SelectItem>
                                          <SelectItem value="absent" className={STATUS_BADGE.absent}>
                                            Absent
                                          </SelectItem>
                                          <SelectItem value="late" className={STATUS_BADGE.late}>
                                            Late
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )
                                })()}
                              </TableCell>
                            )}
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
